"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  LocalParticipant,
  RemoteParticipant,
  Participant,
} from "livekit-client";
import { useWeered } from "../WeeredProvider";
import { useVoice } from "../VoiceContext";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export type StageMode = "voice" | "video" | "screen" | "youtube" | "browser" | null;

interface Props {
  roomId: string;
  mode: StageMode;
  onClose: () => void;
  style?: React.CSSProperties;
}

interface ParticipantTile {
  sid: string;
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isLocal: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string {
  try {
    return (
      localStorage.getItem("weered_token") ||
      localStorage.getItem("weered:token") ||
      sessionStorage.getItem("weered_token") ||
      ""
    );
  } catch { return ""; }
}

function avatarColor(name: string): string {
  const palette = ["#7c3aed","#2563eb","#059669","#d97706","#dc2626","#0891b2","#7c3aed","#db2777"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function extractVideoId(input: string): string | null {
  const s = String(input || "").trim();
  // Already a bare ID (11 chars, no slashes)
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).split("?")[0];
    if (url.hostname.includes("youtube.com")) return url.searchParams.get("v");
  } catch {}
  return null;
}

// ─── YouTube Stage ────────────────────────────────────────────────────────────

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

function YoutubeStage({ roomId, onClose, style }: { roomId: string; onClose: () => void; style?: React.CSSProperties }) {
  const { sendRaw } = useWeered() as any;
  const voice = useVoice();
  const playerRef    = useRef<any>(null);
  const playerDivRef = useRef<HTMLDivElement>(null);
  const isSyncing    = useRef(false); // prevent echo when applying remote events

  const [videoId,   setVideoId  ] = useState<string | null>(null);
  const [inputVal,  setInputVal ] = useState("");
  const [inputErr,  setInputErr ] = useState("");
  const [ytReady,   setYtReady  ] = useState(false);
  const [playing,   setPlaying  ] = useState(false);

  // ── Load YouTube IFrame API once ──
  useEffect(() => {
    if (window.YT?.Player) { setYtReady(true); return; }
    const existing = document.getElementById("yt-iframe-api");
    if (!existing) {
      const s = document.createElement("script");
      s.id  = "yt-iframe-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
    const poll = setInterval(() => {
      if (window.YT?.Player) { setYtReady(true); clearInterval(poll); }
    }, 200);
    return () => clearInterval(poll);
  }, []);

  // ── Create player when videoId + API ready ──
  useEffect(() => {
    if (!videoId || !ytReady || !playerDivRef.current) return;
    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
      return;
    }
    playerRef.current = new window.YT.Player(playerDivRef.current, {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: { autoplay: 0, controls: 1, rel: 0, modestbranding: 1 },
      events: {
        onStateChange: (e: any) => {
          if (isSyncing.current) return;
          const YT = window.YT;
          const pos = playerRef.current?.getCurrentTime?.() ?? 0;
          if (e.data === YT.PlayerState.PLAYING) {
            sendRaw?.({ type: "youtube:play",  roomId, position: pos });
            setPlaying(true);
          } else if (e.data === YT.PlayerState.PAUSED) {
            sendRaw?.({ type: "youtube:pause", roomId, position: pos });
            setPlaying(false);
          }
        },
        onReady: () => {
          // If joining late with a playing state, autoplay handled by youtube:state handler
        },
      },
    });
    return () => {
      try {
        const p = playerRef.current;
        playerRef.current = null;
        // Detach the iframe from DOM before destroying to prevent React removeChild error
        try { const iframe = p?.getIframe?.(); iframe?.parentNode?.removeChild(iframe); } catch {}
        p?.destroy?.();
      } catch {}
    };
  }, [videoId, ytReady]);

  // ── Listen for WS youtube:state events ──
  useEffect(() => {
    const handler = (ev: any) => {
      const d = ev.detail;
      if (!d || d.roomId !== roomId) return;
      if (d.type === "youtube:stopped") {
        setVideoId(null);
        setPlaying(false);
        return;
      }
      if (d.type !== "youtube:state") return;

      // Load new video if needed
      if (d.videoId && d.videoId !== videoId) {
        setVideoId(d.videoId);
      }

      const player = playerRef.current;
      if (!player?.seekTo) return;

      isSyncing.current = true;
      try {
        // Compute drift-adjusted position
        const drift = (Date.now() - d.updatedAt) / 1000;
        const targetPos = d.position + (d.playing ? drift : 0);

        const currentPos = player.getCurrentTime?.() ?? 0;
        // Only seek if > 2s off to avoid constant micro-seeks
        if (Math.abs(currentPos - targetPos) > 2) {
          player.seekTo(targetPos, true);
        }

        if (d.playing) {
          player.playVideo?.();
          setPlaying(true);
        } else {
          player.pauseVideo?.();
          setPlaying(false);
        }
      } finally {
        setTimeout(() => { isSyncing.current = false; }, 500);
      }
    };

    window.addEventListener("weered:youtube", handler as any);
    return () => window.removeEventListener("weered:youtube", handler as any);
  }, [roomId, videoId]);

  const loadVideo = () => {
    const id = extractVideoId(inputVal);
    if (!id) { setInputErr("Couldn't find a YouTube video ID in that URL."); return; }
    setInputErr("");
    setVideoId(id);
    sendRaw?.({ type: "youtube:load", roomId, videoId: id });
    setInputVal("");
  };

  const stopVideo = () => {
    sendRaw?.({ type: "youtube:stop", roomId });
    setVideoId(null);
    setPlaying(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "rgba(0,0,0,.4)", ...style }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: videoId ? "#22c55e" : "rgba(255,255,255,.2)", boxShadow: videoId ? "0 0 6px #22c55e" : "none", display: "inline-block" }} />
          YouTube Sync
        </div>
        {videoId && (
          <button onClick={stopVideo} style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.1)", color: "#fca5a5", cursor: "pointer" }}>
            Stop
          </button>
        )}
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, fontSize: 16, color: "#fff", padding: "2px 4px", marginLeft: videoId ? 0 : "auto" }}>✕</button>
      </div>

      {/* Player or load prompt */}
      {videoId ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 0, overflow: "hidden" }}>
          {/* Player */}
          <div style={{ flex: 1, background: "#000", position: "relative", minWidth: 0, overflow: "hidden" }}>
            <style>{`.yt-stage-player iframe { position:absolute !important; inset:0 !important; width:100% !important; height:100% !important; }`}</style>
            <div ref={playerDivRef} className="yt-stage-player" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            {!ytReady && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, opacity: 0.5 }}>
                Loading player…
              </div>
            )}
          </div>
          {/* Queue sidebar */}
          <div style={{ width: 160, borderLeft: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.02)", padding: "10px 10px", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.35, marginBottom: 2 }}>Queue</div>
            <div style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(124,106,245,.3)", background: "rgba(124,106,245,.1)", color: "#c4bef8" }}>
              ▶ {videoId}
            </div>
            <div style={{ marginTop: "auto" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.35, marginBottom: 6 }}>Load another</div>
              <input
                value={inputVal}
                onChange={e => { setInputVal(e.target.value); setInputErr(""); }}
                onKeyDown={e => e.key === "Enter" && loadVideo()}
                placeholder="YouTube URL…"
                style={{ width: "100%", background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: "#fff", outline: "none" }}
              />
              <button onClick={loadVideo} style={{ marginTop: 5, width: "100%", padding: "5px 0", borderRadius: 6, border: "1px solid rgba(124,106,245,.3)", background: "rgba(124,106,245,.12)", color: "#c4bef8", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Load
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 24 }}>
          <div style={{ fontSize: 13, opacity: 0.5 }}>Paste a YouTube URL to sync for everyone in the room</div>
          <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 400 }}>
            <input
              value={inputVal}
              onChange={e => { setInputVal(e.target.value); setInputErr(""); }}
              onKeyDown={e => e.key === "Enter" && loadVideo()}
              placeholder="https://youtube.com/watch?v=…"
              style={{ flex: 1, background: "rgba(255,255,255,.05)", border: `1px solid ${inputErr ? "rgba(239,68,68,.5)" : "rgba(255,255,255,.12)"}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "#fff", outline: "none" }}
            />
            <button onClick={loadVideo} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid rgba(124,106,245,.35)", background: "rgba(124,106,245,.15)", color: "#c4bef8", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Load
            </button>
          </div>
          {inputErr && <div style={{ fontSize: 12, color: "#fca5a5" }}>{inputErr}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Voice Stage (unchanged) ──────────────────────────────────────────────────

function VoiceStage({ roomId, onClose, style }: { roomId: string; onClose: () => void; style?: React.CSSProperties }) {
  const voice = useVoice();
  const alreadyInRoom = voice.connState === "connected" && voice.activeRoomId === roomId;
  const [prompted, setPrompted] = useState(alreadyInRoom); // skip prompt if already connected here

  const connect = useCallback(async () => {
    await voice.connect(roomId);
  }, [roomId, voice]);

  const disconnect = useCallback(() => {
    voice.disconnect();
    onClose();
  }, [voice, onClose]);

  const toggleMute = useCallback(() => {
    voice.toggleMute();
  }, [voice]);

  // Only auto-connect if user confirmed OR was already in this room
  useEffect(() => {
    if (!prompted) return;
    const alreadyHere = voice.connState === "connected" && voice.activeRoomId === roomId;
    const inProgress  = voice.connState === "connecting";
    if (!alreadyHere && !inProgress) {
      connect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompted, roomId]);

  const { connState, errorMsg, muted, tiles } = voice;
  const live = connState === "connected";

  // ── Join prompt ──
  if (!prompted) return (
    <div style={{ background: "rgba(0,0,0,.35)", borderBottom: "1px solid rgba(148,163,184,.12)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", flexShrink: 0, display: "inline-block" }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(226,232,240,0.9)" }}>Voice is active in this room</div>
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", marginTop: 2 }}>Join to hear and speak with others</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={onClose}
          style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(148,163,184,0.7)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          Not now
        </button>
        <button
          onClick={() => setPrompted(true)}
          style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          Join voice
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ background: "rgba(0,0,0,.35)", borderBottom: "1px solid rgba(148,163,184,.12)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10, height: "100%", ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, opacity: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: live ? "#22c55e" : "rgba(255,255,255,.2)", boxShadow: live ? "0 0 6px #22c55e" : "none", display: "inline-block" }} />
          Voice
          {connState === "connecting" && <span style={{ opacity: 0.5 }}> connecting…</span>}
          {connState === "error"      && <span style={{ color: "#fca5a5" }}> {errorMsg}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {live && (
            <>
              <button onClick={toggleMute} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.8)" }}>
                {muted ? "🔇 Unmute" : "🎙 Mute"}
              </button>
              <button onClick={disconnect} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(239,68,68,.15)", color: "#fca5a5" }}>
                Leave
              </button>
            </>
          )}
          {connState === "error" && <button onClick={connect} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.8)" }}>Retry</button>}
          {connState === "idle"  && <button onClick={connect} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.8)" }}>Join</button>}
          <button onClick={disconnect} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, fontSize: 16, padding: "2px 4px", color: "#fff" }} title="Close">✕</button>
        </div>
      </div>

      {tiles.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
          {tiles.map(t => (
            <div key={t.sid} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 10,
              border: t.isSpeaking ? "1.5px solid rgba(34,197,94,.5)" : t.isLocal ? "1.5px solid rgba(124,58,237,.35)" : "1.5px solid rgba(255,255,255,.08)",
              background: t.isSpeaking ? "rgba(34,197,94,.08)" : t.isLocal ? "rgba(124,58,237,.08)" : "rgba(255,255,255,.03)",
              transition: "border-color .15s, background .15s",
            }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: avatarColor(t.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>
                {t.name[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                  {t.name}{t.isLocal ? " (you)" : ""}
                </div>
                {t.isMuted && <div style={{ fontSize: 10, opacity: 0.5 }}>muted</div>}
              </div>
              {t.isSpeaking && (
                <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 14, marginLeft: 2 }}>
                  {[4,7,5].map((h, i) => (
                    <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: "#22c55e", opacity: 0.8, animation: `waveBar .8s ease-in-out ${i*0.15}s infinite alternate` }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes waveBar { from { transform: scaleY(0.4); } to { transform: scaleY(1.2); } }`}</style>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function RoomStage({ roomId, mode, onClose, style }: Props) {
  if (mode === "youtube") return <YoutubeStage roomId={roomId} onClose={onClose} style={style} />;
  if (mode === "voice")   return <VoiceStage   roomId={roomId} onClose={onClose} style={style} />;

  // Placeholder for future modes
  return (
    <div style={{ padding: 16, opacity: 0.5, fontSize: 13 }}>
      {mode} — coming soon
      <button onClick={onClose} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#fff", opacity: 0.5 }}>✕</button>
    </div>
  );
}
