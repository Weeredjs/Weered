"use client";
import { useState, useEffect } from "react";
import { GlobalRole, S, StaffRoom, apiFetch, fmtDate } from "./shared";

export function RoomsTab({ myRole }: { myRole: GlobalRole }) {
  const [rooms, setRooms] = useState<StaffRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const canEdit = myRole === "STAFF" || myRole === "ADMIN" || myRole === "GOD";

  useEffect(() => {
    setLoading(true);
    apiFetch("/staff/rooms").then((j) => {
      setRooms(j.rooms || []);
      setLoading(false);
    });
  }, []);

  async function renameRoom(id: string) {
    const name = editName.trim();
    if (!name) return;
    const j = await apiFetch(`/staff/rooms/${encodeURIComponent(id)}/rename`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (j.ok) {
      setMsg(`Renamed → ${name}`);
      setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
      setEditId(null);
      setEditName("");
    } else setMsg(j.error || "Failed.");
  }

  async function togglePin(id: string, currentlyPinned: boolean) {
    const j = await apiFetch(`/staff/rooms/${encodeURIComponent(id)}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned: !currentlyPinned }),
    });
    if (j.ok) {
      setMsg(`${!currentlyPinned ? "Pinned" : "Unpinned"} room`);
      setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, pinned: !currentlyPinned } : r)));
    } else setMsg(j.error || "Failed.");
  }

  async function closeRoom(id: string, name: string) {
    if (!confirm(`Close room "${name || id}"? This will kick all users and delete the room.`))
      return;
    const j = await apiFetch(`/staff/rooms/${encodeURIComponent(id)}/close`, { method: "POST" });
    if (j.ok) {
      setMsg(`Closed ${name || id}`);
      setRooms((prev) => prev.filter((r) => r.id !== id));
    } else setMsg(j.error || "Failed.");
  }

  async function deleteRoom(id: string, name: string) {
    if (!confirm(`Delete room "${name || id}" from database?`)) return;
    const j = await apiFetch(`/staff/rooms/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (j.ok) {
      setMsg(`Deleted ${name || id}`);
      setRooms((prev) => prev.filter((r) => r.id !== id));
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
        <div style={{ fontSize: 13, opacity: 0.6 }}>{rooms.length} rooms total</div>
        {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}
      </div>
      {loading && <div style={{ opacity: 0.4 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rooms.map((r) => {
          const isPinned = Boolean((r as any).pinned);
          const liveUsers = (r as any).liveUsers || 0;
          const isEditing = editId === r.id;

          return (
            <div
              key={r.id}
              style={{
                ...S.card,
                borderColor: isPinned ? "rgba(245,158,11,.30)" : undefined,
                background: isPinned ? "rgba(245,158,11,.03)" : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: canEdit ? 8 : 0,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        style={{ ...S.input, flex: 1, fontSize: 13, fontWeight: 700 }}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && renameRoom(r.id)}
                        autoFocus
                      />
                      <button
                        style={{ ...S.btnPri, fontSize: 11, padding: "4px 8px" }}
                        onClick={() => renameRoom(r.id)}
                      >
                        Save
                      </button>
                      <button
                        style={{ ...S.btn, fontSize: 11, padding: "4px 8px" }}
                        onClick={() => {
                          setEditId(null);
                          setEditName("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {r.name || <span style={{ opacity: 0.4 }}>(unnamed)</span>}
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
                      {isPinned && (
                        <span
                          style={{
                            fontSize: 9,
                            padding: "1px 5px",
                            borderRadius: 999,
                            border: "1px solid rgba(245,158,11,.40)",
                            color: "rgb(253,230,138)",
                            background: "rgba(245,158,11,.12)",
                            fontWeight: 800,
                          }}
                        >
                          📌 PINNED
                        </span>
                      )}
                      {liveUsers > 0 && (
                        <span
                          style={{
                            fontSize: 9,
                            padding: "1px 5px",
                            borderRadius: 999,
                            border: "1px solid rgba(34,197,94,.30)",
                            color: "rgba(134,239,172,.85)",
                            background: "rgba(34,197,94,.08)",
                          }}
                        >
                          ● {liveUsers} live
                        </span>
                      )}
                    </div>
                  )}
                  <div
                    style={{ fontSize: 11, opacity: 0.4, marginTop: 2, fontFamily: "monospace" }}
                  >
                    {r.id}
                    {r.lobbyId ? ` · lobby: ${r.lobbyId}` : ""} · {r.members} members ·{" "}
                    {fmtDate(r.createdAt)}
                  </div>
                </div>
              </div>
              {canEdit && !isEditing && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <button
                    style={{ ...S.btn, fontSize: 11, padding: "4px 8px" }}
                    onClick={() => {
                      setEditId(r.id);
                      setEditName(r.name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    style={{
                      ...S.btn,
                      fontSize: 11,
                      padding: "4px 8px",
                      borderColor: isPinned ? "rgba(245,158,11,.50)" : "rgba(245,158,11,.25)",
                      color: "rgb(253,230,138)",
                      fontWeight: isPinned ? 800 : 400,
                    }}
                    onClick={() => togglePin(r.id, isPinned)}
                  >
                    {isPinned ? "📌 Unpin" : "Pin"}
                  </button>
                  <button
                    style={{ ...S.warn, fontSize: 11, padding: "4px 8px" }}
                    onClick={() => closeRoom(r.id, r.name)}
                  >
                    Close Room
                  </button>
                  <button
                    style={{ ...S.danger, fontSize: 11, padding: "4px 8px" }}
                    onClick={() => deleteRoom(r.id, r.name)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!rooms.length && !loading && (
          <div style={{ opacity: 0.4, fontSize: 13 }}>No rooms found.</div>
        )}
      </div>
    </div>
  );
}
