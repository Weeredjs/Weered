"use client";

import React from "react";
import { openConsentBanner } from "../../CookieConsent";

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
  theme: "press",
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

      {/* Profile customization — colors users pick to personalize their card + pill */}
      <ProfileCustomizationSection />

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
        <Row label="Cookies & storage" hint="Revisit what Weered stores on your device.">
          <button
            type="button"
            onClick={() => openConsentBanner()}
            style={{ ...btnStyle, padding: "6px 12px", fontSize: 11 }}
          >
            Manage
          </button>
        </Row>
      </Section>

      {/* Rich presence (Steam + Twitch) */}
      <PresenceSection />

      {/* Blocked users */}
      <BlockedUsersSection />

      {/* Danger zone — account deletion */}
      <DangerZoneSection />

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

// ───────────────────────────────────────────────────────────────────────────
// Profile customization — panel bg/accent + pill bg
// ───────────────────────────────────────────────────────────────────────────

function ProfileCustomizationSection() {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
  function token() { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } }

  // Hydrate from cached `me` (auth:ok payload includes these)
  const [panelBgColor, setPanelBgColor] = React.useState<string>("");
  const [panelAccentColor, setPanelAccentColor] = React.useState<string>("");
  const [pillBgColor, setPillBgColor] = React.useState<string>("");
  const [pillAccentColor, setPillAccentColor] = React.useState<string>("");
  const [savedMsg, setSavedMsg] = React.useState<string>("");

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("weered_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.panelBgColor) setPanelBgColor(u.panelBgColor);
        if (u?.panelAccentColor) setPanelAccentColor(u.panelAccentColor);
        if (u?.pillBgColor) setPillBgColor(u.pillBgColor);
        if (u?.pillAccentColor) setPillAccentColor(u.pillAccentColor);
      }
    } catch {}
  }, []);

  // Debounced save — fires 400ms after the last colour change
  const saveTimer = React.useRef<any>(null);
  function scheduleSave(field: "panelBgColor" | "panelAccentColor" | "pillBgColor" | "pillAccentColor", value: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const tok = token();
      if (!tok) return;
      try {
        const r = await fetch(`${apiBase}/profile/me`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ [field]: value }),
        });
        if (r.ok) {
          // Update cached `me` so UserCorner picks it up on next mount
          try {
            const raw = localStorage.getItem("weered_user");
            if (raw) {
              const u = JSON.parse(raw);
              u[field] = value || null;
              localStorage.setItem("weered_user", JSON.stringify(u));
            }
          } catch {}
          // Tell UserCorner / others to re-render
          try { window.dispatchEvent(new CustomEvent("weered:profileColors", { detail: { field, value } })); } catch {}
          setSavedMsg("Saved");
          setTimeout(() => setSavedMsg(""), 1200);
        }
      } catch {}
    }, 400);
  }

  function clearField(field: "panelBgColor" | "panelAccentColor" | "pillBgColor" | "pillAccentColor", setter: (v: string) => void) {
    setter("");
    scheduleSave(field, "");
  }

  return (
    <Section title="Profile customization">
      <div style={{ fontSize: 11, color: "var(--weered-muted, rgba(148,163,184,.7))", marginBottom: 8 }}>
        Personalize how you appear in lobbies and on your right-rail card.
      </div>
      <ColorPickerRow
        label="ID badge background"
        hint="Tints the panel behind your name + role chips."
        value={panelBgColor}
        onChange={(v) => { setPanelBgColor(v); scheduleSave("panelBgColor", v); }}
        onClear={() => clearField("panelBgColor", setPanelBgColor)}
      />
      <ColorPickerRow
        label="ID badge accent"
        hint="Border, brackets, and avatar ring colour."
        value={panelAccentColor}
        onChange={(v) => { setPanelAccentColor(v); scheduleSave("panelAccentColor", v); }}
        onClear={() => clearField("panelAccentColor", setPanelAccentColor)}
      />
      <ColorPickerRow
        label="Presence pill"
        hint="How your row appears in friends lists and rails."
        value={pillBgColor}
        onChange={(v) => { setPillBgColor(v); scheduleSave("pillBgColor", v); }}
        onClear={() => clearField("pillBgColor", setPillBgColor)}
      />
      <ColorPickerRow
        label="Pill accent stripe"
        hint="The vertical bar on the left edge of your row. Default uses your role/tier color."
        value={pillAccentColor}
        onChange={(v) => { setPillAccentColor(v); scheduleSave("pillAccentColor", v); }}
        onClear={() => clearField("pillAccentColor", setPillAccentColor)}
      />
      <PillIntensityRow />
      {savedMsg && (
        <div style={{ fontSize: 11, color: "var(--weered-accent-text, rgba(167,139,250,.85))", marginTop: 4, textAlign: "right" }}>
          {savedMsg}
        </div>
      )}
    </Section>
  );
}

function PillIntensityRow() {
  // Local-only preference: how strongly OTHER users' pill colours render in
  // this user's view of friends/presence lists. 0 = off, 100 = solid.
  const [val, setVal] = React.useState<number>(60);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("weered:pillBgIntensity");
      const n = raw == null ? 60 : Math.max(0, Math.min(100, Number(raw)));
      if (Number.isFinite(n)) setVal(n);
    } catch {}
  }, []);
  function update(n: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(n)));
    setVal(clamped);
    try { localStorage.setItem("weered:pillBgIntensity", String(clamped)); } catch {}
    try { window.dispatchEvent(new CustomEvent("weered:pillBgIntensity", { detail: clamped })); } catch {}
  }
  return (
    <Row label="Pill intensity" hint="How strongly tinted pills render. 0 turns the tint off entirely.">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range"
          min={0} max={100} step={5}
          value={val}
          onChange={(e) => update(Number(e.target.value))}
          style={{ width: 120, accentColor: "var(--weered-accent-text, rgba(167,139,250,.85))" }}
        />
        <span style={{ fontFamily: "ui-monospace, 'JetBrains Mono', monospace", fontSize: 11, color: "var(--weered-muted, rgba(148,163,184,.75))", minWidth: 32, textAlign: "right" }}>
          {val}%
        </span>
      </div>
    </Row>
  );
}

function ColorPickerRow({
  label, hint, value, onChange, onClear,
}: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void; onClear: () => void;
}) {
  const safeValue = /^#[0-9a-f]{6}$/i.test(value) ? value : "#5800E5";
  return (
    <Row label={label} hint={hint}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="color"
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 36, height: 28, borderRadius: 6,
            border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
            background: "transparent", padding: 2, cursor: "pointer",
          }}
        />
        <span style={{ fontFamily: "ui-monospace, 'JetBrains Mono', monospace", fontSize: 11, color: "var(--weered-muted, rgba(148,163,184,.75))", minWidth: 64 }}>
          {value || "default"}
        </span>
        {value && (
          <button
            type="button"
            onClick={onClear}
            style={{
              padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
              border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
              background: "transparent", color: "var(--weered-muted, rgba(148,163,184,.85))",
              cursor: "pointer", fontFamily: "inherit",
            }}
            title="Reset to default"
          >
            Reset
          </button>
        )}
      </div>
    </Row>
  );
}

type BlockedRow = { id: string; userId: string; name: string; avatarColor: string | null; createdAt: string };

function BlockedUsersSection() {
  const [blocks, setBlocks] = React.useState<BlockedRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string>("");
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
  function token() { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } }

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/blocks`, { headers: { Authorization: `Bearer ${token()}` } });
      const j = await r.json();
      setBlocks(Array.isArray(j?.blocks) ? j.blocks : []);
    } catch {} finally { setLoading(false); }
  }, [apiBase]);

  React.useEffect(() => { void load(); }, [load]);

  async function unblock(userId: string) {
    setBusyId(userId);
    try {
      await fetch(`${apiBase}/users/${encodeURIComponent(userId)}/block`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      setBlocks(cur => cur.filter(b => b.userId !== userId));
    } finally { setBusyId(""); }
  }

  return (
    <Section title="Blocked Users">
      {loading ? (
        <div style={{ fontSize: 12, color: "var(--weered-muted, rgba(148,163,184,.65))", padding: "6px 0" }}>Loading…</div>
      ) : blocks.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--weered-muted, rgba(148,163,184,.65))", padding: "6px 0" }}>
          You haven't blocked anyone.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {blocks.map(b => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, background: "var(--weered-panel2, rgba(255,255,255,.03))", border: "1px solid var(--weered-border, rgba(255,255,255,.08))" }}>
              <div style={{ width: 26, height: 26, borderRadius: 999, background: b.avatarColor || "rgba(148,163,184,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {(b.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--weered-text, rgba(243,244,246,.92))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {b.name}
              </div>
              <button
                type="button"
                onClick={() => unblock(b.userId)}
                disabled={busyId === b.userId}
                style={{
                  padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
                  background: "transparent", color: "var(--weered-muted, rgba(148,163,184,.85))",
                  cursor: busyId === b.userId ? "default" : "pointer",
                  opacity: busyId === b.userId ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function PresenceSection() {
  const [steamId, setSteamId] = React.useState("");
  const [twitchLogin, setTwitchLogin] = React.useState("");
  const [xboxGamertag, setXboxGamertag] = React.useState("");
  const [saving, setSaving] = React.useState<"" | "steam" | "twitch" | "xbox">("");
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [linkedSteam, setLinkedSteam] = React.useState<string | null>(null);
  const [linkedTwitch, setLinkedTwitch] = React.useState<string | null>(null);
  const [linkedXbox, setLinkedXbox] = React.useState<string | null>(null);
  const [livePresence, setLivePresence] = React.useState<any>(null);
  const [presenceCheckedAt, setPresenceCheckedAt] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
  function token() { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } }

  const loadPresence = React.useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/profile/me/presence`, { headers: { Authorization: `Bearer ${token()}` } });
      const j = await r.json();
      if (j?.ok) {
        setLinkedSteam(j.steamId ?? null);
        setLinkedTwitch(j.twitchLogin ?? null);
        setLinkedXbox(j.xboxGamertag ?? null);
        setLivePresence(j.livePresence ?? null);
        setPresenceCheckedAt(j.presenceCheckedAt ?? null);
      }
    } catch {}
  }, [apiBase]);

  React.useEffect(() => { loadPresence(); }, [loadPresence]);

  async function refreshNow() {
    setRefreshing(true);
    try {
      const r = await fetch(`${apiBase}/profile/me/presence/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const j = await r.json();
      if (j?.ok) {
        setLivePresence(j.livePresence ?? null);
        setPresenceCheckedAt(j.presenceCheckedAt ?? null);
      }
    } catch {}
    setRefreshing(false);
  }

  async function saveSteam(clear?: boolean) {
    setSaving("steam"); setMsg(null);
    try {
      const r = await fetch(`${apiBase}/profile/me/steam-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ steamId: clear ? "" : steamId.trim() }),
      });
      const j = await r.json();
      if (j?.ok) {
        const resolvedNote = j?.resolvedFrom ? ` (resolved "${j.resolvedFrom}" → ${j.steamId})` : "";
        setMsg({ ok: true, text: clear ? "Steam disconnected." : `Steam linked${resolvedNote}. Polling your activity now…` });
        if (clear) setSteamId("");
        await loadPresence();
        if (!clear) { void refreshNow(); }
      } else setMsg({ ok: false, text: j?.message || j?.error || "Failed." });
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setSaving("");
  }

  async function saveTwitch(clear?: boolean) {
    setSaving("twitch"); setMsg(null);
    try {
      const r = await fetch(`${apiBase}/profile/me/twitch-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ twitchLogin: clear ? "" : twitchLogin.trim().toLowerCase() }),
      });
      const j = await r.json();
      if (j?.ok) {
        setMsg({ ok: true, text: clear ? "Twitch disconnected." : "Twitch linked. You'll show as streaming when live." });
        if (clear) setTwitchLogin("");
        await loadPresence();
        if (!clear) { void refreshNow(); }
      } else setMsg({ ok: false, text: j?.message || j?.error || "Failed." });
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setSaving("");
  }

  async function saveXbox(clear?: boolean) {
    setSaving("xbox"); setMsg(null);
    try {
      const r = await fetch(`${apiBase}/profile/me/xbox-gamertag`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ gamertag: clear ? "" : xboxGamertag.trim() }),
      });
      const j = await r.json();
      if (j?.ok) {
        setMsg({ ok: true, text: clear ? "Xbox disconnected." : `Xbox linked as ${j.xboxGamertag}. Polling your activity now…` });
        if (clear) setXboxGamertag("");
        await loadPresence();
        if (!clear) { void refreshNow(); }
      } else setMsg({ ok: false, text: j?.message || j?.error || "Failed." });
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setSaving("");
  }

  const inputStyle: React.CSSProperties = {
    width: 220, padding: "6px 10px", borderRadius: 8,
    border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
    background: "var(--weered-panel2, rgba(0,0,0,.3))",
    color: "var(--weered-text, rgba(243,244,246,.95))",
    fontFamily: "ui-monospace, monospace", fontSize: 12, outline: "none",
  };

  const stackedInputStyle: React.CSSProperties = {
    flex: 1, minWidth: 0,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
    background: "var(--weered-panel2, rgba(0,0,0,.3))",
    color: "var(--weered-text, rgba(243,244,246,.95))",
    fontFamily: "ui-monospace, monospace",
    fontSize: 13, outline: "none",
  };

  return (
    <Section title="Rich Presence">
      {/* Steam ID — stacked: label + hint on top, input row below */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--weered-text, rgba(243,244,246,.95))" }}>Steam ID</span>
          {linkedSteam && (
            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.3)", color: "rgba(134,239,172,.95)", letterSpacing: ".04em", fontWeight: 700 }}>LINKED</span>
          )}
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, color: "var(--weered-muted, rgba(148,163,184,.75))", lineHeight: 1.4 }}>
          Paste your 17-digit SteamID64, your Steam vanity URL name, or your full profile URL.
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input type="text" value={steamId} onChange={e => setSteamId(e.target.value.replace(/\s/g, ""))} placeholder={linkedSteam || "weeredjs  or  76561198000000000"} style={stackedInputStyle} />
          <button type="button" style={{ ...btnStyle, padding: "8px 14px", fontSize: 12 }} onClick={() => saveSteam(false)} disabled={saving === "steam" || steamId.trim().length < 2}>
            {saving === "steam" ? "Saving…" : "Link"}
          </button>
          <button type="button" style={{ ...btnStyle, padding: "8px 12px", fontSize: 12, opacity: 0.7 }} onClick={() => saveSteam(true)} disabled={saving === "steam"}>Clear</button>
        </div>
      </div>

      {/* Twitch login */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--weered-text, rgba(243,244,246,.95))" }}>Twitch login</span>
          {linkedTwitch && (
            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(139,92,246,.14)", border: "1px solid rgba(139,92,246,.32)", color: "rgba(196,181,253,.95)", letterSpacing: ".04em", fontWeight: 700 }}>LINKED</span>
          )}
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, color: "var(--weered-muted, rgba(148,163,184,.75))", lineHeight: 1.4 }}>
          Your Twitch username — friends see a live stream badge when you&apos;re on air.
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input type="text" value={twitchLogin} onChange={e => setTwitchLogin(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder={linkedTwitch || "your_twitch_login"} style={stackedInputStyle} />
          <button type="button" style={{ ...btnStyle, padding: "8px 14px", fontSize: 12 }} onClick={() => saveTwitch(false)} disabled={saving === "twitch" || !/^[a-z0-9_]{3,25}$/.test(twitchLogin.trim())}>
            {saving === "twitch" ? "Saving…" : "Link"}
          </button>
          <button type="button" style={{ ...btnStyle, padding: "8px 12px", fontSize: 12, opacity: 0.7 }} onClick={() => saveTwitch(true)} disabled={saving === "twitch"}>Clear</button>
        </div>
      </div>

      {/* Xbox gamertag */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--weered-text, rgba(243,244,246,.95))" }}>Xbox gamertag</span>
          {linkedXbox && (
            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(16,124,16,.14)", border: "1px solid rgba(16,124,16,.36)", color: "rgba(134,239,172,.95)", letterSpacing: ".04em", fontWeight: 700 }}>LINKED</span>
          )}
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, color: "var(--weered-muted, rgba(148,163,184,.75))", lineHeight: 1.4 }}>
          Your Xbox gamertag — friends see what you&apos;re playing on Xbox. Resolved via OpenXBL.
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input type="text" value={xboxGamertag} onChange={e => setXboxGamertag(e.target.value.slice(0, 20))} placeholder={linkedXbox || "YourGamertag"} style={stackedInputStyle} />
          <button type="button" style={{ ...btnStyle, padding: "8px 14px", fontSize: 12 }} onClick={() => saveXbox(false)} disabled={saving === "xbox" || xboxGamertag.trim().length < 3}>
            {saving === "xbox" ? "Saving…" : "Link"}
          </button>
          <button type="button" style={{ ...btnStyle, padding: "8px 12px", fontSize: 12, opacity: 0.7 }} onClick={() => saveXbox(true)} disabled={saving === "xbox"}>Clear</button>
        </div>
      </div>

      {/* Current detected state */}
      {(linkedSteam || linkedTwitch || linkedXbox) && (
        <div style={{
          marginTop: 12,
          padding: "12px 14px",
          borderRadius: 8,
          background: "rgba(124,58,237,0.06)",
          border: "1px solid rgba(124,58,237,0.18)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--weered-muted, rgba(148,163,184,.7))" }}>
                Detected now
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: "var(--weered-text, rgba(243,244,246,.95))" }}>
                {livePresence?.activity ? (
                  <>
                    <span style={{ fontWeight: 700, color: "rgba(196,181,253,.98)" }}>{livePresence.activity}</span>
                    {livePresence.detail && (
                      <span style={{ opacity: 0.75, marginLeft: 6, fontSize: 12, fontStyle: "italic" }}>— {String(livePresence.detail).slice(0, 80)}</span>
                    )}
                    <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.5, fontFamily: "ui-monospace, monospace" }}>via {livePresence.source || "?"}</span>
                  </>
                ) : (
                  <span style={{ opacity: 0.6, fontStyle: "italic" }}>Nothing detected yet. Go live on Twitch or open a Steam game and refresh.</span>
                )}
              </div>
              {presenceCheckedAt && (
                <div style={{ marginTop: 3, fontSize: 10, opacity: 0.45, fontFamily: "ui-monospace, monospace" }}>
                  last checked {new Date(presenceCheckedAt).toLocaleTimeString()}
                </div>
              )}
            </div>
            <button type="button" style={{ ...btnStyle, padding: "6px 12px", fontSize: 11 }} onClick={refreshNow} disabled={refreshing}>
              {refreshing ? "Checking…" : "Refresh"}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 6, fontSize: 11, color: msg.ok ? "rgba(134,239,172,.85)" : "rgba(252,165,165,.85)" }}>
          {msg.text}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 11, color: "var(--weered-muted, rgba(148,163,184,.55))", lineHeight: 1.5 }}>
        Find your SteamID64 at{" "}
        <a href="https://steamdb.info/calculator/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--weered-accent-text, rgba(196,181,253,0.95))", textDecoration: "underline" }}>
          steamdb.info/calculator
        </a>
        . Steam requires your game activity to be public. Twitch uses your login from{" "}
        <a href="https://twitch.tv" target="_blank" rel="noopener noreferrer" style={{ color: "var(--weered-accent-text, rgba(196,181,253,0.95))", textDecoration: "underline" }}>twitch.tv</a>.
      </div>
    </Section>
  );
}

function DangerZoneSection() {
  const [open, setOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
  function token() { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } }

  async function submit() {
    if (confirmText.trim() !== "DELETE" || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${apiBase}/profile/me/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const j = await r.json();
      if (j?.ok) {
        // Wipe local session then bounce to login
        try { localStorage.clear(); } catch {}
        try { sessionStorage.clear(); } catch {}
        window.location.href = "/login?deleted=1";
        return;
      }
      setBusy(false);
      alert(j?.error || "Deletion failed.");
    } catch {
      setBusy(false);
      alert("Network error. Try again.");
    }
  }

  return (
    <div
      style={{
        marginTop: 18,
        borderRadius: 10,
        border: "1px solid rgba(239,68,68,0.22)",
        background: "rgba(239,68,68,0.03)",
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "rgba(252,165,165,0.85)",
          marginBottom: 8,
        }}
      >
        Danger Zone
      </div>

      {!open ? (
        <div>
          <div style={{ fontSize: 12, color: "var(--weered-muted, rgba(148,163,184,.72))", marginBottom: 10, lineHeight: 1.5 }}>
            Permanently delete your account. Wipes your profile, login, linked accounts, location, and push subscriptions. Your messages remain but are attributed to a generic "deleted user" handle. This cannot be undone.
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid rgba(239,68,68,0.45)",
              background: "transparent",
              color: "rgba(252,165,165,0.9)",
              fontSize: 12,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: "pointer",
              transition: "background 0.12s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            Delete my account
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: "rgba(252,165,165,0.9)", marginBottom: 8, fontWeight: 700 }}>
            Last chance. This is permanent.
          </div>
          <div style={{ fontSize: 11, color: "var(--weered-muted, rgba(148,163,184,.7))", marginBottom: 10, lineHeight: 1.5 }}>
            Type <strong style={{ color: "rgba(252,165,165,0.95)", fontFamily: "ui-monospace, monospace" }}>DELETE</strong> in the box below to confirm. Then click <strong>Confirm deletion</strong>.
          </div>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            autoFocus
            disabled={busy}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(239,68,68,0.4)",
              background: "rgba(0,0,0,0.3)",
              color: "rgba(243,244,246,0.95)",
              fontFamily: "ui-monospace, monospace",
              fontSize: 13,
              outline: "none",
              marginBottom: 10,
            }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => { setOpen(false); setConfirmText(""); }}
              disabled={busy}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--weered-border, rgba(255,255,255,.12))", background: "transparent", color: "var(--weered-muted, rgba(148,163,184,.8))", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: busy ? "default" : "pointer" }}
            >Cancel</button>
            <button
              type="button"
              onClick={submit}
              disabled={confirmText.trim() !== "DELETE" || busy}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border: "1px solid rgba(239,68,68,0.55)",
                background: "rgba(239,68,68,0.18)",
                color: "rgba(254,202,202,0.98)",
                fontSize: 12,
                fontWeight: 800,
                fontFamily: "inherit",
                cursor: (confirmText.trim() !== "DELETE" || busy) ? "not-allowed" : "pointer",
                opacity: (confirmText.trim() !== "DELETE" || busy) ? 0.5 : 1,
              }}
            >
              {busy ? "Deleting..." : "Confirm deletion"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}