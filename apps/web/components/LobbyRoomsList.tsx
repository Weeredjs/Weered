"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "./WeeredProvider";

type AnyRoom = any;

function getRoomCount(room: AnyRoom): number | null {
  if (typeof room?.count === "number") return room.count;
  if (typeof room?.presenceCount === "number") return room.presenceCount;
  if (typeof room?.usersCount === "number") return room.usersCount;
  if (Array.isArray(room?.users)) return room.users.length;
  if (Array.isArray(room?.members)) return room.members.length;
  return null;
}

export default function LobbyRoomsList() {
  
  const clamp1: React.CSSProperties = { maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const w = useWeered() as any;
  const router = useRouter();

  const [q, setQ] = useState("");

  const rooms = useMemo(() => {
    const list = Array.isArray(w?.rooms) ? w.rooms : [];
    const qq = (q || "").trim().toLowerCase();
    if (!qq) return list;
    return list.filter((r: AnyRoom) => {
      const id = String(r?.id || "").toLowerCase();
      const nm = String(r?.name || "").toLowerCase();
      return id.includes(qq) || nm.includes(qq);
    });
  }, [q, w?.rooms]);

  
  // Publish rooms list to header search (UI-only)
  useEffect(() => {
    try {
      const payload = (rooms || []).map((r: any) => ({
        id: String(r?.id || ""),
        name: String(r?.name || r?.id || ""),
        locked: Boolean(r?.locked),
        count: getRoomCount(r),
      }));
      window.dispatchEvent(new CustomEvent("weered:rooms:updated", { detail: payload }));
    } catch {}
  }, [rooms]);
function go(roomId: string) {
    if (!roomId) return;
    router.push(`/room/${roomId}`);
  }

  function doJoin(room: AnyRoom) {
    const id = String(room?.id || "");
    if (!id) return;

    // Prefer provider functions if present
    if (room?.locked) {
      if (typeof w?.knock === "function") w.knock(id);
      else go(id);
    } else {
      if (typeof w?.join === "function") w.join(id);
      else go(id);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search rooms..."
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--weered-border)", minWidth: 240 }}
        />
        <div style={{ fontSize: 12, opacity: 0.7 }}>{rooms.length} shown</div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {rooms.map((r: AnyRoom) => {
          const id = String(r?.id || "");
          const name = String(r?.name || id || "Room");
          const locked = Boolean(r?.locked);
          const n = getRoomCount(r);
          const iconUrl  = r?.iconUrl ? String(r.iconUrl) : null;
          const bannerUrl= r?.bannerUrl ? String(r.bannerUrl) : null;
          const accent   = r?.accentColor ? String(r.accentColor) : null;
          const pinned   = Boolean(r?.pinned);
          const isEvent  = Boolean(r?.isEvent);

          const cardBorder = accent ? `${accent}55` : "var(--weered-border)";
          const cardBg     = accent ? `${accent}10` : "transparent";
          const iconBg     = accent ? `${accent}25` : "rgba(255,255,255,.05)";
          const iconBorder = accent ? `${accent}55` : "rgba(255,255,255,.10)";

          return (
            <div
              key={id || name}
              style={{
                position: "relative", overflow: "hidden",
                minWidth: 0, border: `1px solid ${cardBorder}`,
                background: cardBg,
                borderRadius: 12,
                padding: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                minHeight: 64,
              }}
              onClick={() => go(id)}
            >
              {bannerUrl && (
                <div aria-hidden style={{
                  position: "absolute", inset: 0,
                  backgroundImage: `url("${bannerUrl}")`,
                  backgroundSize: "cover", backgroundPosition: "center",
                  opacity: 0.65, pointerEvents: "none",
                }} />
              )}
              {bannerUrl && (
                <div aria-hidden style={{
                  position: "absolute", inset: 0,
                  background: `linear-gradient(90deg, rgba(10,12,20,.80) 0%, rgba(10,12,20,.45) 50%, rgba(10,12,20,.15) 100%)`,
                  pointerEvents: "none",
                }} />
              )}
              <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0, flex: 1, position: "relative", zIndex: 1 }}>
                <div style={{
                  width: 64, height: 64, flexShrink: 0,
                  borderRadius: 10, border: `1px solid ${iconBorder}`,
                  background: iconUrl ? "rgba(0,0,0,.25)" : iconBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden", color: accent || "rgba(243,244,246,.65)",
                  fontSize: 24,
                }}>
                  {iconUrl
                    ? <img src={iconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : (isEvent ? "🔥" : pinned ? "📌" : "◆")}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </div>
                    {locked ? (
                      <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--weered-border)", opacity: 0.85 }}>
                        Locked
                      </span>
                    ) : null}
                    {typeof n === "number" ? (
                      <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--weered-border)", opacity: 0.85 }}>
                        {n} online
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative", zIndex: 1 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); doJoin(r); }}
                  style={{
                    padding: "8px 10px", borderRadius: 10,
                    border: `1px solid ${accent ? `${accent}66` : "var(--weered-border)"}`,
                    background: accent ? `${accent}18` : "transparent",
                    color: accent || undefined,
                  }}
                >
                  {locked ? "Knock" : "Join"}
                </button>
              </div>
            </div>
          );
        })}

        {rooms.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7, padding: 8 }}>No rooms found.</div>
        ) : null}
      </div>
    </div>
  );
}


