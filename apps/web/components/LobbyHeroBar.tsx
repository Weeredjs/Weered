"use client";

import React, { useEffect, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

const MODULE_GAME: Record<string, string> = {
  BUNGIE: "Destiny 2",
  MLB: "MLB The Show 25",
  PGA: "Golf",
};

interface FeaturedStream {
  thumbnail: string;
  title: string;
  streamer: string;
  viewers: number;
  url?: string;
}

interface Props {
  lobbyId: string;
  lobbyName: string;
  description?: string;
  verified?: boolean;
  accentColor?: string;
  logoUrl?: string;
  bannerUrl?: string;
  roomCount?: number;
  memberCount?: number;
  moduleType?: string;
  gameName?: string;
}

export default function LobbyHeroBar({
  lobbyId, lobbyName, description, verified = false,
  accentColor, logoUrl, bannerUrl, roomCount, memberCount,
  moduleType, gameName,
}: Props) {
  const accent  = accentColor || "#7C3AED";
  const initial = (lobbyName || lobbyId || "L").charAt(0).toUpperCase();

  const twitchGame = gameName || MODULE_GAME[moduleType || ""] || "";

  const [stream, setStream]           = useState<FeaturedStream | null>(null);
  const [streamLoading, setLoading]   = useState(false);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);

  useEffect(() => {
    if (!twitchGame) return;
    setLoading(true);
    fetch(`${API}/twitch/streams?game=${encodeURIComponent(twitchGame)}`)
      .then(r => r.json())
      .then(j => {
        const s = Array.isArray(j?.streams) ? j.streams[0] : null;
        if (s) setStream({
          thumbnail: (s.thumbnail || s.thumbnailUrl || "")
            .replace("{width}", "440").replace("{height}", "248"),
          title:    s.title   || "",
          streamer: s.userName || s.user_name || s.streamer || "",
          viewers:  Number(s.viewerCount || s.viewer_count || 0),
          url:      s.url || `https://www.twitch.tv/${s.userName || s.user_name || ""}`,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [twitchGame]);

  const hasFeatured = !!twitchGame;

  return (
    <div style={{ position: "relative", flexShrink: 0, overflow: "hidden", minHeight: hasFeatured ? 196 : 78 }}>

      {/* Background */}
      {bannerUrl ? (
        <>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center top", opacity: 0.55 }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,10,18,0.25) 0%, rgba(10,10,18,0.75) 100%)" }} />
        </>
      ) : (
        <>
          <div style={{ position: "absolute", top: -60, left: -40, width: 280, height: 280, borderRadius: "50%", background: `radial-gradient(circle, ${accent}20 0%, transparent 65%)`, pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${accent}12 0%, transparent 55%, ${accent}07 100%)` }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.10, backgroundImage: `radial-gradient(circle, ${accent} 1px, transparent 1px)`, backgroundSize: "26px 26px", pointerEvents: "none" }} />
        </>
      )}

      {/* Bottom edge line */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${accent}55, transparent)` }} />

      {/* Content */}
      <div className="weered-hero-content" style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "stretch", padding: "18px 16px", gap: 16, minHeight: hasFeatured ? 196 : 78 }}>

        {/* Left: identity */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>

          {/* Logo + name */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, flexShrink: 0,
              background: logoUrl ? "rgba(0,0,0,0.35)" : `${accent}28`,
              border: `2px solid ${accent}60`,
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
              boxShadow: `0 0 28px ${accent}38, 0 4px 14px rgba(0,0,0,0.5)`,
            }}>
              {logoUrl
                ? <img src={logoUrl} alt={lobbyName} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 7 }} />
                : <span style={{ fontSize: 24, fontWeight: 900, color: accent, letterSpacing: "-1px" }}>{initial}</span>
              }
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <div style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.15, color: "rgba(243,244,246,0.98)", letterSpacing: "-0.3px" }}>
                  {lobbyName}
                </div>
                {verified && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0,
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                    padding: "2px 8px", borderRadius: 999,
                    background: `${accent}22`, border: `1px solid ${accent}50`, color: accent,
                  }}>✓ VERIFIED</span>
                )}
              </div>
              {description && (
                <div style={{
                  fontSize: 12, color: "rgba(148,163,184,0.72)", lineHeight: 1.4,
                  overflow: "hidden", textOverflow: "ellipsis",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                } as React.CSSProperties}>
                  {description}
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          {(typeof roomCount === "number" || typeof memberCount === "number") && (
            <div style={{ display: "flex", gap: 6 }}>
              {typeof roomCount === "number" && <StatChip value={roomCount} label="rooms" />}
              {typeof memberCount === "number" && <StatChip value={memberCount} label="members" />}
            </div>
          )}
        </div>

        {/* Right: featured stream — hidden on mobile */}
        {hasFeatured && (
          <div className="weered-hero-stream" style={{ width: 215, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {streamLoading
              ? <StreamSkeleton accent={accent} />
              : stream
                ? <div
                    onClick={() => setInterceptStream({
                      userLogin: stream.streamer?.toLowerCase() || "",
                      userName: stream.streamer || "",
                      title: stream.title || "",
                      viewerCount: stream.viewers || 0,
                      thumbnailUrl: stream.thumbnail || "",
                      gameName: twitchGame,
                    })}
                    style={{ cursor: "pointer" }}
                  >
                    <LiveStreamCard stream={stream} accent={accent} />
                  </div>
                : <EmptyStream accent={accent} game={twitchGame} />
            }
          </div>
        )}
      </div>

      <StreamInterceptModal
        stream={interceptStream}
        lobbyId={lobbyId}
        accentColor={accent}
        onClose={() => setInterceptStream(null)}
        onWatchHere={() => {
          // Dispatch event so the modules panel can pick it up and open inline
          if (interceptStream) {
            window.dispatchEvent(new CustomEvent("weered:stream:watchhere", {
              detail: { channel: interceptStream.userLogin },
            }));
          }
        }}
      />
    </div>
  );
}

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(243,244,246,0.90)" }}>{value.toLocaleString()}</span>
      <span style={{ fontSize: 10, opacity: 0.42, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
    </div>
  );
}

function LiveStreamCard({ stream, accent }: { stream: FeaturedStream; accent: string }) {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Twitch thumbnails support {width}x{height} — append cache bust to force refresh
  const thumb = (stream.thumbnail || "")
    .replace("{width}", "440").replace("{height}", "248");
  const src = thumb ? `${thumb}${thumb.includes("?") ? "&" : "?"}t=${tick}` : "";

  return (
    <div
      style={{
        borderRadius: 10, overflow: "hidden",
        border: `1px solid ${accent}33`,
        background: "rgba(0,0,0,0.4)",
        boxShadow: `0 4px 18px rgba(0,0,0,0.5), 0 0 0 1px ${accent}1a`,
        transition: "transform 0.15s, box-shadow 0.15s",
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = `0 8px 28px rgba(0,0,0,0.6), 0 0 0 1px ${accent}44`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = `0 4px 18px rgba(0,0,0,0.5), 0 0 0 1px ${accent}1a`;
      }}
    >
      <div style={{ position: "relative", aspectRatio: "16/9", background: "#000" }}>
        {src ? (
          <img src={src} alt={stream.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 28, opacity: 0.25 }}>▶</span>
          </div>
        )}
        <div style={{ position: "absolute", top: 6, left: 6, fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "#ef4444", color: "#fff", letterSpacing: "0.06em" }}>LIVE</div>
        <div style={{ position: "absolute", bottom: 6, right: 6, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "rgba(0,0,0,0.75)", color: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)" }}>
          {stream.viewers.toLocaleString()} viewers
        </div>
      </div>
      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(243,244,246,0.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{stream.streamer}</div>
        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.58)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stream.title}</div>
      </div>
    </div>
  );
}

function StreamSkeleton({ accent }: { accent: string }) {
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${accent}20`, background: "rgba(0,0,0,0.3)" }}>
      <style>{`@keyframes shimmer{0%,100%{opacity:.6}50%{opacity:.3}}`}</style>
      <div style={{ aspectRatio: "16/9", background: `${accent}10`, animation: "shimmer 1.4s ease-in-out infinite" }} />
      <div style={{ padding: "8px 10px" }}>
        <div style={{ height: 11, borderRadius: 4, background: "rgba(255,255,255,0.08)", marginBottom: 5, animation: "shimmer 1.4s ease-in-out infinite" }} />
        <div style={{ height: 10, width: "65%", borderRadius: 4, background: "rgba(255,255,255,0.05)", animation: "shimmer 1.4s ease-in-out 0.2s infinite" }} />
      </div>
    </div>
  );
}

function EmptyStream({ accent, game }: { accent: string; game: string }) {
  return (
    <div style={{ borderRadius: 10, border: `1px dashed ${accent}28`, background: `${accent}07`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px", gap: 6, textAlign: "center", minHeight: 120 }}>
      <div style={{ fontSize: 20, opacity: 0.28 }}>📡</div>
      <div style={{ fontSize: 11, opacity: 0.38 }}>No live streams right now</div>
      <a href={`https://www.twitch.tv/directory/game/${encodeURIComponent(game)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: accent, opacity: 0.55, textDecoration: "none" }}>Browse on Twitch →</a>
    </div>
  );
}
