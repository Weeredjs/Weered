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
  { id: "branding", label: "Branding",  icon: "🎨", minLevel: 4 },
  { id: "modules",  label: "Modules",   icon: "🧩", minLevel: 4 },
  { id: "rooms",    label: "Rooms",     icon: "🚪", minLevel: 3 },
  { id: "roles",    label: "Roles",     icon: "👑", minLevel: 5 },
  { id: "members",  label: "Members",   icon: "👥", minLevel: 2 },
  { id: "audit",    label: "Audit Log", icon: "📋", minLevel: 3 },
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
  { key: "feed",  label: "Reddit Feed",      desc: "Subreddit content browser" },
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

  // Join the admin room for presence
  useEffect(() => {
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
            {nav === "roles"    && <RolesTab lobby={lobby} onRefresh={load} />}
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
