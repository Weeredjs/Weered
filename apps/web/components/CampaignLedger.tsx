"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#C4A55A";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  try { return await r.json(); } catch { return { ok: false, error: "bad_json" }; }
}

type Campaign = {
  id: string;
  roomId: string;
  name: string;
  description: string;
  partyGold: number;
  dmUserId: string;
};
type Member = { id: string; userId: string; characterName: string };
type LedgerEntry = {
  id: string;
  type: "GOLD" | "ITEM" | "XP";
  delta: number;
  description: string;
  awardedToUserId: string | null;
  createdAt: string;
};
type SessionLog = { id: string; sessionNumber: number; body: string; createdAt: string };
type Npc = {
  id: string;
  name: string;
  status: "ALIVE" | "DEAD" | "HOSTILE" | "ALLIED" | "UNKNOWN";
  notes: string;
  firstMetSessionId: string | null;
};
type Thread = {
  id: string;
  title: string;
  body: string;
  status: "OPEN" | "CLOSED" | "DORMANT";
  createdAt: string;
  closedAt: string | null;
};
type WorldNote = {
  id: string;
  parentId: string | null;
  title: string;
  body: string;
};

type SectionId = "ledger" | "party" | "sessions" | "npcs" | "threads" | "notes";
const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "ledger",   label: "Ledger" },
  { id: "party",    label: "Party" },
  { id: "sessions", label: "Sessions" },
  { id: "npcs",     label: "NPCs" },
  { id: "threads",  label: "Threads" },
  { id: "notes",    label: "World" },
];

export default function CampaignLedger({ roomId }: { roomId: string }) {
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isDM, setIsDM] = useState(false);
  const [section, setSection] = useState<SectionId>("ledger");
  const [errMsg, setErrMsg] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrMsg("");
    const r = await apiFetch(`/rooms/${roomId}/campaign`);
    if (!r?.ok) { setErrMsg(r?.error || "failed"); setLoading(false); return; }
    setCampaign(r.campaign || null);
    setMembers(r.members || []);
    setIsDM(!!r.isDM);
    setLoading(false);
  }, [roomId]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) {
    return <div className="dnd-serif" style={{ padding: 24, textAlign: "center", opacity: .55 }}>Unrolling the chronicle…</div>;
  }

  if (!campaign) {
    return <CampaignBootstrap roomId={roomId} onCreated={refresh} errMsg={errMsg} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <header className="dnd-card" style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="dnd-heading" style={{ fontSize: 22, color: ACCENT, lineHeight: 1.1 }}>{campaign.name}</div>
            {campaign.description && (
              <div className="dnd-serif" style={{ fontSize: 13, opacity: .75, marginTop: 4, maxWidth: 520 }}>{campaign.description}</div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="dnd-section-label" style={{ opacity: .55 }}>Party Coffers</div>
            <div className="dnd-heading" style={{ fontSize: 22, color: ACCENT }}>{campaign.partyGold.toLocaleString()} gp</div>
          </div>
        </div>
        {!isDM && (
          <div className="dnd-serif" style={{ fontSize: 12, opacity: .6, marginTop: 8 }}>
            Read-only — only the DM may amend the chronicle.
          </div>
        )}
      </header>

      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`weered-dnd-tab weered-dnd-tab--small${section === s.id ? " is-active" : ""}`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div style={{ minHeight: 200 }}>
        {section === "ledger"   && <LedgerSection roomId={roomId} isDM={isDM} members={members} onPartyGoldChange={(g) => setCampaign(c => c ? { ...c, partyGold: g } : c)} />}
        {section === "party"    && <PartySection roomId={roomId} />}
        {section === "sessions" && <SessionsSection roomId={roomId} isDM={isDM} />}
        {section === "npcs"     && <NpcsSection roomId={roomId} isDM={isDM} />}
        {section === "threads"  && <ThreadsSection roomId={roomId} isDM={isDM} />}
        {section === "notes"    && <NotesSection roomId={roomId} isDM={isDM} />}
      </div>
    </div>
  );
}

// ── Bootstrap (no campaign yet) ────────────────────────────────────────────

function CampaignBootstrap({ roomId, onCreated, errMsg }: { roomId: string; onCreated: () => void; errMsg: string }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(errMsg);

  async function create() {
    if (!name.trim()) { setErr("Give the campaign a name."); return; }
    setBusy(true); setErr("");
    const r = await apiFetch(`/rooms/${roomId}/campaign`, {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), description: desc.trim() }),
    });
    setBusy(false);
    if (!r?.ok) { setErr(r?.error || "failed"); return; }
    onCreated();
  }

  return (
    <div className="dnd-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="dnd-heading" style={{ fontSize: 22, color: ACCENT }}>Begin the Chronicle</div>
      <div className="dnd-serif" style={{ fontSize: 14, opacity: .8 }}>
        No campaign yet bound to this hall. Christen one and you become its Dungeon Master —
        keeper of gold, loot, sessions, plot threads and the world itself.
      </div>
      <div>
        <div className="dnd-section-label">Campaign Name</div>
        <input
          className="dnd-parchment-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. The Ashfall Reliquary"
          maxLength={120}
          style={{ width: "100%" }}
        />
      </div>
      <div>
        <div className="dnd-section-label">Premise (optional)</div>
        <textarea
          className="dnd-parchment-input"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          rows={3}
          maxLength={2000}
          style={{ width: "100%", resize: "vertical" }}
        />
      </div>
      {err && <div className="dnd-serif" style={{ fontSize: 12, color: "#d97757" }}>Error: {err}</div>}
      <div>
        <button
          className="dnd-stone-tile"
          onClick={create}
          disabled={busy || !name.trim()}
        >
          {busy ? "Founding…" : "Found Campaign"}
        </button>
      </div>
    </div>
  );
}

// ── Ledger ──────────────────────────────────────────────────────────────────

function LedgerSection({
  roomId, isDM, members, onPartyGoldChange,
}: { roomId: string; isDM: boolean; members: Member[]; onPartyGoldChange: (g: number) => void }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"GOLD" | "ITEM" | "XP">("GOLD");
  const [delta, setDelta] = useState("");
  const [desc, setDesc] = useState("");
  const [awardedTo, setAwardedTo] = useState("");
  const [distributeXp, setDistributeXp] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch(`/rooms/${roomId}/campaign/ledger`);
    if (r?.ok) {
      setEntries(r.entries || []);
      onPartyGoldChange(r.partyGold || 0);
    }
    setLoading(false);
  }, [roomId, onPartyGoldChange]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    const n = Math.trunc(Number(delta));
    if (!Number.isFinite(n) || n === 0) return;
    setBusy(true);
    // XP with distribute=true and no awardedTo → split evenly across all
    // party characters via the integration endpoint (one entry per char).
    if (type === "XP" && distributeXp && !awardedTo) {
      const r = await apiFetch(`/rooms/${roomId}/campaign/ledger/distribute`, {
        method: "POST",
        body: JSON.stringify({ delta: n, description: desc.trim() }),
      });
      setBusy(false);
      if (r?.ok && Array.isArray(r.entries)) {
        setEntries(es => [...r.entries.slice().reverse(), ...es]);
        setDelta(""); setDesc(""); setAwardedTo("");
      }
      return;
    }
    const r = await apiFetch(`/rooms/${roomId}/campaign/ledger`, {
      method: "POST",
      body: JSON.stringify({ type, delta: n, description: desc.trim(), awardedToUserId: awardedTo || null }),
    });
    setBusy(false);
    if (r?.ok) {
      setEntries(es => [r.entry, ...es]);
      onPartyGoldChange(r.partyGold);
      setDelta(""); setDesc(""); setAwardedTo("");
    }
  }

  async function del(id: string) {
    if (!confirm("Strike this entry from the ledger?")) return;
    const r = await apiFetch(`/rooms/${roomId}/campaign/ledger/${id}`, { method: "DELETE" });
    if (r?.ok) {
      setEntries(es => es.filter(e => e.id !== id));
      if (typeof r.partyGold === "number") onPartyGoldChange(r.partyGold);
    }
  }

  const memberNameById = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach(x => m.set(x.userId, x.characterName || x.userId.slice(0, 8)));
    return m;
  }, [members]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {isDM && (
        <div className="dnd-card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="dnd-section-label">Record an Entry</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["GOLD", "ITEM", "XP"] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`weered-dnd-tab weered-dnd-tab--small${type === t ? " is-active" : ""}`}
              >
                {t === "GOLD" ? "Gold" : t === "ITEM" ? "Item" : "XP"}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            <input
              className="dnd-parchment-input"
              type="number"
              placeholder={type === "ITEM" ? "qty" : "amount"}
              value={delta}
              onChange={e => setDelta(e.target.value)}
            />
            <input
              className="dnd-parchment-input"
              placeholder={type === "ITEM" ? "Item name + notes" : "What for?"}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              maxLength={500}
            />
            <select
              className="dnd-parchment-input"
              value={awardedTo}
              onChange={e => setAwardedTo(e.target.value)}
            >
              <option value="">— Party —</option>
              {members.map(m => (
                <option key={m.userId} value={m.userId}>{m.characterName || m.userId.slice(0, 8)}</option>
              ))}
            </select>
          </div>
          {type === "XP" && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.85 }} className="dnd-serif">
              <input
                type="checkbox"
                checked={distributeXp && !awardedTo}
                disabled={!!awardedTo}
                onChange={e => setDistributeXp(e.target.checked)}
              />
              Distribute to whole party (creates one entry per character)
              {awardedTo && <span style={{ opacity: .6 }}>— targeting individual; ignored</span>}
            </label>
          )}
          <div>
            <button className="dnd-stone-tile" disabled={busy || !delta} onClick={add}>
              {type === "XP" && distributeXp && !awardedTo ? "Distribute XP" : "Inscribe"}
            </button>
          </div>
        </div>
      )}

      <div className="dnd-card" style={{ padding: 12 }}>
        <div className="dnd-section-label" style={{ marginBottom: 8 }}>Recent Entries</div>
        {loading && <div className="dnd-serif" style={{ opacity: .5 }}>Loading…</div>}
        {!loading && entries.length === 0 && (
          <div className="dnd-serif" style={{ opacity: .55, fontStyle: "italic" }}>The ledger is unmarked.</div>
        )}
        {!loading && entries.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {entries.map(e => (
              <li key={e.id} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "6px 4px", borderBottom: "1px solid rgba(196,165,90,.10)" }}>
                <span className="dnd-section-label" style={{ minWidth: 40, color: ACCENT }}>{e.type}</span>
                <span className="dnd-heading" style={{ minWidth: 70, color: e.delta >= 0 ? ACCENT : "#d97757", fontSize: 16 }}>
                  {e.delta >= 0 ? "+" : ""}{e.delta.toLocaleString()}
                </span>
                <span className="dnd-serif" style={{ flex: 1, fontSize: 13 }}>
                  {e.description || <em style={{ opacity: .5 }}>— no note —</em>}
                  {e.awardedToUserId && (
                    <span style={{ opacity: .55, marginLeft: 8 }}>
                      → {memberNameById.get(e.awardedToUserId) || e.awardedToUserId.slice(0, 8)}
                    </span>
                  )}
                </span>
                <span className="dnd-serif" style={{ fontSize: 11, opacity: .5 }}>
                  {new Date(e.createdAt).toLocaleDateString()}
                </span>
                {isDM && (
                  <button
                    onClick={() => del(e.id)}
                    className="dnd-stone-tile"
                    style={{ padding: "2px 8px", fontSize: 11 }}
                  >×</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Sessions ────────────────────────────────────────────────────────────────

function SessionsSection({ roomId, isDM }: { roomId: string; isDM: boolean }) {
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch(`/rooms/${roomId}/campaign/sessions`);
    if (r?.ok) setSessions(r.sessions || []);
    setLoading(false);
  }, [roomId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!draft.trim()) return;
    setBusy(true);
    const r = await apiFetch(`/rooms/${roomId}/campaign/sessions`, {
      method: "POST",
      body: JSON.stringify({ body: draft.trim() }),
    });
    setBusy(false);
    if (r?.ok) {
      setSessions(s => [r.session, ...s]);
      setDraft("");
    }
  }

  async function save(id: string) {
    const r = await apiFetch(`/rooms/${roomId}/campaign/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ body: editBody }),
    });
    if (r?.ok) {
      setSessions(ss => ss.map(s => s.id === id ? r.session : s));
      setEditingId(null);
    }
  }

  async function del(id: string) {
    if (!confirm("Erase this session log?")) return;
    const r = await apiFetch(`/rooms/${roomId}/campaign/sessions/${id}`, { method: "DELETE" });
    if (r?.ok) setSessions(ss => ss.filter(s => s.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {isDM && (
        <div className="dnd-card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="dnd-section-label">Tonight's Recap</div>
          <textarea
            className="dnd-parchment-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={5}
            placeholder="What happened? Markdown welcome."
            maxLength={20000}
            style={{ width: "100%", resize: "vertical" }}
          />
          <div>
            <button className="dnd-stone-tile" disabled={busy || !draft.trim()} onClick={add}>
              Bind New Session
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {loading && <div className="dnd-serif" style={{ opacity: .5 }}>Loading…</div>}
        {!loading && sessions.length === 0 && (
          <div className="dnd-card" style={{ padding: 12 }}>
            <div className="dnd-serif" style={{ opacity: .55, fontStyle: "italic" }}>No session logs yet.</div>
          </div>
        )}
        {sessions.map(s => (
          <article key={s.id} className="dnd-card" style={{ padding: "12px 14px" }}>
            <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <div className="dnd-heading" style={{ fontSize: 18, color: ACCENT }}>Session {s.sessionNumber}</div>
              <div className="dnd-serif" style={{ fontSize: 11, opacity: .55 }}>
                {new Date(s.createdAt).toLocaleString()}
              </div>
            </header>
            {editingId === s.id ? (
              <>
                <textarea
                  className="dnd-parchment-input"
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={6}
                  style={{ width: "100%", resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button className="dnd-stone-tile" onClick={() => save(s.id)}>Save</button>
                  <button className="dnd-stone-tile" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="dnd-serif" style={{ fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                  {s.body || <em style={{ opacity: .5 }}>— no recap —</em>}
                </div>
                {isDM && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button className="dnd-stone-tile" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => { setEditingId(s.id); setEditBody(s.body); }}>Edit</button>
                    <button className="dnd-stone-tile" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => del(s.id)}>Delete</button>
                  </div>
                )}
              </>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

// ── NPCs ────────────────────────────────────────────────────────────────────

const NPC_STATUSES: Npc["status"][] = ["ALIVE", "DEAD", "HOSTILE", "ALLIED", "UNKNOWN"];

function NpcsSection({ roomId, isDM }: { roomId: string; isDM: boolean }) {
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Npc["status"]>("UNKNOWN");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Npc | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch(`/rooms/${roomId}/campaign/npcs`);
    if (r?.ok) setNpcs(r.npcs || []);
    setLoading(false);
  }, [roomId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    const r = await apiFetch(`/rooms/${roomId}/campaign/npcs`, {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), status, notes: notes.trim() }),
    });
    setBusy(false);
    if (r?.ok) {
      setNpcs(n => [r.npc, ...n]);
      setName(""); setStatus("UNKNOWN"); setNotes(""); setShowAdd(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const r = await apiFetch(`/rooms/${roomId}/campaign/npcs/${editing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: editing.name, status: editing.status, notes: editing.notes }),
    });
    if (r?.ok) {
      setNpcs(ns => ns.map(x => x.id === editing.id ? r.npc : x));
      setEditing(null);
    }
  }

  async function del(id: string) {
    if (!confirm("Strike this NPC from the index?")) return;
    const r = await apiFetch(`/rooms/${roomId}/campaign/npcs/${id}`, { method: "DELETE" });
    if (r?.ok) setNpcs(ns => ns.filter(n => n.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {isDM && !showAdd && (
        <div>
          <button className="dnd-stone-tile" onClick={() => setShowAdd(true)}>+ Record NPC</button>
        </div>
      )}
      {isDM && showAdd && (
        <div className="dnd-card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="dnd-section-label">New NPC</div>
          <input className="dnd-parchment-input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} maxLength={120} />
          <select className="dnd-parchment-input" value={status} onChange={e => setStatus(e.target.value as any)}>
            {NPC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <textarea className="dnd-parchment-input" placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={4000} style={{ resize: "vertical" }} />
          <div style={{ display: "flex", gap: 6 }}>
            <button className="dnd-stone-tile" disabled={busy || !name.trim()} onClick={add}>Add</button>
            <button className="dnd-stone-tile" onClick={() => { setShowAdd(false); setName(""); setNotes(""); setStatus("UNKNOWN"); }}>Cancel</button>
          </div>
        </div>
      )}

      {loading && <div className="dnd-serif" style={{ opacity: .5 }}>Loading…</div>}
      {!loading && npcs.length === 0 && (
        <div className="dnd-card" style={{ padding: 12 }}>
          <div className="dnd-serif" style={{ opacity: .55, fontStyle: "italic" }}>No NPCs catalogued.</div>
        </div>
      )}
      {npcs.map(n => (
        <div key={n.id} className="dnd-card" style={{ padding: "10px 12px" }}>
          {editing?.id === n.id ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input className="dnd-parchment-input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} maxLength={120} />
              <select className="dnd-parchment-input" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as any })}>
                {NPC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <textarea className="dnd-parchment-input" value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} rows={3} maxLength={4000} style={{ resize: "vertical" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button className="dnd-stone-tile" onClick={saveEdit}>Save</button>
                <button className="dnd-stone-tile" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div className="dnd-heading" style={{ fontSize: 17, color: ACCENT }}>{n.name}</div>
                <div className="dnd-section-label" style={{ color: statusColor(n.status) }}>{n.status}</div>
              </div>
              {n.notes && <div className="dnd-serif" style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap", opacity: .85 }}>{n.notes}</div>}
              {isDM && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button className="dnd-stone-tile" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => setEditing(n)}>Edit</button>
                  <button className="dnd-stone-tile" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => del(n.id)}>Delete</button>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function statusColor(s: Npc["status"]): string {
  switch (s) {
    case "ALIVE":   return "#7fb069";
    case "DEAD":    return "#777";
    case "HOSTILE": return "#d97757";
    case "ALLIED":  return ACCENT;
    default:        return "rgba(243,244,246,.55)";
  }
}

// ── Plot Threads ────────────────────────────────────────────────────────────

const THREAD_STATUSES: Thread["status"][] = ["OPEN", "DORMANT", "CLOSED"];

function ThreadsSection({ roomId, isDM }: { roomId: string; isDM: boolean }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Thread | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch(`/rooms/${roomId}/campaign/threads`);
    if (r?.ok) setThreads(r.threads || []);
    setLoading(false);
  }, [roomId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    const r = await apiFetch(`/rooms/${roomId}/campaign/threads`, {
      method: "POST",
      body: JSON.stringify({ title: title.trim(), body: body.trim() }),
    });
    setBusy(false);
    if (r?.ok) {
      setThreads(t => [r.thread, ...t]);
      setTitle(""); setBody(""); setShowAdd(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const r = await apiFetch(`/rooms/${roomId}/campaign/threads/${editing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: editing.title, body: editing.body, status: editing.status }),
    });
    if (r?.ok) {
      setThreads(ts => ts.map(x => x.id === editing.id ? r.thread : x));
      setEditing(null);
    }
  }

  async function setStatus(t: Thread, status: Thread["status"]) {
    const r = await apiFetch(`/rooms/${roomId}/campaign/threads/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (r?.ok) setThreads(ts => ts.map(x => x.id === t.id ? r.thread : x));
  }

  async function del(id: string) {
    if (!confirm("Sever this thread?")) return;
    const r = await apiFetch(`/rooms/${roomId}/campaign/threads/${id}`, { method: "DELETE" });
    if (r?.ok) setThreads(ts => ts.filter(x => x.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {isDM && !showAdd && (
        <div><button className="dnd-stone-tile" onClick={() => setShowAdd(true)}>+ Spin Plot Thread</button></div>
      )}
      {isDM && showAdd && (
        <div className="dnd-card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="dnd-section-label">New Thread</div>
          <input className="dnd-parchment-input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} />
          <textarea className="dnd-parchment-input" placeholder="Body (markdown welcome)" value={body} onChange={e => setBody(e.target.value)} rows={3} maxLength={8000} style={{ resize: "vertical" }} />
          <div style={{ display: "flex", gap: 6 }}>
            <button className="dnd-stone-tile" disabled={busy || !title.trim()} onClick={add}>Spin</button>
            <button className="dnd-stone-tile" onClick={() => { setShowAdd(false); setTitle(""); setBody(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {loading && <div className="dnd-serif" style={{ opacity: .5 }}>Loading…</div>}
      {!loading && threads.length === 0 && (
        <div className="dnd-card" style={{ padding: 12 }}>
          <div className="dnd-serif" style={{ opacity: .55, fontStyle: "italic" }}>No plot threads.</div>
        </div>
      )}
      {threads.map(t => (
        <div key={t.id} className="dnd-card" style={{ padding: "10px 12px", opacity: t.status === "CLOSED" ? .55 : 1 }}>
          {editing?.id === t.id ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input className="dnd-parchment-input" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} maxLength={200} />
              <select className="dnd-parchment-input" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as any })}>
                {THREAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <textarea className="dnd-parchment-input" value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} rows={3} maxLength={8000} style={{ resize: "vertical" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button className="dnd-stone-tile" onClick={saveEdit}>Save</button>
                <button className="dnd-stone-tile" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div className="dnd-heading" style={{ fontSize: 17, color: ACCENT, textDecoration: t.status === "CLOSED" ? "line-through" : "none" }}>{t.title}</div>
                <div className="dnd-section-label">{t.status}</div>
              </div>
              {t.body && <div className="dnd-serif" style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap", opacity: .85 }}>{t.body}</div>}
              {isDM && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <button className="dnd-stone-tile" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => setEditing(t)}>Edit</button>
                  {THREAD_STATUSES.filter(s => s !== t.status).map(s => (
                    <button key={s} className="dnd-stone-tile" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => setStatus(t, s)}>→ {s}</button>
                  ))}
                  <button className="dnd-stone-tile" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => del(t.id)}>Delete</button>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ── World Notes (hierarchical wiki) ─────────────────────────────────────────

function NotesSection({ roomId, isDM }: { roomId: string; isDM: boolean }) {
  const [notes, setNotes] = useState<WorldNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [parentId, setParentId] = useState<string | "">("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<WorldNote | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch(`/rooms/${roomId}/campaign/notes`);
    if (r?.ok) setNotes(r.notes || []);
    setLoading(false);
  }, [roomId]);
  useEffect(() => { load(); }, [load]);

  const tree = useMemo(() => {
    const byParent = new Map<string | null, WorldNote[]>();
    notes.forEach(n => {
      const k = n.parentId;
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k)!.push(n);
    });
    return byParent;
  }, [notes]);

  const selected = useMemo(() => notes.find(n => n.id === selectedId) || null, [notes, selectedId]);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    const r = await apiFetch(`/rooms/${roomId}/campaign/notes`, {
      method: "POST",
      body: JSON.stringify({ title: title.trim(), body: body.trim(), parentId: parentId || null }),
    });
    setBusy(false);
    if (r?.ok) {
      setNotes(ns => [...ns, r.note]);
      setTitle(""); setBody(""); setParentId(""); setShowAdd(false);
      setSelectedId(r.note.id);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const r = await apiFetch(`/rooms/${roomId}/campaign/notes/${editing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: editing.title, body: editing.body }),
    });
    if (r?.ok) {
      setNotes(ns => ns.map(x => x.id === editing.id ? r.note : x));
      setEditing(null);
    }
  }

  async function del(id: string) {
    if (!confirm("Burn this page from the codex?")) return;
    const r = await apiFetch(`/rooms/${roomId}/campaign/notes/${id}`, { method: "DELETE" });
    if (r?.ok) {
      setNotes(ns => ns.filter(n => n.id !== id));
      if (selectedId === id) setSelectedId(null);
    }
  }

  function renderTree(parent: string | null, depth: number): React.ReactNode {
    const kids = tree.get(parent) || [];
    if (kids.length === 0) return null;
    return (
      <ul style={{ listStyle: "none", paddingLeft: depth === 0 ? 0 : 12, margin: 0 }}>
        {kids.map(n => (
          <li key={n.id}>
            <button
              onClick={() => setSelectedId(n.id)}
              className="dnd-serif"
              style={{
                background: "transparent",
                border: "none",
                color: selectedId === n.id ? ACCENT : "rgba(243,244,246,.85)",
                cursor: "pointer",
                padding: "3px 4px",
                textAlign: "left",
                fontSize: 13,
                fontWeight: selectedId === n.id ? 600 : 400,
                width: "100%",
              }}
            >
              {depth > 0 && "↳ "}{n.title}
            </button>
            {renderTree(n.id, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 240px) 1fr", gap: 12, alignItems: "start" }}>
      <aside className="dnd-card" style={{ padding: 10, maxHeight: 480, overflow: "auto" }}>
        <div className="dnd-section-label" style={{ marginBottom: 6 }}>Codex</div>
        {loading && <div className="dnd-serif" style={{ opacity: .5 }}>Loading…</div>}
        {!loading && notes.length === 0 && <div className="dnd-serif" style={{ opacity: .55, fontStyle: "italic" }}>No pages yet.</div>}
        {renderTree(null, 0)}
        {isDM && (
          <div style={{ marginTop: 10 }}>
            <button className="dnd-stone-tile" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setShowAdd(true)}>+ New Page</button>
          </div>
        )}
      </aside>

      <section style={{ minHeight: 200 }}>
        {showAdd && isDM ? (
          <div className="dnd-card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="dnd-section-label">New Codex Page</div>
            <input className="dnd-parchment-input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} />
            <select className="dnd-parchment-input" value={parentId} onChange={e => setParentId(e.target.value)}>
              <option value="">— root —</option>
              {notes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
            <textarea className="dnd-parchment-input" placeholder="Body (markdown welcome)" value={body} onChange={e => setBody(e.target.value)} rows={6} maxLength={16000} style={{ resize: "vertical" }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button className="dnd-stone-tile" disabled={busy || !title.trim()} onClick={add}>Inscribe</button>
              <button className="dnd-stone-tile" onClick={() => { setShowAdd(false); setTitle(""); setBody(""); setParentId(""); }}>Cancel</button>
            </div>
          </div>
        ) : selected ? (
          editing?.id === selected.id ? (
            <div className="dnd-card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <input className="dnd-parchment-input" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} maxLength={160} />
              <textarea className="dnd-parchment-input" value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} rows={10} maxLength={16000} style={{ resize: "vertical" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button className="dnd-stone-tile" onClick={saveEdit}>Save</button>
                <button className="dnd-stone-tile" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <article className="dnd-card" style={{ padding: "14px 16px" }}>
              <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <h3 className="dnd-heading" style={{ fontSize: 22, color: ACCENT, margin: 0 }}>{selected.title}</h3>
                {isDM && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="dnd-stone-tile" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => setEditing(selected)}>Edit</button>
                    <button className="dnd-stone-tile" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => del(selected.id)}>Delete</button>
                  </div>
                )}
              </header>
              <div className="dnd-serif" style={{ fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {selected.body || <em style={{ opacity: .5 }}>— blank page —</em>}
              </div>
            </article>
          )
        ) : (
          <div className="dnd-card" style={{ padding: 14 }}>
            <div className="dnd-serif" style={{ opacity: .55, fontStyle: "italic" }}>Select a page from the codex.</div>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Party section: campaign characters with current HP + derived XP totals.
// Reads via the cross-system endpoint added by integration glue.
function PartySection({ roomId }: { roomId: string }) {
  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch(`/rooms/${roomId}/campaign/party`);
    if (r?.ok) setParty(r.party || []);
    setLoading(false);
  }, [roomId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="dnd-serif" style={{ opacity: .55, padding: 16 }}>Mustering the party…</div>;
  if (!party.length) {
    return (
      <div className="dnd-card" style={{ padding: 16 }}>
        <div className="dnd-serif" style={{ opacity: .65, fontStyle: "italic" }}>
          No characters are sworn to this campaign yet. Players: open the Sheets tab and create a character — set its Campaign in the editor.
        </div>
      </div>
    );
  }
  return (
    <div className="dnd-card" style={{ padding: 12 }}>
      <div className="dnd-section-label" style={{ marginBottom: 8 }}>Party Roll</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {party.map(c => {
          const pct = c.hpMax > 0 ? Math.max(0, Math.min(100, (c.hpCurrent / c.hpMax) * 100)) : 0;
          const hpColor = pct > 50 ? "#22C55E" : pct > 25 ? "#F59E0B" : "#EF4444";
          return (
            <li key={c.id} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 1fr) 80px 70px 64px", gap: 8, alignItems: "center", padding: "6px 4px", borderBottom: "1px solid rgba(196,165,90,.10)" }}>
              <div>
                <div className="dnd-heading" style={{ fontSize: 15, color: ACCENT }}>{c.name}</div>
                <div className="dnd-serif" style={{ fontSize: 11, opacity: .6 }}>
                  {c.race ? `${c.race} ` : ""}{c.className || "Adventurer"} · L{c.level}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,.08)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: hpColor }} />
                </div>
              </div>
              <div className="dnd-serif" style={{ fontSize: 12, textAlign: "right" }}>
                {c.hpCurrent}/{c.hpMax} HP
              </div>
              <div className="dnd-heading" style={{ fontSize: 14, color: ACCENT, textAlign: "right" }}>
                {c.xp.toLocaleString()} xp
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
