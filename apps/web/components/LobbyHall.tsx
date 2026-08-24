"use client";

// Mplayer Mode: the lobby's default view. Rooms dominant on the left (live
// occupancy via LobbyRoomDirectory), a compact "pulse" rail on the right:
// HERE NOW faces (lobby-wide presence), a module mini-summary for lobbies
// that have one (Division 2 server dots + weekly reset), and a jump into the
// full Modules tab. On phones the pulse collapses to a strip ABOVE the rooms
// so you still land on faces first.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import LobbyRoomDirectory, { type LobbyPresenceUser } from "./LobbyRoomDirectory";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

const AV_COLORS = [
  "#5800E5",
  "#22c55e",
  "#f97316",
  "#60a5fa",
  "#ef4444",
  "#eab308",
  "#ec4899",
  "#14b8a6",
];
function avColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}

function nextWeeklyReset(): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 30, 0));
  while (d.getUTCDay() !== 2 || d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
function fmtCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Face({ u, size = 30 }: { u: LobbyPresenceUser; size?: number }) {
  const name = u.name || "?";
  const color = avColor(name);
  return (
    <div
      title={name + (u.roomName ? ` · ${u.roomName}` : "")}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        border: "2px solid rgba(15,17,23,.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        color: "rgba(255,255,255,.85)",
        background: u.avatar
          ? "rgba(255,255,255,.08)"
          : `linear-gradient(135deg, ${color}55, ${color}aa)`,
        opacity: u.isAway ? 0.45 : 1,
      }}
    >
      {u.avatar ? (
        <img
          src={u.avatar}
          alt={name + " avatar"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        (name[0]?.toUpperCase() ?? "?")
      )}
    </div>
  );
}

export default function LobbyHall({
  lobbyId,
  accentColor,
  bannerUrl,
  moduleType,
  hasModules,
  onOpenModules,
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  bannerUrl?: string;
  moduleType?: string;
  hasModules?: boolean;
  onOpenModules?: () => void;
  style?: React.CSSProperties;
}) {
  const accent = accentColor || "#5800E5";
  const [presence, setPresence] = useState<LobbyPresenceUser[]>([]);
  const [d2, setD2] = useState<{
    platforms: { platform: string; status: string; maintenance: boolean }[];
  } | null>(null);
  const [, forceTick] = useState(0);

  const loadPresence = useCallback(() => {
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/presence`, {
      headers: authHeaders() as any,
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && Array.isArray(j.users)) setPresence(j.users);
      })
      .catch(() => {});
  }, [lobbyId]);

  useEffect(() => {
    loadPresence();
    const iv = setInterval(loadPresence, 30_000);
    let t: ReturnType<typeof setTimeout> | null = null;
    const onActivity = () => {
      if (t) clearTimeout(t);
      t = setTimeout(loadPresence, 800);
    };
    const events = [
      "weered:lobby:activity",
      "weered:presence:join",
      "weered:presence:leave",
      "weered:presence:state",
    ];
    for (const e of events) window.addEventListener(e, onActivity);
    return () => {
      clearInterval(iv);
      if (t) clearTimeout(t);
      for (const e of events) window.removeEventListener(e, onActivity);
    };
  }, [loadPresence]);

  useEffect(() => {
    if (moduleType !== "DIVISION2") return;
    let alive = true;
    const load = () =>
      fetch(`${API}/division2/status`)
        .then((r) => r.json())
        .then((j) => {
          if (alive && j?.ok && Array.isArray(j.platforms)) setD2({ platforms: j.platforms });
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 5 * 60_000);
    const tick = setInterval(() => forceTick((t) => t + 1), 60_000);
    return () => {
      alive = false;
      clearInterval(iv);
      clearInterval(tick);
    };
  }, [moduleType]);

  const active = useMemo(() => presence.filter((u) => !u.isAway), [presence]);
  const away = useMemo(() => presence.filter((u) => u.isAway), [presence]);
  const faces = [...active, ...away];
  const label = {
    fontSize: 10,
    fontWeight: 700,
    opacity: 0.45,
    letterSpacing: ".7px",
    textTransform: "uppercase" as const,
    marginBottom: 8,
  };
  const card: React.CSSProperties = {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.06)",
    background: "rgba(255,255,255,.03)",
    padding: "12px 14px",
  };

  return (
    <div
      className="weered-lobby-hall"
      style={{ display: "flex", gap: 16, alignItems: "stretch", minHeight: 0, ...style }}
    >
      <LobbyRoomDirectory
        lobbyId={lobbyId}
        accentColor={accentColor}
        bannerUrl={bannerUrl}
        moduleType={moduleType}
        presenceUsers={presence}
        style={{ flex: 1, minWidth: 0, minHeight: 0 }}
      />

      <div
        className="weered-lobby-pulse"
        style={{ width: 264, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={card}>
          <div style={label}>HERE NOW {faces.length > 0 ? `· ${active.length}` : ""}</div>
          {faces.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "rgba(148,163,184,.55)", lineHeight: 1.5 }}>
              Quiet right now — first one into a room gets the good chair.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {faces.slice(0, 18).map((u) => (
                <Face key={u.id} u={u} />
              ))}
              {faces.length > 18 && (
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,.45)",
                    fontFamily: "monospace",
                  }}
                >
                  +{faces.length - 18}
                </div>
              )}
            </div>
          )}
        </div>

        {moduleType === "DIVISION2" && d2 && (
          <div style={{ ...card, borderColor: `${accent}26` }}>
            <div style={label}>OPS · LIVE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {d2.platforms.map((p) => {
                const ok = p.status === "online" && !p.maintenance;
                const c = ok ? "#22c55e" : "#ef4444";
                return (
                  <div
                    key={p.platform}
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: c,
                        boxShadow: `0 0 5px ${c}77`,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: "rgba(243,244,246,.85)", fontWeight: 600 }}>
                      {p.platform}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: c,
                      }}
                    >
                      {p.maintenance ? "Maint" : p.status}
                    </span>
                  </div>
                );
              })}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  marginTop: 4,
                  color: "rgba(148,163,184,.6)",
                }}
              >
                <span>⏳ Reset</span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    color: accent,
                  }}
                >
                  {fmtCountdown(nextWeeklyReset().getTime() - Date.now())}
                </span>
              </div>
            </div>
          </div>
        )}

        {hasModules && (
          <button
            onClick={onOpenModules}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              cursor: "pointer",
              border: `1px solid ${accent}40`,
              background: `${accent}14`,
              color: "rgba(243,244,246,.9)",
              fontSize: 12,
              fontWeight: 700,
              textAlign: "left",
              fontFamily: "inherit",
            }}
          >
            Open full modules →
          </button>
        )}
      </div>

      <style>{`
        @media (max-width: 980px) {
          .weered-lobby-hall { flex-direction: column !important; }
          .weered-lobby-pulse { order: -1; width: auto !important; flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
