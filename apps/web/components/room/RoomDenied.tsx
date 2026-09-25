"use client";

import React from "react";
import { useWeered } from "../WeeredProvider";

/**
 * The screen shown when a room refuses entry, saying WHY.
 *
 * It used to say "A moderator declined your request" for every refusal. That is
 * true only of a declined knock. A level-gated room (Room.minLevel: a crew room,
 * a staff room) refuses without any moderator involved, and blaming one tells
 * the visitor someone looked at them and said no, which did not happen.
 *
 * Extracted from RoomCanvas, which sits at the file-size tripwire.
 */
export default function RoomDenied({ roomIds }: { roomIds: string[] }) {
  const w: any = useWeered();
  const info = roomIds.map((id) => w?.deniedByRoom?.[id]).find(Boolean) || {};
  const lobby = w?.meta?.lobbyName ? String(w.meta.lobbyName) : "this community";
  const gated = info.reason === "level_required";
  const staff = gated && Number(info.minLevel) >= 4;

  const title = gated ? (staff ? "Staff only" : "Members only") : "Entry denied";
  const body = gated
    ? staff
      ? `This room is for ${lobby}'s staff.`
      : `This room opens once ${lobby}'s staff give you access.`
    : info.reason === "private_meeting"
      ? "This is a private meeting room."
      : "A moderator declined your request";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 200,
        background: "rgba(10,10,18,0.92)",
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 40 }}>{gated ? "🔒" : "🚫"}</div>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.5 }}>{body}</div>
      </div>
      <button
        onClick={() => {
          try {
            window.history.back();
          } catch {}
        }}
        style={{
          marginTop: 8,
          padding: "8px 20px",
          borderRadius: 9,
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.3)",
          color: "rgba(252,165,165,0.9)",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Go back
      </button>
    </div>
  );
}
