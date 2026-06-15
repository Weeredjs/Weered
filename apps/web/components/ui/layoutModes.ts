export type LayoutMode = "A" | "B" | "C";

export const DEFAULT_LAYOUT_MODE: LayoutMode = "A";

export function normalizeLayoutMode(v: unknown): LayoutMode {
  if (v === "A" || v === "B" || v === "C") return v;
  return DEFAULT_LAYOUT_MODE;
}
