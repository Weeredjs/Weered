"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWeered } from "../../../components/WeeredProvider";
import { weeredToast } from "../../../lib/toast";
import FlairBadge from "../../../components/FlairBadge";
import { useEquippedFlair } from "../../../lib/useEquippedFlair";

type GameAccount = {
  gameType: string;
  displayName: string;
  platform: string;
  linkedAt: string;
};

type Profile = {
  id: string;
  name: string;
  bio: string;
  notoriety: number;
  tier: "INNOCENT" | "INDICTED" | "FELON" | "KINGPIN";
  globalRole: string;
  joinedAt: string;
  roomsHosted: number;
  avatarColor: string;
  gameAccounts?: GameAccount[];
};

const TIERS = {
  INNOCENT: { label: "Innocent", color: "#94a3b8", glow: "rgba(148,163,184,.25)", rank: 0 },
  INDICTED: { label: "Indicted", color: "#a78bfa", glow: "rgba(167,139,250,.30)", rank: 1 },
  FELON: { label: "Felon", color: "#f97316", glow: "rgba(249,115,22,.30)", rank: 2 },
  KINGPIN: { label: "Kingpin", color: "#eab308", glow: "rgba(234,179,8,.35)", rank: 3 },
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  GOD: { label: "⚡ GOD", color: "#facc15" },
  ADMIN: { label: "🛡 Admin", color: "#f87171" },
  STAFF: { label: "⭐ Staff", color: "#60a5fa" },
  SUPPORT: { label: "🔧 Support", color: "#34d399" },
};

function notorietyRank(n: number): string {
  if (n >= 10000) return "Legend";
  if (n >= 5000) return "Crime Boss";
  if (n >= 2000) return "Made Man";
  if (n >= 1000) return "Associate";
  if (n >= 500) return "Hustler";
  if (n >= 100) return "Small-Timer";
  return "Nobody";
}

function nameToColor(name: string): string {
  const colors = [
    "#7c3aed",
    "#db2777",
    "#ea580c",
    "#16a34a",
    "#0284c7",
    "#9333ea",
    "#e11d48",
    "#d97706",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "14px 18px",
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 14,
        minWidth: 90,
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: "var(--weered-text, #f5f5f4)",
          letterSpacing: "-0.5px",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 11,
          opacity: 0.5,
          textTransform: "uppercase",
          letterSpacing: "0.8px",
          fontWeight: 700,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { me, token, apiBase } = useWeered();

  const userId = String(params?.userId || "");
  const isMe = me?.id === userId || userId === "@me";
  const resolvedId = isMe ? me?.id : userId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!resolvedId) return;
    setLoading(true);
    setError("");
    fetch(`${apiBase}/profile/${resolvedId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.error) {
          setError(j.error);
          return;
        }
        setProfile(j);
        setBio(j.bio || "");
      })
      .catch(() => setError("Failed to load profile."))
      .finally(() => setLoading(false));
  }, [resolvedId, token, apiBase]);

  async function saveBio() {
    if (!token || !me?.id) return;
    setSaving(true);
    try {
      const r = await fetch(`${apiBase}/profile/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio }),
      });
      const j = await r.json();
      if (j?.error) {
        weeredToast.error(j.error);
        return;
      }
      setProfile((prev) => (prev ? { ...prev, bio } : prev));
      setEditing(false);
      weeredToast.success("Bio saved.");
    } catch {
      weeredToast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div style={pageWrap}>
        <div style={{ opacity: 0.4, fontSize: 14 }}>Loading profile...</div>
      </div>
    );

  if (error || !profile)
    return (
      <div style={pageWrap}>
        <div style={{ opacity: 0.5, fontSize: 14, marginBottom: 16 }}>
          {error || "Profile not found."}
        </div>
        <button onClick={() => router.back()} style={btnStyle}>
          ← Go back
        </button>
      </div>
    );

  const tier = TIERS[profile.tier] || TIERS.INNOCENT;
  const roleInfo = ROLE_LABELS[profile.globalRole];
  const avatarColor = nameToColor(profile.name);
  const initial = profile.name.slice(0, 1).toUpperCase();
  const joinDate = new Date(profile.joinedAt).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
  });
  const rank = notorietyRank(profile.notoriety);
  const equippedFlair = useEquippedFlair(profile.id);

  return (
    <div style={pageWrap}>
      <div style={card}>
        {equippedFlair && equippedFlair.kind === "BANNER" && (
          <div style={{ padding: "10px 10px 0" }}>
            <FlairBadge flair={equippedFlair as any} size="lg" />
          </div>
        )}
        <div
          style={{
            height: 80,
            background: `linear-gradient(135deg, ${tier.color}22 0%, rgba(0,0,0,0) 70%)`,
            borderBottom: `1px solid ${tier.color}33`,
            borderRadius: "16px 16px 0 0",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: 20,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: tier.color,
              opacity: 0.4,
            }}
          >
            {tier.label}
          </div>
        </div>

        <div
          style={{
            padding: "0 24px",
            marginTop: -36,
            marginBottom: 16,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: avatarColor,
              border: `3px solid ${tier.color}`,
              boxShadow: `0 0 18px ${tier.glow}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 900,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {initial}
          </div>

          <div style={{ display: "flex", gap: 8, paddingBottom: 4 }}>
            {isMe &&
              (editing ? (
                <>
                  <button
                    onClick={saveBio}
                    disabled={saving}
                    style={{
                      ...btnStyle,
                      background: `${tier.color}22`,
                      borderColor: `${tier.color}55`,
                      color: tier.color,
                    }}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setBio(profile.bio || "");
                    }}
                    style={btnStyle}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} style={btnStyle}>
                  Edit profile
                </button>
              ))}
            {!isMe && (
              <button
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("weered:dock:open", {
                      detail: { mode: "dm", peer: { name: profile.name, id: profile.id } },
                    }),
                  );
                }}
                style={btnStyle}
              >
                Message
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: "0 24px 20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 6,
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{
                fontSize: 22,
                fontWeight: 950,
                margin: 0,
                color: "var(--weered-text, #f5f5f4)",
                letterSpacing: "-0.5px",
              }}
            >
              {equippedFlair && equippedFlair.kind === "NAMEPLATE" ? (
                <FlairBadge flair={equippedFlair as any}>{profile.name}</FlairBadge>
              ) : (
                profile.name
              )}
            </h1>
            {equippedFlair && equippedFlair.kind === "BADGE" && (
              <FlairBadge flair={equippedFlair as any} size="md" />
            )}

            <span
              style={{
                padding: "2px 10px",
                borderRadius: 999,
                background: `${tier.color}18`,
                border: `1px solid ${tier.color}44`,
                color: tier.color,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.5px",
              }}
            >
              {tier.label}
            </span>

            {roleInfo && (
              <span
                style={{
                  padding: "2px 10px",
                  borderRadius: 999,
                  background: `${roleInfo.color}18`,
                  border: `1px solid ${roleInfo.color}44`,
                  color: roleInfo.color,
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                {roleInfo.label}
              </span>
            )}
          </div>

          <div style={{ fontSize: 12, opacity: 0.45, marginBottom: 14 }}>
            Member since {joinDate}
          </div>

          {editing ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Write something about yourself..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.14)",
                borderRadius: 10,
                color: "var(--weered-text, #f5f5f4)",
                fontSize: 13,
                lineHeight: 1.5,
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          ) : (
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                opacity: profile.bio ? 0.85 : 0.35,
                margin: 0,
                fontStyle: profile.bio ? "normal" : "italic",
              }}
            >
              {profile.bio || (isMe ? "No bio yet. Click edit to add one." : "No bio.")}
            </p>
          )}
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "0 24px" }} />

        <div style={{ padding: "20px 24px" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              opacity: 0.4,
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Notoriety
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div
              style={{
                fontSize: 36,
                fontWeight: 950,
                letterSpacing: "-1px",
                color: tier.color,
                textShadow: `0 0 24px ${tier.glow}`,
              }}
            >
              {profile.notoriety.toLocaleString()}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--weered-text, #f5f5f4)" }}>
                {rank}
              </div>
              <div style={{ fontSize: 11, opacity: 0.4 }}>street rank</div>
            </div>
          </div>

          <NotorietyBar value={profile.notoriety} color={tier.color} />
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "0 24px" }} />

        <div style={{ padding: "20px 24px" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              opacity: 0.4,
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Stats
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatBox label="Notoriety" value={profile.notoriety.toLocaleString()} />
            <StatBox label="Rooms Hosted" value={profile.roomsHosted} />
            <StatBox label="Rank" value={rank} />
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "0 24px" }} />
        <div style={{ padding: "20px 24px" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              opacity: 0.4,
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Linked Accounts
          </div>

          {profile.gameAccounts && profile.gameAccounts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {profile.gameAccounts.map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(79,136,198,.08)",
                    border: "1px solid rgba(79,136,198,.18)",
                  }}
                >
                  <span style={{ fontSize: 18 }}>
                    {a.gameType === "BUNGIE" ? "🔷" : a.gameType === "TWITCH" ? "🟣" : "🎮"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(226,232,240,.9)" }}>
                      {a.displayName}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.4 }}>
                      {a.gameType === "BUNGIE" ? "Bungie.net" : a.gameType} · linked{" "}
                      {new Date(a.linkedAt).toLocaleDateString("en-CA", {
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "0.5px",
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(34,197,94,.12)",
                      color: "rgba(134,239,172,.8)",
                      textTransform: "uppercase",
                    }}
                  >
                    Connected
                  </span>
                </div>
              ))}
            </div>
          )}

          {isMe && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!profile.gameAccounts?.some((a) => a.gameType === "BUNGIE") && (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = `${apiBase}/auth/bungie`;
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "rgba(79,136,198,.12)",
                    border: "1px solid rgba(79,136,198,.25)",
                    color: "rgba(79,136,198,.9)",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(79,136,198,.2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(79,136,198,.12)")}
                >
                  🔷 Connect Bungie Account
                </a>
              )}
            </div>
          )}

          {!isMe && (!profile.gameAccounts || profile.gameAccounts.length === 0) && (
            <div style={{ fontSize: 12, opacity: 0.3 }}>No linked accounts.</div>
          )}
        </div>

        <div style={{ padding: "0 24px 24px" }}>
          <button onClick={() => router.back()} style={{ ...btnStyle, opacity: 0.5 }}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

function NotorietyBar({ value, color }: { value: number; color: string }) {
  const thresholds = [0, 100, 500, 1000, 2000, 5000, 10000];
  const next = thresholds.find((t) => t > value) ?? 10000;
  const prev = [...thresholds].reverse().find((t) => t <= value) ?? 0;
  const pct = next === prev ? 100 : Math.min(100, ((value - prev) / (next - prev)) * 100);

  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          height: 4,
          background: "rgba(255,255,255,.08)",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 99,
            boxShadow: `0 0 8px ${color}`,
            transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 5,
          fontSize: 11,
          opacity: 0.35,
        }}
      >
        <span>{prev.toLocaleString()}</span>
        <span>{next.toLocaleString()}</span>
      </div>
    </div>
  );
}

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "40px 16px",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  background: "var(--weered-panel2, rgba(28,25,23,.94))",
  border: "1px solid var(--weered-bd2, rgba(168,162,158,.28))",
  borderRadius: 16,
  overflow: "hidden",
};

const btnStyle: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.06)",
  color: "var(--weered-text, #f5f5f4)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
