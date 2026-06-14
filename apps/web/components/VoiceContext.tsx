"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, LocalParticipant, RemoteParticipant, TrackPublication, RemoteTrackPublication } from "livekit-client";

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
  hasVideo: boolean;
  hasScreenShare: boolean;
  videoTrackSid: string | null;
  screenTrackSid: string | null;
}

interface VoiceContextValue {
  connState:        VoiceConnState;
  activeRoomId:     string | null;
  tiles:            ParticipantTile[];
  muted:            boolean;
  cameraOn:         boolean;
  screenShareOn:    boolean;
  errorMsg:         string;
  mics:             { deviceId: string; label: string }[];
  micId:            string | null;
  inputLevel:       number;
  connect:          (roomId: string, opts?: { mic?: boolean }) => Promise<void>;
  disconnect:       () => void;
  toggleMute:       () => void;
  toggleCamera:     () => void;
  toggleScreenShare: () => void;
  setMic:           (deviceId: string) => Promise<void>;
  refreshMics:      () => Promise<void>;
  getVideoElement:  (trackSid: string) => HTMLVideoElement | null;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const roomRef    = useRef<Room | null>(null);
  const audioRefs  = useRef<Map<string, HTMLAudioElement>>(new Map());
  const videoRefs  = useRef<Map<string, HTMLVideoElement>>(new Map());

  const [connState,      setConnState     ] = useState<VoiceConnState>("idle");
  const [activeRoomId,   setActiveRoomId  ] = useState<string | null>(null);
  const [tiles,          setTiles         ] = useState<ParticipantTile[]>([]);
  const [muted,          setMuted         ] = useState(false);
  const [cameraOn,       setCameraOn      ] = useState(false);
  const [screenShareOn,  setScreenShareOn ] = useState(false);
  const [errorMsg,       setErrorMsg      ] = useState("");
  const [mics,           setMics          ] = useState<{ deviceId: string; label: string }[]>([]);
  const [micId,          setMicId         ] = useState<string | null>(null);
  const [inputLevel,     setInputLevel    ] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);

  const stopLevelMeter = useCallback(() => {
    if (meterRafRef.current != null) { cancelAnimationFrame(meterRafRef.current); meterRafRef.current = null; }
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    setInputLevel(0);
  }, []);

  const startLevelMeter = useCallback((room: Room) => {
    try {
      stopLevelMeter();
      const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      const mst = (pub?.track as any)?.mediaStreamTrack as MediaStreamTrack | undefined;
      if (!mst) return;
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AC) return;
      const ctx: AudioContext = new AC();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(new MediaStream([mst]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        setInputLevel(Math.min(1, rms * 3.2));
        meterRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  }, [stopLevelMeter]);

  const refreshMics = useCallback(async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const ins = devs
        .filter(d => d.kind === "audioinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
      setMics(ins);
      const room = roomRef.current;
      const active = room ? (room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as any)?.mediaStreamTrack?.getSettings?.()?.deviceId : null;
      if (active) setMicId(active);
    } catch {}
  }, []);

  const rebuildTiles = useCallback((room: Room) => {
    const next: ParticipantTile[] = [];
    const addP = (p: any, isLocal: boolean) => {
      if (!p) return;
      let hasVideo = false;
      let hasScreenShare = false;
      let videoTrackSid: string | null = null;
      let screenTrackSid: string | null = null;

      const pubs = [...(p.trackPublications?.values() || [])] as TrackPublication[];
      for (const pub of pubs) {
        if (pub.kind === Track.Kind.Video) {
          const sid = (pub as any).track?.sid || pub.trackSid || null;
          if (pub.source === Track.Source.Camera) {
            hasVideo = !pub.isMuted;
            videoTrackSid = sid;
          } else if (pub.source === Track.Source.ScreenShare) {
            hasScreenShare = !pub.isMuted;
            screenTrackSid = sid;
          }
        }
      }

      next.push({
        sid: p.sid, identity: p.identity,
        name: p.name || p.identity,
        isSpeaking: p.isSpeaking,
        isMuted: isLocal
          ? !p.isMicrophoneEnabled
          : pubs.filter((pub: any) => pub.kind === Track.Kind.Audio).every((pub: any) => pub.isMuted),
        isLocal,
        hasVideo,
        hasScreenShare,
        videoTrackSid,
        screenTrackSid,
      });
    };
    addP(room.localParticipant, true);
    room.remoteParticipants.forEach(p => addP(p, false));
    console.log("[LK] rebuildTiles", next.map(t => ({ name: t.name, hasScreen: t.hasScreenShare, screenSid: t.screenTrackSid, videoSid: t.videoTrackSid })));
    console.log("[LK] videoRefs keys:", [...videoRefs.current.keys()]);
    setTiles(next);
  }, []);

  const connect = useCallback(async (roomId: string, opts?: { mic?: boolean }) => {
    const enableMic = opts?.mic !== false;
    if (connState === "connected" && activeRoomId === roomId) return;
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
      audioRefs.current.forEach(el => el.remove()); audioRefs.current.clear();
      videoRefs.current.forEach(el => el.remove()); videoRefs.current.clear();
    }

    setConnState("connecting"); setErrorMsg(""); setActiveRoomId(roomId);
    setCameraOn(false); setScreenShareOn(false);
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

      const room = new Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: { width: 640, height: 480, frameRate: 24 } } });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        console.log("[LK] TrackSubscribed", { kind: track.kind, source: track.source, sid: track.sid });
        if (!track.sid) return;
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach() as HTMLAudioElement;
          el.autoplay = true; el.volume = 1;
          document.body.appendChild(el);
          audioRefs.current.set(track.sid, el);
        } else if (track.kind === Track.Kind.Video) {
          console.log("[LK] Storing remote video element with SID:", track.sid);
          const el = track.attach() as HTMLVideoElement;
          el.autoplay = true; el.playsInline = true;
          el.style.display = "none";
          document.body.appendChild(el);
          videoRefs.current.set(track.sid, el);
        }
        rebuildTiles(room);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (!track.sid) return;
        if (track.kind === Track.Kind.Audio) {
          const el = audioRefs.current.get(track.sid);
          if (el) { el.remove(); audioRefs.current.delete(track.sid); }
        } else if (track.kind === Track.Kind.Video) {
          const el = videoRefs.current.get(track.sid);
          if (el) { el.remove(); videoRefs.current.delete(track.sid); }
        }
        rebuildTiles(room);
      });
      room.on(RoomEvent.ParticipantConnected,    () => rebuildTiles(room));
      room.on(RoomEvent.ParticipantDisconnected, () => rebuildTiles(room));
      room.on(RoomEvent.ActiveSpeakersChanged,   () => rebuildTiles(room));
      room.on(RoomEvent.TrackMuted,              () => rebuildTiles(room));
      room.on(RoomEvent.TrackUnmuted,            () => rebuildTiles(room));
      room.on(RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.kind === Track.Kind.Video && pub.track) {
          const el = pub.track.attach() as HTMLVideoElement;
          el.autoplay = true; el.playsInline = true; el.muted = true;
          el.style.display = "none";
          document.body.appendChild(el);

          let attempts = 0;
          const storeBySid = () => {
            const sid = pub.track?.sid || pub.trackSid;
            if (sid) {
              console.log("[LK] Local video stored with SID:", sid, "source:", pub.source);
              videoRefs.current.set(sid, el);
              rebuildTiles(room);
            } else if (attempts++ < 50) {
              setTimeout(storeBySid, 100);
            }
          };
          storeBySid();
        }
        rebuildTiles(room);
      });
      room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.kind === Track.Kind.Video) {
          const sids = [pub.track?.sid, pub.trackSid].filter(Boolean);
          for (const sid of sids) {
            const el = videoRefs.current.get(sid!);
            if (el) { el.remove(); videoRefs.current.delete(sid!); }
          }
        }
        rebuildTiles(room);
      });
      room.on(RoomEvent.Disconnected,            () => {
        setConnState("idle"); setActiveRoomId(null); setTiles([]);
        setCameraOn(false); setScreenShareOn(false);
        stopLevelMeter();
        audioRefs.current.forEach(el => el.remove()); audioRefs.current.clear();
        videoRefs.current.forEach(el => el.remove()); videoRefs.current.clear();
      });

      await room.connect(url, token);
      if (enableMic) {
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          let pref: string | null = null;
          try { pref = localStorage.getItem("weered:micId"); } catch {}
          if (pref) { try { await room.switchActiveDevice("audioinput", pref); setMicId(pref); } catch {} }
          refreshMics();
          startLevelMeter(room);
        } catch (e: any) { console.warn("Mic unavailable:", e?.message); setMuted(true); }
      } else {
        setMuted(true);
      }
      setConnState("connected"); rebuildTiles(room);
    } catch (e: any) {
      setConnState("error"); setErrorMsg(String(e?.message || e));
      setActiveRoomId(null);
    }
  }, [connState, activeRoomId, rebuildTiles, refreshMics, startLevelMeter]);

  const disconnect = useCallback(() => {
    roomRef.current?.disconnect(); roomRef.current = null;
    stopLevelMeter();
    audioRefs.current.forEach(el => el.remove()); audioRefs.current.clear();
    videoRefs.current.forEach(el => el.remove()); videoRefs.current.clear();
    setTiles([]); setConnState("idle"); setActiveRoomId(null); setErrorMsg("");
    setCameraOn(false); setScreenShareOn(false);
  }, [stopLevelMeter]);

  useEffect(() => {
    function handler(e: any) {
      const detail = (e as CustomEvent).detail || {};
      const rid = String(detail.roomId || "");
      if (!rid) return;
      if (!activeRoomId || activeRoomId !== rid) return;
      const wasMic = !muted;
      try { roomRef.current?.disconnect(); } catch {}
      roomRef.current = null;
      setTimeout(() => { connect(rid, { mic: wasMic }).catch(() => {}); }, 50);
    }
    window.addEventListener("weered:voice:permission", handler as any);
    return () => window.removeEventListener("weered:voice:permission", handler as any);
  }, [activeRoomId, muted, connect]);

  const toggleMute = useCallback(() => {
    const room = roomRef.current; if (!room) return;
    const next = !muted;
    room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next); rebuildTiles(room);
    if (next) stopLevelMeter(); else setTimeout(() => startLevelMeter(room), 200);
  }, [muted, rebuildTiles, startLevelMeter, stopLevelMeter]);

  const setMic = useCallback(async (deviceId: string) => {
    setMicId(deviceId);
    try { localStorage.setItem("weered:micId", deviceId); } catch {}
    const room = roomRef.current;
    if (room) {
      try {
        await room.switchActiveDevice("audioinput", deviceId);
        setTimeout(() => startLevelMeter(room), 200);
      } catch (e: any) { console.warn("switch mic failed:", e?.message); }
    }
  }, [startLevelMeter]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current; if (!room) return;
    try {
      const next = !cameraOn;
      await room.localParticipant.setCameraEnabled(next);
      setCameraOn(next);
      rebuildTiles(room);
    } catch (e: any) { console.warn("Camera error:", e?.message); }
  }, [cameraOn, rebuildTiles]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current; if (!room) return;
    try {
      const next = !screenShareOn;
      await room.localParticipant.setScreenShareEnabled(next);
      setScreenShareOn(next);
      rebuildTiles(room);
    } catch (e: any) { console.warn("Screen share error:", e?.message); }
  }, [screenShareOn, rebuildTiles]);

  const getVideoElement = useCallback((trackSid: string): HTMLVideoElement | null => {
    return videoRefs.current.get(trackSid) || null;
  }, []);

  useEffect(() => () => {
    roomRef.current?.disconnect();
    stopLevelMeter();
    audioRefs.current.forEach(el => el.remove());
    videoRefs.current.forEach(el => el.remove());
  }, [stopLevelMeter]);

  return (
    <VoiceContext.Provider value={{
      connState, activeRoomId, tiles, muted, cameraOn, screenShareOn, errorMsg,
      mics, micId, inputLevel,
      connect, disconnect, toggleMute, toggleCamera, toggleScreenShare,
      setMic, refreshMics, getVideoElement,
    }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within VoiceProvider");
  return ctx;
}
