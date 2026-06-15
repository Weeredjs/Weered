"use client";

import React from "react";
import { openConsentBanner } from "../../CookieConsent";
import PresenceSection from "./PresenceSection";

type Settings = {
  theme: "stone" | "slate" | "zinc" | "gray" | "ishimura" | "broadcast" | "press";
  density: "comfortable" | "compact";
  reduceMotion: boolean;
  keepDefaultThemeInLobbies: boolean;

  dockDefaultTab: "room" | "dms";
  enterToSend: boolean;
  confirmDestructive: boolean;

  showOnline: boolean;
  allowDMs: boolean;

  notifyDMs: boolean;
  notifyMentions: boolean;
  notifySound: boolean;
  notifyDesktop: boolean;

  debugOverlays: boolean;
};

const KEY = "weered:settings:v0";

const DEFAULTS: Settings = {
  theme: "press",
  density: "comfortable",
  reduceMotion: false,
  keepDefaultThemeInLobbies: true,

  dockDefaultTab: "dms",
  enterToSend: true,
  confirmDestructive: true,

  showOnline: true,
  allowDMs: true,

  notifyDMs: true,
  notifyMentions: true,
  notifySound: false,
  notifyDesktop: false,

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
    window.dispatchEvent(new Event("weered:settings"));
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
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        padding: "8px 0",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--weered-text, rgba(243,244,246,.95))",
          }}
        >
          {label}
        </div>
        {hint ? (
          <div
            style={{
              fontSize: 11,
              opacity: 0.6,
              marginTop: 2,
              color: "var(--weered-muted, rgba(148,163,184,.75))",
            }}
          >
            {hint}
          </div>
        ) : null}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
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
        background: checked
          ? "var(--weered-accent-bg, rgba(124,58,237,.25))"
          : "rgba(255,255,255,.05)",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
        padding: 0,
        outline: "none",
        boxShadow: checked
          ? "inset 0 0 0 1px var(--weered-accent-ring, rgba(124,58,237,.4))"
          : "none",
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
          background: checked
            ? "var(--weered-accent-text, rgba(243,244,246,.95))"
            : "rgba(243,244,246,.75)",
          transition: "left 0.15s cubic-bezier(0.22,1,0.36,1), background 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,.4)",
        }}
      />
    </button>
  );
}

const THEME_OPTIONS: { id: Settings["theme"]; name: string; sw: string }[] = [
  { id: "press", name: "Press", sw: "#7C3AED" },
  { id: "ishimura", name: "Ishimura", sw: "#22d3ee" },
  { id: "broadcast", name: "Broadcast", sw: "#22c55e" },
  { id: "slate", name: "Slate", sw: "#64748b" },
  { id: "stone", name: "Stone", sw: "#78716c" },
  { id: "zinc", name: "Zinc", sw: "#71717a" },
  { id: "gray", name: "Gray", sw: "#6b7280" },
];

function JoinPolicyRow({
  field = "joinPolicy",
  label = "Who can join your session",
  hint = "Controls the Join button others see on your profile and in their friends list.",
}: { field?: string; label?: string; hint?: string } = {}) {
  const [policy, setPolicy] = React.useState<string>("FRIENDS");
  const [loaded, setLoaded] = React.useState(false);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
  const hdr = (): Record<string, string> => {
    try {
      const t = localStorage.getItem("weered_token") || "";
      return t ? { Authorization: `Bearer ${t}` } : {};
    } catch {
      return {};
    }
  };
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = JSON.parse(localStorage.getItem("weered_user") || "null");
        if (!me?.id) return;
        const j = await fetch(`${apiBase}/profile/${me.id}`, { headers: hdr() }).then((r) =>
          r.json(),
        );
        if (alive && j?.[field]) setPolicy(String(j[field]));
      } catch {
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const save = async (v: string) => {
    setPolicy(v);
    try {
      await fetch(`${apiBase}/profile/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...hdr() },
        body: JSON.stringify({ [field]: v }),
      });
    } catch {}
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--weered-text, rgba(243,244,246,.92))",
          }}
        >
          {label}
        </div>
        <div
          style={{ fontSize: 11, color: "var(--weered-muted, rgba(148,163,184,.6))", marginTop: 2 }}
        >
          {hint}
        </div>
      </div>
      <select
        value={policy}
        disabled={!loaded}
        onChange={(e) => void save(e.target.value)}
        style={{
          padding: "7px 10px",
          borderRadius: 8,
          border: "1px solid var(--weered-bd2, rgba(255,255,255,.12))",
          background: "rgba(0,0,0,.3)",
          color: "var(--weered-text, rgba(243,244,246,.9))",
          fontSize: 12,
          fontFamily: "inherit",
          cursor: "pointer",
          outline: "none",
          flexShrink: 0,
        }}
      >
        <option value="EVERYONE">Everyone</option>
        <option value="FRIENDS">Friends only</option>
        <option value="OFF">Nobody</option>
      </select>
    </div>
  );
}

export default function SettingsSheet({ initialTab }: { initialTab?: string } = {}) {
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

  const TABS = [
    { id: "account", label: "Account", icon: "◆" },
    { id: "appearance", label: "Appearance", icon: "◐" },
    { id: "behavior", label: "Behavior", icon: "▸" },
    { id: "privacy", label: "Privacy & Safety", icon: "⛉" },
    { id: "notifs", label: "Notifications", icon: "◔" },
    { id: "developer", label: "Developer", icon: "⚙" },
  ] as const;
  type TabId = (typeof TABS)[number]["id"];
  const [tab, setTab] = React.useState<TabId>(
    (TABS.some((t) => t.id === initialTab) ? initialTab : "account") as TabId,
  );

  return (
    <div style={{ padding: 16, color: "var(--weered-text, rgba(243,244,246,.95))" }}>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Settings</div>
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4, marginBottom: 14 }}>
        How Weered behaves and how you appear.
      </div>

      <div
        className="weered-settings-shell"
        style={{ display: "flex", gap: 16, alignItems: "flex-start" }}
      >
        <nav
          className="weered-settings-nav"
          style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, width: 150 }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "8px 11px",
                  borderRadius: 7,
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: active ? 700 : 600,
                  border: "1px solid transparent",
                  background: active
                    ? "var(--weered-accent-bg, rgba(124,58,237,.16))"
                    : "transparent",
                  color: active
                    ? "var(--weered-text, rgba(243,244,246,.98))"
                    : "var(--weered-muted, rgba(148,163,184,.8))",
                  transition: "background .12s, color .12s",
                }}
                onMouseOver={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)";
                }}
                onMouseOut={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span
                  style={{
                    width: 16,
                    textAlign: "center",
                    opacity: 0.85,
                    color: active ? "var(--weered-accent-text, rgba(196,181,253,.95))" : "inherit",
                  }}
                >
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="weered-settings-panel" style={{ flex: 1, minWidth: 0 }}>
          {tab === "account" && (
            <>
              <PresenceSection />
            </>
          )}

          {tab === "appearance" && (
            <>
              <Section
                title="Display"
                onReset={() =>
                  patch({
                    density: DEFAULTS.density,
                    reduceMotion: DEFAULTS.reduceMotion,
                    keepDefaultThemeInLobbies: DEFAULTS.keepDefaultThemeInLobbies,
                  })
                }
              >
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
                <Row
                  label="Keep default theme in themed lobbies"
                  hint="Themed lobbies (Windrose, Destiny 2, D&D, etc.) show the default minimal theme instead of their custom skin."
                >
                  <Toggle
                    checked={s.keepDefaultThemeInLobbies}
                    onChange={(v) => patch({ keepDefaultThemeInLobbies: v })}
                  />
                </Row>
              </Section>

              <Section
                title="Theme"
                onReset={() => {
                  patch({ theme: DEFAULTS.theme });
                  try {
                    document.documentElement.setAttribute("data-weered-theme", DEFAULTS.theme);
                  } catch {}
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 9 }}>
                  The platform skin. Applies everywhere except lobbies running their own theme.
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))",
                    gap: 8,
                  }}
                >
                  {THEME_OPTIONS.map((t) => {
                    const active = s.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          patch({ theme: t.id });
                          try {
                            document.documentElement.setAttribute("data-weered-theme", t.id);
                          } catch {}
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 10px",
                          cursor: "pointer",
                          borderRadius: 3,
                          fontFamily: "inherit",
                          fontSize: 12,
                          fontWeight: 700,
                          textAlign: "left",
                          color: active ? "#fff" : "rgba(226,232,240,.72)",
                          background: active ? "rgba(124,58,237,.16)" : "rgba(255,255,255,.03)",
                          border: active
                            ? "1px solid rgba(167,139,250,.7)"
                            : "1px solid rgba(255,255,255,.08)",
                          transition: "background .12s, border-color .12s, color .12s",
                        }}
                      >
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: t.sw,
                            boxShadow: `0 0 8px ${t.sw}99`,
                            flexShrink: 0,
                          }}
                        />
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <ProfileCustomizationSection />
            </>
          )}

          {tab === "behavior" && (
            <Section
              title="Behavior"
              onReset={() =>
                patch({
                  dockDefaultTab: DEFAULTS.dockDefaultTab,
                  enterToSend: DEFAULTS.enterToSend,
                  confirmDestructive: DEFAULTS.confirmDestructive,
                })
              }
            >
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
              <Row
                label="Confirm destructive actions"
                hint="Deletes and clears ask before running."
              >
                <Toggle
                  checked={s.confirmDestructive}
                  onChange={(v) => patch({ confirmDestructive: v })}
                />
              </Row>
            </Section>
          )}

          {tab === "privacy" && (
            <>
              <Section
                title="Privacy"
                onReset={() =>
                  patch({ showOnline: DEFAULTS.showOnline, allowDMs: DEFAULTS.allowDMs })
                }
              >
                <Row label="Show online status" hint="Broadcast presence in lobbies and crews.">
                  <Toggle checked={s.showOnline} onChange={(v) => patch({ showOnline: v })} />
                </Row>
                <Row label="Allow DMs" hint="Let anyone send you a direct message.">
                  <Toggle checked={s.allowDMs} onChange={(v) => patch({ allowDMs: v })} />
                </Row>
                <JoinPolicyRow />
                <JoinPolicyRow
                  field="invitePolicy"
                  label="Who can invite you"
                  hint="Controls who can send you room invites from their friends list."
                />
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

              <BlockedUsersSection />
              <DangerZoneSection />
            </>
          )}

          {tab === "notifs" && (
            <Section
              title="Notifications"
              onReset={() =>
                patch({
                  notifyDMs: DEFAULTS.notifyDMs,
                  notifyMentions: DEFAULTS.notifyMentions,
                  notifySound: DEFAULTS.notifySound,
                  notifyDesktop: DEFAULTS.notifyDesktop,
                })
              }
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--weered-muted, rgba(148,163,184,.7))",
                  marginBottom: 8,
                }}
              >
                What pings you, and how. These are stored on this device.
              </div>
              <Row label="Direct messages" hint="Get notified when someone DMs you.">
                <Toggle checked={s.notifyDMs} onChange={(v) => patch({ notifyDMs: v })} />
              </Row>
              <Row label="Mentions" hint="Get notified when someone @mentions you in a room.">
                <Toggle checked={s.notifyMentions} onChange={(v) => patch({ notifyMentions: v })} />
              </Row>
              <Row label="Notification sound" hint="Play a sound on new pings.">
                <Toggle checked={s.notifySound} onChange={(v) => patch({ notifySound: v })} />
              </Row>
              <Row
                label="Desktop notifications"
                hint="Show OS notifications when Weered isn't focused. Requires browser permission."
              >
                <DesktopNotifyToggle
                  enabled={s.notifyDesktop}
                  onChange={(v) => patch({ notifyDesktop: v })}
                />
              </Row>
            </Section>
          )}

          {tab === "developer" && (
            <Section title="Developer">
              <Row label="Debug overlays" hint="Surface extra diagnostic labels.">
                <Toggle checked={s.debugOverlays} onChange={(v) => patch({ debugOverlays: v })} />
              </Row>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" style={btnStyle} onClick={copyDiagnostics}>
                  {copied ? "Copied" : "Copy diagnostics"}
                </button>
                <button type="button" style={btnStyle} onClick={resetLocal}>
                  Reset all settings
                </button>
              </div>
            </Section>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .weered-settings-shell { flex-direction: column !important; }
          .weered-settings-nav {
            flex-direction: row !important; width: 100% !important;
            overflow-x: auto; gap: 4px !important; padding-bottom: 4px;
          }
          .weered-settings-nav button { white-space: nowrap; }
        }
      `}</style>
    </div>
  );
}

function DesktopNotifyToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  const [denied, setDenied] = React.useState(false);
  async function handle(v: boolean) {
    if (!v) {
      onChange(false);
      return;
    }
    if (typeof Notification === "undefined") {
      setDenied(true);
      return;
    }
    if (Notification.permission === "granted") {
      onChange(true);
      return;
    }
    if (Notification.permission === "denied") {
      setDenied(true);
      return;
    }
    const res = await Notification.requestPermission();
    if (res === "granted") {
      onChange(true);
      setDenied(false);
    } else {
      onChange(false);
      setDenied(true);
    }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Toggle checked={enabled} onChange={handle} />
      {denied && (
        <span style={{ fontSize: 10, color: "rgba(252,165,165,.9)" }}>Blocked in browser</span>
      )}
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

export const btnStyle: React.CSSProperties = {
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

export function Section({
  title,
  children,
  onReset,
}: {
  title: string;
  children: React.ReactNode;
  onReset?: () => void;
}) {
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
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
          }}
        >
          {title}
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--weered-muted, rgba(148,163,184,.6))",
              padding: "2px 4px",
            }}
            title={`Reset ${title} to defaults`}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.color =
                "var(--weered-text, rgba(243,244,246,.9))";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.color =
                "var(--weered-muted, rgba(148,163,184,.6))";
            }}
          >
            Reset ⟲
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function ProfileCustomizationSection() {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
  function token() {
    try {
      return localStorage.getItem("weered_token") || "";
    } catch {
      return "";
    }
  }

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

  const saveTimer = React.useRef<any>(null);
  function scheduleSave(
    field: "panelBgColor" | "panelAccentColor" | "pillBgColor" | "pillAccentColor",
    value: string,
  ) {
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
          try {
            const raw = localStorage.getItem("weered_user");
            if (raw) {
              const u = JSON.parse(raw);
              u[field] = value || null;
              localStorage.setItem("weered_user", JSON.stringify(u));
            }
          } catch {}
          try {
            window.dispatchEvent(
              new CustomEvent("weered:profileColors", { detail: { field, value } }),
            );
          } catch {}
          try {
            window.dispatchEvent(new CustomEvent("weered:profile:updated"));
          } catch {}
          setSavedMsg("Saved");
          setTimeout(() => setSavedMsg(""), 1200);
        }
      } catch {}
    }, 400);
  }

  function clearField(
    field: "panelBgColor" | "panelAccentColor" | "pillBgColor" | "pillAccentColor",
    setter: (v: string) => void,
  ) {
    setter("");
    scheduleSave(field, "");
  }

  function resetColors() {
    clearField("panelBgColor", setPanelBgColor);
    clearField("panelAccentColor", setPanelAccentColor);
    clearField("pillBgColor", setPillBgColor);
    clearField("pillAccentColor", setPillAccentColor);
  }

  const ACCENT_PRESETS: { label: string; value: string }[] = [
    { label: "Purple", value: "#5b21b6" },
    { label: "Gold", value: "#b8860b" },
    { label: "Crimson", value: "#9f1239" },
    { label: "Teal", value: "#0d7a6f" },
    { label: "Slate", value: "#3b4a6b" },
  ];

  return (
    <Section title="Your colors" onReset={resetColors}>
      <div
        style={{
          fontSize: 11,
          color: "var(--weered-muted, rgba(148,163,184,.7))",
          marginBottom: 10,
        }}
      >
        Personalize how you appear in lobbies and on your right-rail ID card. Changes save
        automatically.
      </div>

      <ColorPreview
        accent={panelAccentColor || "#5b21b6"}
        panelBg={panelBgColor || "#14161A"}
        pillBg={pillBgColor}
        pillStripe={pillAccentColor}
      />

      <div
        style={{
          margin: "12px 0 4px",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--weered-muted, rgba(148,163,184,.8))",
        }}
      >
        Quick accent
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {ACCENT_PRESETS.map((p) => {
          const active = panelAccentColor.toLowerCase() === p.value.toLowerCase();
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                setPanelAccentColor(p.value);
                scheduleSave("panelAccentColor", p.value);
              }}
              title={p.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: 700,
                border: active
                  ? `1px solid ${p.value}`
                  : "1px solid var(--weered-border, rgba(255,255,255,.12))",
                background: active ? `${p.value}22` : "transparent",
                color: "var(--weered-text, rgba(243,244,246,.9))",
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: p.value,
                  border: "1px solid rgba(255,255,255,.2)",
                }}
              />
              {p.label}
            </button>
          );
        })}
      </div>

      <ColorPickerRow
        label="Accent color"
        hint="The purple used on every header bar, banner, ID bracket, and avatar ring in calm-mode lobbies. This is the platform accent — change it and the whole theme follows."
        value={panelAccentColor}
        onChange={(v) => {
          setPanelAccentColor(v);
          scheduleSave("panelAccentColor", v);
        }}
        onClear={() => clearField("panelAccentColor", setPanelAccentColor)}
      />
      <ColorPickerRow
        label="Panel background"
        hint="Tints the grey surfaces behind your rail sections and ID card body."
        value={panelBgColor}
        onChange={(v) => {
          setPanelBgColor(v);
          scheduleSave("panelBgColor", v);
        }}
        onClear={() => clearField("panelBgColor", setPanelBgColor)}
      />
      <ColorPickerRow
        label="Your row tint"
        hint="The background color of your name-row as it appears in other people's friends lists and rails."
        value={pillBgColor}
        onChange={(v) => {
          setPillBgColor(v);
          scheduleSave("pillBgColor", v);
        }}
        onClear={() => clearField("pillBgColor", setPillBgColor)}
      />
      <ColorPickerRow
        label="Row stripe"
        hint="The vertical bar on the left edge of your row. Leave default to use your role/tier color."
        value={pillAccentColor}
        onChange={(v) => {
          setPillAccentColor(v);
          scheduleSave("pillAccentColor", v);
        }}
        onClear={() => clearField("pillAccentColor", setPillAccentColor)}
      />
      <PillIntensityRow />
      <BannerUploadRow />
      {savedMsg && (
        <div
          style={{
            fontSize: 11,
            color: "var(--weered-accent-text, rgba(167,139,250,.85))",
            marginTop: 4,
            textAlign: "right",
          }}
        >
          {savedMsg}
        </div>
      )}
    </Section>
  );
}

function ColorPreview({
  accent,
  panelBg,
  pillBg,
  pillStripe,
}: {
  accent: string;
  panelBg: string;
  pillBg: string;
  pillStripe: string;
}) {
  const stripe = pillStripe || accent;
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <div
        style={{
          flex: "1 1 180px",
          minWidth: 160,
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,.08)",
          background: panelBg,
        }}
      >
        <div
          style={{
            height: 26,
            background: accent,
            clipPath: "polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)",
            display: "flex",
            alignItems: "center",
            padding: "0 10px",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#fff",
          }}
        >
          Your ID card
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px" }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              border: `2px solid ${accent}`,
              background: "rgba(255,255,255,.08)",
              flexShrink: 0,
            }}
          />
          <div style={{ fontSize: 12, fontWeight: 700 }}>You</div>
        </div>
      </div>
      <div
        style={{
          flex: "1 1 180px",
          minWidth: 160,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: 9,
            opacity: 0.5,
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          In a friends list
        </div>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            overflow: "hidden",
            background: pillBg
              ? `linear-gradient(90deg, ${pillBg}99, ${pillBg}33 60%, transparent)`
              : "rgba(255,255,255,.03)",
            border: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 4,
              bottom: 4,
              width: 3,
              borderRadius: "0 2px 2px 0",
              background: stripe,
            }}
          />
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              background: "rgba(255,255,255,.1)",
              flexShrink: 0,
              marginLeft: 2,
            }}
          />
          <div style={{ fontSize: 12, fontWeight: 700 }}>You</div>
        </div>
      </div>
    </div>
  );
}

function BannerUploadRow() {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
  function token() {
    try {
      return localStorage.getItem("weered_token") || "";
    } catch {
      return "";
    }
  }

  const [bannerUrl, setBannerUrl] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string>("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const tok = token();
    if (!tok) return;
    try {
      const raw = localStorage.getItem("weered_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.id) {
          fetch(`${apiBase}/profile/${encodeURIComponent(u.id)}`, {
            headers: { Authorization: `Bearer ${tok}` },
          })
            .then((r) => r.json())
            .then((j) => {
              if (j?.bannerUrl) setBannerUrl(String(j.bannerUrl));
            })
            .catch(() => {});
        }
      }
    } catch {}
  }, [apiBase]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setErr("");
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      setErr("Image must be under 4 MB.");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(f.type)) {
      setErr("Use PNG, JPEG, WebP, or GIF.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result || ""));
        r.onerror = () => rej(new Error("read_failed"));
        r.readAsDataURL(f);
      });
      const tok = token();
      const r = await fetch(`${apiBase}/profile/banner/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ image: dataUrl }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setErr(j?.message || j?.error || "Upload failed.");
      } else {
        setBannerUrl(String(j.bannerUrl));
        try {
          window.dispatchEvent(
            new CustomEvent("weered:profileColors", { detail: { bannerUrl: j.bannerUrl } }),
          );
        } catch {}
        try {
          window.dispatchEvent(new CustomEvent("weered:profile:updated"));
        } catch {}
      }
    } catch (ex: any) {
      setErr(ex?.message || "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function clear() {
    setBusy(true);
    setErr("");
    try {
      const tok = token();
      const r = await fetch(`${apiBase}/profile/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ bannerUrl: "" }),
      });
      if (r.ok) {
        setBannerUrl("");
        try {
          window.dispatchEvent(
            new CustomEvent("weered:profileColors", { detail: { bannerUrl: null } }),
          );
        } catch {}
        try {
          window.dispatchEvent(new CustomEvent("weered:profile:updated"));
        } catch {}
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row
      label="ID card banner"
      hint="Wide image at the top of your right-rail card. PNG/JPEG/WebP/GIF, ≤4 MB. Indicted+ tier."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "stretch",
          minWidth: 240,
        }}
      >
        {bannerUrl && (
          <div
            style={{
              width: "100%",
              height: 56,
              borderRadius: 6,
              overflow: "hidden",
              background: `url(${bannerUrl}) center / cover no-repeat`,
              border: "1px solid rgba(255,255,255,.08)",
            }}
          />
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            style={{
              flex: 1,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 4,
              cursor: busy ? "default" : "pointer",
              background: "rgba(167,139,250,.14)",
              border: "1px solid rgba(167,139,250,.4)",
              color: "rgba(216,180,254,.95)",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? "Uploading…" : bannerUrl ? "Replace" : "Upload banner"}
          </button>
          {bannerUrl && (
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              style={{
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 4,
                cursor: busy ? "default" : "pointer",
                background: "transparent",
                border: "1px solid rgba(148,163,184,.3)",
                color: "rgba(148,163,184,.9)",
              }}
            >
              Clear
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onPick}
          style={{ display: "none" }}
        />
        {err && <div style={{ fontSize: 11, color: "rgba(252,165,165,.95)" }}>{err}</div>}
      </div>
    </Row>
  );
}

function PillIntensityRow() {
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
    try {
      localStorage.setItem("weered:pillBgIntensity", String(clamped));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent("weered:pillBgIntensity", { detail: clamped }));
    } catch {}
  }
  return (
    <Row
      label="Pill intensity"
      hint="How strongly tinted pills render. 0 turns the tint off entirely."
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={val}
          onChange={(e) => update(Number(e.target.value))}
          style={{ width: 120, accentColor: "var(--weered-accent-text, rgba(167,139,250,.85))" }}
        />
        <span
          style={{
            fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
            fontSize: 11,
            color: "var(--weered-muted, rgba(148,163,184,.75))",
            minWidth: 32,
            textAlign: "right",
          }}
        >
          {val}%
        </span>
      </div>
    </Row>
  );
}

function ColorPickerRow({
  label,
  hint,
  value,
  onChange,
  onClear,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
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
            width: 36,
            height: 28,
            borderRadius: 6,
            border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
            background: "transparent",
            padding: 2,
            cursor: "pointer",
          }}
        />
        <span
          style={{
            fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
            fontSize: 11,
            color: "var(--weered-muted, rgba(148,163,184,.75))",
            minWidth: 64,
          }}
        >
          {value || "default"}
        </span>
        {value && (
          <button
            type="button"
            onClick={onClear}
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
              background: "transparent",
              color: "var(--weered-muted, rgba(148,163,184,.85))",
              cursor: "pointer",
              fontFamily: "inherit",
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

type BlockedRow = {
  id: string;
  userId: string;
  name: string;
  avatarColor: string | null;
  createdAt: string;
};

function BlockedUsersSection() {
  const [blocks, setBlocks] = React.useState<BlockedRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string>("");
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
  function token() {
    try {
      return localStorage.getItem("weered_token") || "";
    } catch {
      return "";
    }
  }

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/blocks`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const j = await r.json();
      setBlocks(Array.isArray(j?.blocks) ? j.blocks : []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function unblock(userId: string) {
    setBusyId(userId);
    try {
      await fetch(`${apiBase}/users/${encodeURIComponent(userId)}/block`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      setBlocks((cur) => cur.filter((b) => b.userId !== userId));
    } finally {
      setBusyId("");
    }
  }

  return (
    <Section title="Blocked Users">
      {loading ? (
        <div
          style={{
            fontSize: 12,
            color: "var(--weered-muted, rgba(148,163,184,.65))",
            padding: "6px 0",
          }}
        >
          Loading…
        </div>
      ) : blocks.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: "var(--weered-muted, rgba(148,163,184,.65))",
            padding: "6px 0",
          }}
        >
          You haven't blocked anyone.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {blocks.map((b) => (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 10px",
                borderRadius: 8,
                background: "var(--weered-panel2, rgba(255,255,255,.03))",
                border: "1px solid var(--weered-border, rgba(255,255,255,.08))",
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: b.avatarColor || "rgba(148,163,184,.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {(b.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--weered-text, rgba(243,244,246,.92))",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {b.name}
              </div>
              <button
                type="button"
                onClick={() => unblock(b.userId)}
                disabled={busyId === b.userId}
                style={{
                  padding: "5px 10px",
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 700,
                  border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
                  background: "transparent",
                  color: "var(--weered-muted, rgba(148,163,184,.85))",
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

function DangerZoneSection() {
  const [open, setOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
  function token() {
    try {
      return localStorage.getItem("weered_token") || "";
    } catch {
      return "";
    }
  }

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
        try {
          localStorage.clear();
        } catch {}
        try {
          sessionStorage.clear();
        } catch {}
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
          <div
            style={{
              fontSize: 12,
              color: "var(--weered-muted, rgba(148,163,184,.72))",
              marginBottom: 10,
              lineHeight: 1.5,
            }}
          >
            Permanently delete your account. Wipes your profile, login, linked accounts, location,
            and push subscriptions. Your messages remain but are attributed to a generic "deleted
            user" handle. This cannot be undone.
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
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            Delete my account
          </button>
        </div>
      ) : (
        <div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(252,165,165,0.9)",
              marginBottom: 8,
              fontWeight: 700,
            }}
          >
            Last chance. This is permanent.
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--weered-muted, rgba(148,163,184,.7))",
              marginBottom: 10,
              lineHeight: 1.5,
            }}
          >
            Type{" "}
            <strong
              style={{ color: "rgba(252,165,165,0.95)", fontFamily: "ui-monospace, monospace" }}
            >
              DELETE
            </strong>{" "}
            in the box below to confirm. Then click <strong>Confirm deletion</strong>.
          </div>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
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
              onClick={() => {
                setOpen(false);
                setConfirmText("");
              }}
              disabled={busy}
              style={{
                padding: "7px 12px",
                borderRadius: 8,
                border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
                background: "transparent",
                color: "var(--weered-muted, rgba(148,163,184,.8))",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: busy ? "default" : "pointer",
              }}
            >
              Cancel
            </button>
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
                cursor: confirmText.trim() !== "DELETE" || busy ? "not-allowed" : "pointer",
                opacity: confirmText.trim() !== "DELETE" || busy ? 0.5 : 1,
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
