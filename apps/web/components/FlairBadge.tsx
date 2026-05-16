"use client";

import React from "react";

export type FlairKind = "BADGE" | "BANNER" | "NAMEPLATE";

export interface FlairData {
  id?: string;
  kind: FlairKind | string;
  name: string;
  imageUrl?: string | null;
  color?: string | null;
  rarity?: string;
  slug?: string;
}

export interface FlairBadgeProps {
  flair: FlairData | null | undefined;
  size?: "sm" | "md" | "lg";
  // For NAMEPLATE: wrap this child name span and apply tinted color/glow.
  children?: React.ReactNode;
}

const SIZE_PX: Record<string, number> = { sm: 14, md: 18, lg: 24 };

const RARITY_RING: Record<string, string> = {
  LEGENDARY: "rgba(250,204,21,.55)",
  EPIC: "rgba(167,139,250,.55)",
  RARE: "rgba(96,165,250,.45)",
  COMMON: "rgba(148,163,184,.35)",
};

export default function FlairBadge({ flair, size = "sm", children }: FlairBadgeProps) {
  if (!flair) {
    if (children) return <>{children}</>;
    return null;
  }
  const px = SIZE_PX[size] || SIZE_PX.sm;
  const ring = RARITY_RING[String(flair.rarity || "COMMON").toUpperCase()] || RARITY_RING.COMMON;
  const tint = flair.color || "#a78bfa";

  if (flair.kind === "NAMEPLATE") {
    // Wrap children name in tinted span. If no children, render a small dot.
    if (children) {
      return (
        <span
          title={flair.name}
          style={{
            color: tint,
            textShadow: `0 0 6px ${tint}55`,
            fontWeight: "inherit",
          }}
        >
          {children}
        </span>
      );
    }
    return (
      <span
        title={flair.name}
        aria-label={flair.name}
        style={{
          display: "inline-block",
          width: Math.round(px * 0.55),
          height: Math.round(px * 0.55),
          borderRadius: "50%",
          background: tint,
          boxShadow: `0 0 6px ${tint}88`,
          verticalAlign: "middle",
          flexShrink: 0,
        }}
      />
    );
  }

  if (flair.kind === "BANNER") {
    // Wide image block. Falls back to a tinted gradient strip.
    return (
      <div
        title={flair.name}
        aria-label={flair.name}
        style={{
          width: "100%",
          height: size === "lg" ? 80 : size === "md" ? 56 : 32,
          borderRadius: 10,
          overflow: "hidden",
          border: `1px solid ${ring}`,
          background: flair.imageUrl
            ? `center/cover no-repeat url("${flair.imageUrl}")`
            : `linear-gradient(135deg, ${tint}33, ${tint}11)`,
        }}
      />
    );
  }

  // BADGE — small chip. Emoji renders bare (the glyph IS the visual).
  // Image renders inside a tinted ringed chip. Fallback dot when neither.
  const isEmoji = flair.imageUrl?.startsWith("emoji:");
  if (isEmoji) {
    return (
      <span
        title={`${flair.name}${flair.rarity ? ` (${flair.rarity.toLowerCase()})` : ""}`}
        aria-label={flair.name}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.round(px * 1.0),
          lineHeight: 1,
          fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif",
          flexShrink: 0,
          verticalAlign: "middle",
        }}
      >{flair.imageUrl!.slice(6)}</span>
    );
  }
  return (
    <span
      title={`${flair.name}${flair.rarity ? ` (${flair.rarity.toLowerCase()})` : ""}`}
      aria-label={flair.name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: px,
        height: px,
        borderRadius: 999,
        border: `1px solid ${ring}`,
        background: tint ? `${tint}22` : "rgba(255,255,255,.06)",
        flexShrink: 0,
        verticalAlign: "middle",
        overflow: "hidden",
      }}
    >
      {flair.imageUrl ? (
        <img
          src={flair.imageUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <span
          style={{
            display: "inline-block",
            width: "60%",
            height: "60%",
            borderRadius: "50%",
            background: tint,
            boxShadow: `0 0 4px ${tint}99`,
          }}
        />
      )}
    </span>
  );
}
