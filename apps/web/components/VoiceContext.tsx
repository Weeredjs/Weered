"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

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

export type VoiceConnState = "idle" | "connecting" | "connected" | "error";

export interface ParticipantTile {
  sid: string;
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isLocal: boolean;
}

interface VoiceContextValue {
  connState:   VoiceConnState;
  activeRoomId: string | null;
  tiles:       ParticipantTile[];
  muted:       boolean;
  errorMsg:    string;
  connect:     (roomId: string) => Promise<void>;
  disconnect:  () => void;
  toggleMute:  () => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const roomRef    = useRef<Room | null>(null);
  const audioRefs  = useRef<Map<string, HTMLAudioElement>>(new Map());

  const [connState,    setConnState   ] = useState<VoiceConnState>("idle");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [tiles,        setTiles       ] = useState<ParticipantTile[]>([]);
  const [muted,        setMuted       ] = useState(false);
  const [errorMsg,     setErrorMsg    ] = useState("");

  const rebuildTiles = useCallback((room: Room) => {
    const next: ParticipantTile[] = [];
    const addP = (p: any, isLocal: boolean) => {
      if (!p) return;
      next.push({
        sid: p.sid, identity: p.identity,
        name: p.name || p.identity,
        isSpeaking: p.isSpeaking,
        isMuted: isLocal
          ? !p.isMicrophoneEnabled
          : [...(p.trackPublications?.values() || [])]
              .filter((pub: any) => pub.kind === Track.Kind.Audio)
              .every((pub: any) => pub.isMuted),
        isLocal,
      });
    };
    addP(room.localParticipant, true);
    room.remoteParticipants.forEach(p => addP(p, false));
    setTiles(next);
  }, []);

  const connect = useCallback(async (roomId: string) => {
    // Already connected to this room — no-op
    if (connState === "connected" && activeRoomId === roomId) return;
    // Connected to a different room — disconnect first
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
      audioRefs.current.forEach(el => el.remove());
      audioRefs.current.clear();
    }

    setConnState("connecting"); setErrorMsg(""); setActiveRoomId(roomId);
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

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach() as HTMLAudioElement;
          el.autoplay = true; el.volume = 1;
          document.body.appendChild(el);
          audioRefs.current.set(track.sid, el);
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
        setConnState("idle"); setActiveRoomId(null); setTiles([]);
        audioRefs.current.forEach(el => el.remove()); audioRefs.current.clear();
      });

      await room.connect(url, token);
      try { await room.localParticipant.setMicrophoneEnabled(true); }
      catch (e: any) { console.warn("Mic unavailable:", e?.message); setMuted(true); }
      setConnState("connected"); rebuildTiles(room);
    } catch (e: any) {
      setConnState("error"); setErrorMsg(String(e?.message || e));
      setActiveRoomId(null);
    }
  }, [connState, activeRoomId, rebuildTiles]);

  const disconnect = useCallback(() => {
    roomRef.current?.disconnect(); roomRef.current = null;
    audioRefs.current.forEach(el => el.remove()); audioRefs.current.clear();
    setTiles([]); setConnState("idle"); setActiveRoomId(null); setErrorMsg("");
  }, []);

  const toggleMute = useCallback(() => {
    const room = roomRef.current; if (!room) return;
    const next = !muted;
    room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next); rebuildTiles(room);
  }, [muted, rebuildTiles]);

  // Cleanup on unmount (app close)
  useEffect(() => () => {
    roomRef.current?.disconnect();
    audioRefs.current.forEach(el => el.remove());
  }, []);

  return (
    <VoiceContext.Provider value={{ connState, activeRoomId, tiles, muted, errorMsg, connect, disconnect, toggleMute }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within VoiceProvider");
  return ctx;
}
