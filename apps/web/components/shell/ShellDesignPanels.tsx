"use client";

// Design your Weered, the left panel's three tabs: Sections (blocks to add,
// switched-off sections to bring back), Layouts (presets) and Look (theme,
// colourway, type, starfield, density).
import React, { useMemo, useState } from "react";
import { chip, input, label } from "../lobby-design/designerKit";
import { alpha } from "../composer/ui";
import {
  CORE_META,
  SHELL_BLOCKS,
  SHELL_MAX_BLOCKS,
  SHELL_PRESETS,
  blockCount,
  canPlace,
  canUseBlock,
  entryIndex,
  isCore,
  keyOf,
  newShellBlock,
  placeItem,
  presetLayout,
  regionsFor,
  type ShellBlockType,
  type ShellItem,
  type ShellLayout,
  type ShellRegion,
} from "../../lib/shellLayout";
import {
  NEBULA_FONTS,
  NEBULA_FONT_IDS,
  PALETTES,
  PALETTE_IDS,
  customPalette,
  type SiteThemeId,
} from "../../lib/uiPrefs";
import { editLayout, editLook, selectItem, type ShellLook } from "../../lib/shellDesign";
import { beginLibraryDrag, justDragged } from "./ShellDesignOverlay";
import { EffectControls, StructureControls } from "./ShellLookControls";

// ── Sections ──────────────────────────────────────────────────────────────
export function SectionsTab({
  accent,
  layout,
  tier,
  addTo,
  setAddTo,
}: {
  accent: string;
  layout: ShellLayout;
  tier?: string;
  addTo: ShellRegion;
  setAddTo: (r: ShellRegion) => void;
}) {
  const [q, setQ] = useState("");
  const full = blockCount(layout) >= SHELL_MAX_BLOCKS;
  const groups = useMemo(() => {
    const g: Record<string, typeof SHELL_BLOCKS> = {};
    for (const b of SHELL_BLOCKS) {
      if (q && !`${b.name} ${b.blurb}`.toLowerCase().includes(q.toLowerCase())) continue;
      (g[b.group] ||= []).push(b);
    }
    return g;
  }, [q]);

  const add = (item: ShellItem) => {
    if (justDragged()) return;
    const region = canPlace(item, addTo) ? addTo : regionsFor(item)[0];
    editLayout((l) => placeItem(l, item, region, entryIndex(l, region)));
    selectItem(keyOf(item));
  };

  const card = (
    key: string,
    icon: string,
    name: string,
    blurb: string,
    make: () => ShellItem,
    locked = false,
    capped = false,
  ) => (
    <button
      key={key}
      type="button"
      onPointerDown={(e) => {
        if (!locked && !capped) beginLibraryDrag(make(), e);
      }}
      onClick={() => {
        if (locked) {
          window.location.href = "/subscribe";
          return;
        }
        if (!capped) add(make());
      }}
      title={locked ? "Comes with a paid plan" : "Click to add, or drag it onto the page"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "9px 10px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.03)",
        color: "inherit",
        textAlign: "left",
        cursor: capped ? "not-allowed" : "grab",
        opacity: capped ? 0.5 : 1,
        touchAction: "none",
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
          background: alpha(accent, 0.16),
          fontSize: 17,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontWeight: 800, fontSize: 13 }}>{name}</span>
        <span style={{ display: "block", fontSize: 11, opacity: 0.6 }}>{blurb}</span>
      </span>
      {locked && <span style={{ fontSize: 10, fontWeight: 800, color: accent }}>PLUS</span>}
    </button>
  );

  return (
    <div>
      <div style={label}>Add to</div>
      <div style={{ display: "flex", gap: 6 }}>
        {(["left", "home", "right"] as ShellRegion[]).map((r) => (
          <button
            key={r}
            type="button"
            style={{ ...chip(addTo === r, accent), flex: 1, padding: "7px 4px" }}
            onClick={() => setAddTo(r)}
          >
            {r === "left" ? "Left" : r === "home" ? "Home" : "Right"}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, opacity: 0.5, marginTop: 6 }}>
        Or drag anything straight onto the page.
      </div>

      {layout.hidden.length > 0 && (
        <>
          <div style={label}>Switched off · click to bring back</div>
          <div style={{ display: "grid", gap: 6 }}>
            {layout.hidden.map((id) =>
              card(id, CORE_META[id].icon, CORE_META[id].name, CORE_META[id].blurb, () => id),
            )}
          </div>
        </>
      )}

      <input
        placeholder="Find a block…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ ...input, marginTop: 14 }}
        aria-label="Find a block"
      />
      {full && (
        <div style={{ fontSize: 11.5, color: "#fca5a5", marginTop: 8 }}>
          That&apos;s {SHELL_MAX_BLOCKS} blocks, the most a layout holds. Remove one to add another.
        </div>
      )}
      {Object.entries(groups).map(([g, items]) => (
        <div key={g}>
          <div style={label}>{g}</div>
          <div style={{ display: "grid", gap: 6 }}>
            {items.map((b) =>
              card(
                b.type,
                b.icon,
                b.name,
                b.blurb,
                () => newShellBlock(b.type as ShellBlockType),
                !canUseBlock(b.type, tier),
                full,
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Layouts ───────────────────────────────────────────────────────────────
const PEOPLE = new Set(["friends", "crew", "presence", "whoshere", "pulse", "dms"]);

/** A thumbnail of a layout: three columns of bars, people lit in the accent,
 *  blocks in the light tint. */
export function LayoutThumb({
  layout,
  accent,
  hi,
  height = 70,
}: {
  layout: { left: ShellItem[]; right: ShellItem[]; home: ShellItem[] };
  accent: string;
  hi: string;
  height?: number;
}) {
  const bar = (it: ShellItem, i: number, home = false) => {
    const block = !isCore(it);
    const k = keyOf(it);
    const bg = block
      ? hi
      : k === "card"
        ? `linear-gradient(90deg, ${accent}, ${alpha(accent, 0.4)})`
        : PEOPLE.has(k)
          ? alpha(accent, 0.75)
          : "rgba(255,255,255,.26)";
    const w = home && block ? { s: "33%", m: "50%", l: "66%", full: "100%" }[it.size] : "100%";
    return (
      <span
        key={`${k}${i}`}
        style={{
          display: "block",
          height: block || k === "card" ? 9 : 5,
          width: w,
          borderRadius: 3,
          background: bg,
          flexShrink: 0,
        }}
      />
    );
  };
  const col = (items: ShellItem[], home = false) => (
    <span
      style={{
        display: "flex",
        flexDirection: home ? "row" : "column",
        flexWrap: home ? "wrap" : undefined,
        alignContent: "flex-start",
        gap: 3,
        padding: 4,
        borderRadius: 6,
        background: "rgba(255,255,255,.04)",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {items.slice(0, home ? 9 : 7).map((it, i) => bar(it, i, home))}
    </span>
  );
  return (
    <span
      aria-hidden
      style={{
        display: "grid",
        gridTemplateColumns: "26% 1fr 26%",
        gap: 4,
        height,
        padding: 4,
        borderRadius: 9,
        background: "rgba(0,0,0,.35)",
      }}
    >
      {col(layout.left)}
      {col(layout.home, true)}
      {col(layout.right)}
    </span>
  );
}

export function LayoutsTab({
  accent,
  hi,
  layout,
}: {
  accent: string;
  hi: string;
  layout: ShellLayout;
}) {
  const thumbs = useMemo(() => Object.fromEntries(SHELL_PRESETS.map((p) => [p.id, p.build()])), []);
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.6, margin: "12px 0 2px", lineHeight: 1.45 }}>
        A preset swaps the whole layout. Undo puts yours back. Then move anything.
      </div>
      <div style={label}>Presets</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {SHELL_PRESETS.map((p) => {
          const on = layout.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                const l = presetLayout(p.id);
                if (l) editLayout(() => l);
                selectItem(null);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 7,
                padding: 8,
                borderRadius: 13,
                textAlign: "left",
                cursor: "pointer",
                color: "inherit",
                border: `1px solid ${on ? accent : "rgba(255,255,255,.09)"}`,
                background: on ? alpha(accent, 0.12) : "rgba(255,255,255,.03)",
                boxShadow: on ? `0 0 0 3px ${alpha(accent, 0.18)}` : "none",
              }}
            >
              <LayoutThumb layout={thumbs[p.id]} accent={accent} hi={hi} height={58} />
              <span style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</span>
              <span style={{ fontSize: 10.5, opacity: 0.62, lineHeight: 1.35 }}>{p.blurb}</span>
            </button>
          );
        })}
      </div>
      <div style={label}>Where things live</div>
      <div style={{ fontSize: 11.5, opacity: 0.62, lineHeight: 1.5 }}>
        Friends, Crew, Rooms, Who&apos;s here and Discover go in either sidebar. Your card,
        navigation, Presence, Favorites and Recent are built into the left one. Blocks go anywhere,
        Home included. On screens under 1400px wide the left sidebar folds into the icon strip; it
        opens with one click.
      </div>
    </div>
  );
}

// ── Look ──────────────────────────────────────────────────────────────────
const CLASSIC_SKINS: { id: SiteThemeId; name: string; sw: string }[] = [
  { id: "press", name: "Press", sw: "#7C3AED" },
  { id: "ishimura", name: "Ishimura", sw: "#22d3ee" },
  { id: "broadcast", name: "Broadcast", sw: "#22c55e" },
  { id: "slate", name: "Slate", sw: "#64748b" },
  { id: "stone", name: "Stone", sw: "#78716c" },
  { id: "zinc", name: "Zinc", sw: "#71717a" },
  { id: "gray", name: "Gray", sw: "#6b7280" },
];

function Toggle({
  on,
  accent,
  onClick,
  title,
  blurb,
}: {
  on: boolean;
  accent: string;
  onClick: () => void;
  title: string;
  blurb: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px 12px",
        marginTop: 6,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.03)",
        color: "inherit",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 800, fontSize: 13 }}>{title}</span>
        <span style={{ display: "block", fontSize: 11, opacity: 0.6 }}>{blurb}</span>
      </span>
      <span
        aria-hidden
        style={{
          width: 38,
          height: 22,
          borderRadius: 99,
          padding: 3,
          background: on ? accent : "rgba(255,255,255,.14)",
          transition: "background .2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: "block",
            width: 16,
            height: 16,
            borderRadius: 99,
            background: "#fff",
            transform: on ? "translateX(16px)" : "none",
            transition: "transform .2s",
          }}
        />
      </span>
    </button>
  );
}

export function LookTab({ accent, look }: { accent: string; look: ShellLook }) {
  const neb = look.theme === "nebula";
  const custom = customPalette(look.accent);
  const colours = look.palette === "custom" ? custom : PALETTES[look.palette];
  const swatch = (c: { a: string; b: string; c: string; bg: string }) =>
    `radial-gradient(120% 120% at 0% 0%, ${alpha(c.b, 0.85)}, transparent 60%), radial-gradient(120% 120% at 100% 100%, ${alpha(c.c, 0.9)}, transparent 60%), ${c.bg}`;
  return (
    <div>
      <div style={label}>Theme</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          style={{ ...chip(neb, accent), flex: 1 }}
          onClick={() => editLook({ theme: "nebula" })}
        >
          ✦ Nebula
        </button>
        <button
          type="button"
          style={{ ...chip(!neb, accent), flex: 1 }}
          onClick={() => editLook({ theme: neb ? "press" : look.theme })}
        >
          Classic
        </button>
      </div>

      {neb ? (
        <>
          <div style={label}>Colourway</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
            {PALETTE_IDS.map((id) => {
              const c = PALETTES[id];
              const on = look.palette === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => editLook({ palette: id })}
                  style={{
                    minHeight: 58,
                    padding: "9px 10px",
                    borderRadius: 12,
                    textAlign: "left",
                    cursor: "pointer",
                    color: "#fff",
                    background: swatch(c),
                    border: `1px solid ${on ? c.a : "rgba(255,255,255,.1)"}`,
                    boxShadow: on ? `0 0 0 3px ${alpha(c.a, 0.35)}` : "none",
                  }}
                >
                  <span style={{ display: "flex", gap: 3, marginBottom: 6 }}>
                    {[c.a, c.hi, c.b].map((x) => (
                      <i key={x} style={{ width: 8, height: 8, borderRadius: 9, background: x }} />
                    ))}
                  </span>
                  <span style={{ display: "block", fontWeight: 800, fontSize: 12.5 }}>
                    {c.name}
                  </span>
                </button>
              );
            })}
            <label
              style={{
                position: "relative",
                minHeight: 58,
                padding: "9px 10px",
                borderRadius: 12,
                cursor: "pointer",
                color: "#fff",
                background: swatch(custom),
                border: `1px solid ${look.palette === "custom" ? custom.a : "rgba(255,255,255,.1)"}`,
                boxShadow:
                  look.palette === "custom" ? `0 0 0 3px ${alpha(custom.a, 0.35)}` : "none",
              }}
              title="Pick any colour; Weered builds the rest around it"
            >
              <span style={{ display: "flex", gap: 3, marginBottom: 6 }}>
                {[custom.a, custom.hi, custom.b].map((x, i) => (
                  <i key={i} style={{ width: 8, height: 8, borderRadius: 9, background: x }} />
                ))}
              </span>
              <span style={{ display: "block", fontWeight: 800, fontSize: 12.5 }}>
                Your colour ✎
              </span>
              <input
                type="color"
                value={look.accent}
                onChange={(e) => editLook({ palette: "custom", accent: e.target.value }, "accent")}
                onClick={() => {
                  if (look.palette !== "custom") editLook({ palette: "custom" });
                }}
                aria-label="Pick your own colour"
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
              />
            </label>
          </div>

          <div style={label}>Type</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {NEBULA_FONT_IDS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => editLook({ font: f })}
                style={{
                  ...chip(look.font === f, accent),
                  fontFamily: NEBULA_FONTS[f].stack,
                  fontSize: 13,
                  padding: "8px 4px",
                }}
              >
                {NEBULA_FONTS[f].name}
              </button>
            ))}
          </div>

          <Toggle
            on={look.stars}
            accent={accent}
            onClick={() => editLook({ stars: !look.stars })}
            title="Starfield"
            blurb="Drifting stars behind everything."
          />
          <EffectControls accent={accent} look={look} c={colours} />
          <StructureControls accent={accent} look={look} c={colours} />
        </>
      ) : (
        <>
          <div style={label}>Skin</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {CLASSIC_SKINS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => editLook({ theme: t.id })}
                style={{
                  ...chip(look.theme === t.id, accent),
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <i
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 99,
                    background: t.sw,
                    boxShadow: `0 0 8px ${t.sw}99`,
                  }}
                />
                {t.name}
              </button>
            ))}
          </div>
        </>
      )}

      <Toggle
        on={look.density === "compact"}
        accent={accent}
        onClick={() =>
          editLook({ density: look.density === "compact" ? "comfortable" : "compact" })
        }
        title="Compact"
        blurb="Tighter rows, more on screen."
      />
      <div style={{ fontSize: 11, opacity: 0.5, marginTop: 12, lineHeight: 1.45 }}>
        Lobbies with their own theme keep it. Your layout comes with you everywhere.
      </div>
    </div>
  );
}
