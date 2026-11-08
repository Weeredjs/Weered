"use client";

import { useEffect, useState } from "react";
import FlairBadge from "../FlairBadge";
import CrewBadge, { type CrewLook } from "../crew/CrewBadge";
import { useEquippedFlair } from "../../lib/useEquippedFlair";
import { API } from "./chatShared";

export function ChatFlair({ userId, size = "sm" }: { userId: string; size?: "sm" | "md" | "lg" }) {
  const f = useEquippedFlair(userId);
  if (!f || f.kind !== "BADGE") return null;
  return <FlairBadge flair={f} size={size} />;
}

// The crew badge beside a name in chat and the member list: the crew's tag on its
// plate (crew/CrewBadge.tsx), never its logo squeezed into a square.
export type CrewFlairData = CrewLook | null;
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
      void existing.then(() => setFlair(crewFlairCache.get(userId) ?? null));
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
                name: String(pc.name || ""),
                accentColor: pc.accentColor || null,
                tagShape: pc.tagShape || null,
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
  return <CrewBadge crew={flair} size={size} />;
}
