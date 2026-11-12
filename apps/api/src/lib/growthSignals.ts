import { prisma } from "./prisma";
import { sendMail } from "./email";
import { createNotification, sendPush } from "./notifications";
import { log, swallow } from "./logger";
import { LISTING_MEMBERS } from "./listingHold";

// The two moments that decide whether a new lobby lives (2026-11-12, James:
// "Not a traffic or product problem. It is exposure"). Two strangers built
// lobbies that week and nobody was told: not James, and nobody they knew.
//
// 1. Someone outside staff builds a lobby: James hears at once, with who they
//    are and where they came from, so he can write to them the same day.
// 2. Someone walks into a lobby: its owner hears, so the first person in turns
//    into the second and third (three, and Downtown lists it: lib/listingHold).

const BUILDER_NOTIFY_TO =
  process.env.BUILDER_NOTIFY_TO || process.env.CONTACT_NOTIFY_TO || "james@weered.ca";
const WEB = process.env.WEB_URL || "https://weered.ca";
/** Owners hear about each join until a lobby has this many members. */
const TELL_OWNER_UNTIL = 10;

const esc = (s: string) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Where an account came from, in a few words (or ""). */
export function cameFrom(u: {
  signupSource?: string | null;
  signupFrom?: string | null;
  signupLanding?: string | null;
}): string {
  const parts: string[] = [];
  if (u.signupSource) parts.push(`?ref=${u.signupSource}`);
  if (u.signupFrom) parts.push(`from ${u.signupFrom}`);
  if (u.signupLanding) parts.push(`landed on ${u.signupLanding}`);
  return parts.join(", ");
}

/** A lobby built by someone outside staff: tell James, with a way to reach them. */
export async function alertNewBuilder(lobby: {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
}): Promise<boolean> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: lobby.ownerId },
      select: {
        name: true,
        usernameKey: true,
        email: true,
        createdAt: true,
        signupSource: true,
        signupFrom: true,
        signupLanding: true,
      },
    });
    if (!u) return false;
    const link = `${WEB}/lobby/${encodeURIComponent(lobby.id)}`;
    const ageMin = Math.max(0, Math.round((Date.now() - u.createdAt.getTime()) / 60000));
    const age =
      ageMin < 120
        ? `${ageMin} minutes after signing up`
        : `account made ${u.createdAt.toISOString().slice(0, 10)}`;
    const from = cameFrom(u);
    const who = `${u.name || u.usernameKey}${u.usernameKey && u.usernameKey !== u.name ? ` (@${u.usernameKey})` : ""}`;
    const lines = [
      `${who} just built ${lobby.name}: ${link}`,
      lobby.description ? `"${String(lobby.description).slice(0, 300)}"` : "",
      `${age}${from ? `; ${from}` : ""}.`,
      u.email
        ? `Their email: ${u.email} (reply to this to write to them).`
        : "No email on the account.",
    ].filter(Boolean);
    const sent = await sendMail({
      to: BUILDER_NOTIFY_TO,
      ...(u.email ? { replyTo: u.email } : {}),
      subject: `[weered.ca] new lobby: ${lobby.name} by ${u.name || u.usernameKey}`,
      html: lines.map((l) => `<p>${esc(l)}</p>`).join(""),
      text: lines.join("\n\n"),
    });
    return !!sent?.ok;
  } catch (e: any) {
    log.warn("[builder alert]", e?.message || e);
    return false;
  }
}

/** Someone joined a lobby: its owner hears, until it has a crowd. */
export async function tellOwnerOfJoin(opts: {
  lobbyId: string;
  joinerId: string;
  joinerName: string;
}): Promise<boolean> {
  try {
    const lobby = await prisma.lobby.findUnique({
      where: { id: opts.lobbyId },
      select: { id: true, name: true, ownerId: true, listingHeld: true },
    });
    if (!lobby?.ownerId || lobby.ownerId === opts.joinerId) return false;
    const members = await prisma.lobbyMember.count({
      where: { lobbyId: lobby.id, NOT: { userId: lobby.ownerId } },
    });
    if (members < 1 || members > TELL_OWNER_UNTIL) return false;
    const name = lobby.name || lobby.id;
    const title = `${opts.joinerName || "Someone"} joined ${name}`;
    const body =
      lobby.listingHeld && members >= LISTING_MEMBERS
        ? `That's ${members}: ${name} shows in Downtown within ten minutes.`
        : lobby.listingHeld
          ? `${members} in. At ${LISTING_MEMBERS}, Downtown lists it. Say hi.`
          : "Say hi.";
    const url = `/lobby/${encodeURIComponent(lobby.id)}`;
    await createNotification({
      userId: lobby.ownerId,
      type: "SYSTEM",
      title,
      body,
      actionUrl: url,
      actorId: opts.joinerId,
      actorName: opts.joinerName,
    }).catch(swallow);
    await sendPush(lobby.ownerId, { title, body, url, tag: `join-${lobby.id}` }).catch(swallow);
    return true;
  } catch (e: any) {
    log.warn("[join ping]", e?.message || e);
    return false;
  }
}
