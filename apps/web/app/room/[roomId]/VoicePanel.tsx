"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { useWeered } from "../../../components/WeeredProvider";

type Conn = "disconnected" | "connecting" | "connected" | "error";

export default function VoicePanel({ roomId }: { roomId: string }) {
  const { apiBase, token } = useWeered();

  const [conn, setConn] = useState<Conn>("disconnected");
  const [err, setErr] = useState<string>("");
  const [micOn, setMicOn] = useState<boolean>(false);
  const [participants, setParticipants] = useState<
    { id: string; name: string; isLocal: boolean }[]
  >([]);

  const roomRef = useRef<Room | null>(null);
  const audioRootRef = useRef<HTMLDivElement | null>(null);

  const btnDisabled = useMemo(() => conn === "connecting", [conn]);

  function clearAudio() {
    const root = audioRootRef.current;
    if (!root) return;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  function syncRoster() {
    const r = roomRef.current;
    if (!r) {
      setParticipants([]);
      return;
    }

    const list: { id: string; name: string; isLocal: boolean }[] = [];
    if (r.localParticipant)
      list.push({
        id: r.localParticipant.identity,
        name: r.localParticipant.name || "Me",
        isLocal: true,
      });

    ((r as any).participants ?? (r as any).remoteParticipants ?? new Map()).forEach((p: any) => {
      list.push({ id: p.identity, name: p.name || p.identity, isLocal: false });
    });

    setParticipants(list);
  }

  async function connect() {
    setErr("");
    setConn("connecting");

    try {
      const res = await fetch(`${apiBase}/voice/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId }),
      });

      const j = await res.json();
      if (!j?.ok) {
        throw new Error(j?.error || `voice_token_failed_${res.status}`);
      }

      const url = String(j.url || "");
      const livekitToken = String(j.token || "");
      if (!url || !livekitToken) throw new Error("missing_livekit_url_or_token");

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        const el = track.attach();
        (el as HTMLMediaElement).autoplay = true;
        (el as HTMLMediaElement).controls = false;
        audioRootRef.current?.appendChild(el);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        try {
          track.detach().forEach((n) => n.remove());
        } catch {}
      });

      room.on(RoomEvent.ParticipantConnected, syncRoster);
      room.on(RoomEvent.ParticipantDisconnected, syncRoster);
      room.on(RoomEvent.Disconnected, () => {
        setConn("disconnected");
        setMicOn(false);
        syncRoster();
        clearAudio();
      });

      await room.connect(url, livekitToken);

      await room.localParticipant.setMicrophoneEnabled(true);
      setMicOn(true);

      syncRoster();
      setConn("connected");
    } catch (e: any) {
      setErr(String(e?.message || e || "voice_error"));
      setConn("error");
      try {
        roomRef.current?.disconnect();
      } catch {}
      roomRef.current = null;
      clearAudio();
    }
  }

  async function disconnect() {
    setErr("");
    try {
      roomRef.current?.disconnect();
    } catch {}
    roomRef.current = null;
    clearAudio();
    setMicOn(false);
    setParticipants([]);
    setConn("disconnected");
  }

  async function toggleMic() {
    const r = roomRef.current;
    if (!r) return;
    const next = !micOn;
    await r.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }

  useEffect(() => {
    return () => {
      try {
        roomRef.current?.disconnect();
      } catch {}
      roomRef.current = null;
      clearAudio();
    };
  }, []);

  const card: React.CSSProperties = {
    border: "1px solid var(--weered-border)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(15,23,42,.92)",
  };
  const btn: React.CSSProperties = {
    border: "1px solid var(--weered-border)",
    borderRadius: 10,
    padding: "6px 10px",
    background: "rgba(15,23,42,.92)",
    cursor: "pointer",
    fontSize: 13,
  };
  const pill: React.CSSProperties = {
    border: "1px solid var(--weered-border)",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 12,
    background: "#fafafa",
  };

  return (
    <div style={card}>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}
      >
        <div>
          <div style={{ fontWeight: 900 }}>Voice</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            <span style={pill}>state: {conn}</span>
            <span style={{ marginLeft: 8, ...pill }}>mic: {micOn ? "on" : "off"}</span>
            <span style={{ marginLeft: 8, ...pill }}>peeps: {participants.length}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {conn !== "connected" ? (
            <button
              style={{ ...btn, opacity: btnDisabled ? 0.6 : 1 }}
              disabled={btnDisabled}
              onClick={connect}
            >
              Connect
            </button>
          ) : (
            <>
              <button style={btn} onClick={toggleMic}>
                {micOn ? "Mute" : "Unmute"}
              </button>
              <button style={btn} onClick={disconnect}>
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {err ? <div style={{ marginTop: 10, fontSize: 12, color: "#b00" }}>{err}</div> : null}

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>Participants</div>
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {participants.length ? (
            participants.map((p) => (
              <span key={p.id} style={pill}>
                {p.isLocal ? "me" : p.name}
              </span>
            ))
          ) : (
            <span style={{ fontSize: 12, color: "#666" }}>None</span>
          )}
        </div>
      </div>

      <div ref={audioRootRef} />
    </div>
  );
}
