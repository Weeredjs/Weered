"use client";
import { useState, useEffect } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";
import { consumePendingStream } from "../lib/useWatchHere";
import { S, apiFetch } from "./D2Shared";

export function TwitchStreams({
  gameName = "Destiny 2",
  lobbyId,
  accentColor,
}: {
  gameName?: string;
  lobbyId?: string;
  accentColor?: string;
}) {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);

  useEffect(() => {
    const ch = consumePendingStream();
    if (ch) setActiveStream(ch);
  }, []);

  useEffect(() => {
    apiFetch(`/twitch/streams?game=${encodeURIComponent(gameName)}`)
      .then((j) => {
        setStreams(j.streams || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [gameName]);

  if (loading)
    return (
      <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
        Loading streams...
      </div>
    );

  function handleCardClick(s: any) {
    setInterceptStream({
      userLogin: s.userLogin || s.user_login || "",
      userName: s.userName || s.user_name || "",
      title: s.title || "",
      viewerCount: Number(s.viewerCount || s.viewer_count || 0),
      thumbnailUrl: s.thumbnailUrl || s.thumbnail_url || "",
      gameName,
    });
  }

  function handleWatchHere(stream: StreamInfo) {
    setActiveStream(stream.userLogin);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {activeStream && (
        <div
          style={{
            borderRadius: 2,
            overflow: "hidden",
            border: "1px solid rgba(145,70,255,.25)",
            borderLeft: "2px solid rgba(124,58,237,.5)",
            background: "#000",
            marginBottom: 4,
          }}
        >
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${typeof window !== "undefined" ? window.location.hostname : "weered.ca"}&muted=true`}
            width="100%"
            height="280"
            style={{ border: "none", display: "block" }}
            allowFullScreen
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: "rgba(145,70,255,.08)",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(216,180,254,.9)" }}>
              {activeStream}
            </span>
            <button
              onClick={() => setActiveStream(null)}
              style={{ ...S.btn, fontSize: 11, padding: "4px 10px" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 8,
        }}
      >
        {streams.map((s) => (
          <div
            key={s.id}
            onClick={() => handleCardClick(s)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCardClick(s);
              }
            }}
            tabIndex={0}
            role="button"
            style={{
              ...S.card,
              cursor: "pointer",
              transition: "border-color .15s, background .15s",
              border:
                activeStream === s.userLogin
                  ? "1px solid rgba(145,70,255,.40)"
                  : "1px solid rgba(255,255,255,.08)",
              background:
                activeStream === s.userLogin ? "rgba(145,70,255,.08)" : "rgba(255,255,255,.03)",
            }}
          >
            {s.thumbnailUrl && (
              <img
                src={s.thumbnailUrl}
                alt={s.userName + " stream thumbnail"}
                style={{
                  width: "100%",
                  borderRadius: 2,
                  marginBottom: 6,
                  aspectRatio: "16/9",
                  objectFit: "cover",
                }}
              />
            )}
            <div
              style={{
                fontWeight: 700,
                fontSize: 12,
                marginBottom: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.userName}
            </div>
            <div
              style={{
                fontSize: 11,
                opacity: 0.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: 4,
              }}
            >
              {s.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22c55e",
                  flexShrink: 0,
                  boxShadow: "0 0 6px rgba(34,197,94,.6)",
                }}
              />
              <span style={{ fontSize: 11, color: "rgba(230,235,240,.75)", fontWeight: 600 }}>
                {s.viewerCount?.toLocaleString()} viewers
              </span>
            </div>
          </div>
        ))}
      </div>

      {streams.length === 0 && (
        <div style={{ textAlign: "center", padding: 20, opacity: 0.4, fontSize: 13 }}>
          No live {gameName} streams right now.
        </div>
      )}

      <StreamInterceptModal
        stream={interceptStream}
        lobbyId={lobbyId}
        accentColor={accentColor}
        onClose={() => setInterceptStream(null)}
        onWatchHere={handleWatchHere}
      />
    </div>
  );
}
