import { describe, expect, it } from "vitest";
import {
  BUILD_BLOCKS,
  BUILD_EFFECTS,
  BUILD_FEATURES,
  BUILD_FONTS,
  BUILD_ROOM_PRESETS,
  BUILD_TEMPLATES,
  BUILD_THEMES,
  DRIP_FONTS,
  DRIP_PALETTES,
  DRIP_PRESETS,
  DRIP_THEMES,
} from "../../api/src/lib/buildCatalog";
import { FEATURES, GAMES, ROOM_PRESETS } from "../components/composer/catalog";
import { EFFECT_LABEL, FONT_LABEL, THEME_PRESETS } from "../lib/lobbyThemePresets";
import { BLOCK_CATALOG } from "../lib/lobbyLayout";
import { NEBULA_FONTS, PALETTE_IDS, SITE_THEME_IDS } from "../lib/uiPrefs";
import { SHELL_PRESETS } from "../lib/shellLayout";

// The builder (api routes/aiBuild.ts) works from a copy of these catalogs. When
// one of them changes here, update apps/api/src/lib/buildCatalog.ts too, or the
// builder offers what isn't there (or never offers what's new).
const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id).sort();
const keys = (o: Record<string, unknown>) => Object.keys(o).sort();

describe("the builder's catalog matches the app's", () => {
  it("lobby templates (every pickable one, with its preset and rooms)", () => {
    const pickable = GAMES.filter((g) => !g.action);
    expect(ids(BUILD_TEMPLATES)).toEqual(ids(pickable));
    for (const t of BUILD_TEMPLATES) {
      const g = pickable.find((x) => x.id === t.id)!;
      expect(t.preset, t.id).toBe(g.preset);
      expect(t.rooms, t.id).toEqual(g.rooms);
    }
  });

  it("themes, effects, fonts, features, rooms and blocks", () => {
    expect(ids(BUILD_THEMES)).toEqual(ids(THEME_PRESETS));
    for (const t of BUILD_THEMES) {
      const real = THEME_PRESETS.find((x) => x.id === t.id)!;
      expect([t.accent, t.effect, t.font], t.id).toEqual([real.accent, real.effect, real.font]);
    }
    expect(keys(BUILD_EFFECTS)).toEqual(keys(EFFECT_LABEL));
    expect(keys(BUILD_FONTS)).toEqual(keys(FONT_LABEL));
    expect(ids(BUILD_FEATURES)).toEqual(ids(FEATURES));
    expect(ids(BUILD_ROOM_PRESETS)).toEqual(ids(ROOM_PRESETS));
    expect(BUILD_BLOCKS.map((b) => b.type).sort()).toEqual(BLOCK_CATALOG.map((b) => b.type).sort());
  });

  it("drip: skins, palettes, fonts and layouts", () => {
    expect([...DRIP_THEMES].sort()).toEqual([...SITE_THEME_IDS].sort());
    expect(DRIP_PALETTES.map((p) => p.id).sort()).toEqual([...PALETTE_IDS].sort());
    expect(keys(DRIP_FONTS)).toEqual(keys(NEBULA_FONTS));
    expect(ids(DRIP_PRESETS)).toEqual(ids(SHELL_PRESETS));
  });
});
