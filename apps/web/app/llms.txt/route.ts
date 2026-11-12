// /llms.txt: what Weered is, in plain text, for AI assistants and the crawlers
// that feed them (ClaudeBot, GPTBot, OAI-SearchBot, PerplexityBot all visit).
// None of them run scripts, so this and the lobby pages' server-rendered
// summary (app/lobby/[id]/LobbySeoSlab.tsx) are what they know us by.

import { llmsText, type Lobby } from "@/lib/llmsText";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export const revalidate = 3600;

export async function GET() {
  let lobbies: Lobby[] = [];
  try {
    const res = await fetch(`${API}/lobbies`, { next: { revalidate: 3600 } });
    const data = await res.json();
    if (data?.ok && Array.isArray(data.lobbies)) lobbies = data.lobbies;
  } catch {}
  return new Response(llmsText(lobbies), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
