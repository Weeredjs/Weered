import { B, E, S, VOICE, clip, clipText, oneOf } from "../common";
import type { BuildJob } from "../job";
import { findTags } from "../../htmlScan";

// Custom blocks and games: the AI writes a small page that runs in the walled-
// off box (web lib/blockSandbox.ts): no network, no Weered cookies or storage,
// and only the bridge (weered.me/get/set/list/send/on/resize) to talk through.
// The checks below refuse what the box would block anyway, and anything that
// could be used to fish for a password.

const BRIDGE_DOC = `To remember things for everyone, use the bridge (calls return promises):
  await weered.me()              the viewer: {id, name}, or null when signed out
  await weered.get(key)          a saved value (any JSON), or null
  await weered.set(key, value)   saves it for everyone (signed-in viewers only; it throws when signed out)
  await weered.list(prefix)      [{key, value, by, at}] for keys starting with prefix, oldest first
  weered.send(data)              tells everyone viewing right now (small JSON)
  weered.on((data, from) => …)   hears what others send; from is {id, name}
  weered.resize(px)              asks for a different height
Keys: letters, numbers and - _ : . (at most 60 characters). Values under 2 KB; at most 2,000 keys in all. Three kinds:
  "mine:…"  each viewer has their own (a vote, a pick, an entry): set("mine:vote", "B") saves this viewer's; get("mine:vote") reads it back; list("mine:vote") returns everyone's, each with by. Nobody can change someone else's. Use these for votes and anything one person owns.
  "staff:…" only the lobby's moderators and admins can change (an official scoreboard, the loot log, the real tier list). Hide the editing controls behind a try/catch: set throws for everyone else.
  any other key: anyone signed in can change (a shared jukebox queue, a counter).
For lists that grow (guestbook entries, scores) use one key per entry, like "mine:msg:" + Date.now(), and read them back with list(). When a signed-out viewer tries to write, show a friendly "Sign in to join in".`;

const BOX_RULES = `It runs in a sealed box: plain HTML, one <style>, one <script>, no libraries and nothing from the network (no fetch, no external images, fonts or scripts, no iframes, no forms). Write only what goes inside <body>. The page already has a transparent background, light text and these CSS variables: --accent (the lobby's colour), --text, --muted, --card, --line.
Make it look good on a dark background: rounded cards (var(--card), 1px solid var(--line)), the accent for buttons and highlights, comfortable spacing, readable from 300px to 900px wide. Keep it under 12 KB: tight code, no comments, no repeated markup (build lists in the script).
Never ask for passwords, emails, payment details or anything private. Nothing that looks like a sign-in. No links that leave Weered.`;

export const BLOCK_SYSTEM = `You write small custom blocks for a lobby's Home page on Weered: a guestbook, a poll, a tier list, a scoreboard, a loot tracker, a raid planner, a dice roller, a quote wall. Call the write_block tool exactly once. Do not reply with text.

${BOX_RULES}

${BRIDGE_DOC}

title: a short name for the block. height: s (about 220px), m (about 380px) or l (about 600px).
summary: one short plain sentence (20 words at most) saying what you made.
If they ask for something the box can't do (play music from a link, show a live web page, take payments), make the closest thing it can and say so in the summary.

${VOICE}`;

export const GAME_SYSTEM = `You write small party games for Weered that everyone viewing a lobby plays together in real time: trivia, bingo, a dice game, would-you-rather, a reaction race, word games. Call the write_block tool exactly once. Do not reply with text.

${BOX_RULES}

${BRIDGE_DOC}

How a game works together: weered.send(...) reaches everyone viewing right now and weered.on(...) hears it. The first viewer to press Start becomes the host: the host's page holds the game state, runs the timer and sends the whole state after every change and every few seconds while a round runs; everyone else just shows what they receive and sends their moves (answers, buzzes, picks) to the host. Someone who opens the page mid-game sends a hello as soon as it loads, and the host answers any hello with the whole state, so they're in right away. If no host is heard from for 10 seconds, anyone can press Start again. Keep lasting scores with weered.set so a leaderboard survives a refresh. Write all questions, cards or words into the code itself as one compact array (20 for trivia unless they said how many; each question under 100 characters with four short answers), fitting what they asked for. The whole game stays under 14 KB.

title: the game's name. height: l unless it's tiny.
summary: one short plain sentence (20 words at most) saying what you made.

${VOICE}`;

// A tag's own text, every one of that name, open or closed. Found in one pass
// (lib/htmlScan.ts): the patterns this replaced rescanned from every opening
// with no ">" (fan-out audit, 2026-11-13).
const tags = (code: string, name: string) =>
  findTags(code, name, { limit: 5000, tagMax: CODE_MAX, unclosed: true });
const anyTag = (name: string, re: RegExp) => (code: string) =>
  tags(code, name).some((t) => re.test(t));

const FORBIDDEN: [RegExp | ((code: string) => boolean), string][] = [
  [/type\s*=\s*["']?password/i, "a password field"],
  [/<form\b/i, "a form"],
  [/<iframe\b|<frame\b|<object\b|<embed\b/i, "an embedded page"],
  [anyTag("script", /\bsrc\s*=/i), "an outside script"],
  [/<link\b|@import\b/i, "outside styles"],
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource|importScripts|sendBeacon)\b/, "network calls"],
  [/document\.cookie|localStorage|sessionStorage|indexedDB/i, "browser storage"],
  [/\b(window\.)?(top|parent)\.location\b|window\.open\s*\(/, "leaving the page"],
  // The box may not send itself somewhere else either: a block that turns into
  // an outside page inside a lobby is a fake sign-in waiting to happen. (The
  // frame also reloads itself if it ever navigates: CustomBlockFrame.tsx.)
  [/\blocation\s*(=[^=]|\.\s*(href|assign|replace)\b)/, "leaving the page"],
  [anyTag("meta", /http-equiv/i), "leaving the page"],
  [anyTag("a", /\bhref\s*=\s*["']?\s*(https?:|\/\/|javascript:|data:)/i), "outside links"],
  [/\bjavascript\s*:/i, "leaving the page"],
];

export type CodeResult =
  | { ok: true; title: string; height: "s" | "m" | "l"; code: string }
  | { ok: false; reason: string };

/** The box's code can be this long. Longer is refused, never cut: cut code
 *  is broken code. */
export const CODE_MAX = 24_000;

export function cleanCode(raw: unknown, fallbackHeight: "s" | "m" | "l"): CodeResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const whole = clipText(r.code, CODE_MAX + 1).trim();
  if (whole.length > CODE_MAX)
    return { ok: false, reason: "That one came out too big for the box. Ask for a smaller version." };
  const code = whole;
  if (code.length < 20) return { ok: false, reason: "That one came back empty. Try again." };
  for (const [rule, what] of FORBIDDEN)
    if (typeof rule === "function" ? rule(code) : rule.test(code)) return { ok: false, reason: `That one used ${what}, which the box doesn't allow. Try again.` };
  return {
    ok: true,
    title: clip(r.title, 60) || "Custom block",
    height: oneOf(r.height, ["s", "m", "l"] as const) || fallbackHeight,
    code,
  };
}

const CODE_TOOL = {
  name: "write_block",
  description: "The block's code.",
  input_schema: {
    type: "object",
    properties: {
      title: S(),
      height: E(["s", "m", "l"]),
      code: S("The inside of <body>: markup, one <style>, one <script>."),
      realtime: B,
      summary: S(),
    },
    required: ["title", "height", "code", "summary"],
  },
};

/** What the model sees of an existing block when changing it. */
function current(body: Record<string, any>): string {
  const code = clipText(body?.code, CODE_MAX);
  return code ? `The block as it is now (change what they ask for, keep the rest):\n${code}` : "";
}

export const blockJob: BuildJob<CodeResult> = {
  id: "block",
  scope: "lobby",
  minLevel: 4,
  perm: "edit_branding",
  system: BLOCK_SYSTEM,
  tool: CODE_TOOL,
  maxTokens: 12000,
  timeoutMs: 180_000,
  context: (c) => current(c.body),
  clean: (raw) => cleanCode(raw, "m"),
};

export const gameJob: BuildJob<CodeResult> = {
  id: "game",
  scope: "lobby",
  minLevel: 4,
  perm: "edit_branding",
  system: GAME_SYSTEM,
  tool: CODE_TOOL,
  maxTokens: 16000,
  timeoutMs: 240_000,
  context: (c) => current(c.body),
  clean: (raw) => cleanCode(raw, "l"),
};
