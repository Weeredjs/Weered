import React, { useMemo } from "react";
import LobbyChatPanel from "./LobbyChatPanel";

export default function RoomChatPanel({
  roomId,
  style,
  hideInput,
}: {
  roomId: string;
  style?: React.CSSProperties;
  hideInput?: boolean;
}) {
  const rid = useMemo(() => {
    let raw = String(roomId || "").trim();
    if (!raw) return "";
    if (raw.startsWith("room:")) raw = raw.slice(5);
    try {
      raw = decodeURIComponent(raw);
    } catch {}
    return raw.trim();
  }, [roomId]);

  if (!rid) {
    return <div className="text-sm opacity-80">Room chat unavailable: missing roomId.</div>;
  }

  return <LobbyChatPanel roomId={rid} embedded hideInput={hideInput} style={style} />;
}
