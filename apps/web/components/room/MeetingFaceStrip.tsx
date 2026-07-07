"use client";
// The meeting face strip: a thin row of participant camera tiles that rides ABOVE
// the office stage so the client's face stays visible while the presentation is up.
// Reads the live LiveKit tiles from VoiceContext; each tile points its own <video>
// srcObject at the shared MediaStream (VoiceContext keeps a hidden attached element
// per track — many <video> elements can share one stream with no conflict). Falls
// back to an initial avatar when a participant's camera is off. Renders nothing until
// voice is connected, so it never leaves an empty band.
import { useEffect, useRef } from "react";
import { useVoice } from "../VoiceContext";
import type { ParticipantTile } from "../VoiceContext";

function avColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360} 42% 40%)`;
}

function FaceTile({
  tile,
  getVideoElement,
}: {
  tile: ParticipantTile;
  getVideoElement: (sid: string) => HTMLVideoElement | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!tile.hasVideo || !tile.videoTrackSid) return;
    let stop = false;
    let tries = 0;
    const attach = () => {
      if (stop) return;
      const src = getVideoElement(tile.videoTrackSid as string);
      const stream = (src?.srcObject as MediaStream | null) || null;
      const el = ref.current;
      if (el && stream) {
        if (el.srcObject !== stream) el.srcObject = stream;
        el.play?.().catch(() => {});
      } else if (tries++ < 40) {
        setTimeout(attach, 150);
      }
    };
    attach();
    return () => {
      stop = true;
      if (ref.current) ref.current.srcObject = null;
    };
  }, [tile.videoTrackSid, tile.hasVideo, getVideoElement]);

  const ring = tile.isSpeaking ? "0 0 0 2px #34d399, 0 0 10px rgba(52,211,153,.6)" : "none";
  return (
    <div
      style={{
        position: "relative",
        width: 150,
        height: 88,
        flexShrink: 0,
        borderRadius: 8,
        overflow: "hidden",
        background: tile.hasVideo ? "#050a12" : avColor(tile.identity || tile.name || "?"),
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: ring,
        transition: "box-shadow .12s ease",
      }}
      title={tile.name || "Guest"}
    >
      {tile.hasVideo ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: tile.isLocal ? "scaleX(-1)" : "none",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            fontWeight: 800,
            color: "#fff",
          }}
        >
          {(tile.name || "?").slice(0, 1).toUpperCase()}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 7px",
          background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
          fontSize: 11,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: ".01em",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tile.name || "Guest"}
          {tile.isLocal ? " (you)" : ""}
        </span>
        {tile.isMuted && <span style={{ marginLeft: "auto", opacity: 0.85 }}>🔇</span>}
      </div>
    </div>
  );
}

export default function MeetingFaceStrip() {
  const { connState, tiles, getVideoElement, cameraOn, toggleCamera } = useVoice();
  if (connState !== "connected" && connState !== "connecting") return null;

  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "#0b1220",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      {tiles.length === 0 ? (
        <span style={{ fontSize: 12, color: "rgba(148,163,184,0.7)" }}>
          Waiting for others to join…
        </span>
      ) : (
        tiles.map((t) => <FaceTile key={t.sid} tile={t} getVideoElement={getVideoElement} />)
      )}
      <button
        onClick={() => {
          try {
            toggleCamera();
          } catch {}
        }}
        style={{
          marginLeft: "auto",
          flexShrink: 0,
          padding: "7px 13px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.14)",
          background: cameraOn ? "rgba(239,68,68,0.14)" : "rgba(34,197,94,0.16)",
          color: cameraOn ? "#fca5a5" : "#86efac",
          fontSize: 12,
          fontWeight: 800,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
        title={cameraOn ? "Turn camera off" : "Turn camera on"}
      >
        {cameraOn ? "Stop camera" : "Start camera"}
      </button>
    </div>
  );
}
