import { S, VOICE, clip, clipText, givenUrl } from "../common";
import type { BuildJob } from "../job";

// Describe-it for a lobby's pages (the Pages tab): a clan wiki, a build guide,
// house rules, a merch page, written in markdown (web components/forum/
// Markdown.tsx). The model writes the shape and the words; facts it wasn't
// given become clear blanks to fill in, and links it wasn't given come out.

export type PagePlan = { title: string; body: string };

const PAGE_SYSTEM = `You write a page for a lobby on Weered (its Pages tab): a clan wiki, a build guide, house rules, an FAQ, a merch page, a how-to-join. Call the write_page tool exactly once. Do not reply with text.

- title: short (60 characters at most).
- body: markdown. Sections with ## and ###, short paragraphs, lists, **bold**; tables are not supported. The page shows its title above the body, so don't start with the title again. 300 to 1,500 words unless they asked for something short.
- Use only facts they gave you. Where a real fact is needed that they didn't give (a date, a price, a name, a rank requirement), write a clear blank in square brackets, like [your clan's founding date], so they can fill it in.
- Links only if they gave them, written as [text](link). Never make one up.
- If you're given the page as it is now, change what they ask for and keep the rest.
- summary: one short plain sentence (20 words at most).

${VOICE}`;

const MD_LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const BARE_URL = /\bhttps?:\/\/[^\s)<>\]]+/gi;

/** Markdown with every link and image the person didn't give taken out (the
 *  link's text stays; an image goes). */
export function keepGivenLinks(md: string, given: string): string {
  return md
    .replace(MD_LINK, (_m, bang: string, text: string, url: string) => {
      const ok = givenUrl(url, given);
      if (!ok) return bang ? "" : text;
      return `${bang}[${text}](${ok})`;
    })
    .replace(BARE_URL, (u) => (givenUrl(u, given) ? u : ""));
}

export const pageJob: BuildJob<PagePlan> = {
  id: "page",
  scope: "lobby",
  minLevel: 4,
  perm: "edit_branding",
  system: PAGE_SYSTEM,
  tool: {
    name: "write_page",
    description: "The page.",
    input_schema: {
      type: "object",
      properties: { title: S(), body: S("markdown"), summary: S() },
      required: ["title", "body", "summary"],
    },
  },
  maxTokens: 8000,
  timeoutMs: 150_000,
  context: (c) => {
    const now = clipText(c.body?.body, 20_000);
    return [
      `The lobby: ${clip(c.lobby?.name, 100)} (${c.lobby?.moduleType || "NONE"}).`,
      now ? `The page as it is now:\n${clip(c.body?.title, 80)}\n\n${now}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  },
  clean: (raw, c) => {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
      title: clip(r.title, 80) || "New page",
      // The page shows its title itself: a top-level heading first is a repeat.
      body: keepGivenLinks(clipText(r.body, 20_000), c.given)
        .trim()
        .replace(/^#(?!#)[^\n]*\n+/, "")
        .trim(),
    };
  },
};
