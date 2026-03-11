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
  const [phase, setPhase] = useState<"idle" | "enter" | "visible" | "exit">("idle");
  const [user, setUser]   = useState<{ name: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (item) {
      try {
        const u = JSON.parse(localStorage.getItem("weered_user") || "{}");
        if (u?.name) setUser(u);
      } catch {}
      // Start zoom animation
      requestAnimationFrame(() => {
        setPhase("enter");
        setTimeout(() => setPhase("visible"), 20);
      });
    } else {
      setPhase("idle");
    }
  }, [item]);

  function handleClose() {
    setPhase("exit");
    setTimeout(() => { onClose(); setPhase("idle"); }, 220);
  }

  function goDiscussion() {
    if (!item) return;
    const roomId  = roomIdFromUrl(item.url);
    const lobbyId = domainLobbyId(item.domain);
    handleClose();
    setTimeout(() => {
      router.push(`/lobby/${encodeURIComponent(lobbyId)}?room=${roomId}&article=${encodeURIComponent(item.url)}&autoJoin=true`);
    }, 230);
  }

  function goLobby() {
    if (!item) return;
    const lobbyId = domainLobbyId(item.domain);
    handleClose();
    setTimeout(() => router.push(`/lobby/${encodeURIComponent(lobbyId)}`), 230);
  }

  if (!item || phase === "idle") return null;

  const color    = CAT_COLORS[item.category] || "#7C3AED";
  const isEntering = phase === "enter";
  const isExiting  = phase === "exit";
  const isVisible  = phase === "visible";

  // Compute transform origin from where the card was on screen
  const originX = originRect ? (originRect.left + originRect.width  / 2) / window.innerWidth  * 100 : 50;
  const originY = originRect ? (originRect.top  + originRect.height / 2) / window.innerHeight * 100 : 50;

  return (
    <>
      <style>{`
        @keyframes backdropIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes backdropOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes modalZoomIn  {
          from { opacity: 0; transform: scale(0.55); filter: blur(4px); }
          to   { opacity: 1; transform: scale(1);    filter: blur(0px); }
        }
        @keyframes modalZoomOut {
          from { opacity: 1; transform: scale(1);    filter: blur(0px); }
          to   { opacity: 0; transform: scale(0.7);  filter: blur(3px); }
        }
        .intercept-btn {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 16px 20px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
          width: 100%;
        }
        .intercept-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-1px);
        }
        .intercept-btn.primary {
          background: linear-gradient(135deg, ${color}22, ${color}11);
          border-color: ${color}55;
        }
        .intercept-btn.primary:hover {
          background: linear-gradient(135deg, ${color}33, ${color}22);
          border-color: ${color}88;
          box-shadow: 0 4px 24px ${color}22;
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          backdropFilter: "blur(12px) brightness(0.35)",
          WebkitBackdropFilter: "blur(12px) brightness(0.35)",
          animation: isExiting
            ? "backdropOut 0.22s ease forwards"
            : "backdropIn 0.25s ease forwards",
        }}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          transformOrigin: `${originX}% ${originY}%`,
          zIndex: 201,
          width: "min(480px, 90vw)",
          animation: isExiting
            ? "modalZoomOut 0.22s cubic-bezier(0.55,0,1,0.45) forwards"
            : "modalZoomIn 0.32s cubic-bezier(0.22,1,0.36,1) forwards",
        }}
      >
        <div style={{
          background: "rgba(10,10,18,0.96)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.7), 0 0 60px ${color}18`,
        }}>
          {/* Story preview header */}
          <div style={{ position: "relative", height: 140, overflow: "hidden" }}>
            {item.thumbnail && (
              <img
                src={item.thumbnail}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "brightness(0.45)" }}
              />
            )}
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(to bottom, transparent 20%, rgba(10,10,18,0.95) 100%)`,
            }} />
            {/* Category + domain */}
            <div style={{ position: "absolute", top: 12, left: 14, display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{
                padding: "3px 8px", borderRadius: 5,
                background: color + "cc", fontSize: 10,
                fontWeight: 700, color: "white", letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}>{item.category}</span>
              <span style={{
                padding: "3px 8px", borderRadius: 5,
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.12)",
                fontSize: 10, color: "rgba(148,163,184,0.8)", fontWeight: 600,
              }}>{item.domain}</span>
            </div>
            {/* Close */}
            <button
              onClick={handleClose}
              style={{
                position: "absolute", top: 10, right: 10,
                width: 28, height: 28, borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.4)",
                color: "rgba(148,163,184,0.7)",
                fontSize: 12, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                backdropFilter: "blur(8px)",
              }}
            >✕</button>
            {/* Title */}
            <div style={{
              position: "absolute", bottom: 12, left: 14, right: 14,
              fontSize: 14, fontWeight: 700,
              color: "rgba(243,244,246,0.95)",
              lineHeight: 1.35,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {item.title}
            </div>
          </div>

          {/* Greeting + options */}
          <div style={{ padding: "18px 18px 20px" }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "rgba(148,163,184,0.55)", marginBottom: 2 }}>
                Hey {user?.name || "there"} —
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(226,232,240,0.95)", lineHeight: 1.35 }}>
                Where do you want to go?
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Live discussion */}
              <button className="intercept-btn primary" onClick={goDiscussion}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: color + "33", border: `1px solid ${color}55`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, flexShrink: 0,
                  }}>💬</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,0.95)" }}>
                      Enter Live Discussion
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", marginTop: 1 }}>
                      {item.usersInRoom > 0
                        ? `${item.usersInRoom} ${item.usersInRoom === 1 ? "person" : "people"} in this room right now`
                        : "Start the conversation — be the first in"}
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto", fontSize: 16, color: "rgba(148,163,184,0.3)" }}>→</div>
                </div>
              </button>

              {/* Domain lobby */}
              <button className="intercept-btn" onClick={goLobby}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, flexShrink: 0,
                  }}>🏛️</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(226,232,240,0.85)" }}>
                      Enter {item.domain} Lobby
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", marginTop: 1 }}>
                      Browse all rooms and content from {item.sourceName}
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto", fontSize: 16, color: "rgba(148,163,184,0.3)" }}>→</div>
                </div>
              </button>
            </div>

            {/* Dismiss */}
            <div
              onClick={handleClose}
              style={{ marginTop: 14, textAlign: "center", fontSize: 11, color: "rgba(100,116,139,0.35)", cursor: "pointer", letterSpacing: "0.04em" }}
            >
              press esc or click outside to dismiss
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
