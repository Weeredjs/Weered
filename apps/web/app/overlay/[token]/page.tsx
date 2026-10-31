"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiBase } from "../../apiBase";

type OverlayConfig = {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  size: "s" | "m" | "l";
  style: "glass" | "solid" | "minimal" | "neon";
  accent: string;
  show: {
    avatar: boolean;
    tier: boolean;
    place: boolean;
    count: boolean;
    join: boolean;
    status: boolean;
    people?: boolean;
    chat?: boolean;
  };
  tagline: string;
  hideOffline: boolean;
};

type OverlayState = {
  ok: boolean;
  online: boolean;
  isAway?: boolean;
  user: {
    name: string;
    avatar: string | null;
    avatarColor: string | null;
    tier: string;
  };
  lobby: {
    id: string;
    name: string;
    accentColor: string;
    logoUrl: string | null;
    moduleType: string | null;
    verified: boolean;
  } | null;
  room: { id: string; name: string; isLobbyRoot: boolean; count: number } | null;
  joinUrl: string;
  /** Their look from Settings → Streamer overlay; null until they set one. */
  config?: OverlayConfig | null;
  /** Who's in the room with them, and its last chat lines, when they turned those on. */
  people?: { name: string; avatarColor: string | null }[];
  chat?: { name: string; body: string }[];
};

const TIER_COLOR: Record<string, string> = {
  INNOCENT: "#94a3b8",
  KNOWN: "#60a5fa",
  WANTED: "#f59e0b",
  NOTORIOUS: "#ef4444",
  INFAMOUS: "#a855f7",
  KINGPIN: "#fbbf24",
};

const SHOW_ALL: OverlayConfig["show"] = {
  avatar: true,
  tier: true,
  place: true,
  count: true,
  join: true,
  status: true,
};
const SCALE = { s: 0.8, m: 1, l: 1.25 } as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

/** Where the card sits: OBS shows the page at the source's size, so the corner
 *  is where the card goes inside it. */
function corner(pos: OverlayConfig["position"]): React.CSSProperties {
  const [v, h] = pos.split("-");
  return {
    position: "fixed",
    [v]: 16,
    [h]: 16,
    background: "transparent",
    pointerEvents: "none",
    transformOrigin: `${v} ${h}`,
  } as React.CSSProperties;
}

export default function OverlayPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";
  const [state, setState] = useState<OverlayState | null>(null);
  const [phase, setPhase] = useState<"loading" | "ok" | "notfound" | "error">("loading");
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function tick() {
      try {
        const url = `${apiBase()}/public/overlay/${encodeURIComponent(token)}`;
        const r = await fetch(url, { cache: "no-store" });
        if (r.status === 404) {
          if (!cancelled) {
            setPhase("notfound");
            setState(null);
          }
          return;
        }
        if (!r.ok) {
          if (!cancelled) {
            setPhase("error");
            setErrMsg(`HTTP ${r.status}`);
          }
          return;
        }
        const j = await r.json();
        if (!cancelled && j?.ok) {
          setState(j);
          setPhase("ok");
        }
      } catch (e: any) {
        if (!cancelled) {
          setPhase("error");
          setErrMsg(String(e?.message || e || "fetch failed"));
        }
      }
    }
    void tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  if (phase === "loading") {
    return (
      <div style={shellStyle}>
        <div style={diagCardStyle}>
          <div style={{ fontSize: 11, letterSpacing: ".14em", fontWeight: 800, color: "#D9A942" }}>
            WEERED OVERLAY · LOADING
          </div>
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>
            token: <code>{token || "(empty)"}</code>
          </div>
        </div>
      </div>
    );
  }
  if (phase === "notfound") {
    return (
      <div style={shellStyle}>
        <div style={diagCardStyle}>
          <div style={{ fontSize: 11, letterSpacing: ".14em", fontWeight: 800, color: "#ef4444" }}>
            WEERED OVERLAY · UNKNOWN TOKEN
          </div>
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>
            Rotate from Settings → Streamer overlay.
          </div>
        </div>
      </div>
    );
  }
  if (phase === "error" || !state) {
    return (
      <div style={shellStyle}>
        <div style={diagCardStyle}>
          <div style={{ fontSize: 11, letterSpacing: ".14em", fontWeight: 800, color: "#ef4444" }}>
            WEERED OVERLAY · FETCH ERROR
          </div>
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>{errMsg || "no state"}</div>
        </div>
      </div>
    );
  }

  const cfg = state.config || null;
  const show = cfg?.show || SHOW_ALL;
  const look = cfg?.style || "glass";
  // Their own colour once they've set a look; until then, the lobby's.
  const accent = cfg?.accent || state.lobby?.accentColor || "#D9A942";
  const tierColor = TIER_COLOR[state.user.tier] || "#94a3b8";
  const isLive = state.online && !state.isAway;

  if (!state.online && cfg?.hideOffline) return <div style={shellStyle} />;

  const card: React.CSSProperties =
    look === "minimal"
      ? {
          background: "transparent",
          border: "none",
          padding: "4px 2px",
          textShadow: "0 1px 3px rgba(0,0,0,.9), 0 0 12px rgba(0,0,0,.6)",
        }
      : look === "solid"
        ? {
            background: "#0b0d12",
            border: `1px solid ${accent}55`,
            borderTop: `3px solid ${accent}`,
            borderRadius: 10,
            padding: "12px 14px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
          }
        : look === "neon"
          ? {
              background: "rgba(6,6,12,0.9)",
              border: `1.5px solid ${accent}`,
              borderRadius: 12,
              padding: "12px 14px",
              boxShadow: `0 0 18px ${accent}aa, inset 0 0 14px ${accent}33`,
            }
          : {
              background: "rgba(8,10,14,0.88)",
              border: `1px solid ${accent}55`,
              borderTop: `3px solid ${accent}`,
              borderRadius: 10,
              padding: "12px 14px",
              boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
              backdropFilter: "blur(6px)",
            };

  return (
    <div
      style={{
        ...(cfg ? corner(cfg.position) : shellStyle),
        transform: cfg && cfg.size !== "m" ? `scale(${SCALE[cfg.size]})` : undefined,
      }}
    >
      <div
        style={{
          width: 420,
          color: "#f3f4f6",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          ...card,
        }}
      >
        {show.status && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isLive ? "#22c55e" : "#64748b",
                boxShadow: isLive ? "0 0 8px #22c55e" : "none",
                animation: isLive ? "weered-pulse 1.6s ease-in-out infinite" : "none",
              }}
            />
            <span style={{ fontSize: 11, letterSpacing: "0.14em", fontWeight: 800, color: accent }}>
              {isLive ? "LIVE ON WEERED" : state.online ? "LYING LOW · WEERED" : "ON WEERED"}
            </span>
            <span
              style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6, letterSpacing: "0.08em" }}
            >
              weered.ca
            </span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: state.lobby && show.place ? 10 : 0,
          }}
        >
          {show.avatar &&
            (state.user.avatar ? (
              <img
                src={state.user.avatar}
                alt=""
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  objectFit: "cover",
                  border: `1px solid ${accent}55`,
                }}
              />
            ) : (
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: state.user.avatarColor || "#1f2937",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#0b0d11",
                  border: `1px solid ${accent}55`,
                }}
              >
                {initials(state.user.name)}
              </div>
            ))}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f3f4f6", lineHeight: 1.1 }}>
              {state.user.name}
            </div>
            {cfg?.tagline && (
              <div style={{ fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.2 }}>{cfg.tagline}</div>
            )}
            {show.tier && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    fontWeight: 800,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: `${tierColor}22`,
                    color: tierColor,
                    border: `1px solid ${tierColor}55`,
                  }}
                >
                  {state.user.tier}
                </span>
              </div>
            )}
          </div>
        </div>

        {show.place && state.lobby && state.room && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              background: look === "minimal" ? "transparent" : `${accent}0e`,
              borderLeft: `3px solid ${accent}`,
              borderRadius: 6,
            }}
          >
            {state.lobby.logoUrl ? (
              <img
                src={state.lobby.logoUrl}
                alt=""
                style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  background: accent,
                  color: "#0b0d11",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {(state.lobby.name || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#f3f4f6",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {state.lobby.name}
                {!state.room.isLobbyRoot && (
                  <span style={{ opacity: 0.65, fontWeight: 500 }}> · {state.room.name}</span>
                )}
              </div>
              {(show.count || show.join) && (
                <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                  {show.count && (
                    <>
                      <span style={{ color: accent, fontWeight: 700 }}>{state.room.count}</span>
                      <span style={{ opacity: 0.75 }}> in here</span>
                    </>
                  )}
                  {show.count && show.join && <span style={{ opacity: 0.75 }}> · </span>}
                  {show.join && (
                    <>
                      <span style={{ opacity: 0.75 }}>join </span>
                      <span style={{ fontWeight: 600, color: "#f3f4f6" }}>
                        {state.joinUrl.replace("https://", "")}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {state.online && state.people && state.people.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
            {state.people.map((p, i) => (
              <span
                key={`${p.name}-${i}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 8px 3px 4px",
                  borderRadius: 999,
                  background: look === "minimal" ? "rgba(0,0,0,.35)" : "rgba(255,255,255,.06)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: p.avatarColor || accent,
                  }}
                />
                {p.name}
              </span>
            ))}
          </div>
        )}

        {state.online && state.chat && state.chat.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8 }}>
            {state.chat.map((m, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.35,
                  color: "#e2e8f0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ color: accent, fontWeight: 700 }}>{m.name}</span> {m.body}
              </div>
            ))}
          </div>
        )}

        {!state.online && (
          <div
            style={{
              padding: "10px 12px",
              background: look === "minimal" ? "transparent" : "rgba(100,116,139,0.08)",
              borderLeft: "3px solid #475569",
              borderRadius: 6,
              fontSize: 12,
              color: "#94a3b8",
            }}
          >
            Currently between lobbies · join at{" "}
            <strong style={{ color: "#f3f4f6" }}>weered.ca</strong>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes weered-pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}

const shellStyle: React.CSSProperties = {
  position: "fixed",
  top: 16,
  left: 16,
  background: "transparent",
  pointerEvents: "none",
};

const diagCardStyle: React.CSSProperties = {
  width: 360,
  padding: "10px 14px",
  background: "rgba(8,10,14,0.92)",
  border: "1px solid rgba(217,169,66,0.30)",
  borderRadius: 8,
  color: "#f3f4f6",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};
