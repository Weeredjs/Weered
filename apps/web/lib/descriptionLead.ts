// The opening of a lobby's description, for its header: whole sentences up to
// about 200 characters. The game lobbies carry long write-ups (1,300 to 1,800
// characters) whose later sentences read like our own notes ("Weered's LFG is
// built for the Riot ecosystem's actual gaps…"), and the header's two lines
// cut into them (James's walkthrough 2026-11-09). The full text still serves
// search engines and the lobby's About.
export function descriptionLead(text: string | null | undefined, max = 200): string {
  const t = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  const sentences = t.match(/[^.!?]+[.!?]+(\s|$)/g) || [];
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  out = out.trim();
  if (out) return out;
  // One long first sentence: cut at a word.
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).replace(/[,;:\s]+$/, "") + "…";
}
