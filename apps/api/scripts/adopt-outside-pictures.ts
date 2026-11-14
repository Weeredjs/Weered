// One-time: copy every picture still linked from another site onto Weered
// (James 2026-11-13: "Anything we are linking you might as well migrate").
// New links are copied in as they are saved (lib/adoptPicture.ts); this moves
// the ones saved before that.
//
// Run from apps/api (pictures land in its uploads/, where the API serves them):
//   npx tsx scripts/adopt-outside-pictures.ts            list what would move
//   npx tsx scripts/adopt-outside-pictures.ts --apply    copy and repoint
//
// --apply first writes every old address to --backup <file> (default
// ./adopt-pictures-backup.json) so any row can be put back. Each row is written
// only if it still holds the address that was copied. A picture the screen
// refuses is taken off; one that can't be fetched is left as it is and listed.
//
// News and mod thumbnails are NOT moved: they come from publishers' feeds, and
// copying their photos here would be republishing them.
import dotenv from "dotenv";
import { writeFileSync } from "fs";

dotenv.config({ override: true });

const apply = process.argv.includes("--apply");
const bi = process.argv.indexOf("--backup");
const backupPath = bi > 0 ? process.argv[bi + 1] : "./adopt-pictures-backup.json";

// Not anyone's own act: a blocked picture must not media-ban the owner, and
// an owner's media ban must not keep their old logo on another site.
const UPLOADER = "system-picture-migration";

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { adoptPicture, isOutsidePicture, pictureName, pictureSize } =
    await import("../src/lib/adoptPicture");

  type Job = {
    table: "lobby" | "room" | "user" | "flairItem";
    id: string;
    field: string;
    url: string;
    opts: Parameters<typeof adoptPicture>[1];
  };
  const jobs: Job[] = [];

  const lobbies = await prisma.lobby.findMany({
    select: { id: true, logoUrl: true, bannerUrl: true },
  });
  for (const l of lobbies) {
    if (isOutsidePicture(l.logoUrl))
      jobs.push({
        table: "lobby",
        id: l.id,
        field: "logoUrl",
        url: l.logoUrl,
        opts: {
          kind: "banners",
          name: pictureName.lobby(l.id, "logo"),
          uploaderId: UPLOADER,
          ...pictureSize.logo,
        },
      });
    if (isOutsidePicture(l.bannerUrl))
      jobs.push({
        table: "lobby",
        id: l.id,
        field: "bannerUrl",
        url: l.bannerUrl,
        opts: {
          kind: "banners",
          name: pictureName.lobby(l.id, "banner"),
          uploaderId: UPLOADER,
          ...pictureSize.banner,
        },
      });
  }
  const rooms = await prisma.room.findMany({
    select: { id: true, iconUrl: true, bannerUrl: true },
  });
  for (const r of rooms) {
    if (isOutsidePicture(r.iconUrl))
      jobs.push({
        table: "room",
        id: r.id,
        field: "iconUrl",
        url: r.iconUrl,
        opts: {
          kind: "banners",
          name: pictureName.room(r.id, "icon"),
          uploaderId: UPLOADER,
          ...pictureSize.icon,
        },
      });
    if (isOutsidePicture(r.bannerUrl))
      jobs.push({
        table: "room",
        id: r.id,
        field: "bannerUrl",
        url: r.bannerUrl,
        opts: {
          kind: "banners",
          name: pictureName.room(r.id, "banner"),
          uploaderId: UPLOADER,
          ...pictureSize.banner,
        },
      });
  }
  const users = await prisma.user.findMany({
    where: { avatar: { startsWith: "http" } },
    select: { id: true, avatar: true },
  });
  for (const u of users)
    if (isOutsidePicture(u.avatar) && /^[A-Za-z0-9_-]{1,64}$/.test(u.id))
      jobs.push({
        table: "user",
        id: u.id,
        field: "avatar",
        url: u.avatar,
        opts: { kind: "avatars", name: u.id, uploaderId: UPLOADER, ...pictureSize.avatar },
      });
  const flair = await prisma.flairItem.findMany({ select: { id: true, imageUrl: true } });
  for (const f of flair)
    if (isOutsidePicture(f.imageUrl))
      jobs.push({
        table: "flairItem",
        id: f.id,
        field: "imageUrl",
        url: f.imageUrl,
        opts: {
          kind: "banners",
          name: pictureName.flair(f.id),
          uploaderId: UPLOADER,
          ...pictureSize.icon,
        },
      });

  const byTable: Record<string, number> = {};
  for (const j of jobs)
    byTable[`${j.table}.${j.field}`] = (byTable[`${j.table}.${j.field}`] || 0) + 1;
  console.log(`${jobs.length} outside pictures`, byTable);
  if (!apply) {
    for (const j of jobs)
      console.log(`  ${j.table}.${j.field} ${j.id}  ${new URL(j.url).hostname}`);
    console.log("Dry run. Add --apply to copy and repoint.");
    return;
  }

  writeFileSync(
    backupPath,
    JSON.stringify(
      jobs.map(({ table, id, field, url }) => ({ table, id, field, url })),
      null,
      1,
    ),
  );
  console.log(`old addresses saved to ${backupPath}`);

  const tally = { copied: 0, refused: 0, unreachable: 0, changed: 0 };
  const left: string[] = [];
  for (const j of jobs) {
    const host = new URL(j.url).hostname;
    let got;
    try {
      got = await adoptPicture(j.url, j.opts);
    } catch (e: any) {
      got = { ok: false as const, error: "error", message: String(e?.message || e), code: 500 };
    }
    const where: any = { id: j.id, [j.field]: j.url };
    if (got.ok && got.url) {
      const n = await (prisma as any)[j.table].updateMany({ where, data: { [j.field]: got.url } });
      if (n.count) tally.copied++;
      else tally.changed++;
      console.log(`  copied   ${j.table}.${j.field} ${j.id}  ${host}`);
    } else if (!got.ok && (got.error === "failed_screen" || got.error === "blocked_content")) {
      await (prisma as any)[j.table].updateMany({ where, data: { [j.field]: null } });
      tally.refused++;
      left.push(`REFUSED by screen: ${j.table}.${j.field} ${j.id} ${host}`);
      console.log(`  refused  ${j.table}.${j.field} ${j.id}  ${host}`);
    } else {
      tally.unreachable++;
      left.push(
        `left as link (${got.ok ? "?" : got.error}): ${j.table}.${j.field} ${j.id} ${host}`,
      );
      console.log(`  left     ${j.table}.${j.field} ${j.id}  ${host}  ${got.ok ? "" : got.error}`);
    }
  }
  console.log("done", tally);
  if (left.length) console.log(left.join("\n"));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
