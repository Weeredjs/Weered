"use client";

import { useEffect, useState } from "react";
import FlairBadge from "../FlairBadge";
import { useEquippedFlair } from "../../lib/useEquippedFlair";
import { API } from "./chatShared";

export function ChatFlair({ userId, size = "sm" }: { userId: string; size?: "sm" | "md" | "lg" }) {
  const f = useEquippedFlair(userId);
  if (!f || f.kind !== "BADGE") return null;
  return <FlairBadge flair={f as any} size={size} />;
}

export type CrewFlairData = {
  tag: string;
  logoUrl: string | null;
  accentColor: string | null;
} | null;
const crewFlairCache = new Map<string, CrewFlairData>();
const crewFlairInflight = new Map<string, Promise<void>>();

export function CrewFlair({ userId, size = 13 }: { userId: string; size?: number }) {
  const [flair, setFlair] = useState<CrewFlairData | undefined>(() =>
    crewFlairCache.has(userId) ? crewFlairCache.get(userId)! : undefined,
  );
  useEffect(() => {
    if (flair !== undefined) return;
    if (!userId) return;
    const existing = crewFlairInflight.get(userId);
    if (existing) {
      existing.then(() => setFlair(crewFlairCache.get(userId) ?? null));
      return;
    }
    const token = (typeof window !== "undefined" ? localStorage.getItem("weered_token") : "") || "";
    const p = fetch(`${API}/profile/${encodeURIComponent(userId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => {
        const pc = j?.primaryCrew;
        crewFlairCache.set(
          userId,
          pc
            ? {
                tag: String(pc.tag || ""),
                logoUrl: pc.logoUrl || null,
                accentColor: pc.accentColor || null,
              }
            : null,
        );
      })
      .catch(() => {
        crewFlairCache.set(userId, null);
      })
      .finally(() => {
        crewFlairInflight.delete(userId);
        setFlair(crewFlairCache.get(userId) ?? null);
      });
    crewFlairInflight.set(userId, p);
  }, [userId, flair]);
  if (!flair) return null;
  const accent =
    flair.accentColor && /^#[0-9a-f]{6}$/i.test(flair.accentColor)
      ? flair.accentColor
      : "rgba(201,160,102,0.7)";
  if (flair.logoUrl) {
    return (
      <span
        title={`Crew: [${flair.tag || ""}]`}
        style={{
          width: size,
          height: size,
          borderRadius: 3,
          display: "inline-block",
          backgroundImage: `url(${flair.logoUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          border: `1px solid ${accent}`,
          flexShrink: 0,
        }}
      />
    );
  }
  if (flair.tag) {
    return (
      <span
        title={`Crew: [${flair.tag}]`}
        style={{
          fontSize: Math.max(8, size - 4),
          fontWeight: 800,
          letterSpacing: "1px",
          padding: "0 4px",
          borderRadius: 2,
          color: accent,
          border: `1px solid ${accent}`,
          fontFamily: "ui-monospace, monospace",
          lineHeight: `${size}px`,
        }}
      >
        {flair.tag}
      </span>
    );
  }
  return null;
}
