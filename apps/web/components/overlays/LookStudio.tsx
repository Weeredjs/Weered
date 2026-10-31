"use client";

// Your look, in the profile sheet (James 2026-10-31: "We are going to need way
// more profile customization. Even the colors for the avatar frame and name
// effect. Like we need to deck this out"). A name effect and an avatar frame:
// a preset, or your own colours, glow and motion. Described, or picked; tried
// on in the preview; Save keeps it. lib/looks.ts draws them everywhere.
import React, { useEffect, useMemo, useState } from "react";
import DescribeBox from "../build/DescribeBox";
import { describeJob } from "../../lib/aiBuild";
import {
  FRAME_PRESETS,
  FRAME_STYLES,
  LOOK_LABEL,
  NAME_MOTIONS,
  NAME_PRESETS,
  encodeFrame,
  encodeName,
  frameFx,
  nameFx,
  parseFrame,
  parseName,
  type FrameLook,
  type NameLook,
} from "../../lib/looks";

const NAME_DEFAULT: NameLook = { colors: ["#a78bfa", "#38bdf8"], glow: true, motion: "none" };
const FRAME_DEFAULT: FrameLook = { colors: ["#a78bfa", "#38bdf8"], style: "glow" };
const MOTION_LABEL: Record<string, string> = { none: "Still", shimmer: "Shimmer", pulse: "Pulse" };
const STYLE_LABEL: Record<string, string> = {
  ring: "Ring",
  double: "Rings",
  glow: "Glow",
  dashed: "Dashed",
  cycle: "Cycle",
  pulse: "Pulse",
};

const label: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  opacity: 0.55,
  margin: "14px 0 8px",
};
const chip = (on: boolean): React.CSSProperties => ({
  padding: "4px 10px",
  borderRadius: 999,
  border: `1px solid ${on ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.14)"}`,
  background: on ? "rgba(255,255,255,.12)" : "transparent",
  color: "#f3f4f6",
  font: "inherit",
  fontSize: 11.5,
  fontWeight: 700,
  cursor: "pointer",
});

function Colors({ colors, onChange }: { colors: string[]; onChange: (c: string[]) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {colors.map((c, i) => (
        <input
          key={i}
          type="color"
          value={c}
          aria-label={`Colour ${i + 1}`}
          onChange={(e) => onChange(colors.map((x, j) => (j === i ? e.target.value : x)))}
          style={{
            width: 34,
            height: 28,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
        />
      ))}
      {colors.length < 3 && (
        <button
          type="button"
          style={chip(false)}
          onClick={() => onChange([...colors, colors[colors.length - 1]])}
        >
          + colour
        </button>
      )}
      {colors.length > 1 && (
        <button type="button" style={chip(false)} onClick={() => onChange(colors.slice(0, -1))}>
          − colour
        </button>
      )}
    </div>
  );
}

export default function LookStudio({
  name,
  avatar,
  avatarColor,
  nameEffect,
  avatarFrame,
  onSave,
}: {
  name: string;
  avatar?: string | null;
  avatarColor: string;
  nameEffect: string | null;
  avatarFrame: string | null;
  onSave: (patch: { nameEffect: string; avatarFrame: string }) => Promise<void>;
}) {
  const [nm, setNm] = useState<string | null>(nameEffect);
  const [fr, setFr] = useState<string | null>(avatarFrame);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => setNm(nameEffect), [nameEffect]);
  useEffect(() => setFr(avatarFrame), [avatarFrame]);

  const ownName = useMemo(() => parseName(nm), [nm]);
  const ownFrame = useMemo(() => parseFrame(fr), [fr]);
  const dirty = (nm || null) !== (nameEffect || null) || (fr || null) !== (avatarFrame || null);
  const nfx = nameFx(nm);
  const ffx = frameFx(fr);

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      await onSave({ nameEffect: nm || "none", avatarFrame: fr || "none" });
      setMsg("Saved. Everyone sees it next time you join a room.");
    } catch {
      setMsg("Didn't save. Try again.");
    }
    setBusy(false);
  }

  return (
    <div>
      <DescribeBox
        kind="look"
        accent={ownName?.colors[0] || "#a78bfa"}
        label="Describe your look"
        placeholder="Neon green fading to cyan with a glow, and a ring that cycles colours"
        onBuild={async (prompt) => {
          const j = await describeJob<{
            nameEffect: string | null;
            avatarFrame: string | null;
            keepName: boolean;
            keepFrame: boolean;
          }>("look", prompt, { extra: { nameEffect: nm, avatarFrame: fr } });
          const before = { nm, fr };
          if (!j.result.keepName) setNm(j.result.nameEffect);
          if (!j.result.keepFrame) setFr(j.result.avatarFrame);
          setMsg("");
          return {
            summary: `${j.summary || "Here's the look."} Save to keep it.`,
            undo: () => {
              setNm(before.nm);
              setFr(before.fr);
            },
          };
        }}
      />

      {/* Try it on */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          margin: "14px 0 4px",
          padding: "14px 16px",
          borderRadius: 12,
          background: "rgba(0,0,0,.28)",
          border: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <div
          className={ffx.className}
          style={{
            ...ffx.style,
            width: 46,
            height: 46,
            borderRadius: "50%",
            flexShrink: 0,
            background: avatar ? `${avatarColor}22` : avatarColor,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            fontWeight: 900,
            color: "#fff",
          }}
        >
          {avatar ? (
            <img
              src={avatar}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </div>
        <span className={nfx.className} style={{ ...nfx.style, fontSize: 22, fontWeight: 900 }}>
          {name}
        </span>
      </div>

      <div style={label}>Name effect</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(["none", ...NAME_PRESETS] as string[]).map((k) => {
          const fx = nameFx(k === "none" ? null : k);
          return (
            <button
              key={k}
              type="button"
              title={LOOK_LABEL[k] || k}
              onClick={() => setNm(k === "none" ? null : k)}
              style={{ ...chip((nm || "none") === k), padding: "4px 9px" }}
            >
              <span className={fx.className} style={{ ...fx.style, fontWeight: 900 }}>
                {LOOK_LABEL[k] || k}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          style={chip(!!ownName)}
          onClick={() => setNm(ownName ? nm : encodeName(NAME_DEFAULT))}
        >
          ✦ Your own
        </button>
      </div>
      {ownName && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <Colors
            colors={ownName.colors}
            onChange={(colors) => setNm(encodeName({ ...ownName, colors }))}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              style={chip(ownName.glow)}
              onClick={() => setNm(encodeName({ ...ownName, glow: !ownName.glow }))}
            >
              Glow
            </button>
            {NAME_MOTIONS.map((m) => (
              <button
                key={m}
                type="button"
                style={chip(ownName.motion === m)}
                onClick={() => setNm(encodeName({ ...ownName, motion: m }))}
              >
                {MOTION_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={label}>Avatar frame</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {(["none", ...FRAME_PRESETS] as string[]).map((k) => {
          const fx = frameFx(k === "none" ? null : k);
          const on = (fr || "none") === k;
          return (
            <button
              key={k}
              type="button"
              title={LOOK_LABEL[k] || k}
              onClick={() => setFr(k === "none" ? null : k)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                className={fx.className}
                style={{
                  ...fx.style,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: avatarColor,
                  border: k === "none" ? "1px dashed rgba(255,255,255,.3)" : "none",
                  outline: on ? "2px solid #fff" : undefined,
                  outlineOffset: on ? 8 : undefined,
                }}
              />
              <span
                style={{
                  fontSize: 8.5,
                  opacity: on ? 0.95 : 0.55,
                  textTransform: "uppercase",
                  letterSpacing: ".5px",
                }}
              >
                {LOOK_LABEL[k] || k}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          style={{ ...chip(!!ownFrame), alignSelf: "center" }}
          onClick={() => setFr(ownFrame ? fr : encodeFrame(FRAME_DEFAULT))}
        >
          ✦ Your own
        </button>
      </div>
      {ownFrame && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <Colors
            colors={ownFrame.colors}
            onChange={(colors) => setFr(encodeFrame({ ...ownFrame, colors }))}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FRAME_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                style={chip(ownFrame.style === s)}
                onClick={() => setFr(encodeFrame({ ...ownFrame, style: s }))}
              >
                {STYLE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy}
          style={{
            ...chip(true),
            padding: "8px 18px",
            background: dirty ? "#7c3aed" : "rgba(255,255,255,.08)",
            border: `1px solid ${dirty ? "#a78bfa" : "rgba(255,255,255,.14)"}`,
            opacity: busy ? 0.6 : 1,
            cursor: dirty ? "pointer" : "default",
          }}
        >
          {busy ? "Saving…" : "Save my look"}
        </button>
        {dirty && (
          <button
            type="button"
            style={chip(false)}
            onClick={() => {
              setNm(nameEffect);
              setFr(avatarFrame);
            }}
          >
            Put it back
          </button>
        )}
        {msg && <span style={{ fontSize: 11.5, opacity: 0.7 }}>{msg}</span>}
      </div>
    </div>
  );
}
