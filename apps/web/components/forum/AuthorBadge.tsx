"use client";
// Shared between a post header and every comment in the tree. Lives on its own
// so the recursive CommentNode can use it without importing PostDetail, which
// imports CommentNode.
import React from "react";
import { TIER_COLORS } from "./ForumHelpers";
import { avatarBg } from "../../lib/avatarColor";

export type Author = {
  name: string;
  avatar?: string;
  avatarColor?: string;
  tier?: string;
  globalRole?: string;
} | null;

export default function AuthorBadge({
  name,
  author,
  size = 20,
  authorId: _authorId,
  onHoverEnter,
  onHoverLeave,
}: {
  name: string;
  author: Author;
  size?: number;
  authorId?: string;
  onHoverEnter?: (e: React.MouseEvent) => void;
  onHoverLeave?: () => void;
}) {
  const aColor = author?.avatarColor || avatarBg(name);
  const tierColor = TIER_COLORS[author?.tier || "INNOCENT"] || "#94a3b8";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: onHoverEnter ? "pointer" : "default",
      }}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          flexShrink: 0,
          background: author?.avatar ? "transparent" : aColor,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.45,
          fontWeight: 900,
          color: "#fff",
        }}
      >
        {author?.avatar ? (
          <img
            src={author.avatar}
            alt={name + " avatar"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          name[0]?.toUpperCase()
        )}
      </div>
      <span style={{ fontWeight: 700, fontSize: 12 }}>{name}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: tierColor }}>{author?.tier}</span>
    </div>
  );
}
