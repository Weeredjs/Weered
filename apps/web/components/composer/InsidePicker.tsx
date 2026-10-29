"use client";

// Steps 4 and 5: what's inside (feature switches) and the starter rooms.
import React from "react";
import { FEATURES, ROOM_PRESETS, type FeatureId } from "./catalog";
import { FAINT, MUTED, TEXT, alpha } from "./ui";

export function FeatureToggles({
  value,
  accent,
  onToggle,
}: {
  value: Record<FeatureId, boolean>;
  accent: string;
  onToggle: (id: FeatureId) => void;
}) {
  return (
    <div className="cz-feats">
      {FEATURES.map((f) => {
        const on = value[f.id];
        return (
          <button
            key={f.id}
            type="button"
            role="switch"
            aria-checked={on}
            className="cz-chip"
            onClick={() => onToggle(f.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 12px",
              borderRadius: 12,
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "inherit",
              color: TEXT,
              background: on ? alpha(accent, 0.1) : "rgba(255,255,255,.025)",
              border: `1px solid ${on ? alpha(accent, 0.45) : "rgba(255,255,255,.08)"}`,
              minWidth: 0,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 36,
                height: 36,
                flex: "0 0 36px",
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                fontSize: 17,
                background: on ? alpha(accent, 0.22) : "rgba(255,255,255,.05)",
                filter: on ? "none" : "grayscale(1) opacity(.6)",
                transition: "all .2s",
              }}
            >
              {f.icon}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 800, fontSize: 13 }}>{f.name}</span>
              <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 1 }}>
                {f.blurb}
              </span>
            </span>
            <span
              aria-hidden
              style={{
                width: 34,
                height: 20,
                flex: "0 0 34px",
                borderRadius: 99,
                background: on ? accent : "rgba(255,255,255,.12)",
                position: "relative",
                transition: "background .2s",
                boxShadow: on ? `0 0 12px ${alpha(accent, 0.5)}` : "none",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: on ? 16 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: 99,
                  background: "#fff",
                  transition: "left .2s cubic-bezier(.2,.8,.2,1)",
                }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function RoomChips({
  value,
  accent,
  onToggle,
}: {
  value: string[];
  accent: string;
  onToggle: (id: string) => void;
}) {
  const total = ROOM_PRESETS.filter((r) => value.includes(r.id)).reduce(
    (n, r) => n + r.names.length,
    0,
  );
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ROOM_PRESETS.map((r) => {
          const on = value.includes(r.id);
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={on}
              className="cz-chip"
              onClick={() => onToggle(r.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 14px 9px 10px",
                borderRadius: 99,
                cursor: "pointer",
                fontFamily: "inherit",
                color: on ? TEXT : MUTED,
                background: on ? alpha(accent, 0.16) : "rgba(255,255,255,.03)",
                border: `1px solid ${on ? alpha(accent, 0.6) : "rgba(255,255,255,.09)"}`,
                boxShadow: on ? `0 0 14px ${alpha(accent, 0.22)}` : "none",
              }}
            >
              <span aria-hidden style={{ fontSize: 15 }}>
                {on ? "✓" : r.icon}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{r.label}</span>
              <span style={{ fontSize: 10.5, color: FAINT, fontWeight: 700 }}>{r.hint}</span>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: FAINT, marginTop: 10 }}>
        {total === 0
          ? "No rooms yet. You can open them later from the lobby."
          : `${total} room${total === 1 ? "" : "s"} open the moment the lobby does.`}
      </div>
    </div>
  );
}
