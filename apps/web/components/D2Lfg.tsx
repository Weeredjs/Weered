"use client";
import { useState, useEffect, useCallback } from "react";
import EmptyState from "./EmptyState";
import { ACCENT_DESTINY, S, apiFetch } from "./D2Shared";

export const D2_ACTIVITIES = [
  "Raid: Crota's End",
  "Raid: Root of Nightmares",
  "Raid: King's Fall",
  "Raid: Vow of the Disciple",
  "Raid: Vault of Glass",
  "Raid: Garden of Salvation",
  "Dungeon: Warlord's Ruin",
  "Dungeon: Ghosts of the Deep",
  "Dungeon: Spire of the Watcher",
  "Nightfall: Grandmaster",
  "Nightfall: Legend",
  "Nightfall: Hero",
  "Trials of Osiris",
  "Iron Banner",
  "Crucible: Competitive",
  "Gambit",
  "Exotic Quest",
  "Campaign (Legendary)",
  "Other",
];

export const PLATFORMS = ["crossplay", "pc", "xbox", "psn"];

export function LfgBoard({ lobbyId }: { lobbyId: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activity, setActivity] = useState(D2_ACTIVITIES[0]);
  const [desc, setDesc] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [platform, setPlatform] = useState("crossplay");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`)
      .then((j) => {
        setPosts(j.posts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lobbyId]);

  useEffect(() => {
    load();
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, [load]);

  async function create() {
    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({ activity, description: desc, maxPlayers, platform }),
    });
    if (j.ok) {
      setShowForm(false);
      setDesc("");
      load();
    } else setMsg(j.message || j.error || "Failed");
  }

  async function join(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/join`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load();
    else setMsg(j.message || j.error || "Failed");
  }

  async function leave(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/leave`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load();
    else setMsg(j.message || j.error || "Failed");
  }

  if (loading)
    return (
      <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
        Loading fireteams...
      </div>
    );

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.6 }}>{posts.length} active fireteams</div>
        <button style={S.btnPri} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Create Fireteam"}
        </button>
      </div>
      {msg && <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.7 }}>{msg}</div>}

      {showForm && (
        <div
          style={{
            ...S.card,
            marginBottom: 14,
            border: `1px solid ${ACCENT_DESTINY}35`,
            background: `${ACCENT_DESTINY}08`,
          }}
        >
          <div style={S.label}>Activity</div>
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            style={{ ...S.input, marginBottom: 8, cursor: "pointer" }}
          >
            {D2_ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <div style={S.label}>Description (optional)</div>
          <input
            style={{ ...S.input, marginBottom: 8 }}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="KWTD, chill run, teaching..."
          />

          <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Max Players</div>
              <input
                type="number"
                style={S.input}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                min={2}
                max={12}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Platform</div>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                style={{ ...S.input, cursor: "pointer" }}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button style={{ ...S.btnPri, width: "100%", padding: "8px 0" }} onClick={create}>
            Post Fireteam
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {posts.map((p) => {
          const isFull = p.status === "FULL";
          const slots = `${(p.players || []).length}/${p.maxPlayers}`;
          return (
            <div
              key={p.id}
              style={{
                ...S.card,
                display: "flex",
                alignItems: "center",
                gap: 12,
                border: isFull
                  ? "1px solid rgba(245,158,11,.20)"
                  : "1px solid rgba(255,255,255,.08)",
                opacity: isFull ? 0.7 : 1,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {p.activity}
                  {isFull && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: "1px 5px",
                        borderRadius: 2,
                        background: "rgba(245,158,11,.12)",
                        border: "1px solid rgba(245,158,11,.25)",
                        color: "rgb(253,230,138)",
                      }}
                    >
                      FULL
                    </span>
                  )}
                </div>
                {p.description && (
                  <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>{p.description}</div>
                )}
                <div style={{ display: "flex", gap: 8, fontSize: 11, opacity: 0.5 }}>
                  <span>{p.platform}</span>
                  <span>by {p.userName}</span>
                  <span>{slots} guardians</span>
                </div>
                {(p.playerNames || []).length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {p.playerNames.map((n: string, i: number) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 2,
                          background: "rgba(79,136,198,.12)",
                          border: "1px solid rgba(79,136,198,.25)",
                          color: "rgba(147,197,253,.85)",
                        }}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                {!isFull && (
                  <button style={{ ...S.btnPri, fontSize: 11 }} onClick={() => join(p.id)}>
                    Join
                  </button>
                )}
                <button style={{ ...S.btn, fontSize: 11 }} onClick={() => leave(p.id)}>
                  Leave
                </button>
              </div>
            </div>
          );
        })}
        {posts.length === 0 && (
          <EmptyState title="No fireteams running." hint="Flag one up top and rally a crew." />
        )}
      </div>
    </div>
  );
}
