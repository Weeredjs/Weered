// Is this host the domain itself, or a name under it?
//
// A plain endsWith or includes says "evilyoutube.com" is youtube.com and
// "reddit.com.example.net" is Reddit. Every check of where a link points goes
// through here (hardening pass 2026-11-12: nine places had the loose form).

export function isHostOf(host: string, domain: string): boolean {
  const h = String(host || "").toLowerCase();
  const d = domain.toLowerCase();
  return h === d || h.endsWith("." + d);
}

/** The same question for a whole address; false when it isn't one. */
export function isUrlOf(url: string, domain: string): boolean {
  try {
    return isHostOf(new URL(url).hostname, domain);
  } catch {
    return false;
  }
}
