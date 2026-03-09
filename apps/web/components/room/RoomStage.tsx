"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  LocalParticipant,
  RemoteParticipant,
  Participant,
  ConnectionState,
} from "livekit-client";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export type StageMode = "voice" | "video" | "screen" | "youtube" | null;

interface Props {
  roomId: string;
  mode: StageMode;
  onClose: () => void;
}

interface ParticipantTile {
  sid: string;
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isLocal: boolean;
}

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

export default function RoomStage({ roomId, mode, onClose }: Props) {
  const roomRef = useRef<Room | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const [connState, setConnState] = useState<"idle"|"connecting"|"connected"|"error">("idle");
  const [errorMsg, setErrorMsg]   = useState("");
  const [muted, setMuted]         = useState(false);
  const [tiles, setTiles]         = useState<ParticipantTile[]>([]);

  // ── Build tiles from current room state ──────────────────────────────────
  const rebuildTiles = useCallback((room: Room) => {
    const next: ParticipantTile[] = [];

    const addParticipant = (p: Participant, isLocal: boolean) => {
      next.push({
        sid:        p.sid,
        identity:   p.identity,
        name:       p.name || p.identity,
        isSpeaking: p.isSpeaking,
        isMuted:    isLocal
          ? !(p as LocalParticipant).isMicrophoneEnabled
          : Array.from((p as RemoteParticipant).trackPublications.values())
              .filter(pub => pub.kind === Track.Kind.Audio)
              .every(pub => pub.isMuted),
        isLocal,
      });
    };

    addParticipant(room.localParticipant, true);
    room.remoteParticipants.forEach(p => addParticipant(p, false));
    setTiles(next);
  }, []);

  // ── Connect to LiveKit ────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (connState === "connecting" || connState === "connected") return;
    setConnState("connecting");
    setErrorMsg("");

    try {
      const jwt = getToken();
      if (!jwt) throw new Error("Not authenticated");

      const res = await fetch(`${API}/voice/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ roomId }),
      });
      if (!res.ok) throw new Error(`Token error ${res.status}`);
      const { url, token } = await res.json();
      if (!token) throw new Error("No token returned");

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      // ── Attach remote audio tracks ──
      room.on(RoomEvent.TrackSubscribed, (track, _pub, _participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.autoplay = true;
          (el as HTMLAudioElement).volume = 1;
          document.body.appendChild(el);
          audioRefs.current.set(track.sid, el as HTMLAudioElement);
        }
        rebuildTiles(room);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        const el = audioRefs.current.get(track.sid);
        if (el) { el.remove(); audioRefs.current.delete(track.sid); }
        rebuildTiles(room);
      });

      room.on(RoomEvent.ParticipantConnected,    () => rebuildTiles(room));
      room.on(RoomEvent.ParticipantDisconnected, () => rebuildTiles(room));
      room.on(RoomEvent.ActiveSpeakersChanged,   () => rebuildTiles(room));
      room.on(RoomEvent.TrackMuted,              () => rebuildTiles(room));
      room.on(RoomEvent.TrackUnmuted,            () => rebuildTiles(room));
      room.on(RoomEvent.Disconnected,            () => {
        setConnState("idle");
        rebuildTiles(room);
      });

      await room.connect(url, token);
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch (micErr: any) {
        // No mic or permission denied — connect as listener
        console.warn("Mic unavailable, joining as listener:", micErr?.message);
        setMuted(true);
      }

      setConnState("connected");
      rebuildTiles(room);
    } catch (e: any) {
      setConnState("error");
      setErrorMsg(String(e?.message || e));
    }
  }, [roomId, connState, rebuildTiles]);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      room.disconnect();
      roomRef.current = null;
    }
    audioRefs.current.forEach(el => el.remove());
    audioRefs.current.clear();
    setTiles([]);
    setConnState("idle");
    onClose();
  }, [onClose]);

  // ── Toggle mute ──────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
    rebuildTiles(room);
  }, [muted, rebuildTiles]);

  // ── Auto-connect on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "voice") connect();
    return () => {
      const room = roomRef.current;
      if (room) { room.disconnect(); roomRef.current = null; }
      audioRefs.current.forEach(el => el.remove());
      audioRefs.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Styles ────────────────────────────────────────────────────────────────
  const s = {
    stage: {
      background: "rgba(0,0,0,.35)",
      borderBottom: "1px solid rgba(148,163,184,.12)",
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column" as const,
      gap: 10,
    } as React.CSSProperties,
    bar: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
    },
    modeLabel: {
      fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const,
      opacity: 0.5, display: "flex", alignItems: "center", gap: 6,
    },
    dot: (live: boolean): React.CSSProperties => ({
      width: 7, height: 7, borderRadius: "50%",
      background: live ? "#22c55e" : "rgba(255,255,255,.2)",
      boxShadow: live ? "0 0 6px #22c55e" : "none",
    }),
    controls: { display: "flex", alignItems: "center", gap: 6 },
    btn: (danger?: boolean): React.CSSProperties => ({
      padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer",
      fontSize: 12, fontWeight: 700,
      background: danger ? "rgba(239,68,68,.15)" : "rgba(255,255,255,.07)",
      color: danger ? "#fca5a5" : "rgba(255,255,255,.8)",
    }),
    tilesRow: {
      display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center",
    },
    tile: (speaking: boolean, isLocal: boolean): React.CSSProperties => ({
      display: "flex", alignItems: "center", gap: 7,
      padding: "6px 10px", borderRadius: 10,
      border: speaking
        ? "1.5px solid rgba(34,197,94,.5)"
        : isLocal
          ? "1.5px solid rgba(124,58,237,.35)"
          : "1.5px solid rgba(255,255,255,.08)",
      background: speaking
        ? "rgba(34,197,94,.08)"
        : isLocal
          ? "rgba(124,58,237,.08)"
          : "rgba(255,255,255,.03)",
      transition: "border-color .15s, background .15s",
    }),
    avatar: (name: string): React.CSSProperties => ({
      width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
      background: avatarColor(name),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 800, color: "#fff",
    }),
    tileName: {
      fontSize: 12, fontWeight: 600, maxWidth: 90,
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
    },
    mutedIcon: {
      fontSize: 10, opacity: 0.5,
    },
  };

  const live = connState === "connected";

  return (
    <div style={s.stage}>
      {/* ── Top bar ── */}
      <div style={s.bar}>
        <div style={s.modeLabel}>
          <span style={s.dot(live)} />
          {mode === "voice" ? "Voice" : mode === "video" ? "Video" : "Stage"}
          {connState === "connecting" && <span style={{ opacity: 0.5 }}>  connecting…</span>}
          {connState === "error"      && <span style={{ color: "#fca5a5" }}>  {errorMsg}</span>}
        </div>

        <div style={s.controls}>
          {live && (
            <>
              <button style={s.btn()} onClick={toggleMute}>
                {muted ? "🔇 Unmute" : "🎙 Mute"}
              </button>
              <button style={s.btn(true)} onClick={disconnect}>Leave</button>
            </>
          )}
          {connState === "error" && (
            <button style={s.btn()} onClick={connect}>Retry</button>
          )}
          {connState === "idle" && (
            <button style={s.btn()} onClick={connect}>Join</button>
          )}
          <button
            onClick={disconnect}
            style={{ background:"none", border:"none", cursor:"pointer", opacity:0.4, fontSize:16, padding:"2px 4px", color:"#fff" }}
            title="Close stage"
          >✕</button>
        </div>
      </div>

      {/* ── Participant tiles ── */}
      {tiles.length > 0 && (
        <div style={s.tilesRow}>
          {tiles.map(t => (
            <div key={t.sid} style={s.tile(t.isSpeaking, t.isLocal)}>
              <div style={s.avatar(t.name)}>{t.name[0]?.toUpperCase() ?? "?"}</div>
              <div>
                <div style={s.tileName}>{t.name}{t.isLocal ? " (you)" : ""}</div>
                {t.isMuted && <div style={s.mutedIcon}>muted</div>}
              </div>
              {t.isSpeaking && (
                <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:14, marginLeft:2 }}>
                  {[4,7,5].map((h,i) => (
                    <div key={i} style={{
                      width:3, height:h, borderRadius:2,
                      background:"#22c55e", opacity:0.8,
                      animation: `waveBar .8s ease-in-out ${i*0.15}s infinite alternate`,
                    }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes waveBar {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.2); }
        }
      `}</style>
    </div>
  );
}
