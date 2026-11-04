"use client";

// Design your Weered → Look: the structure (corners, side buttons, lines, card
// texture, backdrop) and the moving effect (with its intensity, and the symbol
// that floats by when you pick your own). Nebula only; Classic has its own skins.
import React from "react";
import { chip, input, label } from "../lobby-design/designerKit";
import { alpha } from "../composer/ui";
import LobbyAmbient from "../LobbyAmbient";
import { SYMBOL_PICKS } from "../../lib/lobbyThemePresets";
import { SHELL_FX, editLook, type ShellLook } from "../../lib/shellDesign";
import { useWeered } from "../WeeredProvider";
import type {
  PaletteColours,
  RailButtons,
  ShellBackdrop,
  ShellFx,
  ShellLines,
  ShellShape,
  ShellTexture,
} from "../../lib/uiPrefs";

const SHAPES: { id: ShellShape; name: string }[] = [
  { id: "round", name: "Round" },
  { id: "soft", name: "Soft" },
  { id: "square", name: "Square" },
  { id: "cut", name: "Cut" },
];
const BUTTON_SHAPES: { id: RailButtons; name: string; blurb: string }[] = [
  { id: "tile", name: "Tile", blurb: "Rounded glass tiles" },
  { id: "chevron", name: "Chevron", blurb: "Notched, stacked like an arrow strip" },
  { id: "cut", name: "Cut", blurb: "Angled corners" },
  { id: "pill", name: "Pill", blurb: "Fully rounded ends" },
];
const LINES: { id: ShellLines; name: string; blurb: string }[] = [
  { id: "soft", name: "Soft", blurb: "Hairlines and glow" },
  { id: "hard", name: "Hard", blurb: "Crisp edges, no glow" },
];
const TEXTURES: { id: ShellTexture; name: string }[] = [
  { id: "glass", name: "Glass" },
  { id: "grid", name: "Grid" },
  { id: "lines", name: "Lines" },
  { id: "dots", name: "Dots" },
  { id: "solid", name: "Solid" },
];
const BACKDROPS: { id: ShellBackdrop; name: string }[] = [
  { id: "sky", name: "Sky" },
  { id: "grid", name: "Grid" },
  { id: "plain", name: "Plain" },
];
export const FX_LABEL: Record<ShellFx, string> = {
  none: "None",
  snow: "Snow",
  blizzard: "Blizzard",
  embers: "Embers",
  rain: "Rain",
  petals: "Petals",
  bubbles: "Bubbles",
  fireflies: "Fireflies",
  matrix: "Code rain",
  symbol: "Your symbol",
};
// A 92×46 chip shows few particles at the real density; these fill it.
const CHIP_INTENSITY: Record<ShellFx, number> = {
  none: 1,
  snow: 30,
  blizzard: 12,
  embers: 30,
  rain: 22,
  petals: 50,
  bubbles: 50,
  fireflies: 60,
  matrix: 1.2,
  symbol: 70,
};

/** A tiny card in the chosen shape, texture and line weight. */
function Swatch({
  shape = "round",
  texture = "glass",
  hard = false,
  c,
}: {
  shape?: ShellShape;
  texture?: ShellTexture;
  hard?: boolean;
  c: PaletteColours;
}) {
  const r = shape === "round" ? 9 : shape === "soft" ? 5 : 0;
  const tex =
    texture === "grid"
      ? `linear-gradient(${alpha(c.a, 0.25)} 1px, transparent 1px) 0 0 / 7px 7px, linear-gradient(90deg, ${alpha(c.a, 0.25)} 1px, transparent 1px) 0 0 / 7px 7px`
      : texture === "lines"
        ? `repeating-linear-gradient(135deg, ${alpha(c.a, 0.28)} 0 1px, transparent 1px 5px)`
        : texture === "dots"
          ? `radial-gradient(${alpha(c.a, 0.45)} 1px, transparent 1.4px) 0 0 / 6px 6px`
          : "none";
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width: 34,
        height: 24,
        borderRadius: r,
        clipPath:
          shape === "cut"
            ? "polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)"
            : undefined,
        border: `1px solid ${hard ? c.a : alpha(c.a, 0.35)}`,
        background: `${tex === "none" ? "" : tex + ", "}${texture === "solid" ? c.ink : alpha(c.ink, 0.7)}`,
        boxShadow: hard ? "none" : `0 0 10px ${alpha(c.a, 0.35)}`,
      }}
    />
  );
}

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
/** The plans that may float their own picture: api lib/tiers.ts canFloatPicture. */
const PICTURE_TIERS = ["INDICTED", "FELON", "CONDEMNED", "KINGPIN"];

/** Your own picture in place of the characters ("Change the snow to my logo",
 *  James 2026-11-04). The upload is saved at once; using it is part of the look. */
function SymbolPicture({
  accent,
  look,
  onLook,
}: {
  accent: string;
  look: ShellLook;
  onLook: OnLook;
}) {
  const { me, globalRole } = useWeered() as any;
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const allowed =
    PICTURE_TIERS.includes(String(me?.tier || "").toUpperCase()) ||
    ["STAFF", "GOD"].includes(String(globalRole || "").toUpperCase());

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr("");
    if (f.size > 1024 * 1024) return setErr("The picture must be under 1 MB.");
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return setErr("Use PNG, JPEG, WebP or GIF.");
    setBusy(true);
    try {
      const image: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result || ""));
        r.onerror = () => rej(new Error("read_failed"));
        r.readAsDataURL(f);
      });
      const r = await fetch(`${API}/profile/symbol/upload`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) setErr(j?.message || "That didn't upload. Try another picture.");
      else onLook({ fxImage: String(j.url), fxPicture: true });
    } catch {
      setErr("That didn't upload. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={label}>Your picture</div>
      {look.fxImage ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <img
            src={look.fxImage}
            alt=""
            style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 6 }}
          />
          <button
            type="button"
            onClick={() => onLook({ fxPicture: true })}
            style={{ ...chip(look.fxPicture, accent), padding: "5px 10px" }}
          >
            Picture
          </button>
          <button
            type="button"
            onClick={() => onLook({ fxPicture: false })}
            style={{ ...chip(!look.fxPicture, accent), padding: "5px 10px" }}
          >
            Characters
          </button>
          {allowed && (
            <label style={{ ...chip(false, accent), padding: "5px 10px", cursor: "pointer" }}>
              {busy ? "Uploading…" : "Replace"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={upload}
              />
            </label>
          )}
        </div>
      ) : allowed ? (
        <label
          style={{
            ...chip(false, accent),
            display: "inline-block",
            padding: "6px 12px",
            cursor: "pointer",
          }}
        >
          {busy ? "Uploading…" : "Upload a picture"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={upload}
          />
        </label>
      ) : (
        <div style={{ fontSize: 11.5, opacity: 0.7 }}>
          Float your own logo or picture instead.{" "}
          <a href="/subscribe" style={{ color: accent }}>
            Indicted and up
          </a>
        </div>
      )}
      {err && <div style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}>{err}</div>}
    </>
  );
}

/** A tiny side button in the chosen shape (styles/99-nebula-buttons.css). */
function ButtonSwatch({ shape, c }: { shape: RailButtons; c: PaletteColours }) {
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width: 16,
        height: 26,
        borderRadius: shape === "tile" ? 5 : shape === "pill" ? 999 : 0,
        clipPath:
          shape === "chevron"
            ? "polygon(0 0, 100% 0, 76% 50%, 100% 100%, 0 100%)"
            : shape === "cut"
              ? "polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)"
              : undefined,
        border: `1px solid ${alpha(c.a, 0.45)}`,
        boxShadow: `inset 2px 0 0 ${alpha(c.a, 0.8)}`,
        background: alpha(c.ink, 0.75),
      }}
    />
  );
}

function Pick<T extends string>({
  items,
  value,
  accent,
  onPick,
  render,
  cols = 4,
}: {
  items: { id: T; name: string; blurb?: string }[];
  value: T;
  accent: string;
  onPick: (v: T) => void;
  render?: (id: T) => React.ReactNode;
  cols?: number;
}) {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 6 }}
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onPick(it.id)}
          title={it.blurb}
          style={{
            ...chip(value === it.id, accent),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            padding: "8px 4px 7px",
          }}
        >
          {render?.(it.id)}
          {it.name}
        </button>
      ))}
    </div>
  );
}

/** Where a change goes: Design's draft by default; Settings saves it outright. */
type OnLook = (patch: Partial<ShellLook>, merge?: string) => void;

export function StructureControls({
  accent,
  look,
  c,
  onLook = editLook,
}: {
  accent: string;
  look: ShellLook;
  c: PaletteColours;
  onLook?: OnLook;
}) {
  return (
    <>
      <div style={label}>Corners</div>
      <Pick
        items={SHAPES}
        value={look.shape}
        accent={accent}
        onPick={(v) => onLook({ shape: v })}
        render={(id) => (
          <Swatch shape={id} texture={look.texture} hard={look.lines === "hard"} c={c} />
        )}
      />
      <div style={label}>Side buttons</div>
      <Pick
        items={BUTTON_SHAPES}
        value={look.buttons}
        accent={accent}
        onPick={(v) => onLook({ buttons: v })}
        render={(id) => <ButtonSwatch shape={id} c={c} />}
      />
      <div style={label}>Lines</div>
      <Pick
        items={LINES}
        value={look.lines}
        accent={accent}
        cols={2}
        onPick={(v) => onLook({ lines: v })}
        render={(id) => (
          <Swatch shape={look.shape} texture={look.texture} hard={id === "hard"} c={c} />
        )}
      />
      <div style={label}>Texture</div>
      <Pick
        items={TEXTURES}
        value={look.texture}
        accent={accent}
        cols={5}
        onPick={(v) => onLook({ texture: v })}
        render={(id) => (
          <Swatch shape={look.shape} texture={id} hard={look.lines === "hard"} c={c} />
        )}
      />
      <div style={label}>Behind the glass</div>
      <Pick
        items={BACKDROPS}
        value={look.backdrop}
        accent={accent}
        cols={3}
        onPick={(v) => onLook({ backdrop: v })}
      />
    </>
  );
}

export function EffectControls({
  accent,
  look,
  c,
  onLook = editLook,
}: {
  accent: string;
  look: ShellLook;
  c: PaletteColours;
  onLook?: OnLook;
}) {
  return (
    <>
      <div style={label}>Effect</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
        {SHELL_FX.map((fx) => {
          const on = look.fx === fx;
          return (
            <button
              key={fx}
              type="button"
              onClick={() => onLook({ fx })}
              style={{
                position: "relative",
                height: 46,
                overflow: "hidden",
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                padding: "0 8px 6px",
                display: "flex",
                alignItems: "flex-end",
                color: c.light ? "#0f172a" : "#fff",
                fontFamily: "inherit",
                fontSize: 11.5,
                fontWeight: 800,
                border: `1px solid ${on ? accent : "rgba(255,255,255,.1)"}`,
                boxShadow: on ? `0 0 0 3px ${alpha(accent, 0.25)}` : "none",
                background: c.light
                  ? `linear-gradient(180deg, ${c.bg}, #ffffff)`
                  : `radial-gradient(120% 120% at 0% 0%, ${alpha(c.b, 0.6)}, transparent 60%), ${c.bg}`,
              }}
            >
              {fx !== "none" && (
                <LobbyAmbient
                  effect={fx}
                  accent={c.a}
                  intensity={CHIP_INTENSITY[fx]}
                  symbol={look.fxSymbol}
                  light={!!c.light}
                />
              )}
              <span style={{ position: "relative", zIndex: 1 }}>{FX_LABEL[fx]}</span>
            </button>
          );
        })}
      </div>
      {look.fx === "symbol" && (
        <>
          <div style={label}>Your symbol</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={look.fxSymbol}
              maxLength={12}
              onChange={(e) => onLook({ fxSymbol: e.target.value }, "fxSymbol")}
              aria-label="Your symbol"
              style={{ ...input, width: 64, textAlign: "center", fontSize: 18, padding: "6px 4px" }}
            />
            {SYMBOL_PICKS.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => onLook({ fxSymbol: sym })}
                style={{ ...chip(look.fxSymbol === sym, accent), padding: "4px 7px", fontSize: 15 }}
              >
                {sym}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 6 }}>
            An emoji or up to three characters.
          </div>
          <SymbolPicture accent={accent} look={look} onLook={onLook} />
        </>
      )}
      {look.fx !== "none" && (
        <>
          <div style={label}>Intensity · {Math.round(look.fxIntensity * 100)}%</div>
          <input
            type="range"
            min={0.2}
            max={1.5}
            step={0.1}
            value={look.fxIntensity}
            onChange={(e) => onLook({ fxIntensity: Number(e.target.value) }, "fxIntensity")}
            style={{ width: "100%", accentColor: accent }}
            aria-label="Effect intensity"
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {[
              [false, "Behind the glass"],
              [true, "In front"],
            ].map(([front, name]) => (
              <button
                key={String(front)}
                type="button"
                onClick={() => onLook({ fxFront: front as boolean })}
                title={
                  front
                    ? "Floats over the page; clicks go straight through"
                    : "Under the panels, over the sky"
                }
                style={{ ...chip(look.fxFront === front, accent), flex: 1 }}
              >
                {name as string}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
