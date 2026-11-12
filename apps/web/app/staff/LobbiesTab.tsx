"use client";
import { useState, useEffect } from "react";
import { GlobalRole, S, StaffLobby, apiFetch } from "./shared";
import { plural } from "../../lib/plural";

export function LobbiesTab({ myRole }: { myRole: GlobalRole }) {
  const [lobbies, setLobbies] = useState<StaffLobby[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [featuredId, setFeaturedId] = useState("");
  const canEdit = myRole === "STAFF" || myRole === "ADMIN" || myRole === "GOD";
  // Deleted lobbies, held 30 days before they're erased (api lib/lobbyDelete.ts).
  const [gone, setGone] = useState<
    { id: string; name: string; owner: string | null; deletedBy: string | null; erasedAt: string }[]
  >([]);

  useEffect(() => {
    setLoading(true);
    void Promise.all([apiFetch("/staff/lobbies"), apiFetch("/staff/featured")]).then(
      ([lobbyData, featData]) => {
        setLobbies(lobbyData.lobbies || []);
        setFeaturedId(featData.featuredLobbyId || "");
        setLoading(false);
      },
    );
    if (canEdit) void apiFetch("/staff/lobbies/deleted").then((j) => setGone(j?.lobbies || []));
  }, [canEdit]);

  async function deleteLobby(l: StaffLobby) {
    const reason = window.prompt(
      `Delete ${l.name || l.id}? It vanishes at once and is erased in 30 days; you can restore it until then. Reason (for the audit log):`,
    );
    if (reason === null) return;
    const j = await apiFetch(`/staff/lobbies/${encodeURIComponent(l.id)}/delete`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    if (j?.ok) {
      setLobbies((prev) => prev.filter((x) => x.id !== l.id));
      const g = await apiFetch("/staff/lobbies/deleted");
      setGone(g?.lobbies || []);
    }
    setMsg(
      j?.ok ? `Deleted ${l.id}. Restorable for 30 days.` : j?.message || j?.error || "Failed.",
    );
  }

  async function restore(id: string) {
    const j = await apiFetch(`/staff/lobbies/${encodeURIComponent(id)}/restore`, {
      method: "POST",
    });
    if (j?.ok) {
      setGone((prev) => prev.filter((x) => x.id !== id));
      const d = await apiFetch("/staff/lobbies");
      setLobbies(d?.lobbies || []);
    }
    setMsg(j?.ok ? `Restored ${id}.` : j?.message || "Failed.");
  }

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

  // Downtown's front rows: woven in among the busiest, so the town shows its range.
  async function toggleFrontRow(id: string, on: boolean) {
    const j = await apiFetch(`/staff/lobbies/${encodeURIComponent(id)}/front-row`, {
      method: "POST",
      body: JSON.stringify({ on: !on }),
    });
    if (j.ok) {
      setMsg(`${id} ${!on ? "is in" : "left"} Downtown's front row`);
      setLobbies((prev) => prev.map((l) => (l.id === id ? { ...l, frontRow: !on } : l)));
    } else
      setMsg(
        j.error === "lobby_unlisted"
          ? "Unlisted lobbies aren't in Downtown."
          : j.error || "Failed.",
      );
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

  // One switch, showing the lobby chat's real state (you couldn't see which
  // lobbies were locked: ops audit 2026-11-01).
  async function setLocked(id: string, locked: boolean) {
    const j = await apiFetch(`/staff/lobby/${locked ? "lock" : "unlock"}`, {
      method: "POST",
      body: JSON.stringify({ lobbyId: id }),
    });
    if (j.ok) setLobbies((prev) => prev.map((x) => (x.id === id ? { ...x, locked } : x)));
    setMsg(j.ok ? `${locked ? "Locked" : "Unlocked"} ${id}'s chat` : j.error || "Failed.");
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
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            {plural(lobbies.length, "lobby", "lobbies")}
          </div>
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
                    {l.id} · {l.moduleType} · {l.members ?? 0} member{l.members === 1 ? "" : "s"} ·{" "}
                    {l.onlineCount} in now
                    {l.locked ? " · chat locked" : ""}
                    {l.unlisted ? " · unlisted" : ""}
                    {l.frontRow ? " · front row" : ""}
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
                    disabled={l.unlisted && !isFeatured}
                    title={l.unlisted ? "Unlisted lobbies stay off Home" : undefined}
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
                      ...(l.frontRow ? S.success : S.btn),
                      fontSize: 11,
                      padding: "4px 8px",
                    }}
                    onClick={() => void toggleFrontRow(l.id, !!l.frontRow)}
                    disabled={l.unlisted && !l.frontRow}
                    title="Downtown's front rows: woven in among the busiest lobbies"
                  >
                    {l.frontRow ? "✓ Front row" : "Front row"}
                  </button>
                  <button
                    style={{ ...(l.locked ? S.success : S.warn), fontSize: 11, padding: "4px 8px" }}
                    onClick={() => void setLocked(l.id, !l.locked)}
                  >
                    {l.locked ? "Unlock chat" : "Lock chat"}
                  </button>
                  <button
                    style={{ ...S.danger, fontSize: 11, padding: "4px 8px" }}
                    onClick={() => clearChat(l.id)}
                  >
                    Clear Chat
                  </button>
                  <button
                    style={{ ...S.danger, fontSize: 11, padding: "4px 8px" }}
                    onClick={() => void deleteLobby(l)}
                  >
                    Delete
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
      {canEdit && gone.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
            Deleted · erased after 30 days
          </div>
          {gone.map((g) => (
            <div
              key={g.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.07)",
                marginBottom: 6,
                fontSize: 12,
              }}
            >
              <span>
                <b>{g.name || g.id}</b> · {g.id}
                {g.owner ? ` · owner ${g.owner}` : ""}
                {g.deletedBy ? ` · deleted by ${g.deletedBy}` : ""} · erased{" "}
                {new Date(g.erasedAt).toLocaleDateString()}
              </span>
              <button
                style={{ ...S.btn, fontSize: 11, padding: "4px 8px" }}
                onClick={() => void restore(g.id)}
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
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
