"use client";
import { useState } from "react";
import { weeredConfirm } from "../../../../lib/confirm";
import { AdminRoom, S, apiFetch } from "./shared";

export function RoomsTab({
  lobbyId,
  initialRooms,
  perms,
  onRefresh,
}: {
  lobbyId: string;
  initialRooms: AdminRoom[];
  perms: string[];
  onRefresh: () => void;
}) {
  const [rooms, setRooms] = useState(initialRooms);
  const [msg, setMsg] = useState("");
  const canManage = perms.includes("manage_rooms");

  async function deleteRoom(roomId: string, name: string) {
    const ok = await weeredConfirm({
      title: `Delete room "${name}"?`,
      body: "Every user in the room gets kicked and the room is removed from the lobby.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const j = await apiFetch(
      `/lobbies/${encodeURIComponent(lobbyId)}/admin/rooms/${encodeURIComponent(roomId)}`,
      { method: "DELETE" },
    );
    if (j.ok) {
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      setMsg(`Deleted ${name}`);
      onRefresh();
    } else setMsg(j.error || "Failed.");
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.6 }}>{rooms.length} rooms in this lobby</div>
        {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {rooms.map((r) => (
          <div key={r.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {r.name}
                {r.locked && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 5px",
                      borderRadius: 999,
                      border: "1px solid rgba(239,68,68,.30)",
                      color: "rgba(252,165,165,.80)",
                      background: "rgba(239,68,68,.08)",
                    }}
                  >
                    LOCKED
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2, fontFamily: "monospace" }}>
                {r.onlineCount} online · {r.memberCount} members
              </div>
            </div>
            {canManage && (
              <button
                style={{ ...S.danger, flexShrink: 0, fontSize: 11 }}
                onClick={() => deleteRoom(r.id, r.name)}
              >
                Delete
              </button>
            )}
          </div>
        ))}
        {rooms.length === 0 && (
          <div style={{ opacity: 0.4, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
            No rooms yet. Users will create rooms when they visit your lobby.
          </div>
        )}
      </div>
    </div>
  );
}
