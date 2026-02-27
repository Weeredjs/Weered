"use client";

import React from "react";

type Settings = {
  theme: "stone" | "slate" | "zinc" | "neutral" | "gray";
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
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {hint ? <div className="text-xs opacity-70 mt-0.5">{hint}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
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
      className={
        "h-7 w-12 rounded-full border border-white/10 transition " +
        (checked ? "bg-white/20" : "bg-white/5")
      }
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span
        className={
          "block h-6 w-6 rounded-full bg-white/80 transition translate-y-[1px] " +
          (checked ? "translate-x-[22px]" : "translate-x-[2px]")
        }
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
    <div className="p-4">
      <div className="text-lg font-semibold">Settings</div>
      <div className="text-sm opacity-70 mt-1">Local v0 settings (localStorage). API sync later.</div>

      {/* Appearance */}
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold mb-1">Appearance</div>

        <Row label="Theme preset" hint="Base palette preset for the app shell.">
          <select
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
            value={s.theme}
            onChange={(e) => patch({ theme: e.target.value as any })}
          >
            <option value="stone">Stone</option>
            <option value="slate">Slate</option>
            <option value="zinc">Zinc</option>
            <option value="neutral">Neutral</option>
            <option value="gray">Gray</option>
          </select>
        </Row>

        <Row label="Density" hint="Compact makes rails tighter and lists denser.">
          <select
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
            value={s.density}
            onChange={(e) => patch({ density: e.target.value as any })}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </Row>

        <Row label="Reduce motion" hint="Prefer less animation/transition.">
          <Toggle checked={s.reduceMotion} onChange={(v) => patch({ reduceMotion: v })} />
        </Row>
      </div>

      {/* Behavior */}
      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold mb-1">Behavior</div>

        <Row label="Dock default tab" hint="Where Dock opens by default.">
          <select
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
            value={s.dockDefaultTab}
            onChange={(e) => patch({ dockDefaultTab: e.target.value as any })}
          >
            <option value="room">Room</option>
            <option value="dms">DMs</option>
          </select>
        </Row>

        <Row label="Enter to send" hint="If off, Enter inserts newline (future multiline).">
          <Toggle checked={s.enterToSend} onChange={(v) => patch({ enterToSend: v })} />
        </Row>

        <Row label="Confirm destructive actions" hint="Delete/clear actions ask first (future).">
          <Toggle checked={s.confirmDestructive} onChange={(v) => patch({ confirmDestructive: v })} />
        </Row>
      </div>

      {/* Privacy */}
      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold mb-1">Privacy</div>

        <Row label="Show online status" hint="Controls whether presence broadcasts online (future).">
          <Toggle checked={s.showOnline} onChange={(v) => patch({ showOnline: v })} />
        </Row>

        <Row label="Allow DMs" hint="If off, Message buttons will be disabled (future).">
          <Toggle checked={s.allowDMs} onChange={(v) => patch({ allowDMs: v })} />
        </Row>
      </div>

      {/* Developer */}
      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold mb-1">Developer</div>

        <Row label="Debug overlays" hint="Shows extra debug labels in UI (future wiring).">
          <Toggle checked={s.debugOverlays} onChange={(v) => patch({ debugOverlays: v })} />
        </Row>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-white/10"
            onClick={copyDiagnostics}
          >
            {copied ? "Copied!" : "Copy diagnostics"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-white/10"
            onClick={resetLocal}
          >
            Reset local settings
          </button>
        </div>
      </div>
    </div>
  );
}