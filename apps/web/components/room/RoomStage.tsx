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

export type StageMode = "voice" | "video" | "screen" | "youtube" | "browser" | "twitch" | "article" | "poker" | "fakeout" | null;

interface Props {
  roomId: string;
  mode: StageMode;
  moduleType?: string;
  roomUsers?: { id: string; name: string; role?: string; globalRole?: string; avatarColor?: string }[];
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

import { avatarBg as avatarColor } from "../../lib/avatarColor";
import PokerTable from "../PokerTable";
import TradingModulesPanel from "../TradingModulesPanel";

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
  const { sendRaw, ytStateByRoom } = useWeered() as any;
  const voice = useVoice();
  const playerRef    = useRef<any>(null);
  const playerDivRef = useRef<HTMLDivElement>(null);
  const isSyncing    = useRef(false); // prevent echo when applying remote events

  const [videoId,   setVideoId  ] = useState<string | null>(null);
  const [inputVal,  setInputVal ] = useState("");
  const [inputErr,  setInputErr ] = useState("");
  const [ytReady,   setYtReady  ] = useState(false);
  const [playing,   setPlaying  ] = useState(false);
  const didInitFromBuffer = useRef(false);

  // ── Initialize from buffered server state on mount (handles late-join race) ──
  useEffect(() => {
    if (didInitFromBuffer.current) return;
    const buf = ytStateByRoom?.[roomId];
    if (buf?.videoId) {
      didInitFromBuffer.current = true;
      setVideoId(buf.videoId);
      setPlaying(buf.playing);
    }
  }, [ytStateByRoom, roomId]);

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
          // If joining late, seek to buffered position and auto-play if room is playing
          const buf = ytStateByRoom?.[roomId];
          if (buf?.videoId && buf.videoId === videoId) {
            const drift = (Date.now() - (buf.updatedAt || Date.now())) / 1000;
            const target = (buf.position || 0) + (buf.playing ? drift : 0);
            if (target > 2) {
              isSyncing.current = true;
              playerRef.current?.seekTo?.(target, true);
              setTimeout(() => { isSyncing.current = false; }, 800);
            }
            if (buf.playing) {
              playerRef.current?.playVideo?.();
              setPlaying(true);
            }
          }
        },
      },
    });
    return () => {
      const p = playerRef.current;
      playerRef.current = null;
      // Defer destroy to next tick so React finishes its unmount first
      // This prevents "Failed to execute 'removeChild' on 'Node'" errors
      setTimeout(() => {
        try {
          try { const iframe = p?.getIframe?.(); iframe?.parentNode?.removeChild(iframe); } catch {}
          p?.destroy?.();
        } catch {}
      }, 0);
    };
  }, [videoId, ytReady]);

  // ── Listen for WS youtube events ──
  useEffect(() => {
    const handler = (ev: any) => {
      const d = ev.detail;
      if (!d || d.roomId !== roomId) return;

      // ── stop ──
      if (d.type === "youtube:stop" || d.type === "youtube:stopped") {
        setVideoId(null);
        setPlaying(false);
        return;
      }

      // ── load new video ──
      if (d.type === "youtube:load") {
        if (!d.videoId) return;
        if (playerRef.current?.loadVideoById && d.videoId !== videoId) {
          isSyncing.current = true;
          playerRef.current.loadVideoById(d.videoId);
          setTimeout(() => { isSyncing.current = false; }, 800);
        }
        setVideoId(d.videoId);
        return;
      }

      // ── play ──
      if (d.type === "youtube:play") {
        const player = playerRef.current;
        if (!player?.seekTo) return;
        isSyncing.current = true;
        try {
          const drift = (Date.now() - (d.updatedAt ?? Date.now())) / 1000;
          const target = (d.position ?? 0) + drift;
          const current = player.getCurrentTime?.() ?? 0;
          if (Math.abs(current - target) > 2) player.seekTo(target, true);
          player.playVideo?.();
          setPlaying(true);
        } finally {
          setTimeout(() => { isSyncing.current = false; }, 500);
        }
        return;
      }

      // ── pause ──
      if (d.type === "youtube:pause") {
        const player = playerRef.current;
        if (!player?.seekTo) return;
        isSyncing.current = true;
        try {
          const target = d.position ?? 0;
          const current = player.getCurrentTime?.() ?? 0;
          if (Math.abs(current - target) > 2) player.seekTo(target, true);
          player.pauseVideo?.();
          setPlaying(false);
        } finally {
          setTimeout(() => { isSyncing.current = false; }, 500);
        }
        return;
      }

      // ── legacy youtube:state (late-join snapshot) ──
      if (d.type === "youtube:state") {
        if (d.videoId && d.videoId !== videoId) {
          if (playerRef.current?.loadVideoById) {
            isSyncing.current = true;
            playerRef.current.loadVideoById(d.videoId);
            setVideoId(d.videoId);
            setTimeout(() => { isSyncing.current = false; }, 800);
            return;
          }
          setVideoId(d.videoId);
          return;
        }
        const player = playerRef.current;
        if (!player?.seekTo) return;
        isSyncing.current = true;
        try {
          const drift = (Date.now() - (d.updatedAt ?? Date.now())) / 1000;
          const target = (d.position ?? 0) + (d.playing ? drift : 0);
          const current = player.getCurrentTime?.() ?? 0;
          if (Math.abs(current - target) > 2) player.seekTo(target, true);
          if (d.playing) { player.playVideo?.(); setPlaying(true); }
          else           { player.pauseVideo?.(); setPlaying(false); }
        } finally {
          setTimeout(() => { isSyncing.current = false; }, 500);
        }
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

// ─── Guardian cache for voice tiles ───────────────────────────────────────────

const guardianTileCache = new Map<string, { data: any; at: number }>();
const GUARDIAN_TTL = 120_000; // 2 min

type GuardianChar = {
  className: string; light: number; raceName: string;
  emblemBackgroundPath: string | null;
  dateLastPlayed: string; minutesPlayedTotal: number;
};

type GuardianCard = {
  displayName: string;
  characters: GuardianChar[];
  guardianRank: number | null;
  guardianRankName: string | null;
  commendationScore: number | null;
  lastActivity: { name: string; mode: string; when: string } | null;
};

function useGuardianData(userId: string, moduleType?: string) {
  const [data, setData] = useState<GuardianCard | null>(null);

  useEffect(() => {
    if (moduleType !== "BUNGIE" || !userId) { setData(null); return; }
    const cached = guardianTileCache.get(userId);
    if (cached && Date.now() - cached.at < GUARDIAN_TTL) { setData(cached.data); return; }

    fetch(`${API}/bungie/card/${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => {
        if (d?.ok && d?.characters?.length) {
          const info: GuardianCard = {
            displayName: d.displayName,
            characters: d.characters,
            guardianRank: d.guardianRank ?? null,
            guardianRankName: d.guardianRankName ?? null,
            commendationScore: d.commendationScore ?? null,
            lastActivity: d.lastActivity ?? null,
          };
          guardianTileCache.set(userId, { data: info, at: Date.now() });
          setData(info);
        } else {
          guardianTileCache.set(userId, { data: null, at: Date.now() });
          setData(null);
        }
      })
      .catch(() => setData(null));
  }, [userId, moduleType]);

  return data;
}

// ─── Voice Participant Card ───────────────────────────────────────────────────

const CLASS_ICONS: Record<string, string> = { Warlock: "☀", Hunter: "🗡", Titan: "🛡" };

function VoiceCard({ tile, moduleType, roomUsers }: { tile: any; moduleType?: string; roomUsers?: any[] }) {
  const guardian = useGuardianData(tile.identity, moduleType);
  const mainChar = guardian?.characters?.[0]; // most recently played
  const notInVoice = tile._notInVoice === true;
  const userInfo = roomUsers?.find((u: any) => u.id === tile.identity || u.userId === tile.identity);
  const userAvatar = userInfo?.avatar || null;

  const borderColor = tile.isSpeaking
    ? "rgba(34,197,94,.5)"
    : tile.isLocal ? "rgba(124,58,237,.35)" : "rgba(255,255,255,.08)";
  const bgColor = tile.isSpeaking
    ? "rgba(34,197,94,.06)"
    : tile.isLocal ? "rgba(124,58,237,.06)" : "rgba(255,255,255,.02)";

  return (
    <div style={{
      width: 200, borderRadius: 12, overflow: "hidden",
      border: `1.5px solid ${borderColor}`,
      background: bgColor,
      transition: "border-color .2s, background .2s, opacity .2s",
      position: "relative",
      opacity: notInVoice ? 0.5 : 1,
    }}>
      {/* Emblem banner */}
      {mainChar?.emblemBackgroundPath ? (
        <div style={{ height: 48, background: `url(${mainChar.emblemBackgroundPath}) center/cover`, opacity: 0.6 }} />
      ) : (
        <div style={{ height: 48, background: "linear-gradient(135deg, rgba(124,58,237,.15), rgba(79,136,198,.1))" }} />
      )}

      {/* Avatar overlapping the banner */}
      <div style={{
        width: 40, height: 40, borderRadius: "50%", position: "absolute", top: 28, left: 12,
        background: userAvatar ? "rgba(255,255,255,.08)" : avatarColor(tile.name, tile.isLocal),
        border: "2.5px solid rgba(10,10,20,.9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, fontWeight: 900, color: "#fff",
        overflow: "hidden",
      }}>
        {userAvatar ? <img src={userAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (tile.name[0]?.toUpperCase() ?? "?")}
      </div>

      {/* Speaking indicator */}
      {tile.isSpeaking && (
        <div style={{
          position: "absolute", top: 6, right: 8,
          display: "flex", gap: 2, alignItems: "flex-end", height: 14,
        }}>
          {[4, 8, 5].map((h, i) => (
            <div key={i} style={{
              width: 3, height: h, borderRadius: 2, background: "#22c55e", opacity: 0.9,
              animation: `waveBar .8s ease-in-out ${i * 0.15}s infinite alternate`,
            }} />
          ))}
        </div>
      )}

      {/* Info section */}
      <div style={{ padding: "20px 12px 10px" }}>
        {/* Name + mute status */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            fontSize: 13, fontWeight: 700, maxWidth: 120,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {tile.name}
          </span>
          {tile.isLocal && <span style={{ fontSize: 9, opacity: 0.35, fontWeight: 600 }}>(you)</span>}
          {tile.isMuted && <span style={{ fontSize: 11, opacity: 0.4 }}>🔇</span>}
        </div>

        {/* Destiny info */}
        {mainChar && (
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Class + Light */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(226,232,240,.7)" }}>
                <span>{CLASS_ICONS[mainChar.className] || "⚔"}</span>
                <span style={{ fontWeight: 600 }}>{mainChar.className}</span>
                <span style={{ fontSize: 10, opacity: 0.4 }}>{mainChar.raceName}</span>
              </div>
              <span style={{ color: "#fcd34d", fontWeight: 800, fontFamily: "monospace", fontSize: 12 }}>
                ✦ {mainChar.light}
              </span>
            </div>

            {/* Guardian Rank + Commendations */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
              {guardian?.guardianRankName && (
                <span style={{
                  padding: "1px 6px", borderRadius: 4,
                  background: "rgba(250,204,21,.1)", border: "1px solid rgba(250,204,21,.2)",
                  color: "rgba(250,204,21,.8)", fontWeight: 700, fontSize: 9,
                }}>
                  ⟐ {guardian.guardianRank} {guardian.guardianRankName}
                </span>
              )}
              {guardian?.commendationScore != null && (
                <span style={{ color: "rgba(134,239,172,.6)", fontWeight: 600 }}>
                  ★ {guardian.commendationScore.toLocaleString()}
                </span>
              )}
            </div>

            {/* Last Activity */}
            {guardian?.lastActivity && (
              <div style={{
                fontSize: 9, color: "rgba(148,163,184,.45)", marginTop: 1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {guardian.lastActivity.mode} · {guardian.lastActivity.name}
              </div>
            )}
          </div>
        )}

        {/* Non-Destiny fallback info */}
        {!mainChar && !moduleType?.includes("BUNGIE") && (
          <div style={{ marginTop: 4, fontSize: 10, opacity: 0.3 }}>
            {tile.isSpeaking ? "speaking" : tile.isMuted ? "muted" : "connected"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Voice Stage ──────────────────────────────────────────────────────────────

function VoiceStage({ roomId, moduleType, roomUsers, onClose, style }: { roomId: string; moduleType?: string; roomUsers?: { id: string; name: string; role?: string; globalRole?: string; avatarColor?: string }[]; onClose: () => void; style?: React.CSSProperties }) {
  const voice = useVoice();
  const alreadyInRoom = voice.connState === "connected" && voice.activeRoomId === roomId;
  const [prompted, setPrompted] = useState(alreadyInRoom);

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener("weered:avatarColor", handler);
    return () => window.removeEventListener("weered:avatarColor", handler);
  }, []);

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

  useEffect(() => {
    if (!prompted) return;
    const alreadyHere = voice.connState === "connected" && voice.activeRoomId === roomId;
    const inProgress  = voice.connState === "connecting";
    if (!alreadyHere && !inProgress) { connect(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompted, roomId]);

  const { connState, errorMsg, muted, tiles } = voice;
  const live = connState === "connected";

  return (
    <div style={{ background: "rgba(0,0,0,.35)", borderBottom: "1px solid rgba(148,163,184,.12)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12, height: "100%", ...style }}>

      {/* Join prompt — shown when not yet in voice */}
      {!prompted && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 8px", borderRadius: 10, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", flexShrink: 0, display: "inline-block" }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(226,232,240,0.9)" }}>Voice chat available</div>
              <div style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", marginTop: 1 }}>Join to hear and speak with others</div>
            </div>
          </div>
          <button onClick={() => setPrompted(true)} style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Join voice</button>
        </div>
      )}

      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
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
              <button onClick={disconnect} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(239,68,68,.15)", color: "#fca5a5" }}>Leave</button>
            </>
          )}
          {connState === "error" && <button onClick={connect} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.8)" }}>Retry</button>}
          {connState === "idle"  && <button onClick={connect} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.8)" }}>Join</button>}
          <button onClick={disconnect} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, fontSize: 16, padding: "2px 4px", color: "#fff" }} title="Close">✕</button>
        </div>
      </div>

      {/* Participant cards — voice participants + room members not in voice */}
      {(() => {
        // Build merged list: voice tiles first, then room members not in voice
        const voiceIdentities = new Set(tiles.map(t => t.identity));
        const nonVoiceUsers = (roomUsers || [])
          .filter(u => !voiceIdentities.has(u.id))
          .map(u => ({
            sid: `room-${u.id}`, identity: u.id, name: u.name,
            isSpeaking: false, isMuted: true, isLocal: false,
            hasVideo: false, hasScreenShare: false,
            videoTrackSid: null, screenTrackSid: null,
            _notInVoice: true,
          }));
        const allTiles = [...tiles, ...nonVoiceUsers];

        return allTiles.length > 0 ? (
          <div style={{
            display: "flex", gap: 10, flexWrap: "wrap" as const,
            alignContent: "start", flex: 1, overflow: "auto", padding: "4px 0",
          }}>
            {allTiles.map(t => (
              <VoiceCard key={t.sid} tile={t} moduleType={moduleType} roomUsers={roomUsers} />
            ))}
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.3, fontSize: 12 }}>
            {live ? "Waiting for others to join…" : "No one in this room yet"}
          </div>
        );
      })()}

      <style>{`@keyframes waveBar { from { transform: scaleY(0.4); } to { transform: scaleY(1.2); } }`}</style>
    </div>
  );
}

// ─── Video tile ──────────────────────────────────────────────────────────────

function VideoTile({ tile, getVideoElement }: { tile: any; getVideoElement: (sid: string) => HTMLVideoElement | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Clear previous
    while (ref.current.firstChild) ref.current.removeChild(ref.current.firstChild);

    const trackSid = tile.videoTrackSid || tile.screenTrackSid;
    console.log("[VideoTile]", { name: tile.name, trackSid, videoTrackSid: tile.videoTrackSid, screenTrackSid: tile.screenTrackSid, hasVideo: tile.hasVideo, hasScreenShare: tile.hasScreenShare });
    if (!trackSid) return;

    let el = getVideoElement(trackSid);
    console.log("[VideoTile] getVideoElement result:", el ? "FOUND" : "MISSING", "for SID:", trackSid);
    let retryTimer: any;

    const attach = () => {
      if (!ref.current) return;
      el = getVideoElement(trackSid);
      if (!el) { retryTimer = setTimeout(attach, 200); return; }
      el.style.display = "block";
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.objectFit = "contain";
      el.style.borderRadius = "8px";
      ref.current.appendChild(el);
    };
    attach();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (el && el.parentElement === ref.current) {
        el.style.display = "none";
        document.body.appendChild(el);
      }
    };
  }, [tile.videoTrackSid, tile.screenTrackSid, getVideoElement]);

  const hasVideo = tile.hasVideo || tile.hasScreenShare;

  return (
    <div style={{
      position: "relative", borderRadius: 10, overflow: "hidden",
      background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.06)",
      aspectRatio: tile.hasScreenShare ? undefined : "16/10",
      width: "100%", height: tile.hasScreenShare ? "100%" : undefined,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {hasVideo ? (
        <div ref={ref} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />
      ) : (
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "rgba(124,58,237,.2)", border: "1px solid rgba(124,58,237,.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 900, color: "rgba(167,139,250,.7)",
        }}>
          {tile.name?.[0]?.toUpperCase() || "?"}
        </div>
      )}
      {/* Name label */}
      <div style={{
        position: "absolute", bottom: 4, left: 6, right: 6,
        display: "flex", alignItems: "center", gap: 4,
        fontSize: 10, fontWeight: 700, color: "#fff",
        textShadow: "0 1px 4px rgba(0,0,0,.8)",
      }}>
        {tile.isSpeaking && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />}
        {tile.isMuted && <span style={{ opacity: 0.4 }}>🔇</span>}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tile.name}</span>
        {tile.isLocal && <span style={{ opacity: 0.4 }}>(you)</span>}
      </div>
    </div>
  );
}

// ─── Video Stage ─────────────────────────────────────────────────────────────

function VideoStage({ roomId, onClose, style }: { roomId: string; onClose?: () => void; style?: React.CSSProperties }) {
  const voice = useVoice();
  const { connState, tiles, muted, cameraOn, toggleMute, toggleCamera, connect, disconnect, getVideoElement } = voice;

  useEffect(() => {
    if (connState === "idle" || connState === "error") {
      connect(roomId, { mic: false });
    }
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only show camera tiles (not screen share)
  const cameraTiles = tiles.filter(t => t.hasVideo || !t.hasScreenShare);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, ...style }}>
      {/* Controls bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
        borderBottom: "1px solid rgba(255,255,255,.06)", flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.5 }}>📹 Video</span>
        <div style={{ flex: 1 }} />
        <button onClick={toggleMute} style={ctrlBtn}>{muted ? "🔇 Unmute" : "🎙 Mute"}</button>
        <button onClick={toggleCamera} style={{ ...ctrlBtn, ...(cameraOn ? { background: "rgba(239,68,68,.15)", borderColor: "rgba(239,68,68,.3)", color: "rgba(252,165,165,.9)" } : {}) }}>
          {cameraOn ? "📷 Stop Cam" : "📷 Start Cam"}
        </button>
        <button onClick={() => { disconnect(); onClose?.(); }} style={{ ...ctrlBtn, color: "rgba(239,68,68,.7)" }}>Leave</button>
      </div>

      {/* Video grid */}
      <div style={{
        flex: 1, padding: 8, overflow: "auto",
        display: "grid",
        gridTemplateColumns: cameraTiles.length <= 1 ? "1fr" : cameraTiles.length <= 4 ? "1fr 1fr" : "1fr 1fr 1fr",
        gap: 6, alignContent: "start",
      }}>
        {cameraTiles.map(t => (
          <VideoTile key={t.sid} tile={{ ...t, hasScreenShare: false, screenTrackSid: null }} getVideoElement={getVideoElement} />
        ))}
        {cameraTiles.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 24, opacity: 0.3, fontSize: 12 }}>
            {connState === "connecting" ? "Connecting..." : "No participants yet"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Screen Share Stage ──────────────────────────────────────────────────────

function ScreenStage({ roomId, onClose, style }: { roomId: string; onClose?: () => void; style?: React.CSSProperties }) {
  const voice = useVoice();
  const { connState, activeRoomId, tiles, muted, screenShareOn, toggleMute, toggleScreenShare, connect, disconnect, getVideoElement } = voice;
  const screenRef = useRef<HTMLDivElement>(null);

  // Don't auto-connect to voice — only connect when user clicks Share Screen
  const handleShareScreen = useCallback(async () => {
    if (connState === "idle" || connState === "error") {
      await connect(roomId, { mic: false });
    }
    toggleScreenShare();
  }, [connState, roomId, connect, toggleScreenShare]);

  // Find the screen share presenter
  const presenter = tiles.find(t => t.hasScreenShare);
  const screenSid = presenter?.screenTrackSid;

  // Attach video element directly
  useEffect(() => {
    if (!screenRef.current || !screenSid) return;
    // Clear previous
    while (screenRef.current.firstChild) screenRef.current.removeChild(screenRef.current.firstChild);

    let el: HTMLVideoElement | null = null;
    let retryTimer: any;
    let attempts = 0;

    const attach = () => {
      if (!screenRef.current) return;
      el = getVideoElement(screenSid);
      if (!el) {
        if (attempts++ < 30) retryTimer = setTimeout(attach, 200);
        return;
      }
      el.style.display = "block";
      el.style.position = "absolute";
      el.style.inset = "0";
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.objectFit = "contain";
      screenRef.current.appendChild(el);
    };
    attach();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (el && el.parentElement === screenRef.current) {
        el.style.display = "none";
        el.style.position = "";
        document.body.appendChild(el);
      }
    };
  }, [screenSid, getVideoElement]);

  return (
    <div style={{ height: "100%", position: "relative", ...style }}>
      {/* Controls bar — absolute top */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
        display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
        borderBottom: "1px solid rgba(255,255,255,.06)",
        background: "rgba(0,0,0,.5)", backdropFilter: "blur(8px)",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.5 }}>🖥 Screen Share</span>
        <div style={{ flex: 1 }} />
        {connState === "connected" && <button onClick={toggleMute} style={ctrlBtn}>{muted ? "🔇 Unmute" : "🎙 Mute"}</button>}
        <button onClick={handleShareScreen} style={{ ...ctrlBtn, ...(screenShareOn ? { background: "rgba(239,68,68,.15)", borderColor: "rgba(239,68,68,.3)", color: "rgba(252,165,165,.9)" } : { background: "rgba(34,197,94,.12)", borderColor: "rgba(34,197,94,.25)", color: "rgba(134,239,172,.9)" }) }}>
          {screenShareOn ? "🖥 Stop Sharing" : "🖥 Share Screen"}
        </button>
        {connState === "connected" && (
          <button onClick={() => { disconnect(); onClose?.(); }} style={{ ...ctrlBtn, color: "rgba(239,68,68,.7)" }}>Leave</button>
        )}
      </div>

      {/* Screen share view — fills entire stage */}
      {presenter ? (
        <div
          ref={screenRef}
          style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,.4)",
            overflow: "hidden",
          }}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", opacity: 0.3 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🖥</div>
            <div style={{ fontSize: 13 }}>
              {connState === "connecting" ? "Connecting..." : screenShareOn ? "You are sharing your screen" : "No one is sharing their screen"}
            </div>
            {!screenShareOn && connState === "connected" && (
              <button onClick={toggleScreenShare} style={{ ...ctrlBtn, marginTop: 12, padding: "8px 20px" }}>
                Share Your Screen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Presenter name */}
      {presenter && (
        <div style={{ padding: "4px 16px 8px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)" }}>
          {presenter.isMuted && <span style={{ opacity: 0.4, marginRight: 4 }}>🔇</span>}
          {presenter.name}{presenter.isLocal ? " (you)" : ""}
        </div>
      )}
    </div>
  );
}

const ctrlBtn: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,.1)",
  background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.6)",
  fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
};

// ─── Main export ──────────────────────────────────────────────────────────────

export default function RoomStage({ roomId, mode, moduleType, roomUsers, onClose, style }: Props) {
  const ctx = useWeered() as any;
  if (mode === "poker") return <PokerTable roomId={roomId} myId={ctx?.me?.id || ""} myName={ctx?.me?.name || ""} />;
  if (mode === "fakeout") return <TradingModulesPanel lobbyId={ctx?.currentLobbyId || roomId} accent="#22c55e" />;
  if (mode === "youtube") return <YoutubeStage roomId={roomId} onClose={onClose} style={style} />;
  if (mode === "voice")   return <VoiceStage   roomId={roomId} moduleType={moduleType} roomUsers={roomUsers} onClose={onClose} style={style} />;
  if (mode === "video")   return <VideoStage   roomId={roomId} onClose={onClose} style={style} />;
  if (mode === "screen")  return <ScreenStage  roomId={roomId} onClose={onClose} style={style} />;

  // Placeholder for future modes
  return (
    <div style={{ padding: 16, opacity: 0.5, fontSize: 13 }}>
      {mode} — coming soon
      <button onClick={onClose} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#fff", opacity: 0.5 }}>✕</button>
    </div>
  );
}
