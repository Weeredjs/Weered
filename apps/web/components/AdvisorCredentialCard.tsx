"use client";

import React, { useMemo } from "react";
import { useWeered } from "./WeeredProvider";

const SERIF = "Georgia, 'Iowan Old Style', Cambria, 'Times New Roman', serif";
const UI_SANS = "'Segoe UI', Inter, system-ui, -apple-system, sans-serif";

function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

/**
 * Quiet identity card for the office context. Replaces the gamer UserCorner
 * inside mtg-* rooms and on the office host. No score, tier, crew, status,
 * or burner: name, hairline, credential lines. That is the whole card.
 */
export default function AdvisorCredentialCard() {
  const { me } = useWeered() as any;

  const name = useMemo(() => pickFirstString(me?.name, me?.username, "Advisor"), [me]);
  const avatarUrl: string | null = typeof me?.avatar === "string" && me.avatar ? me.avatar : null;
  const initial = (name || "A").trim().slice(0, 1).toUpperCase();

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 10,
        background: "#122A4A",
        border: "1px solid #1E3A5F",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 8px 24px rgba(0,0,0,.35)",
        padding: "17px 16px 14px",
        marginBottom: 4,
        overflow: "hidden",
      }}
    >
      {/* Satin brass rule: the single gold accent on this surface. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: "linear-gradient(180deg,#D9B878,#C6A15B 55%,#A8853F)",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          aria-hidden={!avatarUrl}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            flexShrink: 0,
            background: "#0A1D35",
            border: "1px solid #1E3A5F",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            color: "rgba(236,242,250,.95)",
            fontFamily: SERIF,
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name + " portrait"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initial
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontVariantNumeric: "tabular-nums lining-nums",
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "0.01em",
              lineHeight: 1.2,
              color: "rgba(236,242,250,.95)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={name}
          >
            {name}
          </div>
        </div>
      </div>

      <div aria-hidden style={{ height: 1, background: "#1E3A5F", margin: "13px 0 10px" }} />

      {/* Deliberately minimal (per James): the name, the anchor, the firm. No titles,
          no licence lines. True for anyone in the room, so guests are never
          mis-credentialed. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontFamily: UI_SANS,
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(163,180,202,.78)",
          lineHeight: 1.5,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <img
          src="/brand/eceb-anchor-chrome.svg"
          alt=""
          aria-hidden
          style={{ width: 13, height: 13, flexShrink: 0, opacity: 0.9 }}
        />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          East Coast Employee Benefits
        </span>
      </div>
    </div>
  );
}
