// The text of /llms.txt (app/llms.txt/route.ts). Plan facts come from
// app/premium/PremiumContent.tsx; keep them in step.

const SITE = "https://weered.ca";
const SKIP = new Set(["lobby", "weered.ca", "path-of-exile", "hq"]);

export type Lobby = { id?: string; name?: string; description?: string | null };

export function firstSentence(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const cut = flat.match(/^.{20,}?[.!?](\s|$)/);
  const s = cut ? cut[0].trim() : flat;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export function lobbyLines(lobbies: Lobby[]): string[] {
  return lobbies
    .filter((l) => l?.id && l.name && !SKIP.has(l.id) && !l.id.startsWith("r/"))
    .map((l) => {
      const url = `${SITE}/lobby/${encodeURIComponent(l.id!)}`;
      const about = l.description ? `: ${firstSentence(l.description)}` : "";
      return `- [${l.name}](${url})${about}`;
    });
}

export function llmsText(lobbies: Lobby[]): string {
  const lines = lobbyLines(lobbies);
  return `# Weered

> Weered (weered.ca) is a free community platform that runs in the browser: voice, video, screen share and chat, in lobbies made of rooms. Think of it as making your Discord into anything you want, except the servers aren't islands. Every lobby sits in one shared town: one account, one search, one friends list, the Town Square where everyone on Weered talks (each name tagged with the lobby they're from), and Downtown, where anyone can walk from one community into the next.

## What you can do
- Describe it: type a sentence ("a cozy book club with a reading room") and Weered builds the lobby, with its rooms, its look and its blocks. Free accounts get 10 AI builds a day.
- Up to three lobbies of your own, free. A free lobby shows in Downtown once three people have joined.
- No download needed. It works in any browser, phones included; people join from a link. A desktop app is at ${SITE}/desktop.
- Rooms have voice, video, screen share and chat. Lobbies can carry live blocks: game stats, player counts, streams, tournaments, scores.
- Your own place, plus crews, profiles and a forum shared by everyone.
- Your own address on paid plans: yourname.weered.ca, yourlobby.weered.ca, or a domain of your own.

## Who it's for
Gaming groups and clans, clubs, classes and study groups, hobby communities, small teams. Anything people gather around.

## Plans
- Innocent, free: up to three lobbies, your own place, voice, video and screen share, all the flair, 10 AI builds a day.
- Indicted, $6 a month: yourname.weered.ca, 60 AI builds a day, new lobbies listed in Downtown right away.
- Felon, $14 a month: one lobby at yourlobby.weered.ca, AI-built blocks and games, HD cams and screen share.
- Condemned, $25 a month: three lobbies at their own weered.ca addresses, a lobby on your own domain, 60 fps screen share.

## Pages
- [Front page](${SITE}/): what Weered is, with a one-minute film.
- [Features](${SITE}/features)
- [Plans](${SITE}/premium)
- [Weered and Discord](${SITE}/alternatives/discord)
- [Safety](${SITE}/safety) and [community guidelines](${SITE}/guidelines)
- [Forum](${SITE}/forum)
- [Contact](${SITE}/contact)

## Public lobbies
${lines.length ? lines.join("\n") : `- See ${SITE}/sitemap.xml`}
`;
}
