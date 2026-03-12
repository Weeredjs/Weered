"use client";

import { AVATAR_PALETTE, avatarBg } from "../../lib/avatarColor";
import React, { useEffect, useState } from "react";
import { useWeered } from "../../WeeredProvider";

// Types
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
};

// Tier config
const TIERS = {
  INNOCENT: { label: "Innocent", color: "#94a3b8", glow: "rgba(148,163,184,.20)" },
  INDICTED: { label: "Indicted", color: "#a78bfa", glow: "rgba(167,139,250,.25)" },
  FELON:    { label: "Felon",    color: "#f97316", glow: "rgba(249,115,22,.25)"  },
  KINGPIN:  { label: "Kingpin",  color: "#eab308", glow: "rgba(234,179,8,.30)"  },
};

const ROLE_COLORS: Record<string, string> = {
  GOD:     "#facc15",
  ADMIN:   "#f87171",
  STAFF:   "#60a5fa",
  SUPPORT: "#34d399",
};

// AVATAR_PALETTE and avatarBg imported from lib/avatarColor

function notorietyRank(n: number): string {
  if (n >= 10000) return "Legend";
  if (n >= 5000)  return "Crime Boss";
  if (n >= 2000)  return "Made Man";
  if (n >= 1000)  return "Associate";
  if (n >= 500)   return "Hustler";
  if (n >= 100)   return "Small-Timer";
  return "Nobody";
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

// Notoriety progress bar
function NotorietyBar({ value, color }: { value: number; color: string }) {
  const thresholds = [0, 100, 500, 1000, 2000, 5000, 10000];
  const next = thresholds.find(t => t > value) ?? 10000;
  const prev = [...thresholds].reverse().find(t => t <= value) ?? 0;
  const pct  = next === prev ? 100 : Math.min(100, ((value - prev) / (next - prev)) * 100);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 3, background: "rgba(255,255,255,.08)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: color, borderRadius: 99,
          boxShadow: `0 0 6px ${color}`,
          transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, opacity: 0.3 }}>
        <span>{prev.toLocaleString()}</span>
        <span>{next.toLocaleString()}</span>
      </div>
    </div>
  );
}

// Avatar color picker
function ColorPicker({ current, onChange }: { current: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
      {AVATAR_PALETTE.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{
            width: 22, height: 22, borderRadius: "50%",
            background: c, border: `2px solid ${c === current ? "#fff" : "transparent"}`,
            cursor: "pointer", padding: 0,
            boxShadow: c === current ? `0 0 0 1px ${c}` : "none",
            transition: "border 0.1s",
          }}
        />
      ))}
    </div>
  );
}

// Main component
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
        // Seed localStorage so other components use the right color immediately
        if (j.avatarColor) {
          try { localStorage.setItem("weered:avatarColor", j.avatarColor); } catch {}
        }
      })
      .catch(() => setError("Could not load profile."))
      .finally(() => setLoading(false));
  }, [resolvedId, token, apiBase]);

  // Save bio
  async function saveBio() {
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
  }

  // Save avatar color
  async function saveColor(color: string) {
    setAvatarColor(color);
    // Write to localStorage immediately so all avatar components pick it up
    try { localStorage.setItem("weered:avatarColor", color); } catch {}
    // Broadcast so open components re-render
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
  }

  function openDM() {
    try {
      window.dispatchEvent(new CustomEvent("weered:dock:open", {
        detail: { mode: "dm", peer: { id: resolvedId, name: profile?.name || userId } },
      }));
    } catch {}
  }

  // Loading state
  if (loading) return (
    <div style={wrap}>
      {[100, 75, 60].map(w => (
        <div key={w} style={{ height: 14, borderRadius: 6, background: "rgba(255,255,255,.06)", marginBottom: 8, width: `${w}%` }} />
      ))}
    </div>
  );

  if (error || !profile) return (
    <div style={wrap}>
      <div style={{ opacity: 0.45, fontSize: 13, padding: "20px 0" }}>{error || "Profile not found."}</div>
    </div>
  );

  const tier      = TIERS[profile.tier] || TIERS.INNOCENT;
  const roleColor = ROLE_COLORS[profile.globalRole] || null;
  const aColor    = avatarColor || avatarBg(profile.name);
  const initial   = profile.name.slice(0, 1).toUpperCase();
  const joinDate  = new Date(profile.joinedAt).toLocaleDateString("en-CA", { year: "numeric", month: "short" });
  const lastSeen  = profile.lastSeen ? formatLastSeen(profile.lastSeen) : null;
  const rank      = notorietyRank(profile.notoriety);

  return (
    <div style={wrap}>

      {/* Tier header strip */}
      <div style={{
        margin: "-16px -16px 0",
        height: 56,
        background: `linear-gradient(135deg, ${tier.color}18 0%, transparent 65%)`,
        borderBottom: `1px solid ${tier.color}28`,
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        padding: "0 16px",
      }}>
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "2px", textTransform: "uppercase", color: tier.color, opacity: 0.5 }}>
          {tier.label}
        </span>
      </div>

      {/* Avatar + name row */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: -24, marginBottom: 12 }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
          background: aColor,
          border: `2.5px solid ${tier.color}`,
          boxShadow: `0 0 14px ${tier.glow}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 900, color: "#fff",
          transition: "background 0.2s",
        }}>
          {initial}
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.3px" }}>{profile.name}</span>
            <span style={{
              padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 900,
              background: `${tier.color}15`, border: `1px solid ${tier.color}40`, color: tier.color,
            }}>{tier.label}</span>
            {roleColor && (
              <span style={{
                padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 900,
                background: `${roleColor}15`, border: `1px solid ${roleColor}40`, color: roleColor,
              }}>{profile.globalRole}</span>
            )}
          </div>
          <div style={{ fontSize: 11, opacity: 0.35, marginTop: 2 }}>
            Member since {joinDate}
            {lastSeen && <span style={{ marginLeft: 8 }}>{lastSeen}</span>}
          </div>
        </div>
      </div>

      {/* Avatar color picker — own profile only */}
      {isMe && (
        <div style={section}>
          <div style={sectionLabel}>Avatar Color {savingColor && <span style={{ opacity: 0.4 }}>saving...</span>}</div>
          <ColorPicker current={aColor} onChange={saveColor} />
        </div>
      )}

      {/* Bio */}
      <div style={section}>
        <div style={sectionLabel}>Bio</div>
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
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 8,
                color: "inherit", fontSize: 12, lineHeight: 1.5,
                resize: "vertical", outline: "none", fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button onClick={saveBio} disabled={saving} style={{ ...btn, background: `${tier.color}18`, borderColor: `${tier.color}44`, color: tier.color }}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={() => { setEditing(false); setBio(profile.bio || ""); }} style={btn}>Cancel</button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <p style={{ fontSize: 12, lineHeight: 1.6, opacity: profile.bio ? 0.8 : 0.3, margin: 0, fontStyle: profile.bio ? "normal" : "italic", flex: 1 }}>
              {profile.bio || (isMe ? "No bio yet." : "No bio.")}
            </p>
            {isMe && <button onClick={() => setEditing(true)} style={{ ...btn, flexShrink: 0, fontSize: 11 }}>Edit</button>}
          </div>
        )}
      </div>

      {/* Notoriety */}
      <div style={section}>
        <div style={sectionLabel}>Notoriety</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            fontSize: 28, fontWeight: 950, letterSpacing: "-1px",
            color: tier.color, textShadow: `0 0 18px ${tier.glow}`,
          }}>
            {profile.notoriety.toLocaleString()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{rank}</div>
            <div style={{ fontSize: 10, opacity: 0.35 }}>street rank</div>
          </div>
        </div>
        <NotorietyBar value={profile.notoriety} color={tier.color} />
      </div>

      {/* Stats */}
      <div style={section}>
        <div style={sectionLabel}>Stats</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Rooms Hosted", value: profile.roomsHosted },
            { label: "Points", value: profile.notoriety.toLocaleString() },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, padding: "10px 12px", borderRadius: 10,
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.07)",
              display: "flex", flexDirection: "column", gap: 2,
            }}>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{s.value}</span>
              <span style={{ fontSize: 10, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions — other users only */}
      {!isMe && (
        <div style={section}>
          <div style={sectionLabel}>Actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button onClick={openDM} style={btn}>Message</button>
            <button style={{ ...btn, opacity: 0.4, cursor: "not-allowed" }} disabled>Invite to room (soon)</button>
          </div>
        </div>
      )}

    </div>
  );
}

// Styles
const wrap: React.CSSProperties = {
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const section: React.CSSProperties = {
  marginTop: 14,
  padding: "12px 14px",
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.07)",
  borderRadius: 12,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, opacity: 0.4,
  textTransform: "uppercase", letterSpacing: "1px",
  marginBottom: 8,
};

const btn: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 8,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.06)",
  color: "inherit", fontSize: 12, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
};
