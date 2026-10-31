// Describe it: the web side of the builder (api routes/aiBuild.ts). A sentence
// becomes a new lobby's plan (the composer fills itself in), changes to a lobby
// in Design mode, or the person's drip. Nothing here saves: each surface puts
// the result in its draft, as one undo step, and the person launches or saves.
import { PRESET_BY_ID } from "./lobbyThemePresets";
import {
  emptyDoor,
  newBlock,
  sanitizeDoor,
  sanitizeLayout,
  type Block,
  type BlockSize,
  type BlockType,
  type EffectId,
  type EntranceId,
  type FontId,
  type HeroMode,
  type LobbyDoor,
  type LobbyLayout,
} from "./lobbyLayout";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export type RoomKind = "text" | "voice" | "video" | "youtube" | "screen";
export type PlanExtra =
  | { type: "rules"; title: string; body: string }
  | { type: "links"; title: string; items: { label: string; url: string }[] }
  | { type: "countdown"; label: string; at: string }
  | { type: "stream"; channel: string };
export type LobbyPlan = {
  name: string;
  description: string;
  template: string;
  look: {
    preset: string;
    accent: string;
    effect: EffectId;
    font: FontId;
    entrance: EntranceId;
    intensity: number;
    symbol?: string;
  };
  inside: Record<string, boolean>;
  rooms: { name: string; kind: RoomKind }[];
  welcome: { title: string; body: string; cta: string };
  extras: PlanExtra[];
  door: LobbyDoor | null;
  summary: string;
};
export type EditOp =
  | {
      op: "look";
      preset?: string;
      accent?: string;
      effect?: EffectId;
      font?: FontId;
      entrance?: EntranceId;
      intensity?: number;
      sparkle?: boolean;
      symbol?: string;
      forced?: boolean;
    }
  | { op: "add"; type: BlockType; size?: BlockSize; props: Record<string, any>; at: string }
  | { op: "update"; id: string; size?: BlockSize; props?: Record<string, any> }
  | { op: "remove"; id: string }
  | { op: "move"; id: string; at: string }
  | { op: "hero"; mode: HeroMode }
  | { op: "door"; door: LobbyDoor | null }
  | { op: "rename"; name?: string; description?: string };
export type DripResult = { look: Record<string, unknown>; layout?: string; summary: string };

export class BuildError extends Error {
  constructor(
    public code: string,
    public paid = false,
  ) {
    super(code);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${API}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BuildError("network");
  }
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok)
    throw new BuildError(
      String(j?.error || (r.status === 429 ? "rate_limited" : `http_${r.status}`)),
      !!j?.paid,
    );
  return j as T;
}

/** What to tell the person when a build doesn't come back. */
export function buildErrorText(e: unknown): string {
  const code = e instanceof BuildError ? e.code : "";
  switch (code) {
    case "ai_budget_reached":
      return e instanceof BuildError && e.paid
        ? "That's 60 builds today. More tomorrow."
        : "That's your 10 free builds for today. A plan gets you 60 a day.";
    case "builder_busy":
      return "The builder has had a big day. Try again tomorrow.";
    case "ai_unavailable":
      return "The builder is switched off right now.";
    case "unauthorized":
      return "Sign in to build.";
    case "rate_limited":
      return "One at a time. Give it a minute.";
    case "no_permission":
    case "forbidden":
      return "Only this lobby's owner and admins can do that.";
    case "layout_too_large":
      return "This Home page is too big to change by describing it. Take a few blocks off first.";
    case "prompt_required":
      return "Say a little more about what you want.";
    case "network":
      return "Couldn't reach Weered. Check your connection.";
    default:
      return "That one didn't come out. Try it again.";
  }
}

function tz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export const planLobby = (prompt: string, current?: LobbyPlan | null) =>
  post<{ plan: LobbyPlan }>("/ai/build/lobby", {
    prompt,
    ...(current ? { current } : {}),
    tz: tz(),
  }).then((j) => j.plan);

export const editLobbyByWords = (
  lobbyId: string,
  prompt: string,
  layout: LobbyLayout,
  words: { name?: string; description?: string },
) =>
  post<{ ops: EditOp[]; summary: string }>(`/ai/build/lobby/${encodeURIComponent(lobbyId)}/edit`, {
    prompt,
    layout,
    ...words,
    tz: tz(),
  });

export const dripByWords = (prompt: string, look: Record<string, unknown>) =>
  post<DripResult>("/ai/build/drip", { prompt, look });

/** A plan's extras as Home blocks (the composer's buildLayout). */
export function extraBlocks(extras: PlanExtra[]): Block[] {
  return extras.map((e) => {
    const b = newBlock(e.type);
    const { type: _type, ...props } = e;
    b.props = { ...b.props, ...props };
    return b;
  });
}

/** "start", "end", or after the block with that id. */
function placeAt(blocks: Block[], b: Block, at: string): Block[] {
  const out = blocks.filter((x) => x.id !== b.id);
  const i = out.findIndex((x) => x.id === at);
  if (at === "start") out.unshift(b);
  else if (i >= 0) out.splice(i + 1, 0, b);
  else out.push(b);
  return out;
}

/** Design mode: the ops applied to a draft, in order. A new name or
 *  description comes back on its own; they live beside the layout. */
export function applyOps(
  L: LobbyLayout,
  ops: EditOp[],
): { layout: LobbyLayout; rename: { name?: string; description?: string }; added: string[] } {
  const l: LobbyLayout = { ...L, theme: { ...L.theme }, blocks: [...L.blocks] };
  const rename: { name?: string; description?: string } = {};
  const added: string[] = [];
  for (const op of ops) {
    switch (op.op) {
      case "look": {
        const t = { ...l.theme };
        const pr = op.preset ? PRESET_BY_ID[op.preset] : undefined;
        if (pr)
          Object.assign(t, { preset: pr.id, accent: pr.accent, effect: pr.effect, font: pr.font });
        if (op.accent) t.accent = op.accent;
        if (op.effect) t.effect = op.effect;
        if (op.font) t.font = op.font;
        if (op.entrance) t.entrance = op.entrance;
        if (op.intensity !== undefined) t.intensity = op.intensity;
        if (op.sparkle !== undefined) t.sparkle = op.sparkle;
        if (op.symbol) t.symbol = op.symbol;
        if (op.forced !== undefined) t.fxForced = op.forced;
        l.theme = t;
        break;
      }
      case "add": {
        const b = newBlock(op.type);
        if (op.size) b.size = op.size;
        b.props = { ...b.props, ...op.props };
        l.blocks = placeAt(l.blocks, b, op.at);
        added.push(b.id);
        break;
      }
      case "update":
        l.blocks = l.blocks.map((b) =>
          b.id === op.id
            ? {
                ...b,
                ...(op.size ? { size: op.size } : {}),
                props: { ...b.props, ...(op.props || {}) },
              }
            : b,
        );
        break;
      case "remove":
        l.blocks = l.blocks.filter((b) => b.id !== op.id);
        break;
      case "move": {
        const b = l.blocks.find((x) => x.id === op.id);
        if (b) l.blocks = placeAt(l.blocks, b, op.at);
        break;
      }
      case "hero":
        l.hero = op.mode;
        break;
      case "door":
        l.door = op.door ? sanitizeDoor(op.door) : { ...(l.door || emptyDoor()), on: false };
        break;
      case "rename":
        if (op.name) rename.name = op.name;
        if (op.description !== undefined) rename.description = op.description;
        break;
    }
  }
  // Blocks only show with the Home tab on.
  if (added.length && !l.tabs.some((t) => t.id === "home" && !t.hidden))
    l.tabs = l.tabs.map((t) => (t.id === "home" ? { ...t, hidden: false } : t));
  return { layout: sanitizeLayout(l) || l, rename, added };
}
