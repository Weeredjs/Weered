"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, TrackPublication, type LocalAudioTrack } from "livekit-client";
import { VOICE_FX_KEY, savedVoiceFx, voiceFxProcessor, type VoiceFx } from "../lib/voiceFx";
import { streamSettings } from "../lib/streamQuality";
import {
  DEFAULT_PTT,
  isTypingTarget,
  readPtt,
  readVolumes,
  writePtt,
  writeVolume,
  type Ptt,
} from "../lib/voicePrefs";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function getToken(): string {
  try {
    return (
      localStorage.getItem("weered_token") ||
      localStorage.getItem("weered:token") ||
      sessionStorage.getItem("weered_token") ||
      ""
    );
  } catch {
    return "";
  }
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
  connState: VoiceConnState;
  activeRoomId: string | null;
  tiles: ParticipantTile[];
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  screenShareOn: boolean;
  errorMsg: string;
  mics: { deviceId: string; label: string }[];
  micId: string | null;
  inputLevel: number;
  connect: (roomId: string, opts?: { mic?: boolean }) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  setMic: (deviceId: string) => Promise<void>;
  refreshMics: () => Promise<void>;
  getVideoElement: (trackSid: string) => HTMLVideoElement | null;
  /** The voice effect everyone hears (lib/voiceFx.ts); kept on this device. */
  voiceFx: VoiceFx;
  setVoiceFx: (fx: VoiceFx) => void;
  /** How loud each person is to you, by identity (lib/voicePrefs.ts); 1 is full. */
  volumes: Record<string, number>;
  setVolume: (identity: string, v: number) => void;
  /** Push to talk, and whether its key is held right now. */
  ptt: Ptt;
  setPtt: (p: Ptt) => void;
  talking: boolean;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const roomRef = useRef<Room | null>(null);
  /** This call's cam and screen-share quality, from its voice pass (lib/streamQuality.ts). */
  const qualityRef = useRef(streamSettings("standard"));
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const [connState, setConnState] = useState<VoiceConnState>("idle");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [tiles, setTiles] = useState<ParticipantTile[]>([]);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const deafenedRef = useRef(false);
  const mutedBeforeDeafenRef = useRef(false);
  const mutedRef = useRef(false);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Per-person volume and push to talk, kept on this device (lib/voicePrefs.ts).
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const volumesRef = useRef<Record<string, number>>({});
  /** Which person each remote audio track belongs to. */
  const ownerRef = useRef<Map<string, string>>(new Map());
  const [ptt, setPttState] = useState<Ptt>(DEFAULT_PTT);
  const pttRef = useRef<Ptt>(DEFAULT_PTT);
  const heldRef = useRef(false);
  const [talking, setTalking] = useState(false);
  useEffect(() => {
    const v = readVolumes();
    volumesRef.current = v;
    setVolumes(v);
    const p = readPtt();
    pttRef.current = p;
    setPttState(p);
  }, []);
  /** With push to talk on, the mic opens only while its key is held. */
  const pttAllows = () => !pttRef.current.on || heldRef.current;
  const [cameraOn, setCameraOn] = useState(false);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [mics, setMics] = useState<{ deviceId: string; label: string }[]>([]);
  const [micId, setMicId] = useState<string | null>(null);
  const [inputLevel, setInputLevel] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);

  // Voice effect: a LiveKit audio processor on the mic track, run in its own
  // AudioContext (the level meter's closes whenever the meter restarts).
  const [voiceFx, setVoiceFxState] = useState<VoiceFx>("off");
  const voiceFxRef = useRef<VoiceFx>("off");
  const fxCtxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    const fx = savedVoiceFx();
    voiceFxRef.current = fx;
    setVoiceFxState(fx);
  }, []);
  const applyVoiceFx = useCallback(async (room: Room, fx: VoiceFx) => {
    const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as
      | LocalAudioTrack
      | undefined;
    if (!track) return;
    try {
      if (fx === "off") {
        await track.stopProcessor();
        return;
      }
      if (!fxCtxRef.current || fxCtxRef.current.state === "closed") {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        fxCtxRef.current = new AC();
      }
      track.setAudioContext(fxCtxRef.current);
      await track.setProcessor(voiceFxProcessor(fx));
    } catch (e: any) {
      console.warn("voice effect failed:", e?.message);
    }
  }, []);
  const setVoiceFx = useCallback(
    (fx: VoiceFx) => {
      voiceFxRef.current = fx;
      setVoiceFxState(fx);
      try {
        localStorage.setItem(VOICE_FX_KEY, fx);
      } catch {}
      const room = roomRef.current;
      if (room) void applyVoiceFx(room, fx);
    },
    [applyVoiceFx],
  );

  const stopLevelMeter = useCallback(() => {
    if (meterRafRef.current != null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    try {
      void audioCtxRef.current?.close();
    } catch {}
    audioCtxRef.current = null;
    setInputLevel(0);
  }, []);

  const startLevelMeter = useCallback(
    (room: Room) => {
      try {
        stopLevelMeter();
        const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        const mst = (pub?.track as any)?.mediaStreamTrack as MediaStreamTrack | undefined;
        if (!mst) return;
        const AC = window.AudioContext || (window as any).webkitAudioContext;
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
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setInputLevel(Math.min(1, rms * 3.2));
          meterRafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {}
    },
    [stopLevelMeter],
  );

  const refreshMics = useCallback(async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const ins = devs
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
      setMics(ins);
      const room = roomRef.current;
      const active = room
        ? (
            room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as any
          )?.mediaStreamTrack?.getSettings?.()?.deviceId
        : null;
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
        sid: p.sid,
        identity: p.identity,
        name: p.name || p.identity,
        isSpeaking: p.isSpeaking,
        isMuted: isLocal
          ? !p.isMicrophoneEnabled
          : pubs
              .filter((pub: any) => pub.kind === Track.Kind.Audio)
              .every((pub: any) => pub.isMuted),
        isLocal,
        hasVideo,
        hasScreenShare,
        videoTrackSid,
        screenTrackSid,
      });
    };
    addP(room.localParticipant, true);
    room.remoteParticipants.forEach((p) => addP(p, false));
    setTiles(next);
  }, []);

  const connect = useCallback(
    async (roomId: string, opts?: { mic?: boolean }) => {
      const enableMic = opts?.mic !== false;
      if (connState === "connected" && activeRoomId === roomId) return;
      if (roomRef.current) {
        void roomRef.current.disconnect();
        roomRef.current = null;
        audioRefs.current.forEach((el) => el.remove());
        audioRefs.current.clear();
        videoRefs.current.forEach((el) => el.remove());
        videoRefs.current.clear();
      }

      setConnState("connecting");
      setErrorMsg("");
      setActiveRoomId(roomId);
      setCameraOn(false);
      setScreenShareOn(false);
      try {
        // Auth is the httpOnly session cookie (credentials: include); the API's
        // onRequest hook reads it. The old localStorage bearer was cleared by the
        // cookie migration, so the previous getToken()/throw guard always failed.
        const res = await fetch(`${API}/voice/token`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId }),
        });
        if (!res.ok) throw new Error(`Token error ${res.status}`);
        const { url, token, quality } = await res.json();
        if (!token) throw new Error("No token returned");
        const q = streamSettings(quality);
        qualityRef.current = q;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: { resolution: q.camera },
          publishDefaults: {
            ...(q.cameraEncoding ? { videoEncoding: q.cameraEncoding } : {}),
            screenShareEncoding: q.screenEncoding,
          },
        });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (!track.sid) return;
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.autoplay = true;
            const who = participant?.identity || "";
            ownerRef.current.set(track.sid, who);
            el.volume = volumesRef.current[who] ?? 1;
            el.muted = deafenedRef.current;
            document.body.appendChild(el);
            audioRefs.current.set(track.sid, el);
          } else if (track.kind === Track.Kind.Video) {
            const el = track.attach() as HTMLVideoElement;
            el.autoplay = true;
            el.playsInline = true;
            el.style.display = "none";
            document.body.appendChild(el);
            videoRefs.current.set(track.sid, el);
          }
          rebuildTiles(room);
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (!track.sid) return;
          if (track.kind === Track.Kind.Audio) {
            ownerRef.current.delete(track.sid);
            const el = audioRefs.current.get(track.sid);
            if (el) {
              el.remove();
              audioRefs.current.delete(track.sid);
            }
          } else if (track.kind === Track.Kind.Video) {
            const el = videoRefs.current.get(track.sid);
            if (el) {
              el.remove();
              videoRefs.current.delete(track.sid);
            }
          }
          rebuildTiles(room);
        });
        room.on(RoomEvent.ParticipantConnected, () => rebuildTiles(room));
        room.on(RoomEvent.ParticipantDisconnected, () => rebuildTiles(room));
        room.on(RoomEvent.ActiveSpeakersChanged, () => rebuildTiles(room));
        room.on(RoomEvent.TrackMuted, () => rebuildTiles(room));
        room.on(RoomEvent.TrackUnmuted, () => rebuildTiles(room));
        room.on(RoomEvent.LocalTrackPublished, (pub) => {
          if (pub.kind === Track.Kind.Video && pub.track) {
            const el = pub.track.attach() as HTMLVideoElement;
            el.autoplay = true;
            el.playsInline = true;
            el.muted = true;
            el.style.display = "none";
            document.body.appendChild(el);

            let attempts = 0;
            const storeBySid = () => {
              const sid = pub.track?.sid || pub.trackSid;
              if (sid) {
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
              if (el) {
                el.remove();
                videoRefs.current.delete(sid!);
              }
            }
          }
          rebuildTiles(room);
        });
        room.on(RoomEvent.Disconnected, () => {
          setConnState("idle");
          setActiveRoomId(null);
          setTiles([]);
          setCameraOn(false);
          setScreenShareOn(false);
          stopLevelMeter();
          audioRefs.current.forEach((el) => el.remove());
          audioRefs.current.clear();
          videoRefs.current.forEach((el) => el.remove());
          videoRefs.current.clear();
        });

        await room.connect(url, token);
        if (enableMic) {
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
            // Push to talk: the mic is ready (and permitted) but closed until
            // the key is held.
            if (!pttAllows()) await room.localParticipant.setMicrophoneEnabled(false);
            let pref: string | null = null;
            try {
              pref = localStorage.getItem("weered:micId");
            } catch {}
            if (pref) {
              try {
                await room.switchActiveDevice("audioinput", pref);
                setMicId(pref);
              } catch {}
            }
            void refreshMics();
            startLevelMeter(room);
            if (voiceFxRef.current !== "off") void applyVoiceFx(room, voiceFxRef.current);
          } catch (e: any) {
            console.warn("Mic unavailable:", e?.message);
            setMuted(true);
          }
        } else {
          setMuted(true);
        }
        setConnState("connected");
        rebuildTiles(room);
      } catch (e: any) {
        setConnState("error");
        setErrorMsg(String(e?.message || e));
        setActiveRoomId(null);
      }
    },
    [connState, activeRoomId, rebuildTiles, refreshMics, startLevelMeter, applyVoiceFx],
  );

  const disconnect = useCallback(() => {
    void roomRef.current?.disconnect();
    roomRef.current = null;
    stopLevelMeter();
    audioRefs.current.forEach((el) => el.remove());
    audioRefs.current.clear();
    videoRefs.current.forEach((el) => el.remove());
    videoRefs.current.clear();
    setTiles([]);
    setConnState("idle");
    setActiveRoomId(null);
    setErrorMsg("");
    setCameraOn(false);
    setScreenShareOn(false);
  }, [stopLevelMeter]);

  useEffect(() => {
    function handler(e: any) {
      const detail = (e as CustomEvent).detail || {};
      const rid = String(detail.roomId || "");
      if (!rid) return;
      if (!activeRoomId || activeRoomId !== rid) return;
      const wasMic = !muted;
      try {
        void roomRef.current?.disconnect();
      } catch {}
      roomRef.current = null;
      setTimeout(() => {
        connect(rid, { mic: wasMic }).catch(() => {});
      }, 50);
    }
    window.addEventListener("weered:voice:permission", handler as any);
    return () => window.removeEventListener("weered:voice:permission", handler as any);
  }, [activeRoomId, muted, connect]);

  const toggleMute = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    mutedRef.current = next;
    void room.localParticipant.setMicrophoneEnabled(!next && pttAllows());
    setMuted(next);
    rebuildTiles(room);
    if (next) stopLevelMeter();
    else {
      setTimeout(() => startLevelMeter(room), 200);
      // Unmuting lifts deafen — you can't speak-but-not-hear (Discord behaviour).
      if (deafenedRef.current) {
        deafenedRef.current = false;
        setDeafened(false);
        audioRefs.current.forEach((el) => {
          el.muted = false;
        });
      }
    }
  }, [muted, rebuildTiles, startLevelMeter, stopLevelMeter]);

  const toggleDeafen = useCallback(() => {
    const room = roomRef.current;
    const next = !deafenedRef.current;
    deafenedRef.current = next;
    setDeafened(next);
    audioRefs.current.forEach((el) => {
      el.muted = next;
    });
    if (next) {
      // Deafening also mutes your mic; remember the prior state to restore it.
      mutedBeforeDeafenRef.current = muted;
      if (room && !muted) {
        void room.localParticipant.setMicrophoneEnabled(false);
        mutedRef.current = true;
        setMuted(true);
        stopLevelMeter();
        rebuildTiles(room);
      }
    } else if (room && !mutedBeforeDeafenRef.current && muted) {
      void room.localParticipant.setMicrophoneEnabled(pttAllows());
      mutedRef.current = false;
      setMuted(false);
      setTimeout(() => startLevelMeter(room), 200);
      rebuildTiles(room);
    }
  }, [muted, rebuildTiles, startLevelMeter, stopLevelMeter]);

  const setMic = useCallback(
    async (deviceId: string) => {
      setMicId(deviceId);
      try {
        localStorage.setItem("weered:micId", deviceId);
      } catch {}
      const room = roomRef.current;
      if (room) {
        try {
          await room.switchActiveDevice("audioinput", deviceId);
          setTimeout(() => startLevelMeter(room), 200);
        } catch (e: any) {
          console.warn("switch mic failed:", e?.message);
        }
      }
    },
    [startLevelMeter],
  );

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const next = !cameraOn;
      await room.localParticipant.setCameraEnabled(next);
      setCameraOn(next);
      rebuildTiles(room);
    } catch (e: any) {
      console.warn("Camera error:", e?.message);
    }
  }, [cameraOn, rebuildTiles]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const next = !screenShareOn;
      await room.localParticipant.setScreenShareEnabled(
        next,
        next ? { resolution: qualityRef.current.screen } : undefined,
      );
      setScreenShareOn(next);
      rebuildTiles(room);
    } catch (e: any) {
      console.warn("Screen share error:", e?.message);
    }
  }, [screenShareOn, rebuildTiles]);

  const getVideoElement = useCallback((trackSid: string): HTMLVideoElement | null => {
    return videoRefs.current.get(trackSid) || null;
  }, []);

  useEffect(
    () => () => {
      void roomRef.current?.disconnect();
      stopLevelMeter();
      audioRefs.current.forEach((el) => el.remove());
      videoRefs.current.forEach((el) => el.remove());
    },
    [stopLevelMeter],
  );

  const setVolume = useCallback((identity: string, v: number) => {
    const all = writeVolume(identity, v);
    volumesRef.current = all;
    setVolumes(all);
    const level = all[identity] ?? 1;
    audioRefs.current.forEach((el, sid) => {
      if (ownerRef.current.get(sid) === identity) el.volume = level;
    });
  }, []);

  const setPtt = useCallback((p: Ptt) => {
    writePtt(p);
    pttRef.current = p;
    setPttState(p);
  }, []);

  // Push to talk: while connected, the key (or a mouse side button) opens the
  // mic for as long as it's held, unless they muted or deafened. It works while
  // Weered has focus; typing in a field never counts. Turning it off opens the
  // mic again for anyone not muted.
  useEffect(() => {
    if (connState !== "connected" || !ptt.on) return;
    const room = roomRef.current;
    const open = (on: boolean) => {
      heldRef.current = on;
      setTalking(on);
      const r = roomRef.current;
      if (r)
        void r.localParticipant
          .setMicrophoneEnabled(on && !mutedRef.current && !deafenedRef.current)
          .catch(() => {});
    };
    let release: ReturnType<typeof setTimeout> | undefined;
    const press = (code: string, target: EventTarget | null) => {
      if (code !== pttRef.current.code || isTypingTarget(target)) return false;
      if (release) clearTimeout(release);
      if (!heldRef.current) open(true);
      return true;
    };
    // A short tail, so the end of a word isn't clipped.
    const lift = (code: string) => {
      if (code !== pttRef.current.code) return false;
      if (release) clearTimeout(release);
      release = setTimeout(() => open(false), 150);
      return true;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.repeat) press(e.code, e.target);
    };
    const onKeyUp = (e: KeyboardEvent) => void lift(e.code);
    // Side buttons are 3 and 4; the browser would go back or forward on them.
    const onMouseDown = (e: MouseEvent) => {
      if (e.button >= 3 && press(`Mouse${e.button + 1}`, e.target)) e.preventDefault();
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button >= 3 && lift(`Mouse${e.button + 1}`)) e.preventDefault();
    };
    const onBlur = () => heldRef.current && open(false);
    if (room && !heldRef.current)
      void room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("blur", onBlur);
    return () => {
      if (release) clearTimeout(release);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", onBlur);
      heldRef.current = false;
      setTalking(false);
      const r = roomRef.current;
      if (r && r.state === "connected")
        void r.localParticipant
          .setMicrophoneEnabled(!mutedRef.current && !deafenedRef.current && !pttRef.current.on)
          .catch(() => {});
    };
  }, [connState, ptt.on, ptt.code]);

  return (
    <VoiceContext.Provider
      value={{
        connState,
        activeRoomId,
        tiles,
        muted,
        deafened,
        cameraOn,
        screenShareOn,
        errorMsg,
        mics,
        micId,
        inputLevel,
        connect,
        disconnect,
        toggleMute,
        toggleDeafen,
        toggleCamera,
        toggleScreenShare,
        setMic,
        refreshMics,
        getVideoElement,
        voiceFx,
        setVoiceFx,
        volumes,
        setVolume,
        ptt,
        setPtt,
        talking,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within VoiceProvider");
  return ctx;
}
