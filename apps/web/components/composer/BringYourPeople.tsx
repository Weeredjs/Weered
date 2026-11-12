"use client";

// The step after a build (2026-11-12): a lobby nobody's in is a room with the
// lights on. Two strangers built lobbies that week and neither invited a soul:
// the launch went straight on into Design mode. Now it stops here.
//
// What it hands over is a guest link (James: "Sounds good"): a friend types a
// name and is in, talking, with no account (api routes/guestJoin.ts). It is
// made here, for anyone, good for a week; each visit lasts up to 12 hours. The
// lasting link is underneath, for the people who'll make an account, and those
// are the ones Downtown's three counts. Share goes to WhatsApp, Facebook, a
// text or an email as well as the clipboard (components/ShareRow.tsx).

import React, { useEffect, useState } from "react";
import ShareRow from "../ShareRow";
import { shareText } from "../../lib/shareLinks";
import { FAINT, MUTED, TEXT, alpha } from "./ui";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
/** A guest link lives a week; a visit through it, 12 hours at most. */
export const GUEST_LINK_HOURS = 168;

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

/** Make the lobby's guest link. Null when it can't be made: the plain link stands in. */
export async function makeGuestLink(slug: string): Promise<string | null> {
  try {
    const r = await fetch(`${API}/invites`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        type: "GUEST",
        targetId: slug,
        maxUses: 0,
        ttlHours: GUEST_LINK_HOURS,
      }),
    });
    const j = await r.json();
    return j?.ok && typeof j.invite?.url === "string" ? j.invite.url : null;
  } catch {
    return null;
  }
}

export default function BringYourPeople({
  slug,
  name,
  accent,
  onDesign,
}: {
  slug: string;
  name: string;
  accent: string;
  onDesign?: () => void;
}) {
  const lasting = `https://weered.ca/lobby/${slug}`;
  // undefined while it's being made, null if it couldn't be.
  const [guest, setGuest] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    void makeGuestLink(slug).then((url) => alive && setGuest(url));
    return () => {
      alive = false;
    };
  }, [slug]);

  const link = guest || lasting;
  const isGuest = !!guest;
  const shown = link.replace(/^https:\/\//, "");
  return (
    <div style={{ marginTop: 16, textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>Now bring your people</div>
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4, lineHeight: 1.45 }}>
        {guest === undefined
          ? "A lobby comes alive when they're in it. Getting your link…"
          : isGuest
            ? "Send this. They walk in with just a name: no account, no download. It works for a week."
            : "A lobby comes alive when they're in it. Send them this."}
      </div>
      <div
        style={{
          marginTop: 12,
          padding: "8px 12px",
          borderRadius: 12,
          background: "rgba(255,255,255,.04)",
          border: `1px solid ${alpha(accent, 0.35)}`,
          fontSize: 12.5,
          color: TEXT,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        data-bring-link
      >
        {guest === undefined ? "…" : shown}
      </div>
      {guest !== undefined && (
        <div style={{ marginTop: 10 }}>
          <ShareRow url={link} text={shareText(name, isGuest)} accent={accent} compact />
        </div>
      )}
      {isGuest && (
        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>
          For people who&apos;ll stay, the lasting link asks for a free account:{" "}
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(lasting);
                setCopied(true);
                setTimeout(() => setCopied(false), 2200);
              } catch {}
            }}
            style={{
              background: "transparent",
              border: 0,
              padding: 0,
              color: TEXT,
              fontWeight: 700,
              fontSize: 11.5,
              cursor: "pointer",
              textDecoration: "underline",
              fontFamily: "inherit",
            }}
          >
            {copied ? "copied" : `weered.ca/lobby/${slug}`}
          </button>
        </div>
      )}
      <div style={{ fontSize: 11, color: FAINT, marginTop: 8 }}>
        A free lobby shows in Downtown once three people have joined with an account.
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
