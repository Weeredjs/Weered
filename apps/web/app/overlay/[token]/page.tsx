"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiBase } from "../../apiBase";

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
};

const TIER_COLOR: Record<string, string> = {
  INNOCENT: "#94a3b8",
  KNOWN: "#60a5fa",
  WANTED: "#f59e0b",
  NOTORIOUS: "#ef4444",
  INFAMOUS: "#a855f7",
  KINGPIN: "#fbbf24",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

export default function OverlayPage() {
  const params = useParams<{ token: string }>();
  const token = (params?.token as string) || "";
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

  const accent = state.lobby?.accentColor || "#D9A942";
  const tierColor = TIER_COLOR[state.user.tier] || "#94a3b8";
  const isLive = state.online && !state.isAway;

  return (
    <div style={shellStyle}>
      <div
        style={{
          width: 420,
          background: "rgba(8,10,14,0.88)",
          border: `1px solid ${accent}55`,
          borderTop: `3px solid ${accent}`,
          borderRadius: 10,
          padding: "12px 14px",
          color: "#f3f4f6",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
          backdropFilter: "blur(6px)",
        }}
      >
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
          <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6, letterSpacing: "0.08em" }}>
            weered.ca
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: state.lobby ? 10 : 0,
          }}
        >
          {state.user.avatar ? (
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
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f3f4f6", lineHeight: 1.1 }}>
              {state.user.name}
            </div>
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
          </div>
        </div>

        {state.lobby && state.room && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              background: `${accent}0e`,
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
              <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                <span style={{ color: accent, fontWeight: 700 }}>{state.room.count}</span>
                <span style={{ opacity: 0.75 }}> with him · join </span>
                <span style={{ fontWeight: 600, color: "#f3f4f6" }}>
                  {state.joinUrl.replace("https://", "")}
                </span>
              </div>
            </div>
          </div>
        )}

        {!state.online && (
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(100,116,139,0.08)",
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
