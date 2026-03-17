"use client";

import { AVATAR_PALETTE, avatarBg } from "../../../lib/avatarColor";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useWeered } from "../../WeeredProvider";

// ─── Types ──────────────────────────────────────────────────
type Profile = {
  id: string;
  name: string;
  bio: string;
  notoriety: number;
  tier: "INNOCENT" | "INDICTED" | "FELON" | "KINGPIN";
  globalRole: string;
  joinedAt: string;
  lastSeen: string;
  roomsHosted: number;
  avatarColor?: string;
  avatar?: string; // URL — DiceBear, Google, or custom
};

// ─── Tier + Role config ─────────────────────────────────────
const TIERS = {
  INNOCENT: { label: "Innocent", color: "#94a3b8", glow: "rgba(148,163,184,.20)", accent: "#64748b" },
  INDICTED: { label: "Indicted", color: "#a78bfa", glow: "rgba(167,139,250,.25)", accent: "#7c3aed" },
  FELON:    { label: "Felon",    color: "#f97316", glow: "rgba(249,115,22,.25)",  accent: "#ea580c" },
  KINGPIN:  { label: "Kingpin",  color: "#eab308", glow: "rgba(234,179,8,.30)",  accent: "#ca8a04" },
};

const ROLE_COLORS: Record<string, string> = {
  GOD: "#facc15", ADMIN: "#f87171", STAFF: "#60a5fa", SUPPORT: "#34d399",
};

// ─── DiceBear avatar styles ─────────────────────────────────
// Each style generates a unique avatar from a seed string
const AVATAR_STYLES = [
  { id: "thumbs",       label: "Thumbs",     url: (s: string) => `https://api.dicebear.com/9.x/thumbs/svg?seed=${s}&backgroundColor=transparent` },
  { id: "bottts",       label: "Bots",       url: (s: string) => `https://api.dicebear.com/9.x/bottts/svg?seed=${s}&backgroundColor=transparent` },
  { id: "pixel-art",    label: "Pixel",      url: (s: string) => `https://api.dicebear.com/9.x/pixel-art/svg?seed=${s}&backgroundColor=transparent` },
  { id: "identicon",    label: "Identity",   url: (s: string) => `https://api.dicebear.com/9.x/identicon/svg?seed=${s}&backgroundColor=transparent` },
  { id: "shapes",       label: "Shapes",     url: (s: string) => `https://api.dicebear.com/9.x/shapes/svg?seed=${s}&backgroundColor=transparent` },
  { id: "rings",        label: "Rings",      url: (s: string) => `https://api.dicebear.com/9.x/rings/svg?seed=${s}&backgroundColor=transparent` },
  { id: "glass",        label: "Glass",      url: (s: string) => `https://api.dicebear.com/9.x/glass/svg?seed=${s}&backgroundColor=transparent` },
  { id: "fun-emoji",    label: "Emoji",      url: (s: string) => `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${s}&backgroundColor=transparent` },
];

// Generate 12 seed variants per style for gallery
function gallerySeeds(username: string): string[] {
  const seeds: string[] = [];
  for (let i = 0; i < 12; i++) {
    seeds.push(`${username}-${i}`);
  }
  return seeds;
}

// ─── Helpers ────────────────────────────────────────────────
function notorietyRank(n: number): { name: string; next: number; prev: number } {
  const ranks = [
    { name: "Nobody",     threshold: 0 },
    { name: "Small-Timer", threshold: 100 },
    { name: "Hustler",    threshold: 500 },
    { name: "Associate",  threshold: 1000 },
    { name: "Made Man",   threshold: 2000 },
    { name: "Crime Boss", threshold: 5000 },
    { name: "Legend",     threshold: 10000 },
  ];
  let current = ranks[0];
  let nextThreshold = 100;
  for (let i = ranks.length - 1; i >= 0; i--) {
    if (n >= ranks[i].threshold) {
      current = ranks[i];
      nextThreshold = ranks[i + 1]?.threshold ?? 10000;
      break;
    }
  }
  return { name: current.name, next: nextThreshold, prev: current.threshold };
}

function formatLastSeen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2)   return "Active now";
  if (m < 60)  return `Active ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `Active ${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `Active ${d}d ago`;
  return `Active ${new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`;
}

function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

// ─── NotorietyBar ───────────────────────────────────────────
function NotorietyBar({ value, color, prev, next }: { value: number; color: string; prev: number; next: number }) {
  const pct = next === prev ? 100 : Math.min(100, ((value - prev) / (next - prev)) * 100);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: "relative", height: 4, background: "rgba(255,255,255,.06)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 99,
          boxShadow: `0 0 8px ${color}66`,
          transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, opacity: 0.25, fontFamily: "monospace" }}>
        <span>{prev.toLocaleString()}</span>
        <span>{next.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ─── AvatarGallery ──────────────────────────────────────────
function AvatarGallery({ username, currentAvatar, onSelect }: {
  username: string;
  currentAvatar: string | null;
  onSelect: (url: string) => void;
}) {
  const [selectedStyle, setSelectedStyle] = useState(AVATAR_STYLES[0].id);
  const seeds = useMemo(() => gallerySeeds(username), [username]);
  const style = AVATAR_STYLES.find(s => s.id === selectedStyle) || AVATAR_STYLES[0];

  return (
    <div>
      {/* Style tabs */}
      <div style={{
        display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10,
        padding: "2px 0",
      }}>
        {AVATAR_STYLES.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedStyle(s.id)}
            style={{
              padding: "3px 9px", borderRadius: 6,
              fontSize: 10, fontWeight: 700, fontFamily: "inherit",
              border: s.id === selectedStyle ? "1px solid rgba(167,139,250,.5)" : "1px solid rgba(255,255,255,.08)",
              background: s.id === selectedStyle ? "rgba(167,139,250,.15)" : "rgba(255,255,255,.04)",
              color: s.id === selectedStyle ? "#c4b5fd" : "rgba(255,255,255,.45)",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Avatar grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6,
      }}>
        {seeds.map(seed => {
          const url = style.url(seed);
          const isSelected = currentAvatar === url;
          return (
            <button
              key={seed}
              type="button"
              onClick={() => onSelect(url)}
              style={{
                width: "100%", aspectRatio: "1", borderRadius: 10, padding: 3,
                border: isSelected ? "2px solid #a78bfa" : "2px solid rgba(255,255,255,.06)",
                background: isSelected ? "rgba(167,139,250,.12)" : "rgba(255,255,255,.03)",
                cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <img
                src={url}
                alt={seed}
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── ColorPicker ────────────────────────────────────────────
function ColorPicker({ current, onChange }: { current: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {AVATAR_PALETTE.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{
            width: 22, height: 22, borderRadius: "50%",
            background: c,
            border: `2px solid ${c === current ? "#fff" : "transparent"}`,
            cursor: "pointer", padding: 0,
            boxShadow: c === current ? `0 0 0 1px ${c}, 0 0 8px ${c}44` : "none",
            transition: "all 0.15s",
          }}
        />
      ))}
    </div>
  );
}

// ─── StatCard ───────────────────────────────────────────────
function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div style={{
      flex: 1, padding: "10px 12px", borderRadius: 10,
      background: "rgba(255,255,255,.03)",
      border: "1px solid rgba(255,255,255,.06)",
      display: "flex", flexDirection: "column", gap: 3,
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 12 }}>{icon}</span>
        <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.5px" }}>{value}</span>
      </div>
      <span style={{
        fontSize: 9, opacity: 0.35, textTransform: "uppercase",
        letterSpacing: "0.8px", fontWeight: 700,
      }}>{label}</span>
    </div>
  );
}

// ─── Main ProfileSheet ──────────────────────────────────────
export default function ProfileSheet({ userId }: { userId: string }) {
  const w       = useWeered() as any;
  const me      = w?.me;
  const token   = w?.token;
  const apiBase = w?.apiBase || "";

  const isMe = !!me && (String(me?.id || "") === String(userId) || userId === "@me");
  const resolvedId = isMe ? me?.id : userId;

  const [profile,     setProfile    ] = useState<Profile | null>(null);
  const [loading,     setLoading    ] = useState(true);
  const [error,       setError      ] = useState("");
  const [editing,     setEditing    ] = useState(false);
  const [bio,         setBio        ] = useState("");
  const [saving,      setSaving     ] = useState(false);
  const [avatarColor, setAvatarColor] = useState("");
  const [savingColor, setSavingColor] = useState(false);
  const [avatarUrl,   setAvatarUrl  ] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [activeTab,   setActiveTab  ] = useState<"gallery" | "color">("gallery");

  // Fetch profile
  useEffect(() => {
    if (!resolvedId) return;
    setLoading(true);
    setError("");
    fetch(`${apiBase}/profile/${resolvedId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(j => {
        if (j?.error) { setError(j.error); return; }
        setProfile(j);
        setBio(j.bio || "");
        const savedColor = j.avatarColor || avatarBg(j.name);
        setAvatarColor(savedColor);
        setAvatarUrl(j.avatar || null);
        if (j.avatarColor) {
          try { localStorage.setItem("weered:avatarColor", j.avatarColor); } catch {}
        }
      })
      .catch(() => setError("Could not load profile."))
      .finally(() => setLoading(false));
  }, [resolvedId, token, apiBase]);

  // Save bio
  const saveBio = useCallback(async () => {
    if (!token) return;
    setSaving(true);
    try {
      const r = await fetch(`${apiBase}/profile/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio }),
      });
      const j = await r.json();
      if (j?.error) { alert(j.error); return; }
      setProfile(prev => prev ? { ...prev, bio } : prev);
      setEditing(false);
    } catch { alert("Failed to save."); }
    finally { setSaving(false); }
  }, [token, apiBase, bio]);

  // Save avatar color
  const saveColor = useCallback(async (color: string) => {
    setAvatarColor(color);
    try { localStorage.setItem("weered:avatarColor", color); } catch {}
    try { window.dispatchEvent(new CustomEvent("weered:avatarColor", { detail: color })); } catch {}
    if (!token) return;
    setSavingColor(true);
    try {
      await fetch(`${apiBase}/profile/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarColor: color }),
      });
      setProfile(prev => prev ? { ...prev, avatarColor: color } : prev);
    } catch {}
    finally { setSavingColor(false); }
  }, [token, apiBase]);

  // Save avatar image URL
  const saveAvatar = useCallback(async (url: string) => {
    setAvatarUrl(url);
    setSavingAvatar(true);
    try {
      await fetch(`${apiBase}/profile/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar: url }),
      });
      setProfile(prev => prev ? { ...prev, avatar: url } : prev);
    } catch {}
    finally { setSavingAvatar(false); }
  }, [token, apiBase]);

  // Remove avatar (go back to letter)
  const removeAvatar = useCallback(async () => {
    setAvatarUrl(null);
    try {
      await fetch(`${apiBase}/profile/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar: "" }),
      });
      setProfile(prev => prev ? { ...prev, avatar: undefined } : prev);
    } catch {}
  }, [token, apiBase]);

  function openDM() {
    try {
      window.dispatchEvent(new CustomEvent("weered:dock:open", {
        detail: { mode: "dm", peer: { id: resolvedId, name: profile?.name || userId } },
      }));
    } catch {}
  }

  // ─── Loading state ──────────────────────────────────────────
  if (loading) return (
    <div style={wrap}>
      <div style={{ padding: "28px 0" }}>
        {[100, 75, 60, 40].map((w, i) => (
          <div key={i} style={{
            height: 12, borderRadius: 6,
            background: "rgba(255,255,255,.04)",
            marginBottom: 10, width: `${w}%`,
            animation: `shimmer 1.5s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>
      <style>{`@keyframes shimmer{0%,100%{opacity:0.3}50%{opacity:0.6}}`}</style>
    </div>
  );

  if (error || !profile) return (
    <div style={wrap}>
      <div style={{ opacity: 0.4, fontSize: 13, padding: "32px 0", textAlign: "center" }}>
        {error || "Profile not found."}
      </div>
    </div>
  );

  const tier      = TIERS[profile.tier] || TIERS.INNOCENT;
  const roleColor = ROLE_COLORS[profile.globalRole] || null;
  const aColor    = avatarColor || avatarBg(profile.name);
  const initial   = profile.name.slice(0, 1).toUpperCase();
  const joinDate  = new Date(profile.joinedAt).toLocaleDateString("en-CA", { year: "numeric", month: "short" });
  const lastSeen  = profile.lastSeen ? formatLastSeen(profile.lastSeen) : null;
  const rank      = notorietyRank(profile.notoriety);
  const hasAvatar = !!avatarUrl;

  return (
    <div style={wrap}>

      {/* ── Tier banner ─────────────────────────────────── */}
      <div style={{
        margin: "-16px -16px 0",
        height: 64,
        background: `linear-gradient(135deg, ${tier.color}12 0%, transparent 50%, ${tier.accent}08 100%)`,
        borderBottom: `1px solid ${tier.color}18`,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle pattern */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }} />
        <div style={{
          position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
          fontSize: 10, fontWeight: 900, letterSpacing: "2.5px",
          textTransform: "uppercase", color: tier.color, opacity: 0.35,
        }}>
          {tier.label}
        </div>
      </div>

      {/* ── Avatar + name ───────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: -28, marginBottom: 14 }}>
        {/* Avatar — image or letter */}
        <div
          onClick={isMe ? () => setShowGallery(!showGallery) : undefined}
          style={{
            width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
            background: hasAvatar ? `${aColor}22` : aColor,
            border: `2.5px solid ${tier.color}`,
            boxShadow: `0 0 16px ${tier.glow}, 0 4px 12px rgba(0,0,0,.3)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: hasAvatar ? 0 : 24, fontWeight: 900, color: "#fff",
            overflow: "hidden",
            cursor: isMe ? "pointer" : "default",
            transition: "transform 0.2s, box-shadow 0.2s",
            position: "relative",
          }}
        >
          {hasAvatar ? (
            <img src={avatarUrl!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            initial
          )}
          {isMe && (
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: 0, transition: "opacity 0.15s",
              fontSize: 11, fontWeight: 700, color: "#fff",
              pointerEvents: "none",
            }}
            className="avatar-edit-overlay"
            >
              Edit
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.3px" }}>{profile.name}</span>
            <span style={{
              padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 900,
              background: `${tier.color}12`, border: `1px solid ${tier.color}30`, color: tier.color,
            }}>{tier.label}</span>
            {roleColor && (
              <span style={{
                padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 900,
                background: `${roleColor}12`, border: `1px solid ${roleColor}30`, color: roleColor,
              }}>{profile.globalRole}</span>
            )}
          </div>
          <div style={{ fontSize: 11, opacity: 0.3, marginTop: 3, fontFamily: "monospace" }}>
            Since {joinDate}
            {lastSeen && <span style={{ marginLeft: 10, color: lastSeen === "Active now" ? "#22c55e" : "inherit", opacity: lastSeen === "Active now" ? 1 : 0.7 }}>{lastSeen}</span>}
          </div>
        </div>
      </div>

      {/* ── Avatar customization (own profile) ──────────── */}
      {isMe && showGallery && (
        <div style={section}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={sectionLabel}>Customize Avatar {(savingColor || savingAvatar) && <span style={{ opacity: 0.4, fontWeight: 400 }}>saving...</span>}</div>
            {hasAvatar && (
              <button onClick={removeAvatar} style={{ ...btnSmall, color: "rgba(239,68,68,.7)" }}>
                Remove image
              </button>
            )}
          </div>

          {/* Tab toggle */}
          <div style={{ display: "flex", gap: 2, marginBottom: 12, background: "rgba(255,255,255,.04)", borderRadius: 8, padding: 2 }}>
            {(["gallery", "color"] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: "6px 0", borderRadius: 6,
                  fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                  border: "none", cursor: "pointer",
                  background: activeTab === tab ? "rgba(255,255,255,.08)" : "transparent",
                  color: activeTab === tab ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.35)",
                  transition: "all 0.15s",
                }}
              >
                {tab === "gallery" ? "Avatar Gallery" : "Color"}
              </button>
            ))}
          </div>

          {activeTab === "gallery" ? (
            <AvatarGallery
              username={profile.name}
              currentAvatar={avatarUrl}
              onSelect={saveAvatar}
            />
          ) : (
            <ColorPicker current={aColor} onChange={saveColor} />
          )}
        </div>
      )}

      {/* ── Bio ─────────────────────────────────────────── */}
      <div style={section}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={sectionLabel}>Bio</div>
          {isMe && !editing && <button onClick={() => setEditing(true)} style={btnSmall}>Edit</button>}
        </div>
        {editing ? (
          <>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Write something about yourself..."
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "8px 10px",
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 8,
                color: "inherit", fontSize: 12, lineHeight: 1.6,
                resize: "vertical", outline: "none", fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setEditing(false); setBio(profile.bio || ""); }} style={btnSmall}>Cancel</button>
              <button onClick={saveBio} disabled={saving} style={{ ...btnSmall, background: `${tier.color}15`, borderColor: `${tier.color}35`, color: tier.color }}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        ) : (
          <p style={{
            fontSize: 12, lineHeight: 1.65, margin: 0,
            opacity: profile.bio ? 0.75 : 0.3,
            fontStyle: profile.bio ? "normal" : "italic",
          }}>
            {profile.bio || (isMe ? "No bio yet. Click Edit to add one." : "No bio.")}
          </p>
        )}
      </div>

      {/* ── Notoriety ───────────────────────────────────── */}
      <div style={section}>
        <div style={sectionLabel}>Notoriety</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            fontSize: 30, fontWeight: 950, letterSpacing: "-1.5px",
            color: tier.color,
            textShadow: `0 0 20px ${tier.glow}`,
            lineHeight: 1,
          }}>
            {profile.notoriety.toLocaleString()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>{rank.name}</div>
            <div style={{ fontSize: 10, opacity: 0.3, fontFamily: "monospace", marginTop: 2 }}>street rank</div>
          </div>
        </div>
        <NotorietyBar value={profile.notoriety} color={tier.color} prev={rank.prev} next={rank.next} />
      </div>

      {/* ── Stats row ───────────────────────────────────── */}
      <div style={{ ...section, background: "transparent", border: "none", padding: 0, marginTop: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <StatCard icon="🏠" label="Rooms Hosted" value={profile.roomsHosted} />
          <StatCard icon="⚡" label="Notoriety" value={profile.notoriety.toLocaleString()} />
          <StatCard icon="📅" label="Member" value={joinDate} />
        </div>
      </div>

      {/* ── Actions (other users) ───────────────────────── */}
      {!isMe && (
        <div style={{ ...section, marginTop: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={openDM} style={{ ...actionButton, background: "rgba(167,139,250,.1)", borderColor: "rgba(167,139,250,.25)", color: "#c4b5fd" }}>
              <span style={{ fontSize: 14 }}>💬</span> Message
            </button>
            <button style={{ ...actionButton, opacity: 0.35, cursor: "not-allowed" }} disabled>
              <span style={{ fontSize: 14 }}>📨</span> Invite
            </button>
            <button style={{ ...actionButton, opacity: 0.35, cursor: "not-allowed" }} disabled>
              <span style={{ fontSize: 14 }}>👥</span> Add Friend
            </button>
          </div>
        </div>
      )}

      {/* ── Hover overlay for avatar edit hint ──────────── */}
      <style>{`
        .avatar-edit-overlay { opacity: 0 !important; }
        div:hover > .avatar-edit-overlay { opacity: 1 !important; }
        @keyframes shimmer{0%,100%{opacity:0.3}50%{opacity:0.6}}
      `}</style>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const wrap: React.CSSProperties = {
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const section: React.CSSProperties = {
  marginTop: 12,
  padding: "12px 14px",
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 12,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, opacity: 0.4,
  textTransform: "uppercase", letterSpacing: "1px",
  marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
};

const btnSmall: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 6,
  border: "1px solid rgba(255,255,255,.1)",
  background: "rgba(255,255,255,.05)",
  color: "inherit", fontSize: 11, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
  transition: "all 0.15s",
};

const actionButton: React.CSSProperties = {
  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
  gap: 6, padding: "9px 0", borderRadius: 10,
  border: "1px solid rgba(255,255,255,.1)",
  background: "rgba(255,255,255,.04)",
  color: "inherit", fontSize: 12, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
  transition: "all 0.15s",
};
