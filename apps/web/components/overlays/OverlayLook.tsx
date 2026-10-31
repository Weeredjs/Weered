"use client";

// The stream overlay's look (James 2026-10-31: "my squad's live stats and the
// chat, for OBS"): where the card sits, its size and style, the colour, what it
// shows, a tagline. Described, or set by hand; the overlay page
// (app/overlay/[token]) reads it on its next refresh. Lives in Settings →
// Streamer overlay (PresenceSection.tsx).
import React, { useEffect, useState } from "react";
import DescribeBox from "../build/DescribeBox";
import { describeJob } from "../../lib/aiBuild";
import {
  OVERLAY_DEFAULT,
  extrasErrorText,
  overlayLook,
  type OverlayConfig,
} from "../../lib/lobbyExtras";

const SHOW: [keyof OverlayConfig["show"], string][] = [
  ["status", "LIVE badge"],
  ["avatar", "Avatar"],
  ["tier", "Rank"],
  ["place", "Lobby and room"],
  ["count", "People in it"],
  ["join", "Join link"],
  ["people", "Who's with me"],
  ["chat", "The room's chat"],
];

const chip = (on: boolean): React.CSSProperties => ({
  padding: "5px 10px",
  borderRadius: 999,
  border: `1px solid ${on ? "rgba(167,139,250,.7)" : "rgba(255,255,255,.14)"}`,
  background: on ? "rgba(124,58,237,.22)" : "transparent",
  color: on ? "#fff" : "rgba(226,232,240,.75)",
  fontSize: 11.5,
  fontWeight: 700,
  cursor: "pointer",
  font: "inherit",
});

export default function OverlayLook() {
  const [cfg, setCfg] = useState<OverlayConfig>(OVERLAY_DEFAULT);
  const [saved, setSaved] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    overlayLook
      .get()
      .then((c) => {
        setCfg(c);
        setSaved(JSON.stringify(c));
      })
      .catch(() => {});
  }, []);

  const set = (p: Partial<OverlayConfig>) => setCfg((c) => ({ ...c, ...p }));
  const dirty = JSON.stringify(cfg) !== saved;

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const c = await overlayLook.save(cfg);
      setCfg(c);
      setSaved(JSON.stringify(c));
      setMsg("Saved. OBS picks it up within a few seconds.");
    } catch (e) {
      setMsg(extrasErrorText(e));
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>Its look</div>
      <DescribeBox
        kind="overlay"
        accent={cfg.accent}
        label="Describe it"
        placeholder="Bottom right, neon green, just my name and the join link"
        onBuild={async (prompt) => {
          const j = await describeJob<OverlayConfig>("overlay", prompt);
          const before = cfg;
          setCfg(j.result);
          setMsg("");
          return {
            summary: `${j.summary || "Here it is."} Save to use it.`,
            undo: () => setCfg(before),
          };
        }}
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((p) => (
          <button
            key={p}
            type="button"
            style={chip(cfg.position === p)}
            onClick={() => set({ position: p })}
          >
            {p.replace("-", " ")}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {(["s", "m", "l"] as const).map((s) => (
          <button
            key={s}
            type="button"
            style={chip(cfg.size === s)}
            onClick={() => set({ size: s })}
          >
            {s === "s" ? "Small" : s === "m" ? "Medium" : "Large"}
          </button>
        ))}
        <span style={{ width: 8 }} />
        {(["glass", "solid", "minimal", "neon"] as const).map((s) => (
          <button
            key={s}
            type="button"
            style={chip(cfg.style === s)}
            onClick={() => set({ style: s })}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
        <input
          type="color"
          aria-label="Colour"
          value={cfg.accent}
          onChange={(e) => set({ accent: e.target.value })}
          style={{
            width: 34,
            height: 26,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {SHOW.map(([k, label]) => (
          <button
            key={k}
            type="button"
            style={chip(cfg.show[k])}
            aria-pressed={cfg.show[k]}
            onClick={() => set({ show: { ...cfg.show, [k]: !cfg.show[k] } })}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          style={chip(cfg.hideOffline)}
          aria-pressed={cfg.hideOffline}
          onClick={() => set({ hideOffline: !cfg.hideOffline })}
        >
          Hide when I&apos;m off Weered
        </button>
      </div>
      <input
        type="text"
        value={cfg.tagline}
        maxLength={60}
        placeholder="A line under your name (optional)"
        onChange={(e) => set({ tagline: e.target.value })}
        style={{
          padding: "8px 11px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(0,0,0,.3)",
          color: "#f3f4f6",
          font: "inherit",
          fontSize: 12.5,
        }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          style={{ ...chip(true), padding: "7px 16px", opacity: busy || !dirty ? 0.5 : 1 }}
        >
          {busy ? "Saving…" : "Save the look"}
        </button>
        {msg && <span style={{ fontSize: 11.5, opacity: 0.75 }}>{msg}</span>}
      </div>
    </div>
  );
}
