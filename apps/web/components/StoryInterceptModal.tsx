"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedItem } from "./HomeFeed";

interface Props {
  item: FeedItem | null;
  originRect: DOMRect | null;
  onClose: () => void;
}

function roomIdFromUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (h << 5) - h + url.charCodeAt(i);
    h |= 0;
  }
  return `article_${Math.abs(h).toString(36).slice(0, 10)}`;
}

function domainLobbyId(domain: string): string {
  return domain.replace(/^www\./, "");
}

const CAT_COLORS: Record<string, string> = {
  gaming: "#7C3AED",
  ufc: "#DC2626",
  news: "#0EA5E9",
  sports: "#16A34A",
  tech: "#D97706",
  podcasts: "#DB2777",
};

export default function StoryInterceptModal({ item, originRect, onClose }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "visible" | "exit">("idle");
  const [user, setUser] = useState<{
    name: string;
    tier?: string;
    globalRole?: string;
    avatarColor?: string;
  } | null>(null);
  const [hovered, setHovered] = useState<"discuss" | "lobby" | null>(null);

  useEffect(() => {
    if (item) {
      try {
        const u = JSON.parse(localStorage.getItem("weered_user") || "{}");
        const avatarColor = localStorage.getItem("weered:avatarColor") || undefined;
        if (u?.name) setUser({ ...u, avatarColor });
      } catch {}
      requestAnimationFrame(() => setTimeout(() => setPhase("visible"), 16));
    } else {
      setPhase("idle");
    }
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [item]);

  function handleClose() {
    setPhase("exit");
    setTimeout(() => {
      onClose();
      setPhase("idle");
    }, 260);
  }

  function goDiscussion() {
    if (!item) return;
    const roomId = roomIdFromUrl(item.url);
    handleClose();
    setTimeout(() => {
      router.push(`/room/${encodeURIComponent(roomId)}?article=${encodeURIComponent(item.url)}`);
    }, 270);
  }

  function goLobby() {
    if (!item) return;
    handleClose();
    setTimeout(() => router.push(`/lobby/${encodeURIComponent(domainLobbyId(item.domain))}`), 270);
  }

  function goExternal() {
    if (!item) return;
    const url = item.url;
    handleClose();
    setTimeout(() => {
      try {
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {}
    }, 270);
  }

  if (!item || phase === "idle") return null;

  const color = CAT_COLORS[item.category] || "#7C3AED";
  const exiting = phase === "exit";

  const ox = originRect
    ? (((originRect.left + originRect.width / 2) / window.innerWidth) * 100).toFixed(1)
    : "50";
  const oy = originRect
    ? (((originRect.top + originRect.height / 2) / window.innerHeight) * 100).toFixed(1)
    : "50";

  return (
    <>
      <style>{`
        @keyframes bIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes bOut { from { opacity:1 } to { opacity:0 } }
        @keyframes mIn  {
          from { opacity:0; transform:translate(-50%,-50%) scale(0.5); filter:blur(6px); }
          to   { opacity:1; transform:translate(-50%,-50%) scale(1);   filter:blur(0);   }
        }
        @keyframes mOut {
          from { opacity:1; transform:translate(-50%,-50%) scale(1);   filter:blur(0);   }
          to   { opacity:0; transform:translate(-50%,-50%) scale(0.72); filter:blur(4px); }
        }
        .sim-discuss, .sim-lobby {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 20px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.03);
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.22,1,0.36,1);
          text-align: left;
          width: 100%;
          position: relative;
          overflow: hidden;
        }
        .sim-discuss::before, .sim-lobby::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.18s;
        }
        .sim-discuss { border-color: ${color}44; background: ${color}0d; }
        .sim-discuss::before { background: linear-gradient(135deg, ${color}18, ${color}08); }
        .sim-discuss:hover { border-color: ${color}88; transform: translateY(-2px); box-shadow: 0 8px 32px ${color}22, 0 0 0 1px ${color}22; }
        .sim-discuss:hover::before { opacity: 1; }
        .sim-lobby:hover { border-color: rgba(255,255,255,0.18); background: rgba(255,255,255,0.07); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .sim-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; flex-shrink: 0;
        }
        .sim-arrow {
          margin-left: auto;
          font-size: 18px;
          transition: transform 0.18s;
          flex-shrink: 0;
        }
        .sim-discuss:hover .sim-arrow,
        .sim-lobby:hover .sim-arrow { transform: translateX(3px); }
      `}</style>

      <div
        onClick={handleClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClose();
          }
        }}
        tabIndex={0}
        role="button"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          backdropFilter: "blur(16px) brightness(0.28) saturate(0.6)",
          WebkitBackdropFilter: "blur(16px) brightness(0.28) saturate(0.6)",
          animation: `${exiting ? "bOut" : "bIn"} 0.26s ease forwards`,
        }}
      />

      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          transformOrigin: `${ox}% ${oy}%`,
          zIndex: 201,
          width: "min(500px, 92vw)",
          animation: `${exiting ? "mOut" : "mIn"} ${exiting ? "0.26s" : "0.34s"} cubic-bezier(0.22,1,0.36,1) forwards`,
        }}
      >
        <div
          style={{
            background: "rgba(8,8,16,0.97)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: `
            0 0 0 1px rgba(255,255,255,0.04),
            0 40px 100px rgba(0,0,0,0.75),
            0 0 80px ${color}14,
            inset 0 1px 0 rgba(255,255,255,0.06)
          `,
          }}
        >
          <div style={{ position: "relative", height: 160, overflow: "hidden" }}>
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt={item.title + " thumbnail"}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  filter: "brightness(0.35) saturate(0.7)",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: `linear-gradient(135deg, ${color}22, rgba(0,0,0,0.8))`,
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to bottom, rgba(8,8,16,0) 0%, rgba(8,8,16,0.6) 60%, rgba(8,8,16,0.98) 100%)`,
              }}
            />

            <div
              style={{
                position: "absolute",
                top: 14,
                left: 16,
                display: "flex",
                gap: 7,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: color,
                  fontSize: 10,
                  fontWeight: 800,
                  color: "white",
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  boxShadow: `0 2px 12px ${color}88`,
                }}
              >
                {item.category}
              </span>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: "rgba(0,0,0,0.55)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(8px)",
                  fontSize: 10,
                  color: "rgba(203,213,225,0.8)",
                  fontWeight: 600,
                }}
              >
                {item.domain}
              </span>
            </div>

            <button
              onClick={handleClose}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 30,
                height: 30,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(10px)",
                color: "rgba(148,163,184,0.8)",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              ✕
            </button>

            <div
              style={{
                position: "absolute",
                bottom: 14,
                left: 16,
                right: 16,
                fontSize: 15,
                fontWeight: 800,
                color: "rgba(243,244,246,0.98)",
                lineHeight: 1.35,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textShadow: "0 2px 12px rgba(0,0,0,0.8)",
              }}
            >
              {item.title}
            </div>
          </div>

          <div style={{ padding: "22px 20px 24px" }}>
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14,
                  marginBottom: 16,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: -10,
                    top: -10,
                    width: 70,
                    height: 70,
                    borderRadius: "50%",
                    background: user?.avatarColor || color,
                    opacity: 0.12,
                    filter: "blur(20px)",
                    pointerEvents: "none",
                  }}
                />

                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: user?.avatarColor || color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 800,
                    color: "white",
                    boxShadow: `0 0 0 2px rgba(255,255,255,0.08), 0 4px 16px ${user?.avatarColor || color}55`,
                    position: "relative",
                  }}
                >
                  {(user?.name || "?")[0].toUpperCase()}
                  <div
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: "#22C55E",
                      border: "2px solid rgba(8,8,16,0.97)",
                      boxShadow: "0 0 6px #22C55E88",
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 5,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: "rgba(243,244,246,0.97)",
                        letterSpacing: "-0.2px",
                      }}
                    >
                      {user?.name || "anon"}
                    </span>
                    {user?.globalRole && user.globalRole !== "USER" && (
                      <span
                        style={{
                          padding: "2px 7px",
                          borderRadius: 5,
                          background:
                            user.globalRole === "GOD"
                              ? "rgba(234,179,8,0.15)"
                              : "rgba(124,58,237,0.15)",
                          border: `1px solid ${user.globalRole === "GOD" ? "rgba(234,179,8,0.35)" : "rgba(124,58,237,0.35)"}`,
                          fontSize: 9,
                          fontWeight: 800,
                          color: user.globalRole === "GOD" ? "#EAB308" : "#A78BFA",
                          letterSpacing: "0.10em",
                          textTransform: "uppercase",
                        }}
                      >
                        {user.globalRole}
                      </span>
                    )}
                    {user?.tier && (
                      <span
                        style={{
                          padding: "2px 7px",
                          borderRadius: 5,
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          fontSize: 9,
                          fontWeight: 700,
                          color: "rgba(148,163,184,0.6)",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        {user.tier}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(100,116,139,0.45)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    choosing where to go...
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#22C55E",
                        boxShadow: "0 0 6px #22C55E",
                      }}
                    />
                    <span style={{ fontSize: 10, color: "rgba(34,197,94,0.7)", fontWeight: 600 }}>
                      online
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "rgba(243,244,246,0.97)",
                    letterSpacing: "-0.4px",
                    lineHeight: 1.2,
                  }}
                >
                  Where do you want to go?
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 16 }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="sim-discuss" onClick={goDiscussion}>
                <div
                  className="sim-icon"
                  style={{ background: `${color}22`, border: `1px solid ${color}44` }}
                >
                  💬
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "rgba(243,244,246,0.97)",
                      marginBottom: 3,
                    }}
                  >
                    Enter Live Discussion
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(148,163,184,0.50)", lineHeight: 1.4 }}>
                    {item.usersInRoom > 0
                      ? `${item.usersInRoom} ${item.usersInRoom === 1 ? "person" : "people"} discussing this right now`
                      : "Be the first in — start the conversation"}
                  </div>
                </div>
                <span className="sim-arrow" style={{ color: color }}>
                  →
                </span>
              </button>

              <button className="sim-lobby" onClick={goLobby}>
                <div
                  className="sim-icon"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  🏛️
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "rgba(226,232,240,0.88)",
                      marginBottom: 3,
                    }}
                  >
                    Enter {item.domain} Lobby
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(148,163,184,0.45)", lineHeight: 1.4 }}>
                    Browse all rooms and content from {item.sourceName}
                  </div>
                </div>
                <span className="sim-arrow" style={{ color: "rgba(148,163,184,0.4)" }}>
                  →
                </span>
              </button>

              <button className="sim-lobby" onClick={goExternal}>
                <div
                  className="sim-icon"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  📄
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "rgba(226,232,240,0.88)",
                      marginBottom: 3,
                    }}
                  >
                    Read the full article
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(148,163,184,0.45)", lineHeight: 1.4 }}>
                    Opens {item.domain} in a new tab
                  </div>
                </div>
                <span className="sim-arrow" style={{ color: "rgba(148,163,184,0.4)" }}>
                  ↗
                </span>
              </button>
            </div>

            <div
              style={{
                marginTop: 18,
                textAlign: "center",
                fontSize: 10,
                color: "rgba(100,116,139,0.28)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Esc or click outside to dismiss
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
