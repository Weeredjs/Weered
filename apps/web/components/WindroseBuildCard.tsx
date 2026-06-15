"use client";

import React from "react";

type Build = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  primaryColor: string | null;
  biome: string | null;
  buildType: string | null;
  difficulty: string | null;
  shipClass: string | null;
  upvotes: number;
  downvotes: number;
  views: number;
  saveCount: number;
  featured: boolean;
  primaryWidth: number | null;
  primaryHeight: number | null;
  imageCount?: number;
  author: { id: string; name: string; avatar: string | null; avatarColor: string | null };
};

const BIOME_LABEL: Record<string, string> = {
  PLAINS: "Plains",
  COAST: "Coast",
  CLIFFS: "Cliffs",
  SWAMP: "Swamp",
  CAVE: "Cave",
  MOUNTAIN: "Mountain",
  ISLAND: "Island",
};
const TYPE_LABEL: Record<string, string> = {
  SHIP: "Ship",
  DOCK: "Dock",
  FORTRESS: "Fortress",
  TAVERN: "Tavern",
  HIDEOUT: "Hideout",
  OUTPOST: "Outpost",
  BRIDGE: "Bridge",
  MISC: "Misc",
};

export default function WindroseBuildCard({
  build,
  onOpen,
  large = false,
}: {
  build: Build;
  onOpen: (slug: string) => void;
  large?: boolean;
}) {
  const aspect =
    build.primaryWidth && build.primaryHeight ? build.primaryWidth / build.primaryHeight : 4 / 3;
  const placeholderBg = build.primaryColor || "#1a1810";
  const score = build.upvotes - build.downvotes;
  const author = build.author;
  const initial = (author?.name || "?").slice(0, 1).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onOpen(build.slug)}
      className="weered-windrose-build-card"
      style={{
        position: "relative",
        width: "100%",
        padding: 0,
        borderRadius: 6,
        border: `2px solid ${build.featured ? "rgba(232,196,138,.85)" : "rgba(201,160,102,.32)"}`,
        background: placeholderBg,
        cursor: "pointer",
        overflow: "hidden",
        fontFamily: "inherit",
        textAlign: "left",
        boxShadow: build.featured
          ? "0 0 0 1px rgba(232,196,138,.5), 0 0 18px rgba(232,196,138,.2), 0 8px 22px rgba(0,0,0,.45)"
          : "0 4px 14px rgba(0,0,0,.35)",
        transition: "transform .15s, box-shadow .15s, border-color .15s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = build.featured
          ? "0 0 0 1px rgba(232,196,138,.7), 0 0 24px rgba(232,196,138,.32), 0 12px 28px rgba(0,0,0,.55)"
          : "0 0 0 1px rgba(201,160,102,.55), 0 8px 22px rgba(0,0,0,.55)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "none";
        el.style.boxShadow = build.featured
          ? "0 0 0 1px rgba(232,196,138,.5), 0 0 18px rgba(232,196,138,.2), 0 8px 22px rgba(0,0,0,.45)"
          : "0 4px 14px rgba(0,0,0,.35)";
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: String(aspect),
          background: placeholderBg,
          overflow: "hidden",
        }}
      >
        {build.thumbnailUrl && (
          <img
            src={build.thumbnailUrl}
            alt={build.title}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              opacity: 0,
              transition: "opacity .35s",
            }}
            onLoad={(e) => {
              (e.currentTarget as HTMLImageElement).style.opacity = "1";
            }}
          />
        )}

        {build.imageCount && build.imageCount > 1 ? (
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              padding: "2px 6px",
              borderRadius: 3,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.5px",
              background: "rgba(0,0,0,.65)",
              color: "rgba(232,196,138,.95)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              border: "1px solid rgba(232,196,138,.35)",
            }}
          >
            +{build.imageCount - 1}
          </span>
        ) : null}

        {build.featured && (
          <span
            title="Captain's Pick"
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              width: 30,
              height: 30,
              borderRadius: 999,
              background: "radial-gradient(circle, #b91c1c 0%, #7f1717 70%, #5a0e0e 100%)",
              border: "2px solid rgba(232,196,138,.85)",
              boxShadow: "0 2px 6px rgba(0,0,0,.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 900,
              color: "rgba(232,196,138,.95)",
              fontFamily: "ui-serif, Georgia, serif",
              letterSpacing: 0,
              transform: "rotate(-8deg)",
            }}
          >
            ★
          </span>
        )}

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "30px 10px 8px",
            background: "linear-gradient(180deg, transparent 0%, rgba(8,5,2,.85) 100%)",
            color: "rgba(243,244,246,.97)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-pirata, 'Pirata One'), serif",
              fontSize: large ? 22 : 16,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: 0.5,
              color: "#e4d4b0",
              textShadow: "0 1px 3px rgba(0,0,0,.7)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {build.title}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 10px",
          background: "linear-gradient(180deg, rgba(20,16,8,.92), rgba(10,8,4,.95))",
          borderTop: "1px solid rgba(201,160,102,.18)",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            flexShrink: 0,
            background: author.avatar
              ? "rgba(255,255,255,.08)"
              : author.avatarColor || "rgba(201,160,102,.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 800,
            color: "#fff",
            overflow: "hidden",
            border: "1px solid rgba(201,160,102,.45)",
          }}
        >
          {author.avatar ? (
            <img
              src={author.avatar}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initial
          )}
        </div>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(228,212,176,.85)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {author.name}
        </span>

        {build.buildType && (
          <span
            style={{
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: "1px",
              color: "rgba(232,196,138,.7)",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            {TYPE_LABEL[build.buildType] || build.buildType}
          </span>
        )}

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 10,
            fontWeight: 800,
            color: score > 0 ? "#4ade80" : score < 0 ? "#f87171" : "rgba(228,212,176,.5)",
            flexShrink: 0,
          }}
        >
          <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 1 L11 7 L8 7 L8 11 L4 11 L4 7 L1 7 Z" />
          </svg>
          {score}
        </span>
      </div>
    </button>
  );
}
