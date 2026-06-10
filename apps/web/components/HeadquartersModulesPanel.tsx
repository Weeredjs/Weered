"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import EmptyState from "./EmptyState";
import ModuleTabBar from "./ModuleTabBar";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function getToken() { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } }
function authHeaders(): Record<string, string> { const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; }

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  return r.json();
}

const CLR = {
  green:  "#22c55e",
  red:    "#ef4444",
  blue:   "#3B82F6",
  grey:   "rgba(255,255,255,.2)",
  gold:   "#D4A017",
  purple: "#A78BFA",
  text:   "rgba(243,244,246,.95)",
  dim:    "rgba(243,244,246,.55)",
  muted:  "rgba(243,244,246,.25)",
  border: "rgba(255,255,255,.06)",
};

const DEFAULT_ACCENT = "#3B82F6";

const S = {
  card: {
    borderRadius: 2,
    border: `1px solid rgba(255,255,255,.08)`,
    background: "rgba(255,255,255,.03)",
    padding: "12px 14px",
  } as React.CSSProperties,
  btn: {
    padding: "6px 12px", borderRadius: 2,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.05)",
    fontSize: 12, cursor: "pointer",
    color: "rgba(243,244,246,.88)",
    fontWeight: 500,
    transition: "background .12s, border-color .12s",
  } as React.CSSProperties,
  input: {
    width: "100%", padding: "8px 12px", borderRadius: 2,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.30)", fontSize: 13,
    color: "rgba(243,244,246,.92)", outline: "none",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  textarea: {
    width: "100%", padding: "8px 12px", borderRadius: 2,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.30)", fontSize: 13,
    color: "rgba(243,244,246,.92)", outline: "none",
    boxSizing: "border-box" as const,
    resize: "vertical" as const, minHeight: 80,
    fontFamily: "inherit",
  } as React.CSSProperties,
  label: {
    fontSize: 10, fontWeight: 700, opacity: 0.45,
    letterSpacing: ".7px", textTransform: "uppercase" as const,
    marginBottom: 6,
  } as React.CSSProperties,
};

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "just now";
    const m = Math.floor(diff / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return "Yesterday";
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}

function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}

function avatarBg(name: string): string {
  return `hsl(${nameHue(name)}, 50%, 35%)`;
}

function roleLabel(role: string): string {
  if (role === "OWNER") return "Director";
  if (role === "MOD") return "Manager";
  return "Employee";
}

function roleColor(role: string): string {
  if (role === "OWNER") return CLR.gold;
  if (role === "MOD") return CLR.purple;
  return CLR.grey;
}

type Room = { id: string; name: string; locked: boolean; onlineCount: number; hasPassword: boolean };
type PresenceUser = { id: string; name: string; roomId: string; roomName: string };
type Presence = { count: number; users: PresenceUser[] };
type Member = { userId: string; name: string; role: string; avatar?: string };
type Announcement = {
  id: string; title: string; body: string;
  authorName?: string; author?: { name: string };
  createdAt: string;
};

const TABS = [
  { id: "directory" as const, label: "Directory", icon: "🏢" },
  { id: "team" as const,      label: "Team",      icon: "👥" },
  { id: "announce" as const,  label: "Announcements", icon: "📢" },
];
type TabId = typeof TABS[number]["id"];

function StatusDot({ color, pulse, size = 8 }: { color: string; pulse?: boolean; size?: number }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: color, flexShrink: 0,
      boxShadow: pulse ? `0 0 8px ${color}88` : undefined,
      animation: pulse ? "hq-pulse 2s ease-in-out infinite" : undefined,
    }} />
  );
}

function AvatarCircle({ name, size = 28, avatar }: { name: string; size?: number; avatar?: string }) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
          border: "1px solid rgba(255,255,255,.08)",
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: avatarBg(name), flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: 700, color: "rgba(255,255,255,.85)",
      border: "1px solid rgba(255,255,255,.08)",
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function officeStatus(room: Room): { color: string; label: string } {
  const occupied = room.onlineCount > 0;
  const locked = room.locked || room.hasPassword;
  if (!locked && !occupied)  return { color: CLR.green, label: "Available" };
  if (!locked && occupied)   return { color: CLR.blue,  label: `${room.onlineCount} in meeting` };
  if (locked && occupied)    return { color: CLR.red,   label: "Busy" };
  return { color: CLR.grey, label: "Closed" };
}

function DirectoryTab({ lobbyId, accent, rooms, presence }: {
  lobbyId: string; accent: string; rooms: Room[]; presence: Presence;
}) {
  const router = useRouter();

  const usersByRoom = new Map<string, PresenceUser[]>();
  for (const u of presence.users || []) {
    if (!usersByRoom.has(u.roomId)) usersByRoom.set(u.roomId, []);
    usersByRoom.get(u.roomId)!.push(u);
  }

  if (rooms.length === 0) {
    return <EmptyState icon="🏢" title="No offices yet." hint="Create rooms in this lobby to set up your HQ." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", borderRadius: 2,
        background: "rgba(255,255,255,.02)",
        border: `1px solid rgba(255,255,255,.05)`,
        borderLeft: `2px solid ${accent}`,
      }}>
        <StatusDot color={CLR.green} pulse size={8} />
        <span style={{ fontSize: 13, color: CLR.text, fontWeight: 600 }}>
          {presence.count || 0} team member{(presence.count || 0) !== 1 ? "s" : ""} online
        </span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
      }}>
        {rooms.map(room => {
          const status = officeStatus(room);
          const people = usersByRoom.get(room.id) || [];
          const locked = room.locked || room.hasPassword;

          return (
            <div key={room.id} className="weered-hq-room-card" style={{
              ...S.card,
              display: "flex", flexDirection: "column", gap: 8,
              transition: "border-color .12s",
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = `${accent}44`)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}
            >
              <div className="weered-hq-room-head" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="weered-hq-room-name" style={{ fontSize: 14, fontWeight: 700, color: CLR.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {room.name}
                </span>
                {locked && <span style={{ fontSize: 12 }} title="Locked">🔒</span>}
              </div>

              <div className="weered-hq-room-status" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <StatusDot color={status.color} size={7} />
                <span style={{ fontSize: 11, color: CLR.dim, fontWeight: 500 }}>{status.label}</span>
              </div>

              {people.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: -4, marginTop: 2 }}>
                  {people.slice(0, 4).map((p, i) => (
                    <div key={p.id} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 4 - i }}>
                      <AvatarCircle name={p.name} size={22} />
                    </div>
                  ))}
                  {people.length > 4 && (
                    <span style={{ fontSize: 10, color: CLR.dim, marginLeft: 4, fontWeight: 600 }}>
                      +{people.length - 4}
                    </span>
                  )}
                </div>
              )}

              <div className="weered-hq-room-actions" style={{ display: "flex", gap: 6, marginTop: "auto" }}>
                {!locked ? (
                  <button
                    className="weered-hq-room-enter"
                    onClick={() => router.push(`/room/${room.id}`)}
                    style={{
                      ...S.btn, flex: 1,
                      background: `${accent}18`,
                      borderColor: `${accent}40`,
                      color: accent,
                      fontWeight: 600,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${accent}30`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${accent}18`; }}
                  >
                    Enter
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => router.push(`/room/${room.id}`)}
                      style={{ ...S.btn, flex: 1 }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.05)"; }}
                    >
                      Enter
                    </button>
                    <button
                      style={{
                        ...S.btn,
                        background: "rgba(239,68,68,.08)",
                        borderColor: "rgba(239,68,68,.25)",
                        color: CLR.red,
                        fontWeight: 600,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,.16)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,.08)"; }}
                      onClick={() => {
                        router.push(`/room/${room.id}`);
                      }}
                    >
                      Knock
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamTab({ members, presence, accent }: {
  members: Member[]; presence: Presence; accent: string;
}) {
  const [search, setSearch] = useState("");

  const onlineSet = new Set((presence.users || []).map(u => u.id));
  const locationMap = new Map<string, string>();
  for (const u of presence.users || []) {
    locationMap.set(u.id, u.roomName || "Online");
  }

  const filtered = members
    .filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aOn = onlineSet.has(a.userId) ? 0 : 1;
      const bOn = onlineSet.has(b.userId) ? 0 : 1;
      if (aOn !== bOn) return aOn - bOn;
      const roleWeight = (r: string) => r === "OWNER" ? 0 : r === "MOD" ? 1 : 2;
      const rw = roleWeight(a.role) - roleWeight(b.role);
      if (rw !== 0) return rw;
      return a.name.localeCompare(b.name);
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        type="text"
        placeholder="Search team members..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={S.input}
      />

      {filtered.length === 0 && (
        <EmptyState compact title={search ? "Nobody matches that search." : "No team members yet."} />
      )}

      {filtered.map(m => {
        const isOnline = onlineSet.has(m.userId);
        const location = locationMap.get(m.userId) || "Away";
        const rLabel = roleLabel(m.role);
        const rColor = roleColor(m.role);

        return (
          <div key={m.userId} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 2,
            background: "rgba(255,255,255,.02)",
            border: "1px solid rgba(255,255,255,.05)",
            transition: "border-color .12s",
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = `${accent}33`)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.05)")}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <AvatarCircle name={m.name} size={32} avatar={m.avatar} />
              <div style={{
                position: "absolute", bottom: -1, right: -1,
                width: 10, height: 10, borderRadius: "50%",
                background: isOnline ? CLR.green : "rgba(100,116,139,.3)",
                border: "2px solid rgba(20,20,25,1)",
                boxShadow: isOnline ? `0 0 4px ${CLR.green}66` : undefined,
              }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: CLR.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.name}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "1px 6px",
                  borderRadius: 2, letterSpacing: ".3px",
                  background: `${rColor}18`,
                  color: rColor,
                  border: `1px solid ${rColor}30`,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}>
                  {rLabel}
                </span>
              </div>
              <div style={{ fontSize: 11, color: CLR.dim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {isOnline ? (
                  <><span style={{ color: CLR.green, fontWeight: 500 }}>In</span> {location}</>
                ) : (
                  <span style={{ color: CLR.muted }}>Away</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnnouncementsTab({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const [posts, setPosts] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(
        `/forum/posts?lobbyId=${encodeURIComponent(lobbyId)}&category=ANNOUNCEMENT&sort=new&limit=10`
      );
      if (data?.ok) setPosts(data.posts || []);
    } catch { }
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => { load(); }, [load]);

  async function handlePost() {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const data = await apiFetch("/forum/posts", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          category: "ANNOUNCEMENT",
          lobbyId,
        }),
      });
      if (data?.ok) {
        setComposing(false);
        setTitle("");
        setBody("");
        load();
      }
    } catch { }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div style={{ padding: 30, textAlign: "center", fontSize: 13, color: CLR.dim }}>
        Loading announcements...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {!composing ? (
        <button
          onClick={() => setComposing(true)}
          style={{
            ...S.btn,
            background: `${accent}14`,
            borderColor: `${accent}35`,
            color: accent,
            fontWeight: 600,
            padding: "8px 14px",
            fontSize: 13,
            width: "100%",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${accent}28`; }}
          onMouseLeave={e => { e.currentTarget.style.background = `${accent}14`; }}
        >
          + Post Announcement
        </button>
      ) : (
        <div style={{
          ...S.card,
          display: "flex", flexDirection: "column", gap: 8,
          borderColor: `${accent}30`,
        }}>
          <div style={S.label}>New Announcement</div>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={S.input}
            autoFocus
          />
          <textarea
            placeholder="Body"
            value={body}
            onChange={e => setBody(e.target.value)}
            style={S.textarea}
          />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              onClick={() => { setComposing(false); setTitle(""); setBody(""); }}
              style={S.btn}
            >
              Cancel
            </button>
            <button
              onClick={handlePost}
              disabled={submitting || !title.trim() || !body.trim()}
              style={{
                ...S.btn,
                background: `${accent}20`,
                borderColor: `${accent}40`,
                color: accent,
                fontWeight: 600,
                opacity: submitting || !title.trim() || !body.trim() ? 0.4 : 1,
                cursor: submitting ? "wait" : "pointer",
              }}
            >
              {submitting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      )}

      {posts.length === 0 && (
        <div style={{ padding: "30px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }}>📢</div>
          <EmptyState compact title="No announcements yet." hint="Leadership's quiet. Check back later." />
        </div>
      )}

      {posts.map(p => (
        <div key={p.id} style={{
          ...S.card,
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: CLR.text, lineHeight: 1.3 }}>
            {p.title}
          </div>
          <div style={{
            fontSize: 12, color: CLR.dim, lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as any,
            overflow: "hidden",
          }}>
            {p.body}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: CLR.muted, fontWeight: 500 }}>
              {p.authorName || p.author?.name || "Unknown"}
            </span>
            <span style={{ fontSize: 11, color: CLR.muted }}>·</span>
            <span style={{ fontSize: 11, color: CLR.muted }}>
              {timeAgo(p.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

type Props = {
  lobbyId: string;
  accentColor?: string;
  style?: React.CSSProperties;
};

export default function HeadquartersModulesPanel({ lobbyId, accentColor, style }: Props) {
  const accent = accentColor || DEFAULT_ACCENT;
  const [tab, setTab] = useState<TabId>("directory");

  const [rooms, setRooms] = useState<Room[]>([]);
  const [presence, setPresence] = useState<Presence>({ count: 0, users: [] });
  const [members, setMembers] = useState<Member[]>([]);

  const fetchRooms = useCallback(async () => {
    try {
      const data = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/rooms`);
      if (Array.isArray(data)) setRooms(data);
      else if (data?.rooms) setRooms(data.rooms);
    } catch { }
  }, [lobbyId]);

  const fetchPresence = useCallback(async () => {
    try {
      const data = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/presence`);
      if (data) setPresence({ count: data.count || 0, users: data.users || [] });
    } catch { }
  }, [lobbyId]);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/members`);
      if (data?.members) setMembers(data.members);
      else if (Array.isArray(data)) setMembers(data);
    } catch { }
  }, [lobbyId]);

  useEffect(() => {
    fetchRooms();
    fetchPresence();
    fetchMembers();
  }, [fetchRooms, fetchPresence, fetchMembers]);

  useEffect(() => {
    const i = setInterval(fetchRooms, 20_000);
    return () => clearInterval(i);
  }, [fetchRooms]);

  useEffect(() => {
    const i = setInterval(fetchPresence, 20_000);
    return () => clearInterval(i);
  }, [fetchPresence]);

  const injectedRef = useRef(false);
  useEffect(() => {
    if (injectedRef.current) return;
    injectedRef.current = true;
    try {
      const styleEl = document.createElement("style");
      styleEl.textContent = `
        @keyframes hq-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .55; transform: scale(.85); }
        }
      `;
      document.head.appendChild(styleEl);
    } catch { }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}>
      <ModuleTabBar tabs={TABS} active={tab} onSelect={(id) => setTab(id as TabId)} accent={accent} />

      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 14px",
        display: "flex", flexDirection: "column",
      }}>
        {tab === "directory" && (
          <DirectoryTab lobbyId={lobbyId} accent={accent} rooms={rooms} presence={presence} />
        )}
        {tab === "team" && (
          <TeamTab members={members} presence={presence} accent={accent} />
        )}
        {tab === "announce" && (
          <AnnouncementsTab lobbyId={lobbyId} accent={accent} />
        )}
      </div>
    </div>
  );
}
