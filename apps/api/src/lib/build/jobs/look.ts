import { B, E, N, S, VOICE, obj } from "../common";
import type { BuildJob } from "../job";
import {
  FRAME_PRESETS,
  FRAME_STYLES,
  NAME_MOTIONS,
  NAME_PRESETS,
  cleanFrame,
  cleanNameEffect,
} from "../../looks";

// Describe-it for a member's look (the profile sheet): their name effect and
// avatar frame, a preset or their own colours (lib/looks.ts).

export type LookPlan = { nameEffect: string | null; avatarFrame: string | null };

const SYSTEM = `You style how someone's name and avatar frame look on Weered, from what they describe. Call the set_look tool exactly once. Do not reply with text.

Name effect: either a preset (${NAME_PRESETS.join(", ")}) or their own: colors (1 to 3, #rrggbb, one colour or a gradient left to right), glow (true for a soft glow), motion (none, shimmer: the colours slide across, pulse: it breathes).
Avatar frame: either a preset (${FRAME_PRESETS.join(", ")}) or their own: colors (1 to 3, #rrggbb) and style (ring, double: two or three rings, glow, dashed, cycle: the colours take turns, pulse: the glow breathes).
Use a preset only when it matches what they asked for closely; otherwise make their own. If they only talk about one of the two, set the other to "keep".
summary: one short plain sentence (20 words at most).

${VOICE}`;

const PART = (presets: readonly string[], extra: Record<string, unknown>) => ({
  type: "object",
  properties: {
    preset: E(["keep", "none", "custom", ...presets]),
    colors: { type: "array", items: S("#rrggbb") },
    ...extra,
  },
  required: ["preset"],
});

export const lookJob: BuildJob<LookPlan & { keepName: boolean; keepFrame: boolean }> = {
  id: "look",
  scope: "user",
  system: SYSTEM,
  tool: {
    name: "set_look",
    description: "Their name effect and avatar frame.",
    input_schema: {
      type: "object",
      properties: {
        name: PART(NAME_PRESETS, { glow: B, motion: E(NAME_MOTIONS) }),
        frame: PART(FRAME_PRESETS, { style: E(FRAME_STYLES), width: N() }),
        summary: S(),
      },
      required: ["name", "frame", "summary"],
    },
  },
  maxTokens: 1500,
  context: (c) =>
    `Their look now: name effect ${JSON.stringify(c.body?.nameEffect ?? null)}, avatar frame ${JSON.stringify(c.body?.avatarFrame ?? null)}.`,
  clean: (raw) => {
    const r = obj(raw);
    const n = obj(r.name);
    const f = obj(r.frame);
    const pick = (
      part: Record<string, any>,
      presets: readonly string[],
      own: (p: Record<string, any>) => string | null | undefined,
    ) => {
      if (part.preset === "keep") return { keep: true, value: null };
      if (part.preset === "none") return { keep: false, value: null };
      if (presets.includes(part.preset)) return { keep: false, value: part.preset as string };
      const v = own(part);
      return v === undefined ? { keep: true, value: null } : { keep: false, value: v };
    };
    const name = pick(n, NAME_PRESETS, (p) => cleanNameEffect({ colors: p.colors, glow: p.glow === true, motion: p.motion || "none" }));
    const frame = pick(f, FRAME_PRESETS, (p) => cleanFrame({ colors: p.colors, style: p.style || "ring" }));
    return { nameEffect: name.value, avatarFrame: frame.value, keepName: name.keep, keepFrame: frame.keep };
  },
};
