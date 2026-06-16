"use client";
import { useState, useEffect } from "react";
import { GlobalRole, S, StaffLobby, apiFetch } from "./shared";

export function LobbiesTab({ myRole }: { myRole: GlobalRole }) {
  const [lobbies, setLobbies] = useState<StaffLobby[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [featuredId, setFeaturedId] = useState("");
  const canEdit = myRole === "STAFF" || myRole === "ADMIN" || myRole === "GOD";

  useEffect(() => {
    setLoading(true);
    Promise.all([apiFetch("/staff/lobbies"), apiFetch("/staff/featured")]).then(
      ([lobbyData, featData]) => {
        setLobbies(lobbyData.lobbies || []);
        setFeaturedId(featData.featuredLobbyId || "");
        setLoading(false);
      },
    );
  }, []);

  async function togglePin(id: string, pinned: boolean) {
    const j = await apiFetch(`/staff/lobbies/${encodeURIComponent(id)}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned: !pinned }),
    });
    if (j.ok) {
      setMsg(`${!pinned ? "Pinned" : "Unpinned"} ${id}`);
      setLobbies((prev) => prev.map((l) => (l.id === id ? { ...l, pinned: !pinned } : l)));
    } else setMsg(j.error || "Failed.");
  }

  async function setFeatured(id: string) {
    const clearing = featuredId === id;
    const j = await apiFetch("/staff/featured", {
      method: "POST",
      body: JSON.stringify({ lobbyId: clearing ? "" : id }),
    });
    if (j.ok) {
      setFeaturedId(clearing ? "" : id);
      setMsg(clearing ? "Featured cleared" : `Featured → ${id}`);
    } else setMsg(j.error || "Failed.");
  }

  async function lockLobby(id: string) {
    const j = await apiFetch("/staff/lobby/lock", {
      method: "POST",
      body: JSON.stringify({ lobbyId: id }),
    });
    setMsg(j.ok ? `Locked ${id}` : j.error || "Failed.");
  }

  async function unlockLobby(id: string) {
    const j = await apiFetch("/staff/lobby/unlock", {
      method: "POST",
      body: JSON.stringify({ lobbyId: id }),
    });
    setMsg(j.ok ? `Unlocked ${id}` : j.error || "Failed.");
  }

  async function clearChat(id: string) {
    if (!confirm(`Clear all chat in ${id}?`)) return;
    const j = await apiFetch("/staff/lobby/clear-chat", {
      method: "POST",
      body: JSON.stringify({ lobbyId: id }),
    });
    setMsg(j.ok ? `Chat cleared in ${id}` : j.error || "Failed.");
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 13, opacity: 0.6 }}>{lobbies.length} lobbies</div>
          {featuredId && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(245,158,11,.12)",
                border: "1px solid rgba(245,158,11,.30)",
                color: "rgb(253,230,138)",
                fontWeight: 700,
              }}
            >
              Featured: {featuredId}
            </span>
          )}
        </div>
        {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}
      </div>
      {loading && <div style={{ opacity: 0.4 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lobbies.map((l) => {
          const isFeatured = featuredId === l.id;
          return (
            <div
              key={l.id}
              style={{
                ...S.card,
                borderColor: isFeatured ? "rgba(245,158,11,.35)" : undefined,
                background: isFeatured ? "rgba(245,158,11,.04)" : undefined,
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
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {l.name || l.id}
                    {l.pinned && (
                      <span
                        style={{
                          fontSize: 9,
                          padding: "1px 5px",
                          borderRadius: 999,
                          border: "1px solid rgba(124,58,237,.30)",
                          color: "rgba(216,180,254,.80)",
                          background: "rgba(124,58,237,.08)",
                        }}
                      >
                        PINNED
                      </span>
                    )}
                    {l.verified && (
                      <span
                        style={{
                          fontSize: 9,
                          padding: "1px 5px",
                          borderRadius: 999,
                          border: "1px solid rgba(16,185,129,.30)",
                          color: "rgba(110,231,183,.80)",
                          background: "rgba(16,185,129,.08)",
                        }}
                      >
                        VERIFIED
                      </span>
                    )}
                    {isFeatured && (
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
                        ★ FEATURED
                      </span>
                    )}
                  </div>
                  <div
                    style={{ fontSize: 11, opacity: 0.4, marginTop: 1, fontFamily: "monospace" }}
                  >
                    {l.id} · {l.moduleType} · {l.onlineCount} online
                  </div>
                </div>
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <button
                    style={
                      isFeatured
                        ? { ...S.warn, fontSize: 11, padding: "4px 8px", fontWeight: 800 }
                        : {
                            ...S.btn,
                            fontSize: 11,
                            padding: "4px 8px",
                            borderColor: "rgba(245,158,11,.25)",
                            color: "rgb(253,230,138)",
                          }
                    }
                    onClick={() => setFeatured(l.id)}
                  >
                    {isFeatured ? "★ Unfeature" : "☆ Set Featured"}
                  </button>
                  <button
                    style={{ ...S.btn, fontSize: 11, padding: "4px 8px" }}
                    onClick={() => togglePin(l.id, l.pinned)}
                  >
                    {l.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    style={{
                      ...S.btn,
                      fontSize: 11,
                      padding: "4px 8px",
                      borderColor: "rgba(245,158,11,.25)",
                      color: "rgb(253,230,138)",
                    }}
                    onClick={() => lockLobby(l.id)}
                  >
                    Lock Chat
                  </button>
                  <button
                    style={{
                      ...S.btn,
                      fontSize: 11,
                      padding: "4px 8px",
                      borderColor: "rgba(16,185,129,.25)",
                      color: "rgb(110,231,183)",
                    }}
                    onClick={() => unlockLobby(l.id)}
                  >
                    Unlock Chat
                  </button>
                  <button
                    style={{ ...S.danger, fontSize: 11, padding: "4px 8px" }}
                    onClick={() => clearChat(l.id)}
                  >
                    Clear Chat
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!lobbies.length && !loading && (
          <div style={{ opacity: 0.4, fontSize: 13 }}>No lobbies found.</div>
        )}
      </div>
    </div>
  );
}

export type ReportRow = {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: string;
  targetId: string;
  targetName: string | null;
  context: string | null;
  reason: string;
  note: string | null;
  status: string;
  bodySnapshot: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewerName: string | null;
};
