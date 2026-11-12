// What shared links unfold into (2026-11-12): the words for an invite link
// (app/invite/[token]/layout.tsx) and the name's size on a lobby's card
// (app/og/lobby/[id]/route.tsx). Here, not there: a route or layout file may
// export only what Next expects of it.

export type Invite = {
  type?: string;
  targetId?: string | null;
  targetName?: string;
  creatorName?: string;
};

/** The words for an invite. Exported for its test. */
export function inviteCard(inv: Invite | null): {
  title: string;
  description: string;
  lobbyId: string;
} {
  const plain = {
    title: "You're invited · Weered",
    description: "Voice, video and chat in the browser. No download.",
    lobbyId: "",
  };
  if (!inv) return plain;
  const target = String(inv.targetId || "");
  // The office's own links are its business, not Weered's to describe.
  if (/^mtg-/.test(target)) return plain;
  const where = String(inv.targetName || "").trim();
  const who = String(inv.creatorName || "").trim();
  const by = who && who !== "unknown" ? `${who} invited you. ` : "";
  if (inv.type === "GUEST" && where)
    return {
      title: `Come into ${where}`,
      description: `${by}Walk in with just a name: no account, no download.`,
      lobbyId: target,
    };
  if (inv.type === "LOBBY" && where)
    return {
      title: `Join ${where} on Weered`,
      description: `${by}Voice, video and chat in the browser. No download.`,
      lobbyId: target,
    };
  if ((inv.type === "ROOM" || inv.type === "CREW") && where)
    return { ...plain, title: `Join ${where} on Weered`, description: `${by}${plain.description}` };
  return plain;
}

/** A size the name fits at: long names step down rather than run off the card. */
export function nameSize(name: string): number {
  const n = name.length;
  return n <= 14 ? 104 : n <= 22 ? 86 : n <= 32 ? 68 : 54;
}
