"use client";

import React from "react";

type Settings = {
  theme: "stone" | "slate" | "zinc" | "gray" | "ishimura" | "broadcast" | "press";
  density: "comfortable" | "compact";
  reduceMotion: boolean;

  dockDefaultTab: "room" | "dms";
  enterToSend: boolean;
  confirmDestructive: boolean;

  showOnline: boolean;
  allowDMs: boolean;

  debugOverlays: boolean;
};

const KEY = "weered:settings:v0";

const DEFAULTS: Settings = {
  theme: "stone",
  density: "comfortable",
  reduceMotion: false,

  dockDefaultTab: "dms",
  enterToSend: true,
  confirmDestructive: true,

  showOnline: true,
  allowDMs: true,

  debugOverlays: false,
};

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const j = JSON.parse(raw);
    return { ...DEFAULTS, ...(j || {}) };
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "8px 0" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--weered-text, rgba(243,244,246,.95))" }}>{label}</div>
        {hint ? <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2, color: "var(--weered-muted, rgba(148,163,184,.75))" }}>{hint}</div> : null}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 999,
        border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
        background: checked ? "var(--weered-accent-bg, rgba(124,58,237,.25))" : "rgba(255,255,255,.05)",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
        padding: 0,
        outline: "none",
        boxShadow: checked ? "inset 0 0 0 1px var(--weered-accent-ring, rgba(124,58,237,.4))" : "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: checked ? "var(--weered-accent-text, rgba(243,244,246,.95))" : "rgba(243,244,246,.75)",
          transition: "left 0.15s cubic-bezier(0.22,1,0.36,1), background 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,.4)",
        }}
      />
    </button>
  );
}

export default function SettingsSheet() {
  const [s, setS] = React.useState<Settings>(DEFAULTS);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const v = loadSettings();
    setS(v);
  }, []);

  function patch(next: Partial<Settings>) {
    setS((cur) => {
      const n = { ...cur, ...next };
      saveSettings(n);
      // broadcast for anyone who wants to react (theme, density, etc.)
      try {
        window.dispatchEvent(new CustomEvent("weered:settings:changed", { detail: n }));
      } catch {}
      return n;
    });
  }

  function resetLocal() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    patch(DEFAULTS);
  }

  async function copyDiagnostics() {
    try {
      const blob = {
        settings: s,
        ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
        ts: new Date().toISOString(),
      };
      await navigator.clipboard.writeText(JSON.stringify(blob, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {}
  }

  return (
    <div style={{ padding: 16, color: "var(--weered-text, rgba(243,244,246,.95))" }}>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Settings</div>
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
        How Weered behaves. Theme + avatar live in your Profile.
      </div>

      {/* Appearance */}
      <Section title="Appearance">
        <Row label="Density" hint="Compact tightens rails and lists.">
          <select
            style={selectStyle}
            value={s.density}
            onChange={(e) => patch({ density: e.target.value as any })}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </Row>
        <Row label="Reduce motion" hint="Drops animations and transitions.">
          <Toggle checked={s.reduceMotion} onChange={(v) => patch({ reduceMotion: v })} />
        </Row>
      </Section>

      {/* Behavior */}
      <Section title="Behavior">
        <Row label="Burner default tab" hint="Which tab opens first when you hit Burner.">
          <select
            style={selectStyle}
            value={s.dockDefaultTab}
            onChange={(e) => patch({ dockDefaultTab: e.target.value as any })}
          >
            <option value="dms">Messages</option>
            <option value="room">Room</option>
          </select>
        </Row>
        <Row label="Enter sends" hint="Off = Enter adds a newline instead.">
          <Toggle checked={s.enterToSend} onChange={(v) => patch({ enterToSend: v })} />
        </Row>
        <Row label="Confirm destructive actions" hint="Deletes and clears ask before running.">
          <Toggle checked={s.confirmDestructive} onChange={(v) => patch({ confirmDestructive: v })} />
        </Row>
      </Section>

      {/* Privacy */}
      <Section title="Privacy">
        <Row label="Show online status" hint="Broadcast presence in lobbies and crews.">
          <Toggle checked={s.showOnline} onChange={(v) => patch({ showOnline: v })} />
        </Row>
        <Row label="Allow DMs" hint="Let anyone send you a direct message.">
          <Toggle checked={s.allowDMs} onChange={(v) => patch({ allowDMs: v })} />
        </Row>
      </Section>

      {/* Developer */}
      <Section title="Developer">
        <Row label="Debug overlays" hint="Surface extra diagnostic labels.">
          <Toggle checked={s.debugOverlays} onChange={(v) => patch({ debugOverlays: v })} />
        </Row>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" style={btnStyle} onClick={copyDiagnostics}>
            {copied ? "Copied" : "Copy diagnostics"}
          </button>
          <button type="button" style={btnStyle} onClick={resetLocal}>
            Reset settings
          </button>
        </div>
      </Section>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
  background: "var(--weered-panel2, rgba(0,0,0,.3))",
  color: "var(--weered-text, rgba(243,244,246,.95))",
  padding: "6px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  cursor: "pointer",
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
  background: "var(--weered-panel2, rgba(0,0,0,.2))",
  color: "var(--weered-text, rgba(243,244,246,.9))",
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
  transition: "background 0.12s, border-color 0.12s",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 14,
        borderRadius: 10,
        border: "1px solid var(--weered-border, rgba(255,255,255,.10))",
        background: "var(--weered-panel, rgba(255,255,255,.04))",
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "var(--weered-accent-text, rgba(167,139,250,.85))",
          opacity: 0.85,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}