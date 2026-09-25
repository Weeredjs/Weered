"use client";

import React from "react";

/**
 * A lobby role icon: an emoji (the original, and still the default), or an
 * image Weered hosts under /brand/.
 *
 * Images are allowed ONLY as same-origin /brand/ paths, never as URLs. That
 * keeps a lobby admin from pointing every member's browser at a server of
 * their choosing, and the API enforces the same rule when the map is saved
 * (cleanRoleIcons in apps/api/src/lib/lobbyRoles.ts). First used for vOCN's
 * rank badges, 2026-09-25.
 */
export function isRoleIconPath(v: unknown): v is string {
  return typeof v === "string" && /^\/brand\/[A-Za-z0-9_\-/]+\.(svg|png|webp)$/.test(v);
}

export default function RoleGlyph({ icon, size = 14 }: { icon?: string | null; size?: number }) {
  if (!icon) return null;
  if (isRoleIconPath(icon))
    return (
      <img
        src={icon}
        alt=""
        width={size}
        height={size}
        style={{ display: "inline-block", verticalAlign: "-2px", objectFit: "contain" }}
      />
    );
  return <>{icon}</>;
}
