"use client";

import React, { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#FFD700";

const ROLES = [
  "Spear Specialist",
  "Breach Specialist",
  "Eagle Commander",
  "Pelican-1 Driver",
  "Sample Runner",
  "Stalker Hunter",
  "Bot Caller",
  "Bug Caller",
];

const DIFFICULTIES = [
  "Trivial",
  "Easy",
  "Medium",
  "Challenging",
  "Hard",
  "Extreme",
  "Suicide Mission",
  "Impossible",
  "Helldive",
  "Super Helldive",
];

const FACTIONS = ["Terminids", "Automatons", "Illuminate", "Any"];

const ROLE_COLOR = "#FFD700";
const DIFFICULTY_COLORS: Record<string, string> = {
  Trivial: "#4ADE80",
  Easy: "#86EFAC",
  Medium: "#FACC15",
  Challenging: "#FB923C",
  Hard: "#F97316",
  Extreme: "#EF4444",
  "Suicide Mission": "#DC2626",
  Impossible: "#B91C1C",
  Helldive: "#7F1D1D",
  "Super Helldive": "#000000",
};
const FACTION_COLORS: Record<string, string> = {
  Terminids: "#F97316",
  Automatons: "#EF4444",
  Illuminate: "#A855F7",
  Any: "#94A3B8",
};

const FACTION_SHORT: Record<string, string> = {
  Terminids: "Bugs",
  Automatons: "Bots",
  Illuminate: "Squids",
  Any: "Any",
};
const FACTION_FROM_SHORT: Record<string, string> = {
  Bugs: "Terminids",
  Bots: "Automatons",
  Squids: "Illuminate",
  Any: "Any",
};

const ALL_TAG_TOKENS = new Set<string>([
  ...ROLES,
  ...DIFFICULTIES,
  ...FACTIONS,
  ...Object.values(FACTION_SHORT),
]);

const S = {
  card: {
    borderRadius: 8,
    border: `1px solid ${ACCENT}22`,
    background: "rgba(255,215,0,.04)",
    padding: "12px 14px",
  } as React.CSSProperties,
  btn: {
    padding: "5px 10px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.04)",
    fontSize: 11,
    cursor: "pointer",
    color: "rgba(243,244,246,.85)",
    fontFamily: "inherit",
    letterSpacing: ".4px",
  } as React.CSSProperties,
  btnActive: {
    padding: "5px 10px",
    borderRadius: 6,
    border: `1px solid ${ACCENT}`,
    background: `${ACCENT}18`,
    fontSize: 11,
    cursor: "pointer",
    color: ACCENT,
    fontFamily: "inherit",
    fontWeight: 700,
    letterSpacing: ".4px",
  } as React.CSSProperties,
  btnPri: {
    padding: "7px 14px",
    borderRadius: 6,
    border: `1px solid ${ACCENT}50`,
    background: `${ACCENT}18`,
    fontSize: 12,
    cursor: "pointer",
    color: ACCENT,
    fontWeight: 700,
    fontFamily: "inherit",
    letterSpacing: ".5px",
  } as React.CSSProperties,
  btnDanger: {
    padding: "5px 12px",
    borderRadius: 6,
    border: "1px solid rgba(239,68,68,.35)",
    background: "rgba(239,68,68,.10)",
    fontSize: 11,
    cursor: "pointer",
    color: "#FCA5A5",
    fontFamily: "inherit",
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 6,
    border: `1px solid ${ACCENT}30`,
    background: "rgba(0,0,0,.50)",
    fontSize: 13,
    color: "rgba(243,244,246,.92)",
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  } as React.CSSProperties,
  label: {
    fontSize: 10,
    fontWeight: 700,
    opacity: 0.6,
    letterSpacing: "1.2px",
    textTransform: "uppercase" as const,
    marginBottom: 6,
    color: ACCENT,
  } as React.CSSProperties,
};

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  return r.json();
}

function parseTags(activity: string): { tags: string[]; rest: string } {
  const tags: string[] = [];
  let rest = activity || "";
  const re = /^\s*\[([^\]]+)\]/;
  while (true) {
    const m = re.exec(rest);
    if (!m) break;
    tags.push(m[1].trim());
    rest = rest.slice(m[0].length);
  }
  return { tags, rest: rest.trim() };
}

function tagKind(tag: string): "role" | "difficulty" | "faction" | "other" {
  if (ROLES.includes(tag)) return "role";
  if (DIFFICULTIES.includes(tag)) return "difficulty";
  if (FACTIONS.includes(tag)) return "faction";
  if (FACTION_FROM_SHORT[tag]) return "faction";
  return "other";
}

function tagColor(tag: string): string {
  const k = tagKind(tag);
  if (k === "role") return ROLE_COLOR;
  if (k === "difficulty") return DIFFICULTY_COLORS[tag] || "#FACC15";
  if (k === "faction")
    return FACTION_COLORS[tag] || FACTION_COLORS[FACTION_FROM_SHORT[tag] || "Any"] || "#94A3B8";
  return "rgba(255,255,255,.4)";
}

type Post = {
  id: string;
  userId: string;
  userName: string;
  activity: string;
  description: string;
  maxPlayers: number;
  platform: string;
  players: string[];
  playerNames: string[];
  status: string;
  createdAt: string;
};

export default function HelldiversSquadFinder({
  lobbyId,
  accentColor,
  currentUserId,
}: {
  lobbyId: string;
  accentColor?: string;
  currentUserId?: string;
}) {
  const accent = accentColor || ACCENT;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");

  const [role, setRole] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [faction, setFaction] = useState<string>("");
  const [opName, setOpName] = useState("");
  const [desc, setDesc] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [platform, setPlatform] = useState("crossplay");

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
    const tags: string[] = [];
    if (role) tags.push(`[${role}]`);
    if (difficulty) tags.push(`[${difficulty}]`);
    if (faction) tags.push(`[${FACTION_SHORT[faction] || faction}]`);
    const activityText = (tags.join(" ") + " " + (opName || "Looking for squad"))
      .trim()
      .slice(0, 100);

    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({
        activity: activityText,
        description: desc,
        maxPlayers,
        platform,
        tags: [role, difficulty, faction].filter(Boolean),
      }),
    });
    if (j.ok) {
      setShowForm(false);
      setRole("");
      setDifficulty("");
      setFaction("");
      setOpName("");
      setDesc("");
      setMaxPlayers(4);
      load();
    } else {
      setMsg(j.message || j.error || "Failed");
    }
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

  return (
    <div style={{ padding: "14px 16px", color: "rgba(243,244,246,.92)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 1.2,
              color: accent,
              textTransform: "uppercase",
            }}
          >
            Squad Finder
          </div>
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2, letterSpacing: ".5px" }}>
            {loading
              ? "Loading active operations..."
              : `${posts.length} active operation${posts.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <button style={showForm ? S.btnActive : S.btnPri} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Form Squad"}
        </button>
      </div>

      {msg && (
        <div style={{ fontSize: 11, marginBottom: 8, opacity: 0.75, color: "#FCA5A5" }}>{msg}</div>
      )}

      {showForm && (
        <div
          style={{
            ...S.card,
            marginBottom: 14,
            border: `1px solid ${accent}45`,
            background: `${accent}08`,
          }}
        >
          <div style={S.label}>Role</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setRole(role === r ? "" : r)}
                style={role === r ? S.btnActive : S.btn}
              >
                {r}
              </button>
            ))}
          </div>

          <div style={S.label}>Difficulty</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {DIFFICULTIES.map((d) => {
              const c = DIFFICULTY_COLORS[d] || "#FACC15";
              const active = difficulty === d;
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(active ? "" : d)}
                  style={
                    active
                      ? { ...S.btnActive, borderColor: c, color: c, background: `${c}22` }
                      : S.btn
                  }
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div style={S.label}>Faction</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {FACTIONS.map((f) => {
              const c = FACTION_COLORS[f];
              const active = faction === f;
              return (
                <button
                  key={f}
                  onClick={() => setFaction(active ? "" : f)}
                  style={
                    active
                      ? { ...S.btnActive, borderColor: c, color: c, background: `${c}22` }
                      : S.btn
                  }
                >
                  {f}
                </button>
              );
            })}
          </div>

          <div style={S.label}>Operation Name (optional)</div>
          <input
            style={{ ...S.input, marginBottom: 8 }}
            value={opName}
            onChange={(e) => setOpName(e.target.value)}
            placeholder="LF3 Operation Storm"
          />

          <div style={S.label}>Description (optional)</div>
          <input
            style={{ ...S.input, marginBottom: 12 }}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Mic preferred, casual chill run, samples priority..."
          />

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Squad Size</div>
              <input
                type="number"
                value={maxPlayers}
                onChange={(e) =>
                  setMaxPlayers(Math.max(2, Math.min(4, Number(e.target.value) || 4)))
                }
                min={2}
                max={4}
                style={S.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Platform</div>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                style={{ ...S.input, cursor: "pointer" }}
              >
                {["crossplay", "pc", "psn"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button style={{ ...S.btnPri, width: "100%", padding: "10px 0" }} onClick={create}>
            Deploy Squad Beacon
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {posts.map((p) => {
          const { tags, rest } = parseTags(p.activity || "");
          const isFull = p.status === "FULL";
          const isMine = currentUserId && p.userId === currentUserId;
          const inSquad = currentUserId && p.players?.includes(currentUserId);
          const slots = `${(p.players || []).length}/${p.maxPlayers}`;

          return (
            <div
              key={p.id}
              style={{
                ...S.card,
                border: isFull ? "1px solid rgba(245,158,11,.30)" : `1px solid ${accent}22`,
                opacity: isFull ? 0.78 : 1,
              }}
            >
              {tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                  {tags.map((t, i) => {
                    const c = tagColor(t);
                    return (
                      <span
                        key={`${t}-${i}`}
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: ".7px",
                          textTransform: "uppercase",
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: `${c}1A`,
                          border: `1px solid ${c}55`,
                          color: c,
                        }}
                      >
                        {t}
                      </span>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      marginBottom: 3,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {rest || p.activity}
                    {isFull && (
                      <span
                        style={{
                          fontSize: 9,
                          padding: "1px 6px",
                          borderRadius: 999,
                          background: "rgba(245,158,11,.15)",
                          border: "1px solid rgba(245,158,11,.35)",
                          color: "rgb(253,230,138)",
                        }}
                      >
                        FULL
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>
                      {p.description}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, fontSize: 11, opacity: 0.55 }}>
                    <span>{p.platform}</span>
                    <span>·</span>
                    <span>by {p.userName}</span>
                    <span>·</span>
                    <span style={{ color: isFull ? "rgb(253,230,138)" : accent, fontWeight: 700 }}>
                      {slots}
                    </span>
                  </div>
                </div>
                <div>
                  {inSquad ? (
                    <button style={S.btnDanger} onClick={() => leave(p.id)}>
                      {isMine ? "Disband" : "Leave"}
                    </button>
                  ) : isFull ? null : (
                    <button style={S.btnPri} onClick={() => join(p.id)}>
                      Join
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!loading && posts.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, opacity: 0.45, fontSize: 12 }}>
            No active operations. Be the first Helldiver to call a squad.
          </div>
        )}
      </div>
    </div>
  );
}
