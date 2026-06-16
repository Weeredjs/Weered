"use client";

import { useEffect, useState } from "react";
import { useRoomTyping } from "../WeeredProvider";

export function TypingIndicator({ roomId, meId }: { roomId: string; meId?: string }) {
  const liveTyping = useRoomTyping(roomId);
  const [, setTick] = useState(0);
  const fresh = Date.now() - 5000;
  const typing = liveTyping.filter((e: any) => e.userId !== meId && e.ts > fresh);
  useEffect(() => {
    if (!liveTyping.length) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [liveTyping.length]);
  if (!typing.length) return null;
  const names = typing.slice(0, 3).map((t: any) => t.name);
  const rest = typing.length - names.length;
  const label =
    names.length === 1
      ? `${names[0]} is typing\u2026`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing\u2026`
        : rest > 0
          ? `${names.join(", ")} and ${rest} other${rest === 1 ? "" : "s"} are typing\u2026`
          : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} are typing\u2026`;
  return (
    <div
      style={{
        padding: "4px 14px 2px",
        fontSize: 11,
        color: "var(--weered-muted, rgba(148,163,184,.70))",
        fontStyle: "italic",
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
        minHeight: 18,
      }}
    >
      <span style={{ display: "inline-flex", gap: 2 }}>
        <span
          style={{
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "currentColor",
            animation: "weered-typing 1.2s ease-in-out infinite",
          }}
        />
        <span
          style={{
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "currentColor",
            animation: "weered-typing 1.2s ease-in-out 0.2s infinite",
          }}
        />
        <span
          style={{
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "currentColor",
            animation: "weered-typing 1.2s ease-in-out 0.4s infinite",
          }}
        />
      </span>
      {label}
      <style>{`
        @keyframes weered-typing {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
