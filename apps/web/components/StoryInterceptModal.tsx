"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { FeedItem } from "./HomeFeed";

interface Props {
  item: FeedItem | null;
  originRect: DOMRect | null;
  onClose: () => void;
}

function roomIdFromUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) { h = ((h << 5) - h) + url.charCodeAt(i); h |= 0; }
  return `article_${Math.abs(h).toString(36).slice(0, 10)}`;
}

function domainLobbyId(domain: string): string {
  return domain.replace(/^www\./, "");
}

const CAT_COLORS: Record<string, string> = {
  gaming: "#7C3AED", ufc: "#DC2626", news: "#0EA5E9",
  sports: "#16A34A", tech: "#D97706", podcasts: "#DB2777",
};

export default function StoryInterceptModal({ item, originRect, onClose }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "visible" | "exit">("idle");
  const [user, setUser]   = useState<{ name: string } | null>(null);
  const [hovered, setHovered] = useState<"discuss" | "lobby" | null>(null);

  useEffect(() => {
    if (item) {
      try {
        const u = JSON.parse(localStorage.getItem("weered_user") || "{}");
        if (u?.name) setUser(u);
      } catch {}
      requestAnimationFrame(() => setTimeout(() => setPhase("visible"), 16));
    } else {
      setPhase("idle");
    }
  }, [item]);

  // Keyboard dismiss
  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [item]);

  function handleClose() {
    setPhase("exit");
    setTimeout(() => { onClose(); setPhase("idle"); }, 260);
  }

  function goDiscussion() {
    if (!item) return;
    const roomId  = roomIdFromUrl(item.url);
    const lobbyId = domainLobbyId(item.domain);
    handleClose();
    setTimeout(() => {
      router.push(`/lobby/${encodeURIComponent(lobbyId)}?room=${roomId}&article=${encodeURIComponent(item.url)}&autoJoin=true`);
    }, 270);
  }

  function goLobby() {
    if (!item) return;
    handleClose();
    setTimeout(() => router.push(`/lobby/${encodeURIComponent(domainLobbyId(item.domain))}`), 270);
  }

  if (!item || phase === "idle") return null;

  const color   = CAT_COLORS[item.category] || "#7C3AED";
  const exiting = phase === "exit";

  // Transform origin — zoom from card position
  const ox = originRect ? ((originRect.left + originRect.width  / 2) / window.innerWidth  * 100).toFixed(1) : "50";
  const oy = originRect ? ((originRect.top  + originRect.height / 2) / window.innerHeight * 100).toFixed(1) : "50";

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

      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          backdropFilter: "blur(16px) brightness(0.28) saturate(0.6)",
          WebkitBackdropFilter: "blur(16px) brightness(0.28) saturate(0.6)",
          animation: `${exiting ? "bOut" : "bIn"} 0.26s ease forwards`,
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        transformOrigin: `${ox}% ${oy}%`,
        zIndex: 201,
        width: "min(500px, 92vw)",
        animation: `${exiting ? "mOut" : "mIn"} ${exiting ? "0.26s" : "0.34s"} cubic-bezier(0.22,1,0.36,1) forwards`,
      }}>
        <div style={{
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
        }}>

          {/* ── Hero thumbnail strip ── */}
          <div style={{ position: "relative", height: 160, overflow: "hidden" }}>
            {item.thumbnail
              ? <img src={item.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "brightness(0.35) saturate(0.7)" }} />
              : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${color}22, rgba(0,0,0,0.8))` }} />
            }
            {/* Gradient fade to card bg */}
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, rgba(8,8,16,0) 0%, rgba(8,8,16,0.6) 60%, rgba(8,8,16,0.98) 100%)` }} />

            {/* Top badges */}
            <div style={{ position: "absolute", top: 14, left: 16, display: "flex", gap: 7, alignItems: "center" }}>
              <span style={{
                padding: "4px 10px", borderRadius: 6,
                background: color,
                fontSize: 10, fontWeight: 800, color: "white",
                letterSpacing: "0.10em", textTransform: "uppercase",
                boxShadow: `0 2px 12px ${color}88`,
              }}>{item.category}</span>
              <span style={{
                padding: "4px 10px", borderRadius: 6,
                background: "rgba(0,0,0,0.55)",
                border: "1px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(8px)",
                fontSize: 10, color: "rgba(203,213,225,0.8)", fontWeight: 600,
              }}>{item.domain}</span>
            </div>

            {/* Close button */}
            <button onClick={handleClose} style={{
              position: "absolute", top: 12, right: 12,
              width: 30, height: 30, borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(10px)",
              color: "rgba(148,163,184,0.8)",
              fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>✕</button>

            {/* Title pinned at bottom of hero */}
            <div style={{
              position: "absolute", bottom: 14, left: 16, right: 16,
              fontSize: 15, fontWeight: 800,
              color: "rgba(243,244,246,0.98)",
              lineHeight: 1.35,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textShadow: "0 2px 12px rgba(0,0,0,0.8)",
            }}>
              {item.title}
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: "22px 20px 24px" }}>

            {/* Greeting */}
            <div style={{ marginBottom: 18, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "rgba(148,163,184,0.45)", marginBottom: 4, letterSpacing: "0.04em" }}>
                Hey {user?.name || "there"} —
              </div>
              <div style={{
                fontSize: 20, fontWeight: 800,
                color: "rgba(243,244,246,0.97)",
                letterSpacing: "-0.4px",
                lineHeight: 1.2,
              }}>
                Where do you want to go?
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 16 }} />

            {/* Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Live Discussion */}
              <button className="sim-discuss" onClick={goDiscussion}>
                <div className="sim-icon" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
                  💬
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(243,244,246,0.97)", marginBottom: 3 }}>
                    Enter Live Discussion
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(148,163,184,0.50)", lineHeight: 1.4 }}>
                    {item.usersInRoom > 0
                      ? `${item.usersInRoom} ${item.usersInRoom === 1 ? "person" : "people"} discussing this right now`
                      : "Be the first in — start the conversation"}
                  </div>
                </div>
                <span className="sim-arrow" style={{ color: color }}>→</span>
              </button>

              {/* Domain Lobby */}
              <button className="sim-lobby" onClick={goLobby}>
                <div className="sim-icon" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  🏛️
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(226,232,240,0.88)", marginBottom: 3 }}>
                    Enter {item.domain} Lobby
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(148,163,184,0.45)", lineHeight: 1.4 }}>
                    Browse all rooms and content from {item.sourceName}
                  </div>
                </div>
                <span className="sim-arrow" style={{ color: "rgba(148,163,184,0.4)" }}>→</span>
              </button>
            </div>

            {/* Dismiss hint */}
            <div style={{ marginTop: 18, textAlign: "center", fontSize: 10, color: "rgba(100,116,139,0.28)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Esc or click outside to dismiss
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
