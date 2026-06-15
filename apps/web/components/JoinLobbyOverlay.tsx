"use client";

import React, { useEffect, useState } from "react";

type Props = {
  lobbyId: string;
  lobbyName: string;
  themeable: boolean;
  memberPerks: string[];
  accentColor?: string;
  joinMode: string;
  onJoin: () => Promise<void>;
};

const DEFAULT_PERKS = [
  "Full themed lobby experience",
  "Create rooms in this lobby",
  "Enter verified tournaments",
  "Receive lobby announcements",
  "Member badge in lobby chat",
];

const SESSION_KEY = (lobbyId: string) => `weered:join-overlay-dismissed:${lobbyId}`;

export default function JoinLobbyOverlay({
  lobbyId,
  lobbyName,
  themeable,
  memberPerks,
  accentColor,
  joinMode,
  onJoin,
}: Props) {
  const [dismissed, setDismissed] = useState<boolean>(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    try {
      const d = sessionStorage.getItem(SESSION_KEY(lobbyId)) === "1";
      setDismissed(d);
    } catch {
      setDismissed(false);
    }
  }, [lobbyId]);

  if (joinMode !== "OPEN") return null;
  if (dismissed) return null;

  const perks = (memberPerks.length > 0 ? memberPerks : DEFAULT_PERKS).slice(0, 5);

  const accent = accentColor || "#7c9dff";

  async function handleJoin() {
    if (joining) return;
    setJoining(true);
    try {
      await onJoin();
    } finally {
      setJoining(false);
    }
  }

  function handleDismiss() {
    try {
      sessionStorage.setItem(SESSION_KEY(lobbyId), "1");
    } catch {}
    setDismissed(true);
  }

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-labelledby="join-overlay-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: `
          radial-gradient(ellipse at center, rgba(8,8,12,0.55) 0%, rgba(8,8,12,0.92) 70%)
        `,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        animation: "weered-overlay-fade-in 220ms ease-out",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          background: "linear-gradient(180deg, rgba(20,20,28,0.96) 0%, rgba(12,12,16,0.96) 100%)",
          border: `1px solid ${accent}44`,
          borderRadius: 16,
          padding: "28px 26px 22px",
          boxShadow: `
            0 24px 60px rgba(0,0,0,0.55),
            0 0 0 1px rgba(255,255,255,0.04),
            0 0 32px ${accent}22
          `,
          color: "#e8e8ea",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: accent,
            opacity: 0.9,
          }}
        >
          Become a member
        </p>

        <h2
          id="join-overlay-title"
          style={{
            margin: "8px 0 6px",
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1.2,
            color: "#fff",
          }}
        >
          Unlock the {lobbyName} experience
        </h2>

        <p
          style={{
            margin: "0 0 18px",
            fontSize: 14,
            opacity: 0.78,
            lineHeight: 1.5,
          }}
        >
          {themeable
            ? `Join to unlock the full ${lobbyName} look + everything below. One click, free, no commitment.`
            : `Join to unlock everything below. One click, free, no commitment.`}
        </p>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 22px",
            display: "grid",
            gap: 10,
          }}
        >
          {perks.map((perk, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontSize: 14,
                lineHeight: 1.45,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  marginTop: 2,
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  background: `${accent}22`,
                  border: `1px solid ${accent}66`,
                  color: accent,
                  fontSize: 11,
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✓
              </span>
              <span style={{ opacity: 0.92 }}>{perk}</span>
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            onClick={handleJoin}
            disabled={joining}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 10,
              border: "none",
              background: accent,
              color: "#0b0b10",
              fontSize: 14,
              fontWeight: 700,
              cursor: joining ? "default" : "pointer",
              boxShadow: `0 4px 18px ${accent}44`,
              transition: "transform .12s, box-shadow .12s, filter .12s",
              opacity: joining ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!joining) (e.currentTarget as HTMLElement).style.filter = "brightness(1.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.filter = "none";
            }}
          >
            {joining ? "Joining…" : `Join ${lobbyName}`}
          </button>
          <button
            onClick={handleDismiss}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "rgba(232,232,234,0.65)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "color .12s, background .12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(232,232,234,0.9)";
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(232,232,234,0.65)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            Maybe later
          </button>
        </div>

        <p
          style={{
            margin: "16px 0 0",
            fontSize: 11,
            opacity: 0.5,
            textAlign: "center",
          }}
        >
          Joining is one click. Free. You can leave anytime.
        </p>
      </div>

      <style>{`
        @keyframes weered-overlay-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
