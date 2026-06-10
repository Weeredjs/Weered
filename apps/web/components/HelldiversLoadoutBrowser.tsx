"use client";

import React, { useEffect, useMemo, useState } from "react";
import HelldiversLoadoutBuilder from "./HelldiversLoadoutBuilder";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

const FACTION_META: Record<string, { label: string; color: string }> = {
  ANY:        { label: "Any Front",  color: "#FFD700" },
  TERMINIDS:  { label: "Terminids",  color: "#f58220" },
  AUTOMATONS: { label: "Automatons", color: "#b91c1c" },
  ILLUMINATE: { label: "Illuminate", color: "#a855f7" },
};

const ROLE_OPTIONS = ["all-rounder", "anti-tank", "support", "crowd-control", "stealth", "defense", "demolitions", "sniper"];

type Loadout = {
  id: string; slug: string; name: string; description: string | null;
  authorId: string;
  primary: string; secondary: string; throwable: string;
  armor: string; helmet: string | null;
  stratagem1: string; stratagem2: string; stratagem3: string; stratagem4: string;
  faction: string; difficulty: string | null; role: string | null;
  upvotes: number; downvotes: number; views: number;
  createdAt: string; updatedAt: string;
  author?: { id: string; name: string; usernameKey: string; avatar: string | null; tier: string };
};

type Props = { lobbyAccent?: string; onCreate?: () => void };

export default function HelldiversLoadoutBrowser({ lobbyAccent = "#FFD700", onCreate }: Props) {
  const [loadouts, setLoadouts] = useState<Loadout[]>([]);
  const [loading, setLoading]   = useState(true);
  const [faction, setFaction]   = useState<string>("");
  const [role, setRole]         = useState<string>("");
  const [sort, setSort]         = useState<string>("top");
  const [search, setSearch]     = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [showBuilder, setShowBuilder]   = useState(false);

  async function fetchList() {
    setLoading(true);
    const params = new URLSearchParams();
    if (faction) params.set("faction", faction);
    if (role) params.set("role", role);
    if (sort) params.set("sort", sort);
    if (search) params.set("q", search);
    params.set("limit", "60");
    try {
      const res = await fetch(`${API}/helldivers/loadouts?${params.toString()}`, { headers: { ...authHeaders() } });
      const j = await res.json();
      if (j.ok) setLoadouts(j.loadouts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchList(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [faction, role, sort, search]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  if (showBuilder) {
    return (
      <HelldiversLoadoutBuilder
        onSaved={(slug) => { setShowBuilder(false); setSelectedSlug(slug); fetchList(); }}
        onCancel={() => setShowBuilder(false)}
      />
    );
  }

  return (
    <div style={{ padding: 14, background: "#0a0a0a", color: "#fff", minHeight: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1.2, color: lobbyAccent, textTransform: "uppercase" }}>
            Loadout Archive
          </div>
          <div style={{
            fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 9,
            letterSpacing: "1.4px", color: lobbyAccent, opacity: 0.55,
            marginTop: 2, fontWeight: 700,
          }}>SUPER EARTH // FIELD MANUAL</div>
        </div>
        <button
          onClick={() => (onCreate ? onCreate() : setShowBuilder(true))}
          style={{
            padding: "8px 14px", borderRadius: 4, border: `2px solid ${lobbyAccent}`,
            background: lobbyAccent, color: "#000", fontWeight: 800, letterSpacing: 1,
            cursor: "pointer", textTransform: "uppercase", fontSize: 12,
          }}
        >+ New Loadout</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 9, fontWeight: 800, letterSpacing: "1.4px",
          color: "rgba(255,215,0,.5)",
          textTransform: "uppercase",
          paddingRight: 4,
        }}>// FRONT</span>
        <FilterChip label="All Fronts" active={!faction} onClick={() => setFaction("")} color={lobbyAccent} />
        {Object.entries(FACTION_META).filter(([id]) => id !== "ANY").map(([id, m]) => (
          <FilterChip key={id} label={m.label} active={faction === id} onClick={() => setFaction(faction === id ? "" : id)} color={m.color} />
        ))}
        <span style={{ width: 1, height: 22, background: "#333", margin: "0 4px" }} />
        <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: "6px 8px", background: "#111", border: "1px solid #333", color: "#fff", borderRadius: 3, fontSize: 12 }}>
          <option value="">— any role —</option>
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: "6px 8px", background: "#111", border: "1px solid #333", color: "#fff", borderRadius: 3, fontSize: 12 }}>
          <option value="top">Top</option>
          <option value="new">New</option>
          <option value="views">Most Viewed</option>
        </select>
        <form onSubmit={submitSearch} style={{ flex: 1, minWidth: 180, display: "flex", gap: 4 }}>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search loadouts..."
            style={{ flex: 1, padding: "6px 10px", background: "#111", border: "1px solid #333", color: "#fff", borderRadius: 3, fontSize: 12 }}
          />
        </form>
      </div>

      {selectedSlug && (
        <LoadoutDetail
          slug={selectedSlug}
          onClose={() => setSelectedSlug(null)}
          onDeleted={() => { setSelectedSlug(null); fetchList(); }}
        />
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#666", fontSize: 13 }}>Decrypting archive...</div>
      ) : loadouts.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center", color: "#888", fontSize: 13,
          border: "2px dashed #333", borderRadius: 6,
        }}>
          <div style={{ fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 11, letterSpacing: 2, color: lobbyAccent, marginBottom: 8 }}>ARCHIVE EMPTY</div>
          <div>No loadouts filed yet for these criteria, Helldiver.</div>
          <div style={{ marginTop: 4 }}>Be the first to submit one for democracy.</div>
        </div>
      ) : (
        <div style={{
          display: "grid", gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        }}>
          {loadouts.map(l => (
            <LoadoutCard key={l.id} loadout={l} onClick={() => setSelectedSlug(l.slug)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 10px", borderRadius: 99, border: `1px solid ${color}`,
        background: active ? color : "transparent",
        color: active ? "#000" : color,
        fontWeight: 700, fontSize: 11, letterSpacing: 0.5, cursor: "pointer",
        textTransform: "uppercase",
      }}
    >{label}</button>
  );
}

function LoadoutCard({ loadout, onClick }: { loadout: Loadout; onClick: () => void }) {
  const meta = FACTION_META[loadout.faction] || FACTION_META.ANY;
  const score = loadout.upvotes - loadout.downvotes;
  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer", border: `2px solid ${meta.color}`, borderRadius: 4,
        background: "#000", overflow: "hidden",
        transition: "transform 0.1s, box-shadow 0.1s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${meta.color}55`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
    >
      <div style={{
        background: meta.color, color: "#000", padding: "5px 10px",
        fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 9, letterSpacing: 2, fontWeight: 800,
        display: "flex", justifyContent: "space-between",
      }}>
        <span>// CLASSIFIED</span>
        <span>{meta.label.toUpperCase()}</span>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{loadout.name}</div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>
          by {loadout.author?.name || "Unknown Helldiver"}
        </div>
        {(loadout.role || loadout.difficulty) && (
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {loadout.role && <span style={pillStyle(meta.color)}>{loadout.role}</span>}
            {loadout.difficulty && <span style={pillStyle("#FFD700")}>{loadout.difficulty}</span>}
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 11.5, color: "#bbb", lineHeight: 1.4 }}>
          <div style={{ color: "#888", fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 9, letterSpacing: 1, marginBottom: 2 }}>WEAPONS</div>
          <div>{loadout.primary}</div>
          <div style={{ color: "#888" }}>+ {loadout.secondary} · {loadout.throwable}</div>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "#bbb" }}>
          <div style={{ color: "#888", fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 9, letterSpacing: 1, marginBottom: 2 }}>ARMOR</div>
          <div>{loadout.armor}</div>
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 10, paddingTop: 8, borderTop: "1px solid #222",
          fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 10,
        }}>
          <span style={{ color: score > 0 ? "#10b981" : score < 0 ? "#f87171" : "#888" }}>
            {score >= 0 ? "+" : ""}{score} votes
          </span>
          <span style={{ color: "#666" }}>{loadout.views} views</span>
        </div>
      </div>
    </div>
  );
}

function pillStyle(color: string): React.CSSProperties {
  return {
    display: "inline-block", padding: "1px 7px", borderRadius: 99,
    background: color, color: "#000", fontSize: 9, fontWeight: 800,
    letterSpacing: 1, textTransform: "uppercase",
  };
}

function LoadoutDetail({ slug, onClose, onDeleted }: { slug: string; onClose: () => void; onDeleted: () => void }) {
  const [data, setData]     = useState<{ loadout: Loadout; myVote: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting]   = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/helldivers/loadouts/${slug}`, { headers: { ...authHeaders() } });
      const j = await res.json();
      if (j.ok) setData({ loadout: j.loadout, myVote: j.myVote || 0 });
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  async function castVote(value: 1 | -1) {
    if (!data || voting) return;
    setVoting(true);
    const next = data.myVote === value ? 0 : value;
    try {
      const res = await fetch(`${API}/helldivers/loadouts/${slug}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ value: next }),
      });
      const j = await res.json();
      if (j.ok) {
        setData({
          loadout: { ...data.loadout, upvotes: j.upvotes, downvotes: j.downvotes },
          myVote: j.myVote,
        });
      }
    } finally { setVoting(false); }
  }

  async function copyShareLink() {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/helldivers/loadout/${slug}`;
    try { await navigator.clipboard.writeText(url); } catch {}
  }

  async function deleteLoadout() {
    if (!data) return;
    if (!confirm("Strike this loadout from the archive?")) return;
    const res = await fetch(`${API}/helldivers/loadouts/${slug}`, {
      method: "DELETE", headers: { ...authHeaders() },
    });
    const j = await res.json().catch(() => ({}));
    if (j.ok) onDeleted();
  }

  if (loading || !data) {
    return <div style={{ padding: 24, color: "#666", textAlign: "center", border: "1px solid #222", borderRadius: 4 }}>Decrypting dossier...</div>;
  }

  const l = data.loadout;
  const meta = FACTION_META[l.faction] || FACTION_META.ANY;
  const score = l.upvotes - l.downvotes;

  return (
    <div style={{
      border: `2px solid ${meta.color}`, borderRadius: 4, background: "#000",
      boxShadow: `0 0 0 4px #000, 0 0 0 5px ${meta.color}33`,
      position: "relative", marginBottom: 4,
    }}>
      <div style={{
        background: `linear-gradient(90deg, ${meta.color} 0%, ${meta.color}cc 100%)`,
        color: "#000", padding: "10px 14px",
        fontFamily: "ui-monospace,Menlo,Consolas,monospace",
        fontSize: 10, letterSpacing: 2, fontWeight: 800,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>SUPER EARTH // CLASSIFIED // {meta.label.toUpperCase()}</span>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#000", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>×</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 16, padding: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>{l.name}</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            Filed by {l.author?.name || "Unknown Helldiver"}
            {" · "}{new Date(l.createdAt).toLocaleDateString()}
          </div>
          {(l.role || l.difficulty) && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {l.role && <span style={pillStyle(meta.color)}>{l.role}</span>}
              {l.difficulty && <span style={pillStyle("#FFD700")}>{l.difficulty}</span>}
            </div>
          )}
          {l.description && (
            <div style={{ marginTop: 12, padding: 12, background: "#111", borderLeft: `3px solid ${meta.color}`, fontSize: 13, color: "#ddd", fontStyle: "italic", lineHeight: 1.5 }}>
              "{l.description}"
            </div>
          )}

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Section accent={meta.color} title="WEAPONS">
              <KV k="Primary"   v={l.primary} />
              <KV k="Secondary" v={l.secondary} />
              <KV k="Throwable" v={l.throwable} />
            </Section>
            <Section accent={meta.color} title="ARMOR">
              <KV k="Set"    v={l.armor} />
              {l.helmet && <KV k="Helmet" v={l.helmet} />}
            </Section>
          </div>

          <div style={{ marginTop: 14 }}>
            <Section accent={meta.color} title="STRATAGEMS">
              <ol style={{ margin: 0, paddingLeft: 18, color: "#fff", fontSize: 13, lineHeight: 1.7 }}>
                <li>{l.stratagem1}</li>
                <li>{l.stratagem2}</li>
                <li>{l.stratagem3}</li>
                <li>{l.stratagem4}</li>
              </ol>
            </Section>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch" }}>
          <div style={{
            border: `1px solid ${meta.color}`, borderRadius: 4, padding: 12, textAlign: "center",
            background: "#0a0a0a",
          }}>
            <div style={{ fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 9, letterSpacing: 2, color: meta.color, marginBottom: 4 }}>FIELD VERDICT</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: score > 0 ? "#10b981" : score < 0 ? "#f87171" : "#fff", lineHeight: 1 }}>
              {score >= 0 ? "+" : ""}{score}
            </div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{l.upvotes}↑ / {l.downvotes}↓ · {l.views} views</div>
          </div>
          <button
            disabled={voting}
            onClick={() => castVote(1)}
            style={{
              padding: "10px", borderRadius: 4,
              border: `2px solid ${data.myVote === 1 ? "#10b981" : "#333"}`,
              background: data.myVote === 1 ? "#10b981" : "transparent",
              color: data.myVote === 1 ? "#000" : "#10b981",
              fontWeight: 800, fontSize: 12, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase",
            }}
          >▲ Approve</button>
          <button
            disabled={voting}
            onClick={() => castVote(-1)}
            style={{
              padding: "10px", borderRadius: 4,
              border: `2px solid ${data.myVote === -1 ? "#f87171" : "#333"}`,
              background: data.myVote === -1 ? "#f87171" : "transparent",
              color: data.myVote === -1 ? "#000" : "#f87171",
              fontWeight: 800, fontSize: 12, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase",
            }}
          >▼ Reject</button>
          <button
            onClick={copyShareLink}
            style={{
              padding: "8px", borderRadius: 4, border: "1px solid #444",
              background: "transparent", color: "#aaa", fontSize: 11, cursor: "pointer",
            }}
          >Copy share link</button>
          <button
            onClick={deleteLoadout}
            style={{
              padding: "6px", borderRadius: 4, border: "1px solid #333",
              background: "transparent", color: "#666", fontSize: 10, cursor: "pointer",
            }}
          >Strike from archive</button>
        </div>
      </div>
    </div>
  );
}

function Section({ accent, title, children }: { accent: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 10, letterSpacing: 2,
        color: accent, paddingBottom: 4, borderBottom: `1px solid ${accent}66`, marginBottom: 8,
        fontWeight: 800,
      }}>{title}</div>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "3px 0", borderBottom: "1px dashed #222" }}>
      <span style={{ color: "#888", minWidth: 70, fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{k}</span>
      <span style={{ color: "#fff" }}>{v}</span>
    </div>
  );
}
