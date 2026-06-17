"use client";
import React, { useState, useEffect } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";
import { consumePendingStream } from "../lib/useWatchHere";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import { PAL, S, WR_FONT_DISPLAY, WR_FONT_MONO, apiFetch } from "./WrShared";

export function Labeled({
  label,
  children,
  span = 1,
}: {
  label: string;
  children: React.ReactNode;
  span?: number;
}) {
  return (
    <div style={{ gridColumn: `span ${span}`, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ ...S.label, fontSize: 9 }}>{label}</div>
      {children}
    </div>
  );
}

export function StreamsTab({ gameName, lobbyId }: { gameName: string; lobbyId: string }) {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [intercept, setIntercept] = useState<StreamInfo | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(null);

  useEffect(() => {
    const ch = consumePendingStream();
    if (ch) setActiveStream(ch);
  }, []);

  useEffect(() => {
    const game = encodeURIComponent(gameName || "Windrose");
    apiFetch(`/twitch/streams?game=${game}&first=20`).then((j) => {
      if (j?.ok && Array.isArray(j.streams)) setStreams(j.streams);
      setLoading(false);
    });
  }, [gameName]);

  if (loading) return <LoadingState label="Tuning the spyglass..." />;
  if (streams.length === 0)
    return (
      <EmptyState
        icon="📡"
        title="No one's live"
        hint="When a captain goes live on Twitch, they'll show up here."
      />
    );

  const parentHost = typeof window !== "undefined" ? window.location.hostname : "weered.ca";

  return (
    <>
      {activeStream && (
        <div
          style={{
            ...S.card,
            padding: 0,
            marginBottom: 16,
            overflow: "hidden",
            border: `1px solid ${PAL.brass}`,
          }}
        >
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${parentHost}&muted=true`}
            width="100%"
            height="380"
            style={{ border: "none", display: "block" }}
            allowFullScreen
            title={`${activeStream} live stream`}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: `${PAL.brass}10`,
              borderTop: `1px solid ${PAL.brass}35`,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: PAL.blood,
                  boxShadow: `0 0 8px ${PAL.blood}`,
                }}
              />
              <span
                style={{
                  fontFamily: WR_FONT_DISPLAY,
                  fontSize: 15,
                  color: PAL.brassHi,
                  letterSpacing: "0.3px",
                }}
              >
                {activeStream}
              </span>
              <span style={{ ...S.label, fontSize: 9 }}>LIVE · Watching in the hub</span>
            </span>
            <button
              type="button"
              onClick={() => setActiveStream(null)}
              style={{ ...S.btn, fontSize: 10, padding: "6px 12px" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {streams.map((s) => (
          <div
            key={s.userLogin}
            style={{ ...S.card, padding: 0, overflow: "hidden", cursor: "pointer" }}
            onClick={() => setIntercept(s)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIntercept(s);
              }
            }}
            tabIndex={0}
            role="button"
          >
            <div
              style={{
                width: "100%",
                aspectRatio: "16 / 9",
                background: s.thumbnailUrl
                  ? `url(${s.thumbnailUrl.replace("{width}", "440").replace("{height}", "248")}) center/cover`
                  : PAL.stormMid,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  padding: "3px 8px",
                  background: PAL.blood,
                  color: PAL.parchment,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "1px",
                  fontFamily: WR_FONT_MONO,
                }}
              >
                LIVE
              </span>
              {typeof s.viewerCount === "number" && (
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    padding: "3px 8px",
                    background: `${PAL.ink}c0`,
                    color: PAL.brassHi,
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: WR_FONT_MONO,
                    letterSpacing: "0.5px",
                  }}
                >
                  {s.viewerCount.toLocaleString()} watching
                </span>
              )}
            </div>
            <div style={{ padding: "10px 14px" }}>
              <div
                style={{
                  fontFamily: WR_FONT_DISPLAY,
                  fontSize: 15,
                  color: PAL.brassHi,
                  letterSpacing: "0.3px",
                }}
              >
                {s.userName}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: PAL.parchDim,
                  marginTop: 3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.title}
              </div>
            </div>
          </div>
        ))}
      </div>
      {intercept && (
        <StreamInterceptModal
          stream={intercept}
          lobbyId={lobbyId}
          onClose={() => setIntercept(null)}
          onWatchHere={(s) => setActiveStream(s.userLogin)}
        />
      )}
    </>
  );
}

export interface ModRow {
  id: string;
  name: string;
  author: string | null;
  summary: string | null;
  thumbnailUrl: string | null;
  sourceUrl: string | null;
  endorsements: number;
  downloads: number;
  source: string;
  sourceUpdatedAt: string | null;
}
