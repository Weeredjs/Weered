"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "./WeeredProvider";

export interface StreamInfo {
  userLogin: string;
  userName: string;
  title: string;
  viewerCount: number;
  thumbnailUrl?: string;
  gameName?: string;
}

interface Props {
  stream: StreamInfo | null;
  lobbyId?: string;
  accentColor?: string;
  onClose: () => void;
  onWatchHere: (stream: StreamInfo) => void;
}

export default function StreamInterceptModal({
  stream,
  lobbyId,
  accentColor,
  onClose,
  onWatchHere,
}: Props) {
  const router = useRouter();
  const { me } = useWeered() as any;

  if (!stream) return null;

  const accent = accentColor || "#9146FF";
  const meUser = me?.name || me?.username || "You";
  const meRole = me?.globalRole || me?.role || "";
  const meAvatar = me?.avatar || null;

  function handleWatchHere() {
    onWatchHere(stream!);
    onClose();
  }

  function handleJoinRoom() {
    const roomId = `stream-${stream!.userLogin}`;
    router.push(
      `/room/${encodeURIComponent(roomId)}?twitch=${encodeURIComponent(stream!.userLogin)}&lobby=${encodeURIComponent(lobbyId || "")}`,
    );
    onClose();
  }

  const thumb = (stream.thumbnailUrl || "").replace("{width}", "640").replace("{height}", "360");

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(0,0,0,.65)",
          backdropFilter: "blur(8px)",
          animation: "weeredFadeIn 0.15s ease-out",
        }}
      />

      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(480px, 92vw)",
          zIndex: 10001,
          borderRadius: 20,
          overflow: "hidden",
          border: `1px solid ${accent}40`,
          background: "var(--weered-panel2, #111008)",
          boxShadow: `0 24px 64px rgba(0,0,0,.65), 0 0 0 1px ${accent}15`,
          animation: "weeredModalIn 0.25s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div
          style={{
            position: "relative",
            aspectRatio: "16/9",
            background: "#000",
            overflow: "hidden",
          }}
        >
          {thumb ? (
            <img
              src={thumb}
              alt={stream.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                opacity: 0.7,
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: `${accent}15`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 48, opacity: 0.2 }}>▶</span>
            </div>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, transparent 40%, rgba(10,10,18,0.95) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              fontSize: 10,
              fontWeight: 800,
              padding: "3px 8px",
              borderRadius: 5,
              background: "#ef4444",
              color: "#fff",
              letterSpacing: "0.06em",
            }}
          >
            LIVE
          </div>
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 30,
              height: 30,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.15)",
              background: "rgba(0,0,0,.5)",
              backdropFilter: "blur(8px)",
              color: "rgba(255,255,255,.7)",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
          <div style={{ position: "absolute", bottom: 14, left: 14, right: 14 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "rgba(243,244,246,.98)",
                lineHeight: 1.3,
                marginBottom: 4,
              }}
            >
              {stream.userName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(148,163,184,.75)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {stream.title}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(148,163,184,.55)",
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {stream.gameName && <span>{stream.gameName}</span>}
              {stream.gameName && <span style={{ opacity: 0.3 }}>·</span>}
              <span style={{ color: "rgba(252,165,165,.8)" }}>
                {stream.viewerCount.toLocaleString()} viewers
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 18px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 12,
              border: `1px solid ${accent}25`,
              background: `${accent}08`,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                flexShrink: 0,
                background: meAvatar ? "rgba(255,255,255,.08)" : `${accent}30`,
                border: `1.5px solid ${accent}50`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 800,
                color: accent,
                overflow: "hidden",
              }}
            >
              {meAvatar ? (
                <img
                  src={meAvatar}
                  alt={meUser + " avatar"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                meUser[0]?.toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{meUser}</span>
                {meRole && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: `${accent}20`,
                      border: `1px solid ${accent}40`,
                      color: accent,
                    }}
                  >
                    {meRole}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, opacity: 0.4, marginTop: 1 }}>
                choosing where to watch...
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 4px #22c55e",
                }}
              />
              <span style={{ fontSize: 10, color: "rgba(134,239,172,.8)", fontWeight: 600 }}>
                online
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 18px 20px" }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              textAlign: "center",
              marginBottom: 14,
              color: "rgba(243,244,246,.95)",
            }}
          >
            Where do you want to watch?
          </div>

          <button
            onClick={handleWatchHere}
            style={{
              width: "100%",
              padding: "14px 18px",
              marginBottom: 8,
              borderRadius: 14,
              border: `1px solid ${accent}35`,
              background: `${accent}10`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 14,
              transition: "all 0.15s",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = `${accent}20`;
              (e.currentTarget as HTMLElement).style.borderColor = `${accent}55`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = `${accent}10`;
              (e.currentTarget as HTMLElement).style.borderColor = `${accent}35`;
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${accent}20`,
                border: `1px solid ${accent}35`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              💬
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "rgba(243,244,246,.95)" }}>
                Watch Here
              </div>
              <div style={{ fontSize: 11, color: accent, opacity: 0.7, marginTop: 1 }}>
                Open the stream inline in this lobby
              </div>
            </div>
            <span style={{ fontSize: 18, opacity: 0.4, flexShrink: 0, color: accent }}>→</span>
          </button>

          <button
            onClick={handleJoinRoom}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 14,
              border: `1px solid ${accent}35`,
              background: `${accent}10`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 14,
              transition: "all 0.15s",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = `${accent}20`;
              (e.currentTarget as HTMLElement).style.borderColor = `${accent}55`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = `${accent}10`;
              (e.currentTarget as HTMLElement).style.borderColor = `${accent}35`;
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${accent}20`,
                border: `1px solid ${accent}35`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              🏛
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "rgba(243,244,246,.95)" }}>
                Join Live Room
              </div>
              <div style={{ fontSize: 11, color: accent, opacity: 0.7, marginTop: 1 }}>
                Watch with others in a dedicated room
              </div>
            </div>
            <span style={{ fontSize: 18, opacity: 0.4, flexShrink: 0, color: accent }}>→</span>
          </button>
        </div>

        <div
          style={{
            textAlign: "center",
            paddingBottom: 14,
            fontSize: 10,
            opacity: 0.25,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          esc or click outside to dismiss
        </div>
      </div>

      <style>{`
        @keyframes weeredModalIn {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  );
}
