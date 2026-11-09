// The staff role as this device last knew it, until /staff/me answers: a
// refresh hid Ops from staff for a few seconds (James's walkthrough
// 2026-11-09). Only the link waits on it; /staff checks the role itself.
const KEY = "weered:role";

export function rememberedRole(fromUser?: unknown): string {
  try {
    return String(fromUser || localStorage.getItem(KEY) || "");
  } catch {
    return String(fromUser || "");
  }
}

/** Keep what /staff/me said: a role, or none (which forgets it). */
export function rememberRole(answer: any) {
  try {
    if (answer?.globalRole) localStorage.setItem(KEY, String(answer.globalRole));
    else if (answer) localStorage.removeItem(KEY);
  } catch {}
}
