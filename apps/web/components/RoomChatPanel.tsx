import React, { useMemo } from "react";
import LobbyChatPanel from "./LobbyChatPanel";

export default function RoomChatPanel({ roomId }: { roomId: string }) {
  const rid = useMemo(() => {
    let raw = String(roomId || "").trim();
    if (!raw) return "";

    // If someone passed "room:XYZ", strip the prefix so it matches server room ids.
    if (raw.startsWith("room:")) raw = raw.slice(5);

    try { raw = decodeURIComponent(raw); } catch {}
    return raw.trim();
  }, [roomId]);

  if (!rid) {
    return <div className="text-sm opacity-80">Room chat unavailable: missing roomId.</div>;
  }

  // IMPORTANT: use raw room id so presence:join and presence:state match
  return <LobbyChatPanel title="Room Chat" roomId={rid} embedded />;
}

