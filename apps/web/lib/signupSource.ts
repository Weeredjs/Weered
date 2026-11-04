// Where a visitor came from, so the outreach can be measured (2026-11-04).
// The first ?ref= a browser arrives with is kept 30 days (a later one doesn't
// replace it); once the visitor has an account, it's reported once to
// api routes/signupSource.ts, which keeps it for a new account only. Ops shows
// it on Users.
const KEY = "weered:ref";
const SENT = "weered:ref-sent";
const KEEP_MS = 30 * 86400_000;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,39}$/;

type Held = { ref: string; at: number };

function held(now = Date.now()): Held | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && typeof v.ref === "string" && typeof v.at === "number" && now - v.at < KEEP_MS
      ? v
      : null;
  } catch {
    return null;
  }
}

/** Keep the first ?ref= this browser arrives with. */
export function captureRef(search: string, now = Date.now()): void {
  try {
    const ref = (new URLSearchParams(search).get("ref") || "").trim().toLowerCase();
    if (!SLUG.test(ref) || held(now)) return;
    localStorage.setItem(KEY, JSON.stringify({ ref, at: now }));
  } catch {}
}

/** Signed in: tell the account where it came from, once per account. */
export async function reportRef(api: string, userId: string): Promise<void> {
  const h = held();
  if (!h || !userId) return;
  try {
    const sent: string[] = JSON.parse(localStorage.getItem(SENT) || "[]");
    if (Array.isArray(sent) && sent.includes(userId)) return;
    const r = await fetch(`${api}/profile/source`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: h.ref }),
    });
    if (r.ok)
      localStorage.setItem(
        SENT,
        JSON.stringify([...(Array.isArray(sent) ? sent : []), userId].slice(-10)),
      );
  } catch {}
}
