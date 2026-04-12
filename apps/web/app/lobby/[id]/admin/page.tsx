"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useWeered } from "../../../../components/WeeredProvider";
import LobbyChatPanel from "../../../../components/LobbyChatPanel";
import RoomStage from "../../../../components/room/RoomStage";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

// ── Types ────────────────────────────────────────────────────────────────────

type AdminMember = { id: string; userId: string; name: string; role: string; roleLevel: number; createdAt: string };
type AdminRoom   = { id: string; name: string; locked: boolean; ownerId?: string; onlineCount: number; memberCount: number };
type AdminAudit  = { id: string; type: string; actorId: string; actorName: string; targetId?: string; note?: string; ts: string };
type AdminBan    = { id: string; userId: string; reason: string; createdAt: string };

type LobbyData = {
  id: string; name: string; description: string;
  verified: boolean; pinned: boolean;
  moduleType: string; moduleConfig: any;
  accentColor: string | null; logoUrl: string | null;
  bannerUrl: string | null; websiteUrl: string | null;
  keywords: string[]; enabledModules: string[];
  roleNames: Record<string, string>;
  joinMode: string; joinPassword?: string | null;
};

type DashboardData = {
  lobby: LobbyData;
  members: AdminMember[];
  rooms: AdminRoom[];
  audit: AdminAudit[];
  bans: AdminBan[];
  myLevel: number;
  overrideRole: string | null;
  globalRole: string;
  perms: string[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

// ── Style System ─────────────────────────────────────────────────────────────

const S = {
  card:    { borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: "11px 14px" } as React.CSSProperties,
  cardHov: { borderRadius: 10, border: "1px solid rgba(124,58,237,.35)", background: "rgba(124,58,237,.07)", padding: "11px 14px" } as React.CSSProperties,
  btn:     { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)" } as React.CSSProperties,
  btnPri:  { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(124,58,237,.35)", background: "rgba(124,58,237,.12)", fontSize: 12, cursor: "pointer", color: "rgb(216,180,254)", fontWeight: 600 } as React.CSSProperties,
  danger:  { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,.30)", background: "rgba(239,68,68,.08)", fontSize: 12, cursor: "pointer", color: "rgba(252,165,165,.90)" } as React.CSSProperties,
  success: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(16,185,129,.30)", background: "rgba(16,185,129,.08)", fontSize: 12, cursor: "pointer", color: "rgb(167,243,208)" } as React.CSSProperties,
  input:   { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  label:   { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 },
  sectionTitle: { fontSize: 12, fontWeight: 700, opacity: 0.6, letterSpacing: ".5px", textTransform: "uppercase" as const, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,.07)" },
};

const LEVEL_COLORS: Record<number, { bg: string; border: string; color: string }> = {
  5: { bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.30)", color: "rgb(253,230,138)" },
  4: { bg: "rgba(124,58,237,.12)", border: "rgba(124,58,237,.30)", color: "rgb(216,180,254)" },
  3: { bg: "rgba(14,165,233,.10)", border: "rgba(14,165,233,.28)", color: "rgb(186,230,253)" },
  2: { bg: "rgba(16,185,129,.10)", border: "rgba(16,185,129,.28)", color: "rgb(167,243,208)" },
  1: { bg: "rgba(255,255,255,.05)", border: "rgba(255,255,255,.10)", color: "rgba(255,255,255,.55)" },
};

function LevelBadge({ level, roleNames }: { level: number; roleNames: Record<string, string> }) {
  const c = LEVEL_COLORS[level] || LEVEL_COLORS[1];
  const name = roleNames[String(level)] || `Level ${level}`;
  return <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontWeight: 700, letterSpacing: ".4px", flexShrink: 0 }}>{name}</span>;
}

function OverrideBadge({ role }: { role: string }) {
  if (!role) return null;
  const c = role === "GOD"
    ? { bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.30)", color: "rgb(253,230,138)" }
    : { bg: "rgba(124,58,237,.12)", border: "rgba(124,58,237,.30)", color: "rgb(216,180,254)" };
  return (
    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontWeight: 700, letterSpacing: ".3px", opacity: 0.85 }}>
      Viewing as {role}
    </span>
  );
}

// ── Nav ──────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "branding",      label: "Branding",       icon: "🎨", minLevel: 4 },
  { id: "modules",       label: "Modules",        icon: "🧩", minLevel: 4 },
  { id: "rooms",         label: "Rooms",          icon: "🚪", minLevel: 3 },
  { id: "challenges",    label: "Challenges",     icon: "🎯", minLevel: 4 },
  { id: "roles",         label: "Roles",          icon: "👑", minLevel: 5 },
  { id: "tiers",         label: "Paid Tiers",     icon: "💎", minLevel: 5 },
  { id: "join-requests", label: "Join Requests",  icon: "📬", minLevel: 3 },
  { id: "events",        label: "Events",         icon: "📅", minLevel: 4 },
  { id: "members",       label: "Members",        icon: "👥", minLevel: 2 },
  { id: "audit",         label: "Audit Log",      icon: "📋", minLevel: 3 },
] as const;

type NavId = typeof NAV_ITEMS[number]["id"];

// ── Presence Sidebar ─────────────────────────────────────────────────────────

function AdminPresence({ lobbyId, roleNames }: { lobbyId: string; roleNames: Record<string, string> }) {
  const ctx = useWeered() as any;
  const users: any[] = Array.isArray(ctx?.users) ? ctx.users : [];

  return (
    <div>
      <div style={S.label}>Team Online</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {users.length === 0 && <div style={{ fontSize: 11, opacity: 0.35 }}>No one else here.</div>}
        {users.map((u: any, i: number) => {
          const name = String(u?.name ?? "?");
          return (
            <div key={u?.id ?? i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
              <div style={{ width: 24, height: 24, borderRadius: 999, background: "rgba(124,58,237,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                {name.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Branding Tab ─────────────────────────────────────────────────────────────

function BrandingTab({ lobby, onRefresh }: { lobby: LobbyData; onRefresh: () => void }) {
  const [name, setName]               = useState(lobby.name);
  const [description, setDescription] = useState(lobby.description);
  const [accentColor, setAccentColor] = useState(lobby.accentColor || "");
  const [logoUrl, setLogoUrl]         = useState(lobby.logoUrl || "");
  const [bannerUrl, setBannerUrl]     = useState(lobby.bannerUrl || "");
  const [websiteUrl, setWebsiteUrl]   = useState(lobby.websiteUrl || "");
  const [keywords, setKeywords]       = useState(lobby.keywords.join(", "));
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState("");

  // Join mode
  const [joinMode, setJoinMode]       = useState(lobby.joinMode || "OPEN");
  const [joinPassword, setJoinPassword] = useState(lobby.joinPassword || "");
  const [joinSaving, setJoinSaving]   = useState(false);
  const [joinMsg, setJoinMsg]         = useState("");

  async function saveJoinMode() {
    setJoinSaving(true); setJoinMsg("");
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/join-mode`, {
      method: "PATCH",
      body: JSON.stringify({ joinMode, password: joinPassword }),
    });
    setJoinSaving(false);
    setJoinMsg(j.ok ? "Saved." : j.error || "Failed.");
    if (j.ok) onRefresh();
  }

  async function save() {
    setSaving(true); setMsg("");
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/branding`, {
      method: "PATCH",
      body: JSON.stringify({
        name, description, accentColor: accentColor || null,
        logoUrl: logoUrl || null, bannerUrl: bannerUrl || null,
        websiteUrl: websiteUrl || null,
        keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
      }),
    });
    setSaving(false);
    setMsg(j.ok ? "Saved." : j.error || "Failed.");
    if (j.ok) onRefresh();
  }

  const Field = ({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={S.label}>{label}</div>
      {multiline ? (
        <textarea style={{ ...S.input, resize: "vertical", minHeight: 60 }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input style={S.input} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Preview */}
      <div style={{ marginBottom: 20, borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", overflow: "hidden" }}>
        {bannerUrl && (
          <div style={{ height: 80, background: `url(${bannerUrl}) center/cover no-repeat`, borderBottom: "1px solid rgba(255,255,255,.08)" }} />
        )}
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, background: accentColor ? `${accentColor}10` : "rgba(255,255,255,.02)" }}>
          {logoUrl && <img src={logoUrl} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(255,255,255,.10)" }} />}
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{name || "Unnamed"}</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 1 }}>{description || "No description"}</div>
          </div>
          {accentColor && <div style={{ marginLeft: "auto", width: 20, height: 20, borderRadius: 6, background: accentColor, border: "1px solid rgba(255,255,255,.15)" }} />}
        </div>
      </div>

      <Field label="Display Name" value={name} onChange={setName} placeholder="My Lobby" />
      <Field label="Description" value={description} onChange={setDescription} placeholder="What's this lobby about?" multiline />
      <Field label="Accent Color (hex)" value={accentColor} onChange={setAccentColor} placeholder="#4F88C6" />
      <Field label="Logo URL" value={logoUrl} onChange={setLogoUrl} placeholder="https://..." />
      <Field label="Banner URL" value={bannerUrl} onChange={setBannerUrl} placeholder="https://..." />
      <Field label="Website URL" value={websiteUrl} onChange={setWebsiteUrl} placeholder="https://..." />
      <Field label="Keywords (comma-separated)" value={keywords} onChange={setKeywords} placeholder="gaming, destiny, fps" />

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
        <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Branding"}</button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>

      {/* ── Join Mode ──────────────────────────────────────────── */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ ...S.label, marginBottom: 12 }}>MEMBERSHIP GATING</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {(["OPEN", "APPROVAL", "PASSWORD", "PAID"] as const).map(m => (
            <button
              key={m}
              onClick={() => setJoinMode(m)}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: joinMode === m ? "1px solid rgba(200,155,60,.45)" : "1px solid rgba(255,255,255,.08)",
                background: joinMode === m ? "rgba(200,155,60,.12)" : "rgba(255,255,255,.03)",
                color: joinMode === m ? "rgb(200,155,60)" : "rgba(148,163,184,.6)",
              }}
            >
              {m === "OPEN" ? "Open" : m === "APPROVAL" ? "Approval" : m === "PASSWORD" ? "Password" : "Paid Tier"}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "rgba(148,163,184,.45)", marginBottom: 12, lineHeight: 1.5 }}>
          {joinMode === "OPEN" && "Anyone can join this lobby instantly."}
          {joinMode === "APPROVAL" && "Users submit a request. Moderators approve or deny from the Join Requests tab."}
          {joinMode === "PASSWORD" && "Users must enter the correct password to join."}
          {joinMode === "PAID" && "Users must subscribe to a paid tier to join. Configure tiers in the Paid Tiers tab."}
        </div>
        {joinMode === "PASSWORD" && (
          <div style={{ marginBottom: 12 }}>
            <div style={S.label}>Lobby Password</div>
            <input style={S.input} type="text" value={joinPassword} onChange={e => setJoinPassword(e.target.value)} placeholder="Enter password" />
          </div>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={saveJoinMode} disabled={joinSaving}>
            {joinSaving ? "Saving..." : "Save Join Mode"}
          </button>
          {joinMsg && <span style={{ fontSize: 12, opacity: 0.7 }}>{joinMsg}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Modules Tab ──────────────────────────────────────────────────────────────

const ALL_MODULES = [
  { key: "voice",   label: "Voice (LiveKit)", desc: "Real-time voice chat in rooms" },
  { key: "youtube", label: "YouTube Sync",     desc: "Synced video playback" },
  { key: "video",   label: "Video/Screenshare", desc: "Camera and screen sharing" },
  { key: "twitch",  label: "Twitch Embed",     desc: "Live Twitch stream embed" },
  { key: "custom",  label: "Custom Embed",     desc: "Custom iframe integration" },
  { key: "reddit",  label: "Reddit Feed",      desc: "Subreddit content browser" },
  { key: "fakeout", label: "FakeOut Trading",  desc: "Paper trading with live charts and leaderboards" },
];

function ModulesTab({ lobby, onRefresh }: { lobby: LobbyData; onRefresh: () => void }) {
  const [enabled, setEnabled] = useState<string[]>(lobby.enabledModules || []);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");

  function toggle(key: string) {
    setEnabled(prev => prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]);
  }

  async function save() {
    setSaving(true); setMsg("");
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/modules`, {
      method: "PATCH",
      body: JSON.stringify({ enabledModules: enabled }),
    });
    setSaving(false);
    setMsg(j.ok ? "Saved." : j.error || "Failed.");
    if (j.ok) onRefresh();
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={S.sectionTitle}>Available Modules</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {ALL_MODULES.map(mod => {
          const on = enabled.includes(mod.key);
          return (
            <div key={mod.key}
              onClick={() => toggle(mod.key)}
              style={{ ...S.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, border: on ? "1px solid rgba(16,185,129,.30)" : "1px solid rgba(255,255,255,.08)", background: on ? "rgba(16,185,129,.05)" : "rgba(255,255,255,.03)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "rgba(16,185,129,.15)" : "rgba(255,255,255,.05)", fontSize: 16, flexShrink: 0, transition: "background .15s" }}>
                {on ? "✓" : "○"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: on ? "rgb(167,243,208)" : "rgba(243,244,246,.85)" }}>{mod.label}</div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 1 }}>{mod.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Modules"}</button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── Rooms Tab ────────────────────────────────────────────────────────────────

function RoomsTab({ lobbyId, initialRooms, perms, onRefresh }: { lobbyId: string; initialRooms: AdminRoom[]; perms: string[]; onRefresh: () => void }) {
  const [rooms, setRooms] = useState(initialRooms);
  const [msg, setMsg]     = useState("");
  const canManage = perms.includes("manage_rooms");

  async function deleteRoom(roomId: string, name: string) {
    if (!confirm(`Delete room "${name}"? This kicks all users.`)) return;
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/rooms/${encodeURIComponent(roomId)}`, { method: "DELETE" });
    if (j.ok) { setRooms(prev => prev.filter(r => r.id !== roomId)); setMsg(`Deleted ${name}`); onRefresh(); }
    else setMsg(j.error || "Failed.");
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>{rooms.length} rooms in this lobby</div>
        {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {rooms.map(r => (
          <div key={r.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                {r.name}
                {r.locked && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 999, border: "1px solid rgba(239,68,68,.30)", color: "rgba(252,165,165,.80)", background: "rgba(239,68,68,.08)" }}>LOCKED</span>}
              </div>
              <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2, fontFamily: "monospace" }}>
                {r.onlineCount} online · {r.memberCount} members
              </div>
            </div>
            {canManage && (
              <button style={{ ...S.danger, flexShrink: 0, fontSize: 11 }} onClick={() => deleteRoom(r.id, r.name)}>Delete</button>
            )}
          </div>
        ))}
        {rooms.length === 0 && <div style={{ opacity: 0.4, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No rooms yet. Users will create rooms when they visit your lobby.</div>}
      </div>
    </div>
  );
}

// ── Roles Tab ────────────────────────────────────────────────────────────────

const DEFAULT_ROLE_NAMES: Record<string, string> = { "5": "Owner", "4": "Admin", "3": "Moderator", "2": "Trusted", "1": "Member" };

const LEVEL_PERMS_DISPLAY: Record<number, string[]> = {
  5: ["Full control", "Manage roles", "Edit branding", "Manage rooms", "Kick/Ban", "Pin rooms", "Admin chat"],
  4: ["Edit branding", "Manage rooms", "Kick/Ban", "Pin rooms", "Admin chat"],
  3: ["Manage rooms", "Kick/Ban", "Pin rooms", "Admin chat"],
  2: ["Kick users", "Admin chat"],
  1: ["Base access"],
};

function RolesTab({ lobby, onRefresh }: { lobby: LobbyData; onRefresh: () => void }) {
  const [names, setNames] = useState<Record<string, string>>(lobby.roleNames || DEFAULT_ROLE_NAMES);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");

  async function save() {
    setSaving(true); setMsg("");
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/roles`, {
      method: "PATCH",
      body: JSON.stringify({ roleNames: names }),
    });
    setSaving(false);
    setMsg(j.ok ? "Saved." : j.error || "Failed.");
    if (j.ok) onRefresh();
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={S.sectionTitle}>Custom Role Titles</div>
      <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 16 }}>Rename roles to match your community. Permissions are fixed per level.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {[5, 4, 3, 2, 1].map(lvl => {
          const c = LEVEL_COLORS[lvl];
          const perms = LEVEL_PERMS_DISPLAY[lvl] || [];
          return (
            <div key={lvl} style={{ borderRadius: 10, border: `1px solid ${c.border}`, background: c.bg, padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: c.color, width: 24 }}>L{lvl}</span>
                <input
                  style={{ ...S.input, background: "rgba(0,0,0,.25)", flex: 1 }}
                  value={names[String(lvl)] || ""}
                  onChange={e => setNames(prev => ({ ...prev, [String(lvl)]: e.target.value }))}
                  placeholder={DEFAULT_ROLE_NAMES[String(lvl)]}
                  maxLength={24}
                />
              </div>
              <div style={{ fontSize: 11, opacity: 0.6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {perms.map(p => (
                  <span key={p} style={{ padding: "1px 6px", borderRadius: 4, background: "rgba(0,0,0,.20)", fontSize: 10 }}>{p}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Roles"}</button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({ lobbyId, initialMembers, roleNames, myLevel, perms, overrideRole, onRefresh }: {
  lobbyId: string; initialMembers: AdminMember[]; roleNames: Record<string, string>;
  myLevel: number; perms: string[]; overrideRole: string | null; onRefresh: () => void;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [selected, setSelected] = useState<AdminMember | null>(null);
  const [msg, setMsg]           = useState("");
  const [filter, setFilter]     = useState("");
  const canKick = perms.includes("kick");
  const canBan  = perms.includes("ban");
  const canRole = perms.includes("manage_roles");

  async function setRole(userId: string, roleLevel: number) {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/members/${userId}/role`, {
      method: "POST",
      body: JSON.stringify({ roleLevel }),
    });
    if (j.ok) {
      setMsg(`Updated role for ${userId}`);
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, roleLevel } : m));
      onRefresh();
    } else setMsg(j.error || "Failed.");
  }

  async function kickMember(userId: string, name: string) {
    if (!confirm(`Kick ${name} from this lobby?`)) return;
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/members/${userId}/kick`, { method: "POST" });
    if (j.ok) { setMembers(prev => prev.filter(m => m.userId !== userId)); setSelected(null); setMsg(`Kicked ${name}`); }
    else setMsg(j.error || "Failed.");
  }

  async function banMember(userId: string, name: string) {
    const reason = prompt(`Ban reason for ${name}:`);
    if (reason === null) return;
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/members/${userId}/ban`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    if (j.ok) { setMembers(prev => prev.filter(m => m.userId !== userId)); setSelected(null); setMsg(`Banned ${name}`); }
    else setMsg(j.error || "Failed.");
  }

  const filtered = filter.trim()
    ? members.filter(m => m.name.toLowerCase().includes(filter.toLowerCase()))
    : members;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start", height: "100%" }}>
      {/* List */}
      <div>
        <input style={{ ...S.input, marginBottom: 10 }} placeholder="Search members..." value={filter} onChange={e => setFilter(e.target.value)} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map(m => (
            <div key={m.id} onClick={() => setSelected(m)} style={{ ...(selected?.id === m.id ? S.cardHov : S.card), cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 999, background: "rgba(124,58,237,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                {(m.name || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name || m.userId}</div>
              <LevelBadge level={m.roleLevel} roleNames={roleNames} />
            </div>
          ))}
          {filtered.length === 0 && <div style={{ opacity: 0.4, fontSize: 13, padding: 12 }}>No members found.</div>}
        </div>
      </div>

      {/* Detail */}
      {selected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={S.card}>
            <div style={S.sectionTitle}>Member Details</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: "rgba(124,58,237,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
                {(selected.name || "?")[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{selected.name}</div>
                <div style={{ fontSize: 11, opacity: 0.4, marginTop: 1 }}>Joined: {fmtDate(selected.createdAt)}</div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <LevelBadge level={selected.roleLevel} roleNames={roleNames} />
              </div>
            </div>
            <div style={{ fontSize: 11, opacity: 0.4, fontFamily: "monospace" }}>ID: {selected.userId}</div>
          </div>

          {/* Role actions */}
          {canRole && (
            <div style={S.card}>
              <div style={S.sectionTitle}>Set Role</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {[1, 2, 3, 4].filter(lvl => overrideRole || lvl < myLevel).map(lvl => (
                  <button key={lvl} style={{ ...S.btn, fontSize: 11 }} onClick={() => setRole(selected.userId, lvl)}>
                    {roleNames[String(lvl)] || `Level ${lvl}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 6 }}>
            {canKick && <button style={S.danger} onClick={() => kickMember(selected.userId, selected.name)}>Kick</button>}
            {canBan  && <button style={{ ...S.danger, borderColor: "rgba(239,68,68,.50)" }} onClick={() => banMember(selected.userId, selected.name)}>Ban</button>}
          </div>
          {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, opacity: 0.3, fontSize: 13 }}>
          Select a member
        </div>
      )}
    </div>
  );
}

// ── Audit Tab ────────────────────────────────────────────────────────────────

// ── Paid Tiers Tab ────────────────────────────────────────────────────────

type AdminTier = {
  id: string; name: string; description: string; priceMonthly: number;
  grantLevel: number; color: string | null; sortOrder: number; active: boolean;
  stripePriceId: string | null; _count?: { subscribers: number };
};

function TiersTab({ lobbyId, roleNames, onRefresh }: { lobbyId: string; roleNames: Record<string, string>; onRefresh: () => void }) {
  const [tiers, setTiers] = useState<AdminTier[]>([]);
  const [revShare, setRevShare] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);

  // New tier form state
  const [form, setForm] = useState({ name: "", description: "", priceDollars: "", grantLevel: "2", color: "", sortOrder: "0" });

  const load = useCallback(async () => {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/tiers`);
    if (j.ok) { setTiers(j.tiers); setRevShare(j.revenueSharePct ?? 0); }
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => { load(); }, [load]);

  async function createTier() {
    const name = form.name.trim();
    if (!name) { setMsg("Name is required."); return; }
    const priceCents = Math.round(parseFloat(form.priceDollars || "0") * 100);
    if (priceCents < 100) { setMsg("Minimum price is $1.00."); return; }
    setCreating(true);
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/tiers`, {
      method: "POST",
      body: JSON.stringify({
        name,
        description: form.description.trim(),
        priceMonthly: priceCents,
        grantLevel: Number(form.grantLevel) || 2,
        color: form.color.trim() || null,
        sortOrder: Number(form.sortOrder) || 0,
      }),
    });
    setCreating(false);
    if (j.ok) {
      setMsg(`Created "${name}".`);
      setForm({ name: "", description: "", priceDollars: "", grantLevel: "2", color: "", sortOrder: "0" });
      load();
      onRefresh();
    } else setMsg(j.error || "Failed to create tier.");
  }

  async function toggleActive(tier: AdminTier) {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/tiers/${tier.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !tier.active }),
    });
    if (j.ok) { setMsg(`${tier.name} ${tier.active ? "deactivated" : "activated"}.`); load(); }
    else setMsg(j.error || "Failed.");
  }

  async function saveRevShare() {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/revenue-share`, {
      method: "PATCH",
      body: JSON.stringify({ revenueSharePct: revShare }),
    });
    if (j.ok) setMsg(`Revenue share set to ${revShare}%.`);
    else setMsg(j.error || "Failed.");
  }

  if (loading) return <div style={{ opacity: 0.4, fontSize: 13 }}>Loading tiers...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {msg && <div style={{ fontSize: 12, color: "rgba(167,243,208,.9)", padding: "8px 12px", borderRadius: 8, background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.25)" }}>{msg}</div>}

      {/* Existing tiers */}
      <div>
        <div style={S.sectionTitle}>Active Tiers</div>
        {tiers.length === 0 && <div style={{ opacity: 0.4, fontSize: 13, padding: "16px 0" }}>No paid tiers yet. Create one below.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tiers.map(t => {
            const lc = LEVEL_COLORS[t.grantLevel] || LEVEL_COLORS[1];
            return (
              <div key={t.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 14, opacity: t.active ? 1 : 0.5 }}>
                {t.color && <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                  {t.description && <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{t.description}</div>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgb(167,243,208)", whiteSpace: "nowrap" }}>${(t.priceMonthly / 100).toFixed(2)}/mo</div>
                <LevelBadge level={t.grantLevel} roleNames={roleNames} />
                <div style={{ fontSize: 11, opacity: 0.5, whiteSpace: "nowrap" }}>{t._count?.subscribers ?? 0} subs</div>
                <button style={t.active ? S.danger : S.success} onClick={() => toggleActive(t)}>
                  {t.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create tier form */}
      <div>
        <div style={S.sectionTitle}>Create New Tier</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={S.label}>Name</div>
            <input style={S.input} placeholder="e.g. VIP, Patron..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <div style={S.label}>Price (USD/month)</div>
            <input style={S.input} type="number" step="0.01" min="1" placeholder="5.00" value={form.priceDollars} onChange={e => setForm(f => ({ ...f, priceDollars: e.target.value }))} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={S.label}>Description</div>
            <input style={S.input} placeholder="What does this tier include?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <div style={S.label}>Grants Role</div>
            <select
              style={{ ...S.input, appearance: "auto" }}
              value={form.grantLevel}
              onChange={e => setForm(f => ({ ...f, grantLevel: e.target.value }))}
            >
              {[1, 2, 3, 4].map(lvl => (
                <option key={lvl} value={lvl}>{roleNames[String(lvl)] || `Level ${lvl}`}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={S.label}>Badge Color (hex)</div>
            <input style={S.input} placeholder="#7C3AED" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
          </div>
          <div>
            <div style={S.label}>Sort Order</div>
            <input style={S.input} type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} />
          </div>
        </div>
        <button style={{ ...S.btnPri, marginTop: 14 }} onClick={createTier} disabled={creating}>
          {creating ? "Creating..." : "Create Tier"}
        </button>
      </div>

      {/* Revenue share */}
      <div>
        <div style={S.sectionTitle}>Revenue Share</div>
        <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 10 }}>Percentage of lobby tier revenue allocated to the lobby owner. Payouts are processed manually.</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input style={{ ...S.input, width: 80 }} type="number" min="0" max="100" value={revShare} onChange={e => setRevShare(Number(e.target.value))} />
          <span style={{ fontSize: 13, opacity: 0.5 }}>%</span>
          <button style={S.btn} onClick={saveRevShare}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Events Tab ────────────────────────────────────────────────────────────

type LobbyEvent = {
  id: string; title: string; description: string; category: string;
  coverImageUrl: string | null; startsAt: string; endsAt: string | null;
  timezone: string; status: string; promotionStatus: string;
  promotionNote: string | null; promotionDenyReason: string | null;
  createdByName: string; createdAt: string;
};

const EVENT_STATUS_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  DRAFT:     { bg: "rgba(255,255,255,.05)", border: "rgba(255,255,255,.15)", color: "rgba(255,255,255,.6)" },
  PUBLISHED: { bg: "rgba(16,185,129,.10)", border: "rgba(16,185,129,.30)", color: "rgb(167,243,208)" },
  CANCELED:  { bg: "rgba(239,68,68,.10)", border: "rgba(239,68,68,.30)", color: "rgb(252,165,165)" },
  COMPLETED: { bg: "rgba(14,165,233,.10)", border: "rgba(14,165,233,.28)", color: "rgb(186,230,253)" },
};

function EventStatusBadge({ status }: { status: string }) {
  const c = EVENT_STATUS_COLORS[status] || EVENT_STATUS_COLORS.DRAFT;
  return <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontWeight: 700, letterSpacing: ".4px" }}>{status}</span>;
}

// ── Challenges Admin Tab ────────────────────────────────────────────────────

const OBJECTIVE_TYPES = [
  { value: "kills", label: "Kills" },
  { value: "weapon_kills", label: "Weapon Kills" },
  { value: "activities", label: "Activity Completions" },
  { value: "wins", label: "Wins" },
  { value: "speed_clear", label: "Speed Clear" },
  { value: "win_streak", label: "Win Streak" },
  { value: "kd_threshold", label: "K/D Threshold" },
  { value: "stat_total", label: "Stat Total (K+A)" },
];

const CATEGORY_OPTIONS = ["crucible", "pve", "raid", "dungeon", "seasonal"];

const SCOPE_OPTIONS = [
  { value: "LOBBY", label: "This Lobby" },
  { value: "GLOBAL", label: "Global" },
];

const SCHEDULE_OPTIONS = [
  { value: "", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly (Tuesday)" },
  { value: "weekly_friday", label: "Weekly (Friday)" },
];

function ChallengesTab({ lobbyId }: { lobbyId: string }) {
  const [defs, setDefs] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "", description: "", category: "pve", difficulty: 2,
    scope: "LOBBY", notorietyReward: 200, isRecurring: false, recurSchedule: "",
  });
  const [objectives, setObjectives] = useState([{
    id: "obj_1", type: "activities", description: "", target: 5,
    modes: "", activityHashes: "", weaponHashes: "", weaponSubTypes: "",
    requireCompletion: true, requireWin: false, maxDuration: 0, minKd: 0,
  }]);

  const load = useCallback(async () => {
    const [dRes, iRes] = await Promise.all([
      apiFetch("/challenges/definitions"),
      apiFetch(`/challenges?lobbyId=${encodeURIComponent(lobbyId)}`),
    ]);
    if (dRes?.definitions) setDefs(dRes.definitions);
    if (iRes?.challenges) setInstances(iRes.challenges);
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => { load(); }, [load]);

  function addObjective() {
    const idx = objectives.length + 1;
    setObjectives(prev => [...prev, {
      id: `obj_${idx}`, type: "activities", description: "", target: 5,
      modes: "", activityHashes: "", weaponHashes: "", weaponSubTypes: "",
      requireCompletion: true, requireWin: false, maxDuration: 0, minKd: 0,
    }]);
  }

  function updateObjective(idx: number, key: string, val: any) {
    setObjectives(prev => prev.map((o, i) => i === idx ? { ...o, [key]: val } : o));
  }

  function removeObjective(idx: number) {
    if (objectives.length <= 1) return;
    setObjectives(prev => prev.filter((_, i) => i !== idx));
  }

  async function createChallenge() {
    if (!form.title.trim()) { setMsg("Title required."); return; }
    if (objectives.some(o => !o.description.trim())) { setMsg("All objectives need a description."); return; }

    setCreating(true);

    // Build objectives JSON
    const objs = objectives.map(o => ({
      id: o.id,
      type: o.type,
      description: o.description,
      target: Number(o.target) || 1,
      filters: {
        ...(o.modes ? { modes: o.modes.split(",").map(s => Number(s.trim())).filter(n => n > 0) } : {}),
        ...(o.activityHashes ? { activityHashes: o.activityHashes.split(",").map(s => s.trim()).filter(Boolean) } : {}),
        ...(o.weaponHashes ? { weaponHashes: o.weaponHashes.split(",").map(s => s.trim()).filter(Boolean) } : {}),
        ...(o.weaponSubTypes ? { weaponSubTypes: o.weaponSubTypes.split(",").map(s => Number(s.trim())).filter(n => n > 0) } : {}),
        ...(o.requireCompletion ? { requireCompletion: true } : {}),
        ...(o.requireWin ? { requireWin: true } : {}),
        ...(o.maxDuration > 0 ? { maxDuration: o.maxDuration } : {}),
        ...(o.minKd > 0 ? { minKd: o.minKd } : {}),
      },
    }));

    const j = await apiFetch("/challenges/definitions", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        lobbyId,
        objectives: objs,
        requireAll: true,
        notorietyReward: Number(form.notorietyReward) || 0,
      }),
    });
    setCreating(false);

    if (j.ok) {
      setMsg(`Created "${j.definition.title}". Now activate it to make it live.`);
      setForm({ title: "", description: "", category: "pve", difficulty: 2, scope: "LOBBY", notorietyReward: 200, isRecurring: false, recurSchedule: "" });
      setObjectives([{ id: "obj_1", type: "activities", description: "", target: 5, modes: "", activityHashes: "", weaponHashes: "", weaponSubTypes: "", requireCompletion: true, requireWin: false, maxDuration: 0, minKd: 0 }]);
      load();
    } else setMsg(j.error || "Failed to create.");
  }

  async function activateDef(defId: string) {
    const j = await apiFetch(`/challenges/definitions/${defId}/activate`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (j.ok) { setMsg("Challenge activated!"); load(); }
    else setMsg(j.error || "Failed.");
  }

  if (loading) return <div style={{ opacity: 0.4, fontSize: 13 }}>Loading challenges...</div>;

  const DIFF_STARS = ["", "★", "★★", "★★★", "★★★★", "★★★★★"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {msg && <div style={{ fontSize: 12, color: "rgba(167,243,208,.9)", padding: "8px 12px", borderRadius: 8, background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.25)" }}>{msg}</div>}

      {/* Create Challenge */}
      <div>
        <div style={S.sectionTitle}>Create Challenge</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={S.label}>Title</div>
            <input style={S.input} placeholder="Crucible Slayer" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <div style={S.label}>Category</div>
            <select style={{ ...S.input, appearance: "auto" }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={S.label}>Description</div>
            <input style={S.input} placeholder="Get 50 kills in any Crucible playlist." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <div style={S.label}>Difficulty (1-5)</div>
            <select style={{ ...S.input, appearance: "auto" }} value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: Number(e.target.value) }))}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{DIFF_STARS[n]} ({n})</option>)}
            </select>
          </div>
          <div>
            <div style={S.label}>XP Reward</div>
            <input style={S.input} type="number" value={form.notorietyReward} onChange={e => setForm(f => ({ ...f, notorietyReward: Number(e.target.value) }))} />
          </div>
          <div>
            <div style={S.label}>Scope</div>
            <select style={{ ...S.input, appearance: "auto" }} value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}>
              {SCOPE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <div style={S.label}>Schedule</div>
            <select style={{ ...S.input, appearance: "auto" }} value={form.recurSchedule} onChange={e => setForm(f => ({ ...f, recurSchedule: e.target.value, isRecurring: !!e.target.value }))}>
              {SCHEDULE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Objectives */}
        <div style={{ marginTop: 16 }}>
          <div style={{ ...S.label, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Objectives</span>
            <button onClick={addObjective} style={{ ...S.btn, fontSize: 10, padding: "2px 8px" }}>+ Add</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {objectives.map((obj, idx) => (
              <div key={idx} style={{ ...S.card, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.4 }}>Objective {idx + 1}</span>
                  {objectives.length > 1 && (
                    <button onClick={() => removeObjective(idx)} style={{ ...S.btn, fontSize: 9, padding: "1px 6px", color: "rgba(252,165,165,.7)", borderColor: "rgba(239,68,68,.2)" }}>Remove</button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>Type</div>
                    <select style={{ ...S.input, fontSize: 11, appearance: "auto" }} value={obj.type} onChange={e => updateObjective(idx, "type", e.target.value)}>
                      {OBJECTIVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>Target</div>
                    <input style={{ ...S.input, fontSize: 11 }} type="number" value={obj.target} onChange={e => updateObjective(idx, "target", Number(e.target.value))} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>Description</div>
                    <input style={{ ...S.input, fontSize: 11 }} placeholder="Get 50 Crucible kills" value={obj.description} onChange={e => updateObjective(idx, "description", e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>Mode IDs (comma-sep)</div>
                    <input style={{ ...S.input, fontSize: 11 }} placeholder="5,10,12,84" value={obj.modes} onChange={e => updateObjective(idx, "modes", e.target.value)} />
                  </div>
                  {obj.type === "speed_clear" && (
                    <div>
                      <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>Max Duration (sec)</div>
                      <input style={{ ...S.input, fontSize: 11 }} type="number" value={obj.maxDuration} onChange={e => updateObjective(idx, "maxDuration", Number(e.target.value))} />
                    </div>
                  )}
                  {obj.type === "kd_threshold" && (
                    <div>
                      <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>Min K/D</div>
                      <input style={{ ...S.input, fontSize: 11 }} type="number" step="0.1" value={obj.minKd} onChange={e => updateObjective(idx, "minKd", Number(e.target.value))} />
                    </div>
                  )}
                  {obj.type === "weapon_kills" && (
                    <div>
                      <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>Weapon Hashes (comma-sep)</div>
                      <input style={{ ...S.input, fontSize: 11 }} placeholder="Optional" value={obj.weaponHashes} onChange={e => updateObjective(idx, "weaponHashes", e.target.value)} />
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12, alignItems: "center", gridColumn: "1 / -1" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, opacity: 0.6, cursor: "pointer" }}>
                      <input type="checkbox" checked={obj.requireCompletion} onChange={e => updateObjective(idx, "requireCompletion", e.target.checked)} />
                      Require Completion
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, opacity: 0.6, cursor: "pointer" }}>
                      <input type="checkbox" checked={obj.requireWin} onChange={e => updateObjective(idx, "requireWin", e.target.checked)} />
                      Require Win
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button style={{ ...S.btnPri, marginTop: 14, width: "100%", padding: "10px 0", fontWeight: 800 }} onClick={createChallenge} disabled={creating}>
          {creating ? "Creating..." : "Create Challenge Definition"}
        </button>
      </div>

      {/* Existing Definitions */}
      <div>
        <div style={S.sectionTitle}>Challenge Definitions ({defs.length})</div>
        {defs.length === 0 && <div style={{ opacity: 0.4, fontSize: 13, padding: "16px 0", textAlign: "center" }}>No challenge definitions yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {defs.map(d => {
            const hasActiveInstance = instances.some(i => i.definitionId === d.id && i.status === "ACTIVE");
            return (
              <div key={d.id} style={S.card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{d.title}</span>
                      <span style={{ fontSize: 10, opacity: 0.3 }}>{DIFF_STARS[d.difficulty]}</span>
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: d.status === "ACTIVE" ? "rgba(34,197,94,.1)" : "rgba(255,255,255,.05)", border: `1px solid ${d.status === "ACTIVE" ? "rgba(34,197,94,.25)" : "rgba(255,255,255,.08)"}`, color: d.status === "ACTIVE" ? "#86efac" : "rgba(255,255,255,.4)", fontWeight: 700 }}>
                        {d.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{d.description}</div>
                    <div style={{ fontSize: 10, opacity: 0.3, marginTop: 3 }}>
                      {d.category} | {d.notorietyReward} XP | {(d.objectives as any[])?.length || 0} objective(s)
                      {d.isRecurring && ` | ${d.recurSchedule}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {d.status === "DRAFT" && !hasActiveInstance && (
                      <button style={S.btnPri} onClick={() => activateDef(d.id)}>Activate</button>
                    )}
                    {hasActiveInstance && (
                      <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "rgba(34,197,94,.08)", color: "#86efac", fontWeight: 700 }}>Live</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Instances */}
      <div>
        <div style={S.sectionTitle}>Active Challenge Instances ({instances.length})</div>
        {instances.length === 0 && <div style={{ opacity: 0.4, fontSize: 13, padding: "16px 0", textAlign: "center" }}>No active challenges.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {instances.map(i => (
            <div key={i.id} style={{ ...S.card, padding: "8px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{i.definition?.title}</span>
                  <span style={{ fontSize: 10, opacity: 0.4, marginLeft: 8 }}>{i._count?.enrollments || 0} enrolled</span>
                </div>
                <div style={{ fontSize: 10, opacity: 0.35 }}>
                  {new Date(i.startsAt).toLocaleDateString()} — {i.endsAt ? new Date(i.endsAt).toLocaleDateString() : "No end"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LobbyEventsTab({ lobbyId, myLevel, overrideRole, onRefresh }: { lobbyId: string; myLevel: number; overrideRole: string | null; onRefresh: () => void }) {
  const [events, setEvents] = useState<LobbyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "", startsAt: "", endsAt: "", status: "DRAFT" });
  const [promoNote, setPromoNote] = useState("");
  const [promoEventId, setPromoEventId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/events`);
    if (j.ok) setEvents(j.events);
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => { load(); }, [load]);

  async function createEvent() {
    if (!form.title.trim()) { setMsg("Title required."); return; }
    if (!form.startsAt) { setMsg("Start date required."); return; }
    setCreating(true);
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/events`, {
      method: "POST",
      body: JSON.stringify({ ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null }),
    });
    setCreating(false);
    if (j.ok) {
      setMsg(`Created "${j.event.title}".`);
      setForm({ title: "", description: "", category: "", startsAt: "", endsAt: "", status: "DRAFT" });
      load();
      onRefresh();
    } else setMsg(j.error || "Failed.");
  }

  async function updateStatus(id: string, status: string) {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/events/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    if (j.ok) { setMsg("Updated."); load(); }
    else setMsg(j.error || "Failed.");
  }

  async function deleteEvent(id: string) {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/events/${id}`, { method: "DELETE" });
    if (j.ok) { setMsg("Deleted."); load(); }
    else setMsg(j.error || "Failed.");
  }

  async function requestPromotion(id: string) {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/events/${id}/promote`, {
      method: "POST",
      body: JSON.stringify({ note: promoNote }),
    });
    if (j.ok) { setMsg("Promotion requested."); setPromoEventId(null); setPromoNote(""); load(); }
    else setMsg(j.error || "Failed.");
  }

  const isOwner = overrideRole || myLevel >= 5;
  const fmtDate = (s: string) => { try { return new Date(s).toLocaleString(); } catch { return s; } };

  if (loading) return <div style={{ opacity: 0.4, fontSize: 13 }}>Loading events...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {msg && <div style={{ fontSize: 12, color: "rgba(167,243,208,.9)", padding: "8px 12px", borderRadius: 8, background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.25)" }}>{msg}</div>}

      {/* Create form */}
      <div>
        <div style={S.sectionTitle}>Create Event</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={S.label}>Title</div>
            <input style={S.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <div style={S.label}>Category</div>
            <input style={S.input} placeholder="raid_night, watch_party..." value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={S.label}>Description</div>
            <input style={S.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <div style={S.label}>Starts At</div>
            <input style={S.input} type="datetime-local" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} />
          </div>
          <div>
            <div style={S.label}>Ends At</div>
            <input style={S.input} type="datetime-local" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
          </div>
          <div>
            <div style={S.label}>Status</div>
            <select style={{ ...S.input, appearance: "auto" }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>
        </div>
        <button style={{ ...S.btnPri, marginTop: 12 }} onClick={createEvent} disabled={creating}>{creating ? "Creating..." : "Create Event"}</button>
      </div>

      {/* Events list */}
      <div>
        <div style={S.sectionTitle}>Events</div>
        {events.length === 0 && <div style={{ opacity: 0.4, fontSize: 13, padding: "16px 0", textAlign: "center" }}>No events yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {events.map(ev => (
            <div key={ev.id} style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{ev.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{fmtDate(ev.startsAt)} {ev.category && `· ${ev.category}`}</div>
                </div>
                <EventStatusBadge status={ev.status} />
                {ev.promotionStatus !== "NONE" && (
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: ev.promotionStatus === "APPROVED" ? "rgba(16,185,129,.10)" : ev.promotionStatus === "DENIED" ? "rgba(239,68,68,.10)" : "rgba(245,158,11,.10)", border: `1px solid ${ev.promotionStatus === "APPROVED" ? "rgba(16,185,129,.30)" : ev.promotionStatus === "DENIED" ? "rgba(239,68,68,.30)" : "rgba(245,158,11,.30)"}`, color: ev.promotionStatus === "APPROVED" ? "rgb(167,243,208)" : ev.promotionStatus === "DENIED" ? "rgb(252,165,165)" : "rgb(253,230,138)", fontWeight: 700, letterSpacing: ".4px" }}>
                    {ev.promotionStatus}
                  </span>
                )}
              </div>
              {ev.description && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>{ev.description}</div>}
              {ev.promotionStatus === "DENIED" && ev.promotionDenyReason && (
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, color: "rgb(252,165,165)" }}>Denied: {ev.promotionDenyReason}</div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {ev.status === "DRAFT" && <button style={S.success} onClick={() => updateStatus(ev.id, "PUBLISHED")}>Publish</button>}
                {ev.status === "PUBLISHED" && <button style={S.btn} onClick={() => updateStatus(ev.id, "COMPLETED")}>Complete</button>}
                {ev.status !== "CANCELED" && <button style={{ ...S.btn, color: "rgb(253,230,138)" }} onClick={() => updateStatus(ev.id, "CANCELED")}>Cancel</button>}
                <button style={S.danger} onClick={() => deleteEvent(ev.id)}>Delete</button>
                {isOwner && ev.status === "PUBLISHED" && ev.promotionStatus === "NONE" && (
                  promoEventId === ev.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input style={{ ...S.input, width: 180, fontSize: 11 }} placeholder="Pitch to staff (optional)" value={promoNote} onChange={e => setPromoNote(e.target.value)} />
                      <button style={S.btnPri} onClick={() => requestPromotion(ev.id)}>Send</button>
                      <button style={S.btn} onClick={() => setPromoEventId(null)}>X</button>
                    </div>
                  ) : (
                    <button style={S.btnPri} onClick={() => setPromoEventId(ev.id)}>Request Promotion</button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Join Requests Tab ────────────────────────────────────────────────────────

function JoinRequestsTab({ lobbyId }: { lobbyId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/join-requests`);
    if (j.ok) setRequests(j.requests || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [lobbyId]);

  async function act(reqId: string, action: "approve" | "deny", reason?: string) {
    setActing(reqId);
    const body: any = {};
    if (reason) body.reason = reason;
    await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/join-requests/${reqId}/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setActing(null);
    load();
  }

  const pending = requests.filter(r => r.status === "PENDING");
  const reviewed = requests.filter(r => r.status !== "PENDING");

  if (loading) return <div style={{ padding: 20, opacity: 0.4, fontSize: 12 }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ ...S.label, marginBottom: 12 }}>PENDING REQUESTS ({pending.length})</div>
      {pending.length === 0 && (
        <div style={{ padding: "16px 0", fontSize: 12, opacity: 0.4 }}>No pending requests.</div>
      )}
      {pending.map(r => (
        <div key={r.id} style={{
          ...S.card, marginBottom: 8,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.9)" }}>{r.userName}</div>
            {r.message && <div style={{ fontSize: 11, color: "rgba(148,163,184,.55)", marginTop: 3, fontStyle: "italic" }}>"{r.message}"</div>}
            <div style={{ fontSize: 10, opacity: 0.35, marginTop: 3 }}>{fmtDate(r.createdAt)}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              style={{ ...S.btnPri, padding: "5px 14px", fontSize: 11 }}
              onClick={() => act(r.id, "approve")}
              disabled={acting === r.id}
            >
              Approve
            </button>
            <button
              style={{ ...S.btn, padding: "5px 14px", fontSize: 11, borderColor: "rgba(239,68,68,.2)", color: "rgba(239,68,68,.7)" }}
              onClick={() => {
                const reason = prompt("Deny reason (optional):");
                act(r.id, "deny", reason || undefined);
              }}
              disabled={acting === r.id}
            >
              Deny
            </button>
          </div>
        </div>
      ))}

      {reviewed.length > 0 && (
        <>
          <div style={{ ...S.label, marginTop: 24, marginBottom: 12 }}>REVIEWED ({reviewed.length})</div>
          {reviewed.map(r => (
            <div key={r.id} style={{
              ...S.card, marginBottom: 6, opacity: 0.6,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{r.userName}</div>
                <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>
                  {r.status === "APPROVED" ? "Approved" : "Denied"}{r.reviewedByName ? ` by ${r.reviewedByName}` : ""} · {fmtDate(r.reviewedAt || r.createdAt)}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                color: r.status === "APPROVED" ? "#22C55E" : "#EF4444",
                background: r.status === "APPROVED" ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)",
              }}>
                {r.status}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function AuditTab({ lobbyId, initialLogs }: { lobbyId: string; initialLogs: AdminAudit[] }) {
  const [logs] = useState(initialLogs);
  const [filter, setFilter] = useState("");

  const actionColor = (a: string) => {
    if (a.includes("kick") || a.includes("delete") || a.includes("ban")) return "rgba(239,68,68,.85)";
    if (a.includes("role") || a.includes("rename")) return "rgba(124,58,237,.95)";
    if (a.includes("branding") || a.includes("module")) return "rgba(14,165,233,.85)";
    if (a.includes("pin")) return "rgba(245,158,11,.85)";
    return "rgba(148,163,184,.75)";
  };

  const filtered = filter.trim()
    ? logs.filter(l => (l.type + l.actorName + (l.note || "")).toLowerCase().includes(filter.toLowerCase()))
    : logs;

  return (
    <div>
      <input style={{ ...S.input, marginBottom: 14 }} placeholder="Filter audit log..." value={filter} onChange={e => setFilter(e.target.value)} />
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {filtered.map(l => (
          <div key={l.id} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.02)", fontSize: 12 }}>
            <span style={{ color: actionColor(l.type), fontWeight: 700, minWidth: 130, flexShrink: 0 }}>{l.type}</span>
            <span style={{ opacity: 0.8, flexShrink: 0 }}>{l.actorName}</span>
            {l.note && <span style={{ opacity: 0.5, fontFamily: "monospace", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.note}</span>}
            <span style={{ marginLeft: "auto", opacity: 0.35, whiteSpace: "nowrap", fontSize: 11 }}>{fmtDate(l.ts)}</span>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ opacity: 0.4, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No audit entries.</div>}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function LobbyAdminPage() {
  const router = useRouter();
  const params = useParams();
  const ctx    = useWeered() as any;

  const lobbyId = decodeURIComponent(String(params?.id || ""));

  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [nav, setNav]         = useState<NavId>("branding");
  const [voiceOpen, setVoiceOpen] = useState(false);

  const adminRoomId = `@admin-${lobbyId}`;

  // Join the admin room for presence + chat
  useEffect(() => {
    try { ctx?.join?.(adminRoomId); } catch {}
    try { ctx?.setActiveRoomId?.(adminRoomId); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminRoomId]);

  const load = useCallback(async () => {
    try {
      const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin`);
      if (!j.ok) { setError(j.error || "Access denied"); setLoading(false); return; }
      setData(j);
      setLoading(false);
    } catch { setError("Failed to load admin data"); setLoading(false); }
  }, [lobbyId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--weered-bg, #080810)", color: "rgba(243,244,246,.4)", fontFamily: "monospace", fontSize: 13 }}>
      Loading admin panel...
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--weered-bg, #080810)", color: "rgba(243,244,246,.5)", fontFamily: "monospace", fontSize: 13 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{error || "Access denied"}</div>
        <a href={`/lobby/${encodeURIComponent(lobbyId)}`} style={{ color: "rgb(216,180,254)", textDecoration: "underline" }}>Back to lobby</a>
      </div>
    </div>
  );

  const { lobby, members, rooms: adminRooms, audit, bans, myLevel, overrideRole, perms } = data;
  const roleNames = lobby.roleNames || DEFAULT_ROLE_NAMES;
  const visibleNav = NAV_ITEMS.filter(n => overrideRole || myLevel >= n.minLevel);
  const accent = lobby.accentColor || "rgba(124,58,237,1)";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--weered-bg, #080810)", color: "rgba(243,244,246,.92)", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${accent}25`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: `${accent}08` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lobby.logoUrl && <img src={lobby.logoUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />}
          <div style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(16,185,129,.85)", boxShadow: "0 0 6px rgba(16,185,129,.5)" }} />
          <div>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-.3px" }}>{lobby.name || lobbyId}</span>
            <span style={{ fontSize: 11, opacity: 0.4, marginLeft: 10 }}>admin panel</span>
          </div>
          {lobby.verified && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 999, border: "1px solid rgba(16,185,129,.30)", color: "rgb(110,231,183)", background: "rgba(16,185,129,.08)" }}>VERIFIED</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {overrideRole && <OverrideBadge role={overrideRole} />}
          <LevelBadge level={myLevel} roleNames={roleNames} />
          <button onClick={() => setVoiceOpen(!voiceOpen)} style={{ ...S.btn, fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
            {voiceOpen ? "🔇" : "🎙"} Voice
          </button>
          <a href={`/lobby/${encodeURIComponent(lobbyId)}`} style={{ fontSize: 12, opacity: 0.55, textDecoration: "none", padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" }}>
            ← Lobby
          </a>
        </div>
      </div>

      {/* Voice bar (collapsible) */}
      {voiceOpen && (
        <RoomStage roomId={adminRoomId} mode="voice" onClose={() => setVoiceOpen(false)} style={{ flexShrink: 0 }} />
      )}

      {/* Body: 3 columns */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "200px 1fr 280px" }}>

        {/* Left: nav + presence */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,.07)", padding: "14px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ ...S.label, marginBottom: 8 }}>Navigation</div>
          {visibleNav.map(item => (
            <button key={item.id} onClick={() => setNav(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left", width: "100%", background: nav === item.id ? `${accent}20` : "transparent", color: nav === item.id ? "rgba(216,180,254,.95)" : "rgba(148,163,184,.75)", fontWeight: nav === item.id ? 700 : 400, fontSize: 13, transition: "background .1s" }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          {/* Stats */}
          <div style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.06)" }}>
            <div style={S.label}>Stats</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.6 }}>
                <span>Members</span><span style={{ fontWeight: 700 }}>{members.length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.6 }}>
                <span>Rooms</span><span style={{ fontWeight: 700 }}>{adminRooms.length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.6 }}>
                <span>Bans</span><span style={{ fontWeight: 700 }}>{bans.length}</span>
              </div>
            </div>
          </div>

          {/* Presence */}
          <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.06)" }}>
            <AdminPresence lobbyId={lobbyId} roleNames={roleNames} />
          </div>
        </div>

        {/* Center: content */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              {visibleNav.find(n => n.id === nav)?.icon} {visibleNav.find(n => n.id === nav)?.label}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            {nav === "branding" && <BrandingTab lobby={lobby} onRefresh={load} />}
            {nav === "modules"  && <ModulesTab lobby={lobby} onRefresh={load} />}
            {nav === "rooms"    && <RoomsTab lobbyId={lobbyId} initialRooms={adminRooms} perms={perms} onRefresh={load} />}
            {nav === "challenges" && <ChallengesTab lobbyId={lobbyId} />}
            {nav === "roles"    && <RolesTab lobby={lobby} onRefresh={load} />}
            {nav === "tiers"    && <TiersTab lobbyId={lobbyId} roleNames={roleNames} onRefresh={load} />}
            {nav === "join-requests" && <JoinRequestsTab lobbyId={lobbyId} />}
            {nav === "events"   && <LobbyEventsTab lobbyId={lobbyId} myLevel={myLevel} overrideRole={overrideRole} onRefresh={load} />}
            {nav === "members"  && <MembersTab lobbyId={lobbyId} initialMembers={members} roleNames={roleNames} myLevel={myLevel} perms={perms} overrideRole={overrideRole} onRefresh={load} />}
            {nav === "audit"    && <AuditTab lobbyId={lobbyId} initialLogs={audit} />}
          </div>
        </div>

        {/* Right: admin team chat */}
        <div style={{ borderLeft: "1px solid rgba(255,255,255,.07)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Team Chat</div>
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>#{adminRoomId} · admin only</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: "0 10px 10px" }}>
            <LobbyChatPanel roomId={adminRoomId} embedded style={{ height: "100%", display: "flex", flexDirection: "column" }} />
          </div>
        </div>

      </div>
    </div>
  );
}
