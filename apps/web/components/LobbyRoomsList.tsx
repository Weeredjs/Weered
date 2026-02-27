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

          return (
            <div
              key={id || name}
              style={{
                minWidth: 0, border: "1px solid var(--weered-border)",
                borderRadius: 12,
                padding: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
              }}
              onClick={() => go(id)}
            >
              <div style={{ minWidth: 0 }}>
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

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); doJoin(r); }}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--weered-border)" }}
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

