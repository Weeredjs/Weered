import { prisma } from "./prisma";
import { log, swallow } from "./logger";
import { rooms } from "./roomState";
import { fetchSafe } from "./ssrfGuard";
import { decodeEntities, stripTags } from "./htmlText";
import { elementBlocks, findTags, firstInner, readCapped, tagAttrs } from "./htmlScan";
import { getTwitchAppToken } from "./presence";
import { createNotification } from "./notifications";
import { WEERED_AUTHOR, hostAuthor, postToLobbyChat } from "./lobbyPost";
import {
  cleanHost,
  cleanPost,
  type AlertSpec,
  type FeedSpec,
  type PostSpec,
} from "./build/jobs/people";

// A lobby's automations (James 2026-10-31, "Do everything"), run every minute
// from index.ts:
//   post  — a scheduled message in the lobby's chat ("every Tuesday, post the
//           reset and ping the raid team"), from its host or from Weered.
//   alert — a member's ping when enough people are in a room ("ping me when
//           four are in the War Room"). Once per crossing, 30 minutes apart.
//   feed  — another site posting into the chat: a YouTube channel's uploads,
//           a Twitch channel going live, any RSS or Atom feed. The first look
//           only records what's there, so hooking one up never floods the chat.

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** What a clock in `tz` reads at `utcMs`. */
function wallClock(tz: string, utcMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  return {
    y: n("year"),
    m: n("month"),
    d: n("day"),
    hh: n("hour") % 24,
    mi: n("minute"),
    s: n("second"),
  };
}

/** The instant a clock in `tz` reads y-m-d hh:mi (the later reading in a DST
 *  overlap; a time skipped by a spring-forward lands just after the gap). */
export function zonedToUtc(
  tz: string,
  y: number,
  m: number,
  d: number,
  hh: number,
  mi: number,
): number {
  const want = Date.UTC(y, m - 1, d, hh, mi);
  let guess = want;
  for (let i = 0; i < 3; i++) {
    const w = wallClock(tz, guess);
    const seen = Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mi);
    if (seen === want) return guess;
    guess += want - seen;
  }
  return guess;
}

/** A scheduled post's next run after `after`, or null when it's done. */
export function nextRunOf(spec: PostSpec, after: number): Date | null {
  const [hh, mi] = spec.time.split(":").map(Number);
  if (spec.cadence === "once") {
    if (!spec.date) return null;
    const [y, m, d] = spec.date.split("-").map(Number);
    const at = zonedToUtc(spec.tz, y, m, d, hh, mi);
    return at > after ? new Date(at) : null;
  }
  const today = wallClock(spec.tz, after);
  for (let i = 0; i < 9; i++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const key = DAY_KEYS[day.getUTCDay()];
    if (spec.cadence === "weekly" && !spec.days.includes(key as any)) continue;
    const at = zonedToUtc(
      spec.tz,
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      hh,
      mi,
    );
    if (at > after) return new Date(at);
  }
  return null;
}

async function lobbyVoice(lobbyId: string) {
  const lobby = await prisma.lobby
    .findUnique({ where: { id: lobbyId }, select: { name: true, hostConfig: true } as any })
    .catch(() => null);
  if (!lobby) return null;
  const host = (lobby as any).hostConfig ? cleanHost((lobby as any).hostConfig) : null;
  return {
    name: String((lobby as any).name || lobbyId),
    author: host?.on ? hostAuthor(lobbyId, host) : WEERED_AUTHOR,
  };
}

// ── Scheduled posts ─────────────────────────────────────────────────────────

/** A post more than this late (the server was down) is skipped, not sent. */
const LATE_MS = 30 * 60_000;

async function runPosts(now: number) {
  const due = await prisma.lobbyAutomation.findMany({
    where: { kind: "post", active: true, nextRunAt: { lte: new Date(now) } },
    take: 50,
  });
  for (const a of due) {
    const spec = cleanPost(a.spec, "UTC");
    const next = nextRunOf(spec, now);
    const late = now - (a.nextRunAt?.getTime() || now) > LATE_MS;
    let result = late ? "missed (the server was down)" : "posted";
    if (!late) {
      try {
        const voice = await lobbyVoice(a.lobbyId);
        if (!voice) continue;
        await postToLobbyChat(a.lobbyId, voice.author, spec.message);
        if (spec.pingLevel > 0) {
          const members = await prisma.lobbyMember.findMany({
            where: { lobbyId: a.lobbyId, roleLevel: { gte: spec.pingLevel } },
            select: { userId: true },
            take: 300,
          });
          for (const m of members)
            void createNotification({
              userId: m.userId,
              type: "SYSTEM",
              title: voice.name,
              body: spec.message.slice(0, 140),
              actionUrl: `/lobby/${encodeURIComponent(a.lobbyId)}`,
              meta: { automationId: a.id },
            });
          result = `posted, pinged ${members.length}`;
        }
      } catch (e: any) {
        result = `failed: ${String(e?.message || e).slice(0, 80)}`;
      }
    }
    await prisma.lobbyAutomation
      .update({
        where: { id: a.id },
        data: {
          lastRunAt: new Date(now),
          lastResult: result,
          nextRunAt: next,
          active: next !== null,
        },
      })
      .catch(swallow);
  }
}

// ── Alerts ──────────────────────────────────────────────────────────────────

const ALERT_GAP_MS = 30 * 60_000;

async function runAlerts(now: number) {
  const alerts = await prisma.lobbyAutomation.findMany({
    where: { kind: "alert", active: true },
    take: 5000,
  });
  for (const a of alerts) {
    const spec = a.spec as unknown as AlertSpec;
    const room = rooms.get(String(spec?.roomId || ""));
    const count = room ? room.users.size : 0;
    const state = (a.state as any) || {};
    const over = count >= (Number(spec?.threshold) || 4);
    if (over === !!state.over) continue;
    const ping = over && now - (Number(state.lastPingAt) || 0) > ALERT_GAP_MS;
    // Someone already in the room doesn't need telling.
    const there = !!room?.users.has(a.createdById);
    if (ping && !there) {
      const link =
        spec.roomId === a.lobbyId
          ? `/lobby/${encodeURIComponent(a.lobbyId)}`
          : `/room/${encodeURIComponent(spec.roomId)}`;
      void createNotification({
        userId: a.createdById,
        type: "SYSTEM",
        title: `${count} in ${spec.roomName}`,
        body: `${count === 1 ? "1 person is" : `${count} people are`} in ${spec.roomName} now.`,
        actionUrl: link,
        meta: { automationId: a.id },
      });
    }
    await prisma.lobbyAutomation
      .update({
        where: { id: a.id },
        data: {
          state: { over, lastPingAt: ping && !there ? now : state.lastPingAt || 0 },
          ...(ping && !there ? { lastRunAt: new Date(now), lastResult: `pinged at ${count}` } : {}),
        },
      })
      .catch(swallow);
  }
}

// ── Feeds ───────────────────────────────────────────────────────────────────

type FeedItem = { id: string; title: string; link: string; name: string };

const UA = {
  "User-Agent": "Mozilla/5.0 (compatible; WeeredBot/1.0; +https://weered.ca)",
  Accept: "*/*",
};
const text = (s: string | undefined) =>
  decodeEntities(stripTags(String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"))).trim();

/** RSS 2.0 items and Atom entries, newest first as the feed lists them. */
export function parseFeed(xml: string): FeedItem[] {
  // lib/htmlScan.ts: one pass over the feed, whatever a stranger's server sent.
  // The patterns this replaced rescanned to the end from every unclosed tag,
  // so a feed of "<title>" with no close held the API for minutes per check
  // (fan-out audit, 2026-11-13).
  const out: FeedItem[] = [];
  const channel = text(firstInner(xml, "title", 400));
  for (const b of elementBlocks(xml, ["item", "entry"], { limit: 30 })) {
    const title = text(firstInner(b, "title", 1000));
    const links = findTags(b, "link", { limit: 20 }).map(tagAttrs);
    const link =
      links.find((a) => (a.rel || "").toLowerCase() === "alternate" && a.href)?.href ||
      links.find((a) => a.href)?.href ||
      text(firstInner(b, "link", 2000));
    const id = text(firstInner(b, "guid", 400) ?? firstInner(b, "id", 400)) || link;
    const author = text(firstInner(firstInner(b, "author", 2000) || "", "name", 200));
    if (!id || !/^https?:\/\//i.test(link || "")) continue;
    out.push({
      id: id.slice(0, 300),
      title: title.slice(0, 200) || "New post",
      link: decodeEntities(link),
      name: author || channel,
    });
  }
  return out;
}

async function youtubeFeedUrl(target: string, state: any): Promise<string> {
  if (state.channelId)
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${state.channelId}`;
  const direct = /youtube\.com\/channel\/(UC[\w-]{22})/i.exec(target)?.[1];
  let channelId = direct || "";
  if (!channelId) {
    const page = target.startsWith("@") ? `https://www.youtube.com/${target}` : target;
    const res = await fetchSafe(page, { headers: { ...UA, "Accept-Language": "en" } }, 8000);
    const html = await readCapped(res, 2_000_000);
    channelId =
      /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/.exec(
        html,
      )?.[1] ||
      /"channelId":"(UC[\w-]{22})"/.exec(html)?.[1] ||
      "";
  }
  if (!channelId) throw new Error("couldn't find that YouTube channel");
  state.channelId = channelId;
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

async function twitchLive(
  logins: string[],
): Promise<Map<string, { title: string; name: string }> | null> {
  const id = process.env.TWITCH_CLIENT_ID;
  const token = await getTwitchAppToken();
  if (!id || !token || !logins.length) return null;
  const qs = logins.map((l) => `user_login=${encodeURIComponent(l)}`).join("&");
  const res = await fetch(`https://api.twitch.tv/helix/streams?${qs}&first=100`, {
    headers: { "Client-ID": id, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const j: any = await res.json();
  const live = new Map<string, { title: string; name: string }>();
  for (const s of j?.data || [])
    live.set(String(s.user_login || "").toLowerCase(), {
      title: String(s.title || "").slice(0, 200),
      name: String(s.user_name || s.user_login || ""),
    });
  return live;
}

const fill = (tpl: string, it: { title: string; link: string; name: string }) =>
  tpl
    .replaceAll("{title}", it.title)
    .replaceAll("{link}", it.link)
    .replaceAll("{name}", it.name)
    .slice(0, 600);

const FEED_EVERY_MS = { youtube: 10 * 60_000, rss: 10 * 60_000, twitch: 2 * 60_000 } as const;

async function runFeeds(now: number) {
  const due = await prisma.lobbyAutomation.findMany({
    where: { kind: "feed", active: true, nextRunAt: { lte: new Date(now) } },
    take: 100,
  });
  if (!due.length) return;
  const twitch = due.filter((a) => (a.spec as any)?.source === "twitch");
  const live = twitch.length
    ? await twitchLive(
        Array.from(new Set(twitch.map((a) => String((a.spec as any).target)))),
      ).catch(() => null)
    : null;
  for (const a of due) {
    const spec = a.spec as unknown as FeedSpec;
    const state: any = { ...((a.state as any) || {}) };
    let result = "checked";
    let wait: number = FEED_EVERY_MS[spec.source] || 10 * 60_000;
    try {
      if (spec.source === "twitch") {
        if (!live) throw new Error("Twitch didn't answer");
        const on = live.get(spec.target.toLowerCase());
        if (on && !state.live && state.primed) {
          const voice = await lobbyVoice(a.lobbyId);
          if (voice)
            await postToLobbyChat(
              a.lobbyId,
              voice.author,
              fill(spec.message, {
                title: on.title,
                link: `https://twitch.tv/${spec.target}`,
                name: on.name || spec.target,
              }),
            );
          result = "posted: went live";
        }
        state.live = !!on;
      } else {
        const url =
          spec.source === "youtube" ? await youtubeFeedUrl(spec.target, state) : spec.target;
        const res = await fetchSafe(url, { headers: UA }, 8000);
        if (!res.ok) throw new Error(`the feed answered ${res.status}`);
        // Read at most 1 MB, and stop there: a compressed body can unpack to
        // gigabytes, and the whole of it used to be read before the cut.
        const items = parseFeed(await readCapped(res, 1_000_000));
        const seen = new Set<string>(Array.isArray(state.seen) ? state.seen : []);
        const fresh = state.primed
          ? items
              .filter((it) => !seen.has(it.id))
              .slice(0, 3)
              .reverse()
          : [];
        if (fresh.length) {
          const voice = await lobbyVoice(a.lobbyId);
          if (voice)
            for (const it of fresh)
              await postToLobbyChat(a.lobbyId, voice.author, fill(spec.message, it));
          result = `posted ${fresh.length}`;
        }
        state.seen = Array.from(new Set([...items.map((it) => it.id), ...seen])).slice(0, 80);
      }
      state.primed = true;
      state.fails = 0;
    } catch (e: any) {
      state.fails = (Number(state.fails) || 0) + 1;
      wait = Math.min(6 * 60 * 60_000, 15 * 60_000 * 2 ** Math.min(4, state.fails - 1));
      result = `couldn't check: ${String(e?.message || e).slice(0, 80)}`;
    }
    await prisma.lobbyAutomation
      .update({
        where: { id: a.id },
        data: {
          state,
          lastRunAt: new Date(now),
          lastResult: result,
          nextRunAt: new Date(now + wait),
        },
      })
      .catch(swallow);
  }
}

let busy = false;

export async function runLobbyAutomations() {
  if (busy) return;
  busy = true;
  const now = Date.now();
  try {
    await runPosts(now).catch((e) => log.error("[automations] posts", e));
    await runAlerts(now).catch((e) => log.error("[automations] alerts", e));
    await runFeeds(now).catch((e) => log.error("[automations] feeds", e));
  } finally {
    busy = false;
  }
}
