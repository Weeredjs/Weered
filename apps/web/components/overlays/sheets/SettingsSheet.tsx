"use client";

import React from "react";
import { openConsentBanner } from "../../CookieConsent";
import PresenceSection from "./PresenceSection";
import { onActivate } from "@/lib/a11y";
import { useRouter } from "next/navigation";


import { useOverlay } from "../OverlayProvider";
import { startDesign } from "../../../lib/shellDesign";


// Web sessions are an httpOnly cookie (Domain=.weered.ca); mobile/desktop send a
// Bearer token from localStorage. Every request in this sheet sends the cookie,
// adds the Bearer only if one exists, and if a stale Bearer is refused (401)
// retries on the cookie alone and discards that token. The previous code gated
// every save on the localStorage token, which web logins stopped writing when
// auth moved to the cookie, so the sheet silently saved nothing.
export async function settingsFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let tok = "";
  try { tok = localStorage.getItem("weered_token") || ""; } catch {}
  const withAuth = (t: string): RequestInit => ({
    ...init,
    credentials: "include",
    headers: { ...((init.headers as Record<string, string>) || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
  let r = await fetch(url, withAuth(tok));
  if (r.status === 401 && tok) {
    r = await fetch(url, withAuth(""));
    if (r.status !== 401) { try { localStorage.removeItem("weered_token"); } catch {} }
  }
  return r;
}
type Settings = {
  theme: "stone" | "slate" | "zinc" | "gray" | "ishimura" | "broadcast" | "press" | "nebula";
  density: "comfortable" | "compact";
  reduceMotion: boolean;
  keepDefaultTheme: boolean;

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
  theme: "nebula",
  density: "comfortable",
  reduceMotion: false,
  // A fresh field: the old keepDefaultThemeInLobbies defaulted to true and sits
  // in most saved settings (see keepsDefaultTheme in lib/lobbyChrome).
  keepDefaultTheme: false,

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

export function Row({
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


function JoinPolicyRow({ field = "joinPolicy", label = "Who can join your session", hint = "Controls the Join button others see on your profile and in their friends list." }: { field?: string; label?: string; hint?: string } = {}) {
  const [policy, setPolicy] = React.useState<string>("FRIENDS");
  const [loaded, setLoaded] = React.useState(false);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
  React.useEffect(() => {
    let alive = true;
    void ((async () => {
      try {
        const me = JSON.parse(localStorage.getItem("weered_user") || "null");
        if (!me?.id) return;
        const j = await settingsFetch(`${apiBase}/profile/${me.id}`, {}).then(r => r.json());
        if (alive && j?.[field]) setPolicy(String(j[field]));
      } catch {} finally { if (alive) setLoaded(true); }
    })());
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const save = async (v: string) => {
    setPolicy(v);
    try {
      await settingsFetch(`${apiBase}/profile/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: v }),
      });
    } catch {}
  };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--weered-text, rgba(243,244,246,.92))" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--weered-muted, rgba(148,163,184,.6))", marginTop: 2 }}>
          {hint}
        </div>
      </div>
      <select
        value={policy}
        disabled={!loaded}
        onChange={(e) => void save(e.target.value)}
        style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--weered-bd2, rgba(255,255,255,.12))", background: "rgba(0,0,0,.3)", color: "var(--weered-text, rgba(243,244,246,.9))", fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none", flexShrink: 0 }}
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
    { id: "account",    label: "Account",       icon: "◆" },
    { id: "appearance", label: "Appearance",    icon: "◐" },
    { id: "behavior",   label: "Behavior",      icon: "▸" },
    { id: "privacy",    label: "Privacy & Safety", icon: "⛉" },
    { id: "notifs",     label: "Notifications", icon: "◔" },
    { id: "developer",  label: "Developer",     icon: "⚙" },
  ] as const;
  type TabId = typeof TABS[number]["id"];
  const [tab, setTab] = React.useState<TabId>(
    (TABS.some(t => t.id === initialTab) ? initialTab : "account") as TabId
  );

  return (
    <div style={{ padding: 16, color: "var(--weered-text, rgba(243,244,246,.95))" }}>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Settings</div>
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4, marginBottom: 14 }}>
        How Weered behaves and how you appear.
      </div>


      <div className="weered-settings-shell" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <nav className="weered-settings-nav" style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, width: 150 }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                onKeyDown={onActivate(() => setTab(t.id))}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 11px", borderRadius: 7, width: "100%",
                  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: active ? 700 : 600,
                  border: "1px solid transparent",
                  background: active ? "var(--weered-accent-bg, rgba(124,58,237,.16))" : "transparent",
                  color: active ? "var(--weered-text, rgba(243,244,246,.98))" : "var(--weered-muted, rgba(148,163,184,.8))",
                  transition: "background .12s, color .12s",
                }}
                onMouseOver={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
                onMouseOut={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                onFocus={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
                onBlur={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ width: 16, textAlign: "center", opacity: 0.85, color: active ? "var(--weered-accent-text, rgba(196,181,253,.95))" : "inherit" }}>{t.icon}</span>
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
              <AppearancePointers />
            </>
          )}

          {tab === "behavior" && (
            <Section title="Behavior" onReset={() => patch({ dockDefaultTab: DEFAULTS.dockDefaultTab, enterToSend: DEFAULTS.enterToSend, confirmDestructive: DEFAULTS.confirmDestructive })}>
              <Row label="Burner default tab" hint="Which tab opens first when you hit Burner.">
                <select style={selectStyle} value={s.dockDefaultTab} onChange={(e) => patch({ dockDefaultTab: e.target.value as any })}>
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
          )}

          {tab === "privacy" && (
            <>
              <Section title="Privacy" onReset={() => patch({ showOnline: DEFAULTS.showOnline, allowDMs: DEFAULTS.allowDMs })}>
                <Row label="Show online status" hint="Broadcast presence in lobbies and crews.">
                  <Toggle checked={s.showOnline} onChange={(v) => patch({ showOnline: v })} />
                </Row>
                <Row label="Allow DMs" hint="Let anyone send you a direct message.">
                  <Toggle checked={s.allowDMs} onChange={(v) => patch({ allowDMs: v })} />
                </Row>
                <JoinPolicyRow />
                <JoinPolicyRow field="invitePolicy" label="Who can invite you" hint="Controls who can send you room invites from their friends list." />
                <Row label="Cookies & storage" hint="Revisit what Weered stores on your device.">
                  <button type="button" onClick={() => openConsentBanner()} style={{ ...btnStyle, padding: "6px 12px", fontSize: 11 }}>
                    Manage
                  </button>
                </Row>
              </Section>

              <BlockedUsersSection />
              <DangerZoneSection />
            </>
          )}

          {tab === "notifs" && (
            <Section title="Notifications" onReset={() => patch({ notifyDMs: DEFAULTS.notifyDMs, notifyMentions: DEFAULTS.notifyMentions, notifySound: DEFAULTS.notifySound, notifyDesktop: DEFAULTS.notifyDesktop })}>
              <div style={{ fontSize: 11, color: "var(--weered-muted, rgba(148,163,184,.7))", marginBottom: 8 }}>
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
              <Row label="Desktop notifications" hint="Show OS notifications when Weered isn't focused. Requires browser permission.">
                <DesktopNotifyToggle enabled={s.notifyDesktop} onChange={(v) => patch({ notifyDesktop: v })} />
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

function DesktopNotifyToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  const [denied, setDenied] = React.useState(false);
  async function handle(v: boolean) {
    if (!v) { onChange(false); return; }
    if (typeof Notification === "undefined") { setDenied(true); return; }
    if (Notification.permission === "granted") { onChange(true); return; }
    if (Notification.permission === "denied") { setDenied(true); return; }
    const res = await Notification.requestPermission();
    if (res === "granted") { onChange(true); setDenied(false); }
    else { onChange(false); setDenied(true); }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Toggle checked={enabled} onChange={handle} />
      {denied && <span style={{ fontSize: 10, color: "rgba(252,165,165,.9)" }}>Blocked in browser</span>}
    </div>
  );
}

// Top of Settings, above every tab (James 2026-10-30: "I find I use it the
// most"). Design your Weered (components/shell/ShellDesigner.tsx) runs on
// Home: from Home it opens in place, from anywhere else it goes there first.
// Appearance in Settings points at the two places that own it: Change your
// drip (how Weered looks to you: theme, colourway, type, effects, compact rows,
// animations) and your profile's Your look (how you look to others). Each
// setting used to sit in two places, and density saved in one only came back
// overwritten by the other (James 2026-11-02).
function AppearancePointers() {
  const { clearSheets, openSheet } = useOverlay() as any;
  const router = useRouter();
  const card = (title: string, blurb: string, label: string, go: () => void) => (
    <button
      type="button"
      onClick={go}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", marginTop: 8, padding: "12px 14px",
        borderRadius: 12, cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "#fff",
        border: "1px solid var(--weered-border, rgba(255,255,255,.12))", background: "rgba(255,255,255,.03)",
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}>{title}</span>
        <span style={{ display: "block", fontSize: 11.5, opacity: 0.65, marginTop: 2 }}>{blurb}</span>
      </span>
      <span style={{ fontSize: 12, fontWeight: 800, color: "var(--weered-accent-text, #c4b5fd)", whiteSpace: "nowrap" }}>{label} →</span>
    </button>
  );
  return (
    <Section title="Appearance">
      {card(
        "How Weered looks to you",
        "Theme, colourway, layout, type, effects, compact rows, animations.",
        "Change your drip",
        () => {
          clearSheets();
          if (window.location.pathname === "/home") startDesign();
          else router.push("/home?design=1");
        },
      )}
      {card(
        "How you look to others",
        "Your picture, frame, background, name effects, ID card colours and banner.",
        "Your look",
        () => {
          let me = "";
          try {
            me = JSON.parse(localStorage.getItem("weered_user") || "{}")?.id || "";
          } catch {}
          clearSheets();
          if (me) openSheet?.("profile", { userId: me });
        },
      )}
      <a
        href="/setup"
        onClick={() => clearSheets()}
        style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "var(--weered-accent-text, #c4b5fd)" }}
      >
        Run setup again →
      </a>
    </Section>
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

export function Section({ title, children, onReset }: { title: string; children: React.ReactNode; onReset?: () => void }) {
  return (
    <div
      className="weered-settings-section"
      style={{
        marginTop: 14,
        borderRadius: 10,
        border: "1px solid var(--weered-border, rgba(255,255,255,.10))",
        background: "var(--weered-panel, rgba(255,255,255,.04))",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div
          className="weered-settings-section-title"
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
            onKeyDown={onActivate(() => onReset())}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 10, fontWeight: 700,
              letterSpacing: "0.04em", textTransform: "uppercase",
              color: "var(--weered-muted, rgba(148,163,184,.6))",
              padding: "2px 4px",
            }}
            title={`Reset ${title} to defaults`}
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--weered-text, rgba(243,244,246,.9))"; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--weered-muted, rgba(148,163,184,.6))"; }}
            onFocus={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--weered-text, rgba(243,244,246,.9))"; }}
            onBlur={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--weered-muted, rgba(148,163,184,.6))"; }}
          >
            Reset ⟲
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

type BlockedRow = { id: string; userId: string; name: string; avatarColor: string | null; createdAt: string };

function BlockedUsersSection() {
  const [blocks, setBlocks] = React.useState<BlockedRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string>("");
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await settingsFetch(`${apiBase}/blocks`, { headers: {} });
      const j = await r.json();
      setBlocks(Array.isArray(j?.blocks) ? j.blocks : []);
    } catch {} finally { setLoading(false); }
  }, [apiBase]);

  React.useEffect(() => { void load(); }, [load]);

  async function unblock(userId: string) {
    setBusyId(userId);
    try {
      await settingsFetch(`${apiBase}/users/${encodeURIComponent(userId)}/block`, {
        method: "DELETE",
        headers: {},
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

function DangerZoneSection() {
  const [open, setOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
  async function submit() {
    if (confirmText.trim() !== "DELETE" || busy) return;
    setBusy(true);
    try {
      const r = await settingsFetch(`${apiBase}/profile/me/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const j = await r.json();
      if (j?.ok) {
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