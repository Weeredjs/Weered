"use client";

// Send a link somewhere: WhatsApp, Facebook, a text, an email, the device's
// own share sheet, or copied (James 2026-11-12: "Share it to facebook or
// whatsapp instead of just the link?"). Used wherever a link is handed out:
// after a build (composer/LaunchOverlay.tsx) and in Invite (InviteModal.tsx).
// Text shows on phones only, where "sms:" opens the messages app.

import React, { useEffect, useState } from "react";
import { shareHref, type ShareTarget } from "../lib/shareLinks";

// Small marks in each service's own colour. Plain shapes: a speech bubble for
// WhatsApp (its green), Facebook's f, a message bubble, an envelope.
const MARKS: Record<ShareTarget, { label: string; color: string; fill?: string; stroke?: string }> =
  {
    whatsapp: {
      label: "WhatsApp",
      color: "#25D366",
      fill: "M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.9-1.2A9.5 9.5 0 1 0 12 2.5Z",
    },
    facebook: {
      label: "Facebook",
      color: "#1877F2",
      fill: "M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z",
    },
    sms: {
      label: "Text",
      color: "#a78bfa",
      stroke: "M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
    },
    email: {
      label: "Email",
      color: "#f5c450",
      stroke:
        "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm-.5 1.5L12 13l8.5-5.5",
    },
  };

export default function ShareRow({
  url,
  text,
  accent = "#7c3aed",
  compact = false,
}: {
  url: string;
  /** The line that goes with the link. */
  text: string;
  accent?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  // After mount, so the server and the first paint agree.
  const [phone, setPhone] = useState(false);
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    try {
      setPhone(window.matchMedia("(pointer: coarse)").matches);
      setSheet(typeof navigator.share === "function");
    } catch {}
  }, []);

  const targets: ShareTarget[] = phone
    ? ["whatsapp", "facebook", "sms", "email"]
    : ["whatsapp", "facebook", "email"];
  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: compact ? "6px 10px" : "7px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(255,255,255,.05)",
    color: "rgba(243,244,246,.94)",
    fontSize: 12.5,
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: "inherit",
  };
  return (
    <div
      className="weered-share-row"
      role="group"
      aria-label="Share this link"
      style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}
    >
      {targets.map((t) => (
        <a
          key={t}
          href={shareHref(t, url, text)}
          target={t === "sms" || t === "email" ? undefined : "_blank"}
          rel="noopener noreferrer"
          style={pill}
          data-share={t}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
            {MARKS[t].fill ? (
              <path d={MARKS[t].fill} fill={MARKS[t].color} />
            ) : (
              <path
                d={MARKS[t].stroke}
                fill="none"
                stroke={MARKS[t].color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
          {MARKS[t].label}
        </a>
      ))}
      <button
        type="button"
        style={{ ...pill, borderColor: accent }}
        data-share="copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2200);
          } catch {}
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
      {sheet && (
        <button
          type="button"
          style={pill}
          data-share="more"
          onClick={() => void navigator.share({ text, url }).catch(() => {})}
        >
          More…
        </button>
      )}
    </div>
  );
}
