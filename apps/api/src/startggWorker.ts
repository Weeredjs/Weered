// start.gg announcements (tier 3).
//
// A lobby that follows a start.gg reference gets its feed written for it: the
// worker watches every configured lobby and posts when something actually
// changes — registration opens, registration is about to close, a tournament
// goes live, results land. That is the difference between a linked bracket and
// a lobby that looks alive without the TO doing any work, which is the whole
// pitch to an organiser who already has enough to do on event day.
//
// Reuses the route's cache (getPayload), so the worker costs no extra start.gg
// requests beyond what a viewer would already trigger.
//
// State lives in Lobby.moduleConfig.startgg.announced as
//   { "<tournamentId>": ["reg_open", "live", ...] }
// deliberately, rather than a new table: a Prisma migration against the
// production database is not worth it for a bag of flags, and the flags belong
// to the same config blob as the reference they describe.
import { log } from "./lib/logger";
import { PrismaClient } from "@prisma/client";
import { parseStartggRef, getPayload } from "./routes/startgg";

const prisma = new PrismaClient();

/** Posts are authored by The Operator, the platform's existing system account,
 *  so an announcement reads as the room talking rather than a stranger. */
const OPERATOR_ID = "cmohev1501cz3vl2uqbjp08d5";
const OPERATOR_NAME = "The Operator";

const CLOSING_SOON_MS = 48 * 60 * 60 * 1000;

type Kind = "reg_open" | "reg_closing" | "live" | "results";
type Announced = Record<string, string[]>;

const when = (ms: number | null) =>
  ms === null
    ? ""
    : new Intl.DateTimeFormat("en-CA", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(ms));

/** What, if anything, this tournament warrants saying right now. */
function due(t: any, now: number): Kind[] {
  const out: Kind[] = [];
  if (t.state === "COMPLETED") {
    const hasStandings = (t.events || []).some((e: any) => e.top?.length);
    if (hasStandings) out.push("results");
    return out;
  }
  if (t.live) out.push("live");
  if (t.isRegistrationOpen) {
    out.push("reg_open");
    if (t.registrationClosesAt && t.registrationClosesAt - now <= CLOSING_SOON_MS) {
      out.push("reg_closing");
    }
  }
  return out;
}

function compose(kind: Kind, t: any, sourceName: string): { title: string; body: string } | null {
  const link = t.url ? `\n\n${t.url}` : "";
  const where = t.where ? ` — ${t.where}` : "";
  switch (kind) {
    case "reg_open":
      return {
        title: `Registration is open: ${t.name}`,
        body:
          `${t.name} is taking entrants.\n\n` +
          `Starts ${when(t.startAt)}${where}.` +
          (t.registrationClosesAt ? `\nRegistration closes ${when(t.registrationClosesAt)}.` : "") +
          link,
      };
    case "reg_closing":
      return {
        title: `Last call: registration closes for ${t.name}`,
        body:
          `Registration for ${t.name} closes ${when(t.registrationClosesAt)}.\n\n` +
          `Starts ${when(t.startAt)}${where}.` +
          link,
      };
    case "live": {
      const streams = (t.streams || []).filter((s: any) => s.url);
      return {
        title: `${t.name} is live`,
        body:
          `${t.name} is under way${where ? ` at ${t.where}` : ""}.` +
          (t.numAttendees ? `\n\n${t.numAttendees} entrants.` : "") +
          (streams.length ? `\n\nStream: ${streams.map((s: any) => s.url).join(" ")}` : "") +
          link,
      };
    }
    case "results": {
      const lines: string[] = [];
      for (const e of t.events || []) {
        if (!e.top?.length) continue;
        lines.push(`${e.name}\n` + e.top.map((p: any) => `  ${p.place}. ${p.name}`).join("\n"));
      }
      if (!lines.length) return null;
      return {
        title: `Results: ${t.name}`,
        body: `${sourceName} wrapped ${t.name}.\n\n${lines.join("\n\n")}${link}`,
      };
    }
  }
}

async function announce(lobbyId: string, title: string, body: string): Promise<boolean> {
  try {
    await prisma.forumPost.create({
      data: {
        title: title.slice(0, 200),
        body: body.slice(0, 8000),
        category: "ANNOUNCEMENT" as any,
        authorId: OPERATOR_ID,
        authorName: OPERATOR_NAME,
        lobbyId,
        tags: ["start.gg"] as any,
      },
    });
    return true;
  } catch (e) {
    log.warn("startggWorker: post failed", lobbyId, String(e).slice(0, 160));
    return false;
  }
}

export async function runStartggWorker(): Promise<void> {
  if (!process.env.STARTGG_TOKEN) return;

  let lobbies: any[] = [];
  try {
    lobbies = await prisma.lobby.findMany({ select: { id: true, moduleConfig: true } });
  } catch (e) {
    log.warn("startggWorker: lobby read failed", String(e).slice(0, 160));
    return;
  }

  const now = Date.now();
  for (const lobby of lobbies) {
    const cfg: any = lobby.moduleConfig;
    const sg = cfg?.startgg;
    const ref = parseStartggRef(sg?.ref);
    if (!ref) continue;

    let payload: any = null;
    try {
      const got = await getPayload(ref);
      payload = got.payload;
    } catch {
      continue;
    }
    if (!payload) continue;

    const seen: Announced =
      sg.announced && typeof sg.announced === "object" ? { ...sg.announced } : {};
    const first = !sg.announced;
    const tournaments = [...(payload.upcoming || []), ...(payload.recent || [])];
    const liveIds = new Set(tournaments.map((t: any) => String(t.id)));

    let changed = false;
    for (const t of tournaments) {
      const id = String(t.id);
      const already = new Set(seen[id] || []);
      for (const kind of due(t, now)) {
        if (already.has(kind)) continue;
        // First pass after a reference is linked records the current state
        // WITHOUT posting. Otherwise linking a busy organiser dumps a dozen
        // backdated announcements into the feed, which is how you lose the TO
        // in the first five minutes.
        if (!first) {
          const msg = compose(kind, t, payload.source?.name || "The organiser");
          if (!msg) continue;
          const ok = await announce(lobby.id, msg.title, msg.body);
          if (!ok) continue;
          log.info(`startggWorker: ${lobby.id} announced ${kind} for ${t.name}`);
        }
        already.add(kind);
        changed = true;
      }
      seen[id] = Array.from(already);
    }

    // Forget tournaments start.gg no longer returns, so the blob stays small.
    for (const id of Object.keys(seen)) {
      if (!liveIds.has(id)) {
        delete seen[id];
        changed = true;
      }
    }

    if (!changed && !first) continue;
    try {
      await prisma.lobby.update({
        where: { id: lobby.id },
        data: { moduleConfig: { ...cfg, startgg: { ...sg, announced: seen } } as any },
      });
    } catch (e) {
      log.warn("startggWorker: config write failed", lobby.id, String(e).slice(0, 160));
    }
  }
}
