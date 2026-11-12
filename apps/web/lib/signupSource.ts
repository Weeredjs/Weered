// Where a visitor came from, so the outreach can be measured (2026-11-04).
// The first visit a browser makes is kept 30 days (a later one doesn't
// replace it): the ?ref= on its link, the site that sent it (2026-11-12:
// most sign-ups carry no ?ref=, while Google, GitHub and Reddit send people
// in) and the page it landed on. Once the visitor has an account, it's
// reported once to api routes/signupSource.ts, which keeps it for a new
// account only. Ops shows it on Users.
const KEY = "weered:ref";
const SENT = "weered:ref-sent";
const KEEP_MS = 30 * 86400_000;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,39}$/;

type Held = { ref?: string; from?: string; landing?: string; at: number };

function held(now = Date.now()): Held | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && typeof v.at === "number" && now - v.at < KEEP_MS ? v : null;
  } catch {
    return null;
  }
}

/** The referring site as a bare host, "direct", or "" for one of our own. */
export function referrerHost(referrer: string, ownHost: string): string {
  if (!referrer) return "direct";
  try {
    const h = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    const own = ownHost.toLowerCase().replace(/^www\./, "");
    if (!h || h === own || h.endsWith(".weered.ca") || h === "weered.ca") return "";
    // Signing in with Google or Discord comes back from their pages: not a source.
    if (/^(accounts\.google\.com|discord\.com)$/.test(h)) return "";
    return h;
  } catch {
    return "";
  }
}

/** Keep this browser's first visit: its ?ref=, the site that sent it, its page. */
export function captureRef(
  search: string,
  now = Date.now(),
  from: { referrer?: string; host?: string; path?: string } = {},
): void {
  try {
    if (held(now)) return;
    const ref = (new URLSearchParams(search).get("ref") || "").trim().toLowerCase();
    // No referrer given at all is unknown; an empty one is a direct visit.
    const site = from.referrer === undefined ? "" : referrerHost(from.referrer, from.host ?? "");
    const path = String(from.path || "").slice(0, 120);
    // A visit that only bounced back from a sign-in page tells us nothing.
    if (!SLUG.test(ref) && !site) return;
    const v: Held = { at: now };
    if (SLUG.test(ref)) v.ref = ref;
    if (site) v.from = site;
    if (path.startsWith("/")) v.landing = path;
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

/** Signed in: tell the account where it came from, once per account. */
export async function reportRef(api: string, userId: string): Promise<void> {
  const h = held();
  if (!h || !userId || (!h.ref && !h.from && !h.landing)) return;
  try {
    const sent: string[] = JSON.parse(localStorage.getItem(SENT) || "[]");
    if (Array.isArray(sent) && sent.includes(userId)) return;
    const r = await fetch(`${api}/profile/source`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: h.ref, from: h.from, landing: h.landing }),
    });
    if (r.ok)
      localStorage.setItem(
        SENT,
        JSON.stringify([...(Array.isArray(sent) ? sent : []), userId].slice(-10)),
      );
  } catch {}
}
