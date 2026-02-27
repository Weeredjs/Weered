export type LayoutMode = "A" | "B" | "C";

export const DEFAULT_LAYOUT_MODE: LayoutMode = "A";

/**
 * Phase 1: scaffolding only.
 * Later we can add:
 *  - query param (?ui=A|B|C)
 *  - localStorage persistence
 *  - env default
 */
export function normalizeLayoutMode(v: unknown): LayoutMode {
  if (v === "A" || v === "B" || v === "C") return v;
  return DEFAULT_LAYOUT_MODE;
}