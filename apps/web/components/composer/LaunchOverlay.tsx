"use client";

// The create-lobby composer's launch overlay: claiming the address, painting
// the theme, opening the starter rooms, doors open (app/lobby/create).
import React from "react";
import { FAINT, MUTED, TEXT, alpha } from "./ui";
import { plural } from "../../lib/plural";

/** The step after a build (2026-11-12): a lobby nobody's in is a room with the
 *  lights on. Two strangers built lobbies that week, and neither invited a
 *  soul: the launch went straight on into Design mode. Now it stops here,
 *  with the link to send. */
function BringYourPeople({
  slug,
  accent,
  onDesign,
}: {
  slug: string;
  accent: string;
  onDesign?: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const link = `https://weered.ca/lobby/${slug}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {}
  };
  const share = async () => {
    try {
      await navigator.share({ title: "Come hang out", url: link });
    } catch {}
  };
  return (
    <div style={{ marginTop: 16, textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>Now bring your people</div>
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4, lineHeight: 1.45 }}>
        A lobby comes alive when they&apos;re in it. Send them this.
      </div>
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 6,
          alignItems: "center",
          padding: 6,
          borderRadius: 12,
          background: "rgba(255,255,255,.04)",
          border: `1px solid ${alpha(accent, 0.35)}`,
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12.5,
            color: TEXT,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "left",
            paddingLeft: 6,
          }}
        >
          weered.ca/lobby/{slug}
        </span>
        <button
          type="button"
          onClick={canShare ? share : copy}
          style={{
            padding: "7px 14px",
            borderRadius: 9,
            border: "none",
            background: accent,
            color: "#fff",
            fontWeight: 800,
            fontSize: 12.5,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {canShare ? "Share" : copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div style={{ fontSize: 11, color: FAINT, marginTop: 8 }}>
        A free lobby shows in Downtown once three people join.
      </div>
      {onDesign && (
        <button
          type="button"
          onClick={onDesign}
          style={{
            marginTop: 14,
            padding: "8px 16px",
            borderRadius: 10,
            border: `1px solid ${alpha(accent, 0.45)}`,
            background: "transparent",
            color: TEXT,
            fontWeight: 700,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          Design it →
        </button>
      )}
    </div>
  );
}

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
        {phase === "done" && <BringYourPeople slug={slug} accent={accent} onDesign={onDesign} />}
      </div>
    </div>
  );
}
