// The layout gallery's choices (components/setup/LayoutGallery.tsx), shared
// with the script that shoots its pictures (apps/api/scripts/layout-shots.ts).
import { SHELL_PRESETS } from "./shellLayout";
import type { Palette } from "./uiPrefs";

/** The layouts with nothing to fill in. */
export const GALLERY_LAYOUTS = SHELL_PRESETS.filter((p) => p.setup);

/** The colourways shown. Violet is the look every account starts with. */
export const GALLERY_LOOKS: {
  id: string;
  name: string;
  swatch: string;
  palette: Palette;
  accent?: string;
}[] = [
  { id: "violet", name: "Violet", swatch: "#8b5cf6", palette: "custom", accent: "#8b5cf6" },
  { id: "ocean", name: "Ocean", swatch: "#38bdf8", palette: "ocean" },
  { id: "ember", name: "Ember", swatch: "#fb923c", palette: "ember" },
];

export const shotSrc = (layout: string, look: string) => `/brand/layouts/${layout}-${look}.webp`;
