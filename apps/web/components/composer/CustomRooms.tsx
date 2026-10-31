"use client";

// Starter rooms by name, once Describe it has named them: drop one, add one,
// click a room's icon to change how it opens. "Use the presets" goes back to
// the preset chips (InsidePicker's RoomChips).
import React, { useState } from "react";
import type { RoomKind } from "../../lib/aiBuild";
import { FAINT, MUTED, TEXT, alpha, inputStyle } from "./ui";

const KINDS: { id: RoomKind; icon: string; name: string }[] = [
  { id: "voice", icon: "🎙", name: "Voice" },
  { id: "video", icon: "📹", name: "Video" },
  { id: "screen", icon: "🖥", name: "Screen share" },
  { id: "youtube", icon: "▶", name: "Watch party" },
  { id: "text", icon: "#", name: "Chat only" },
];
const KIND = Object.fromEntries(KINDS.map((k) => [k.id, k])) as Record<RoomKind, (typeof KINDS)[0]>;
/** POST /rooms allows 8 an hour. */
export const MAX_ROOMS = 8;

export default function CustomRooms({
  rooms,
  accent,
  onChange,
  onPresets,
}: {
  rooms: { name: string; kind: RoomKind }[];
  accent: string;
  onChange: (rooms: { name: string; kind: RoomKind }[]) => void;
  onPresets: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<RoomKind>("voice");
  const full = rooms.length >= MAX_ROOMS;
  const add = () => {
    const n = draft.trim().slice(0, 40);
    if (!n || full || rooms.some((r) => r.name.toLowerCase() === n.toLowerCase())) return;
    onChange([...rooms, { name: n, kind }]);
    setDraft("");
  };
  const next = (k: RoomKind) => KINDS[(KINDS.findIndex((x) => x.id === k) + 1) % KINDS.length].id;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {rooms.map((r, i) => (
          <span
            key={r.name}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px 6px 6px",
              borderRadius: 99,
              color: TEXT,
              fontSize: 13.5,
              fontWeight: 700,
              background: alpha(accent, 0.16),
              border: `1px solid ${alpha(accent, 0.6)}`,
            }}
          >
            <button
              type="button"
              className="cz-chip"
              title={`${KIND[r.kind].name}. Click to change how it opens.`}
              onClick={() =>
                onChange(rooms.map((x, j) => (j === i ? { ...x, kind: next(x.kind) } : x)))
              }
              style={{
                width: 26,
                height: 26,
                borderRadius: 99,
                border: "none",
                cursor: "pointer",
                background: "rgba(255,255,255,.08)",
                color: TEXT,
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              {KIND[r.kind].icon}
            </button>
            {r.name}
            <button
              type="button"
              className="cz-chip"
              aria-label={`Remove ${r.name}`}
              onClick={() => onChange(rooms.filter((_, j) => j !== i))}
              style={{
                border: "none",
                background: "none",
                color: MUTED,
                cursor: "pointer",
                fontSize: 12,
                padding: "0 4px",
              }}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={full ? "That's 8, the most to start with" : "Add a room"}
          maxLength={40}
          disabled={full}
          aria-label="New room name"
          style={{ ...inputStyle, flex: "1 1 180px", minWidth: 0 }}
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as RoomKind)}
          aria-label="How it opens"
          style={{ ...inputStyle, flex: "0 0 auto", width: "auto" }}
        >
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.icon} {k.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="cz-btn"
          disabled={full || !draft.trim()}
          style={{
            padding: "0 16px",
            borderRadius: 10,
            border: `1px solid ${alpha(accent, 0.55)}`,
            background: alpha(accent, 0.2),
            color: TEXT,
            fontWeight: 800,
            fontFamily: "inherit",
            cursor: full || !draft.trim() ? "default" : "pointer",
            opacity: full || !draft.trim() ? 0.5 : 1,
          }}
        >
          Add
        </button>
      </form>
      <div style={{ fontSize: 11.5, color: FAINT, marginTop: 10 }}>
        {rooms.length} of {MAX_ROOMS} to start with. Click a room&apos;s icon to change how it
        opens.{" "}
        <button
          type="button"
          className="cz-btn"
          onClick={onPresets}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: MUTED,
            textDecoration: "underline",
            textUnderlineOffset: 2,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 11.5,
          }}
        >
          Use the presets instead
        </button>
      </div>
    </div>
  );
}
