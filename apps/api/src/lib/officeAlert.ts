// The office rings James's phone (James 2026-11-16: "Can I get push
// notifications to my phone for knocks? ... As long as I am logged in one of
// my accounts on the phone it will ding for knocks").
//
// The office's alerts used to go to the host pass's account, eceb-host, which
// no phone is ever signed in as, so none ever arrived. They go to James's own
// accounts instead: the office hosts in OFFICE_HOST_USER_IDS and his main
// account, weered (or OFFICE_ALERT_USERNAMES). Every device signed in to any of
// them gets it, browser or app, whether or not Weered is open. One tag per
// visitor, so the same knock on two accounts on one phone shows once.
import { prisma } from "./prisma";
import { sendPush } from "./notifications";
import { swallow } from "./logger";

/** Tapping the alert opens the office as its host (a signed-in Weered session). */
export const OFFICE_HOST_URL = "https://weered.ca/api/office/host-pass";

let cache: { ids: string[]; at: number } | null = null;

async function alertIds(): Promise<string[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.ids;
  const env = String(process.env.OFFICE_HOST_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const names = String(process.env.OFFICE_ALERT_USERNAMES || "weered")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const named = await prisma.user
    .findMany({ where: { usernameKey: { in: names } }, select: { id: true } })
    .catch(() => []);
  const ids = [...new Set([...env, ...named.map((u) => u.id)])];
  cache = { ids, at: Date.now() };
  return ids;
}

// Once per visitor per kind for a while: a page that reconnects after a server
// restart rejoins, and must not ring James again.
const rung = new Map<string, number>();
const QUIET_MS = 3 * 3600_000;

export async function alertOffice(
  kind: "knock" | "walkin" | "note" | "booking",
  key: string,
  data: { title: string; body: string; url?: string },
): Promise<void> {
  try {
    const k = `${kind}:${key}`;
    const last = rung.get(k);
    if (last && Date.now() - last < QUIET_MS && kind !== "note") return;
    rung.set(k, Date.now());
    if (rung.size > 500) for (const [x, t] of rung) if (Date.now() - t > QUIET_MS) rung.delete(x);
    const ids = await alertIds();
    await Promise.all(
      ids.map((id) =>
        sendPush(id, {
          title: data.title,
          body: data.body,
          url: data.url || OFFICE_HOST_URL,
          tag: `office-${kind}-${key}`.slice(0, 60),
        }).catch(swallow),
      ),
    );
  } catch (e) {
    swallow(e);
  }
}
