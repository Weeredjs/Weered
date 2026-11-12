"use client";

// The create-lobby composer's launch overlay: claiming the address, painting
// the theme, opening the starter rooms, doors open (app/lobby/create).
import React from "react";
import { FAINT, MUTED, TEXT, alpha } from "./ui";
import BringYourPeople from "./BringYourPeople";
import { plural } from "../../lib/plural";

export default function LaunchOverlay({
  phase,
  name,
  slug,
  presetName,
  roomProgress,
  roomCount,
  accent,
  onDesign,
}: {
  phase: "creating" | "rooms" | "done";
  name: string;
  slug: string;
  presetName: string;
  roomProgress: { made: number; tried: number; total: number };
  roomCount: number;
  accent: string;
  /** Carry on into Design mode. */
  onDesign?: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Creating your lobby"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(3,4,10,.72)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="cz-anim"
        style={{
          width: "100%",
          maxWidth: 380,
          borderRadius: 20,
          padding: "26px 22px",
          background: `radial-gradient(90% 70% at 50% 0%, ${alpha(accent, 0.3)}, transparent 70%), #0b0b14`,
          border: `1px solid ${alpha(accent, 0.45)}`,
          boxShadow: `0 30px 90px ${alpha(accent, 0.45)}`,
          animation: "cz-pop .4s both",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: "-0.5px",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          {phase === "done" ? `${name.trim()} is open 🎉` : "Building your lobby…"}
        </div>
        {[
          { label: `Claiming weered.ca/lobby/${slug}`, done: phase !== "creating" },
          { label: `Painting it ${presetName}`, done: phase !== "creating" },
          {
            label:
              roomProgress.total === 0
                ? "No starter rooms"
                : phase === "rooms"
                  ? `Opening rooms ${roomProgress.tried}/${roomProgress.total}`
                  : phase === "done"
                    ? `${roomProgress.made} of ${plural(roomProgress.total, "room")} open`
                    : `Opening ${plural(roomCount, "room")}`,
            done: phase === "done",
          },
          { label: "Doors open", done: phase === "done" },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 0",
              fontSize: 13.5,
              color: s.done ? TEXT : MUTED,
            }}
          >
            <span
              aria-hidden
              className="cz-anim"
              style={{
                width: 20,
                height: 20,
                flex: "0 0 20px",
                borderRadius: 99,
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 900,
                background: s.done ? accent : "transparent",
                border: s.done ? "none" : `2px solid ${alpha(accent, 0.4)}`,
                borderTopColor: s.done ? undefined : accent,
                animation: s.done ? "cz-pop .3s both" : "cz-spin .8s linear infinite",
                color: "#fff",
              }}
            >
              {s.done ? "✓" : ""}
            </span>
            {s.label}
          </div>
        ))}
        {phase === "done" && roomProgress.made < roomProgress.total && (
          <div style={{ fontSize: 11.5, color: FAINT, marginTop: 8 }}>
            Some rooms didn&apos;t open. Add them from the lobby in a moment.
          </div>
        )}
        {phase === "done" && (
          <BringYourPeople slug={slug} name={name} accent={accent} onDesign={onDesign} />
        )}
      </div>
    </div>
  );
}
