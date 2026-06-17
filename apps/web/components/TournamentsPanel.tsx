"use client";

import React from "react";
import TournamentBracket from "./TournamentBracket";
import TournamentMatchModal from "./TournamentMatchModal";
import TournamentRoundRobin from "./TournamentRoundRobin";
import TournamentArchive from "./TournamentArchive";
import { apiFetch } from "../lib/api";
import { weeredConfirm } from "../lib/confirm";
import { weeredToast } from "../lib/toast";
import TournamentGuide from "./TournamentGuide";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#f58220";

type Tournament = {
  id: string;
  title: string;
  description: string;
  format: "LEADERBOARD" | "BRACKET" | "BRACKET_DOUBLE" | "ROUND_ROBIN" | "CHALLENGE_RACE";
  status: "REGISTRATION" | "ACTIVE" | "COMPLETED" | "CANCELED";
  lobbyId: string | null;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  maxEntries: number;
  minEntries: number;
  createdById?: string | null;
  featuredMode?: "UPCOMING" | "ACTIVE" | null;
  challengePoolIds?: string[];
  pointsPerCompletion?: number;
  pointsToWin?: number | null;
  raceWinCondition?: "THRESHOLD" | "DEADLINE" | "ALL_COMPLETED" | null;
  rewards?: Array<{ kind: string; itemId?: string; rank?: number; item?: { id: string; name: string; imageUrl?: string | null; category: string; rarity: string } }>;
};

export default function TournamentsPanel({
  lobbyId,
  currentUserId,
  isStaff,
}: {
  lobbyId: string;
  currentUserId?: string;
  isStaff?: boolean;
}) {
  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [showGuide, setShowGuide] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  function canManage(t: Tournament): boolean {
    if (isStaff) return true;
    if (currentUserId && t.createdById && t.createdById === currentUserId) return true;
    return false;
  }

  async function deleteTournament(t: Tournament) {
    const ok = await weeredConfirm({
      title: `Delete "${t.title}"?`,
      body: "This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const j = await apiFetch(`/tournaments/${encodeURIComponent(t.id)}`, { method: "DELETE" });
    if (j.ok === false) return;
    weeredToast.success(j.mode === "canceled" ? "Tournament canceled." : "Tournament deleted.");
    if (openId === t.id) setOpenId(null);
    fetchList();
  }

  const fetchList = React.useCallback(async () => {
    try {
      const j = await apiFetch<{ tournaments: Tournament[] }>(`/tournaments?lobbyId=${encodeURIComponent(lobbyId)}&status=all`, { silent: true });
      if (j?.ok) setTournaments(j.tournaments || []);
    } finally {
      setLoading(false);
    }
  }, [lobbyId]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  const q = query.trim().toLowerCase();
  const matchesQuery = (t: Tournament) => !q || (t.title || "").toLowerCase().includes(q);
  const active = tournaments.filter(t => (t.status === "ACTIVE" || t.status === "REGISTRATION") && matchesQuery(t));
  const past   = tournaments.filter(t => (t.status === "COMPLETED" || t.status === "CANCELED") && matchesQuery(t));

  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: "auto",
      padding: "14px 16px",
      color: "rgba(255,255,255,.92)",
      fontFamily: "inherit",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1.2, color: ACCENT, textTransform: "uppercase" }}>
            Tournaments
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
            {active.length} active · {past.length} past
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            style={{
              padding: "8px 12px",
              background: "rgba(255,255,255,.04)",
              color: ACCENT, border: `1px solid ${ACCENT}55`,
              borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
            }}
            title="How challenges and tournaments work"
          >{"\u{1F4D6}"} How it works</button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            style={{
              padding: "8px 14px",
              background: `linear-gradient(135deg, ${ACCENT} 0%, #ff9a40 100%)`,
              color: "#1a0e04", border: `1px solid ${ACCENT}`,
              borderRadius: 4, fontSize: 11, fontWeight: 800, letterSpacing: 1,
              textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
            }}
            title={isStaff ? "Create a tournament" : "Create your own tournament (one active at a time)"}
          >+ New Tournament</button>
        </div>
      </div>

      {!loading && tournaments.length > 3 && (
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search tournaments..."
          style={{
            width: "100%",
            padding: "7px 10px",
            marginBottom: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            color: "rgba(229,231,235,0.9)",
            fontSize: 12,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
      )}

      {loading ? (
        <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.45)", fontSize: 13 }}>
          Loading tournaments…
        </div>
      ) : openId ? (
        <BracketView
          tournament={tournaments.find(t => t.id === openId)!}
          currentUserId={currentUserId}
          isStaff={isStaff}
          onClose={() => setOpenId(null)}
          onChanged={fetchList}
        />
      ) : (
        <>
          {tournaments.length === 0 ? (
            <EmptyState isStaff={isStaff} onCreate={() => setShowCreate(true)} />
          ) : (
            <>
              {active.length > 0 && (
                <Section title="Active + Upcoming">
                  {active.map(t => <TournamentRow key={t.id} t={t} onOpen={() => setOpenId(t.id)} canManage={canManage(t)} onEdit={() => setEditId(t.id)} onDelete={() => deleteTournament(t)} />)}
                </Section>
              )}
              {past.length > 0 && (
                <Section title="Past">
                  {past.map(t => <TournamentRow key={t.id} t={t} onOpen={() => setOpenId(t.id)} muted canManage={canManage(t)} onEdit={() => setEditId(t.id)} onDelete={() => deleteTournament(t)} />)}
                </Section>
              )}
            </>
          )}
          <TournamentArchive lobbyId={lobbyId} />
        </>
      )}

      {showGuide && (
        <TournamentGuide accent={ACCENT} onClose={() => setShowGuide(false)} onCreate={() => setShowCreate(true)} />
      )}
      {showCreate && (
        <TournamentFormModal
          lobbyId={lobbyId}
          onClose={() => setShowCreate(false)}
          onSaved={(id) => { setShowCreate(false); fetchList(); setOpenId(id); }}
        />
      )}
      {editId && (() => {
        const t = tournaments.find(x => x.id === editId);
        if (!t) return null;
        return (
          <TournamentFormModal
            lobbyId={lobbyId}
            existing={t}
            onClose={() => setEditId(null)}
            onSaved={() => { setEditId(null); fetchList(); }}
          />
        );
      })()}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.4, color: "rgba(245,130,32,.7)", textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function TournamentRow({ t, onOpen, muted, canManage, onEdit, onDelete }: { t: Tournament; onOpen: () => void; muted?: boolean; canManage?: boolean; onEdit?: () => void; onDelete?: () => void }) {
  const startDate = new Date(t.startsAt);
  const formatLabel = t.format === "BRACKET" ? "Crucible Bracket" : t.format === "BRACKET_DOUBLE" ? "Crucible Bracket — Double" : t.format === "ROUND_ROBIN" ? "Crucible League" : t.format === "CHALLENGE_RACE" ? "Challenge Race" : "Leaderboard";
  const statusColor = t.status === "ACTIVE" ? "#4ade80" : t.status === "REGISTRATION" ? ACCENT : "rgba(255,255,255,.4)";
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      style={{
        width: "100%", padding: "10px 14px",
        background: muted ? "rgba(20,14,8,.4)" : "rgba(28,20,12,.92)",
        border: `1px solid ${muted ? "rgba(245,130,32,.12)" : "rgba(245,130,32,.3)"}`,
        borderRadius: 4, cursor: "pointer", color: "inherit", textAlign: "left", fontFamily: "inherit",
        transition: "all .12s", boxSizing: "border-box",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = ACCENT; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = muted ? "rgba(245,130,32,.12)" : "rgba(245,130,32,.3)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: muted ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.95)" }}>{t.title}</span>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2, color: statusColor, textTransform: "uppercase" }}>● {t.status}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "2px 7px", background: "rgba(255,255,255,.05)", borderRadius: 999, color: "rgba(255,255,255,.65)", letterSpacing: 0.4 }}>{formatLabel}</span>
        {canManage && (
          <>
            <button type="button"
              onClick={e => { e.stopPropagation(); onEdit?.(); }}
              title="Edit tournament"
              style={manageBtnS}>✎</button>
            <button type="button"
              onClick={e => { e.stopPropagation(); onDelete?.(); }}
              title="Delete tournament"
              style={{ ...manageBtnS, color: "#fca5a5" }}>🗑</button>
          </>
        )}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>{t.description || `Starts ${startDate.toLocaleString()}`}</div>
      {(() => {
        const rewards = Array.isArray(t.rewards) ? t.rewards : [];
        const flair: any = rewards.find((r: any) => r?.kind === "FLAIR" && r?.rank === 1 && r?.item);
        if (!flair) return null;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "3px 8px", borderRadius: 4, background: "rgba(245,130,32,.08)", border: "1px solid rgba(245,130,32,.22)", width: "fit-content" }}>
            {flair.item.imageUrl
              ? <img src={flair.item.imageUrl} alt={flair.item.name} style={{ width: 16, height: 16, borderRadius: 3, objectFit: "cover" }} />
              : <span style={{ fontSize: 11 }}>🏷️</span>}
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: "#fbbf24" }}>WINNER FLAIR</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.85)" }}>{flair.item.name}</span>
            <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 4 }}>{flair.item.rarity}</span>
          </div>
        );
      })()}
    </div>
  );
}

const manageBtnS: React.CSSProperties = {
  width: 26, height: 26,
  background: "rgba(10,8,4,.6)",
  border: "1px solid rgba(245,130,32,.25)",
  color: "rgba(255,255,255,.7)",
  borderRadius: 3, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0,
};

function BracketView({ tournament, currentUserId, isStaff, onClose, onChanged }: { tournament: Tournament; currentUserId?: string; isStaff?: boolean; onClose: () => void; onChanged: () => void }) {
  const [matches, setMatches] = React.useState<any[]>([]);
  const [openMatch, setOpenMatch] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const fetchMatches = React.useCallback(async () => {
    const j = await apiFetch<{ matches: any[] }>(`/tournaments/${encodeURIComponent(tournament.id)}/matches`, { silent: true });
    if (j?.ok) setMatches(j.matches || []);
  }, [tournament.id]);

  React.useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const [seeding, setSeeding] = React.useState<"random" | "rank">("random");
  async function startBracket() {
    setBusy(true);
    try {
      const j = await apiFetch(`/tournaments/${encodeURIComponent(tournament.id)}/bracket/start`, {
        method: "POST",
        body: JSON.stringify({ seeding }),
      });
      if (j?.ok) {
        weeredToast.success(tournament.format === "ROUND_ROBIN" ? "Schedule generated." : "Bracket started.");
        await fetchMatches(); onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={onClose} style={{ padding: "5px 10px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 3, color: "rgba(255,255,255,.85)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{tournament.title}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>{tournament.description}</div>
        </div>
        {isStaff && (tournament.format === "BRACKET" || tournament.format === "BRACKET_DOUBLE" || tournament.format === "ROUND_ROBIN") && matches.length === 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={seeding} onChange={e => setSeeding(e.target.value as any)} style={{ padding: "6px 8px", background: "rgba(10,8,4,.7)", border: `1px solid ${ACCENT}55`, color: "#fff", borderRadius: 3, fontSize: 11, fontFamily: "inherit" }}>
              <option value="random">Random Seed</option>
              <option value="rank">By Rank</option>
            </select>
            <button onClick={startBracket} disabled={busy} style={{ padding: "8px 14px", background: ACCENT, color: "#1a0e04", border: `1px solid ${ACCENT}`, borderRadius: 3, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? 0.5 : 1 }}>
              {busy ? "Generating…" : tournament.format === "ROUND_ROBIN" ? "Generate Schedule" : "Start Bracket"}
            </button>
          </div>
        )}
        {isStaff && tournament.format === "CHALLENGE_RACE" && tournament.status === "REGISTRATION" && (
          <button onClick={startBracket} disabled={busy} style={{ padding: "8px 14px", background: ACCENT, color: "#1a0e04", border: `1px solid ${ACCENT}`, borderRadius: 3, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? 0.5 : 1 }}>
            {busy ? "Starting…" : "Start Race"}
          </button>
        )}
      </div>

      {(tournament.format === "BRACKET" || tournament.format === "BRACKET_DOUBLE") ? (
        matches.length > 0 ? (
          <TournamentBracket
            tournament={tournament as any}
            matches={matches}
            currentUserId={currentUserId}
            isStaff={isStaff}
            onMatchClick={setOpenMatch}
            onRefresh={fetchMatches}
          />
        ) : (
          <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.5)", fontSize: 13, border: "1px dashed rgba(245,130,32,.25)", borderRadius: 6 }}>
            {isStaff ? "Bracket not yet generated. Hit Start Bracket when registration is closed." : "Bracket will appear once the admin generates it."}
          </div>
        )
      ) : tournament.format === "ROUND_ROBIN" ? (
        matches.length > 0 ? (
          <TournamentRoundRobin
            tournamentId={tournament.id}
            matches={matches}
            currentUserId={currentUserId}
            onMatchClick={setOpenMatch}
          />
        ) : (
          <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.5)", fontSize: 13, border: "1px dashed rgba(245,130,32,.25)", borderRadius: 6 }}>
            {isStaff ? "Round-robin not yet generated. Hit Start Bracket when registration is closed." : "Match schedule will appear once the admin generates it."}
          </div>
        )
      ) : tournament.format === "CHALLENGE_RACE" ? (
        <>
          <PoolStatusBlock tournamentId={tournament.id} />
          <RaceLeaderboardView tournamentId={tournament.id} currentUserId={currentUserId} />
        </>
      ) : (
        <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.5)", fontSize: 13 }}>
          {tournament.format} format viewer coming soon. Use the leaderboard view in the meantime.
        </div>
      )}

      {openMatch && (
        <TournamentMatchModal
          tournamentId={tournament.id}
          matchId={openMatch}
          currentUserId={currentUserId}
          isStaff={isStaff}
          onClose={() => setOpenMatch(null)}
          onChanged={fetchMatches}
        />
      )}
    </>
  );
}

function PoolStatusBlock({ tournamentId }: { tournamentId: string }) {
  const [showAudit, setShowAudit] = React.useState(false);
  type PoolItem = {
    defId: string;
    title: string;
    description: string;
    category: string;
    defStatus: string;
    instanceId: string | null;
    enrolled: boolean;
    enrollmentStatus: string | null;
    progress: any;
    completedAt: string | null;
  };
  const [pool, setPool] = React.useState<PoolItem[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const j = await apiFetch<{ pool: PoolItem[] }>(`/tournaments/${encodeURIComponent(tournamentId)}/pool-status`, { silent: true });
    if (j?.ok && Array.isArray(j.pool)) setPool(j.pool);
    setLoaded(true);
  }, [tournamentId]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  async function quickEnroll(item: PoolItem) {
    if (!item.instanceId) return;
    const j = await apiFetch(`/challenges/${encodeURIComponent(item.instanceId)}/enroll`, { method: "POST" });
    if (j?.ok) {
      weeredToast.success(`Enrolled in ${item.title}.`);
      void refresh();
    }
  }

  if (!loaded) return null;
  if (pool.length === 0) return null;

  const enrolledCount = pool.filter(p => p.enrolled).length;
  const completedCount = pool.filter(p => p.enrolled && p.enrollmentStatus === "COMPLETED").length;

  return (
    <div style={{ marginBottom: 14, padding: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(245,130,32,.25)", borderRadius: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(245,130,32,.85)", letterSpacing: 1, textTransform: "uppercase" }}>
          Pool Challenges ({enrolledCount}/{pool.length} enrolled, {completedCount} completed)
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,.5)" }}>Auto-enrolled when you registered</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {pool.map(item => {
          const done = item.enrolled && item.enrollmentStatus === "COMPLETED";
          const pct = (() => {
            try {
              const p = item.progress || {};
              const objs = Object.values(p) as any[];
              if (objs.length === 0) return null;
              const totalCur = objs.reduce((s, o) => s + (Number(o?.current) || 0), 0);
              const totalTgt = objs.reduce((s, o) => s + (Number(o?.target) || 0), 0);
              if (totalTgt === 0) return null;
              return Math.min(100, Math.round((totalCur / totalTgt) * 100));
            } catch { return null; }
          })();
          return (
            <div key={item.defId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", background: done ? "rgba(34,197,94,.06)" : "rgba(255,255,255,.02)", borderRadius: 4, border: `1px solid ${done ? "rgba(34,197,94,.25)" : "rgba(255,255,255,.06)"}` }}>
              <div style={{
                width: 18, height: 18, borderRadius: 3,
                border: `1.5px solid ${done ? "#22c55e" : item.enrolled ? "rgba(245,130,32,.6)" : "rgba(255,255,255,.25)"}`,
                background: done ? "#22c55e" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: "#0a0a0a", fontWeight: 900, flexShrink: 0,
              }}>{done ? "✓" : ""}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: done ? "rgba(134,239,172,.95)" : "rgba(255,255,255,.92)" }}>{item.title}</div>
                {pct != null && !done && (
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{pct}% complete</div>
                )}
                {done && item.completedAt && (
                  <div style={{ fontSize: 10, color: "rgba(134,239,172,.6)", marginTop: 2 }}>cleared {new Date(item.completedAt).toLocaleDateString()}</div>
                )}
              </div>
              {!item.enrolled && item.instanceId && (
                <button onClick={() => quickEnroll(item)} style={{
                  padding: "4px 10px", fontSize: 10, fontWeight: 800, background: "rgba(245,130,32,.18)",
                  border: "1px solid rgba(245,130,32,.5)", color: "#fcd34d", borderRadius: 3, cursor: "pointer",
                  fontFamily: "inherit", letterSpacing: 0.4, textTransform: "uppercase",
                }}>Enroll</button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setShowAudit(true)}
          style={{
            padding: "5px 10px", fontSize: 10, fontWeight: 700,
            background: "transparent", border: "1px solid rgba(255,255,255,.15)",
            color: "rgba(255,255,255,.65)", borderRadius: 3, cursor: "pointer",
            fontFamily: "inherit", letterSpacing: 0.4, textTransform: "uppercase",
          }}
          title="See exactly what Bungie reported on your last 10 activities"
        >Audit My Runs →</button>
      </div>
      {showAudit && <RunAuditModal onClose={() => setShowAudit(false)} />}
    </div>
  );
}

function RunAuditModal({ onClose }: { onClose: () => void }) {
  type Mod = { hash: string; name: string; description: string; source: string };
  type Activity = {
    period: string; instanceId: string; activityName: string;
    mode: number; modeName: string; difficultyTier: number | null;
    completed: boolean; standing: number; kills: number; deaths: number; duration: number;
    modifiers: Mod[];
  };
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiFetch<{ activities: Activity[] }>("/bungie/my-activities?limit=10", { silent: true })
      .then(j => { if (j?.ok && Array.isArray(j.activities)) setActivities(j.activities); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div onClick={onClose} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); } }} tabIndex={0} role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(8,5,2,.82)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); } }} tabIndex={0} role="button" style={{
        width: "min(720px, 100%)", maxHeight: "90vh", overflowY: "auto", padding: 20,
        background: "linear-gradient(180deg, rgba(28,20,12,.97), rgba(14,10,6,.99))",
        border: "2px solid rgba(245,130,32,.6)", borderRadius: 6, color: "rgba(255,255,255,.92)", fontFamily: "inherit",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "rgba(245,130,32,.95)", letterSpacing: 1, textTransform: "uppercase" }}>Run Audit</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginTop: 2 }}>Last 10 activities — exactly what Bungie reported. Source of truth.</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 3, color: "rgba(255,255,255,.7)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,.4)", fontSize: 13 }}>Loading…</div>
        ) : activities.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,.4)", fontSize: 13 }}>
            No activity yet. Your activities show here once the worker has pulled them from Bungie.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activities.map((a, i) => (
              <div key={a.instanceId || i} style={{ padding: 10, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.95)" }}>{a.activityName || "(unknown activity)"}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)" }}>{new Date(a.period).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", gap: 10, fontSize: 10, color: "rgba(255,255,255,.55)", marginBottom: 6, flexWrap: "wrap" }}>
                  <span>mode {a.mode} ({a.modeName || "?"})</span>
                  <span>tier {a.difficultyTier ?? "?"}</span>
                  <span style={{ color: a.completed ? "rgba(134,239,172,.85)" : "rgba(248,113,113,.85)", fontWeight: 700 }}>{a.completed ? "completed" : "did not finish"}</span>
                  <span>K/D {a.kills}/{a.deaths}</span>
                </div>
                {a.modifiers.length > 0 ? (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(245,130,32,.7)", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 }}>Modifiers active ({a.modifiers.length})</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {a.modifiers.map(m => (
                        <div key={m.hash} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 10, color: "rgba(255,255,255,.75)" }}>
                          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: "rgba(255,255,255,.4)", flexShrink: 0, width: 90 }}>[{m.hash}]</span>
                          <span style={{ fontWeight: 600, color: m.source === "skull" ? "rgba(252,211,77,.95)" : "rgba(196,181,253,.9)", flexShrink: 0 }}>{m.name}</span>
                          {m.description && <span style={{ opacity: 0.55 }}>— {m.description}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)", fontStyle: "italic" }}>No modifiers reported by Bungie for this run.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RaceLeaderboardView({ tournamentId, currentUserId }: { tournamentId: string; currentUserId?: string }) {
  type Row = {
    rank: number; entryId: string; userId: string | null;
    displayName: string; score: number; completions: number;
    completedDefinitionIds: string[];
  };
  type Meta = {
    id: string; lobbyId: string | null; status: string;
    pointsPerCompletion: number; pointsToWin: number | null; raceWinCondition: string | null;
    maxEntries: number; entryCount: number;
  };
  type PoolDef = { id: string; title: string; iconUrl: string | null; category: string; difficulty: number };
  type Me = {
    userId: string; isRegistered: boolean; entryId: string | null;
    score: number | null; completions: number; completedDefinitionIds: string[];
    canRegister: boolean;
  };

  const [rows, setRows] = React.useState<Row[]>([]);
  const [meta, setMeta] = React.useState<Meta | null>(null);
  const [pool, setPool] = React.useState<PoolDef[]>([]);
  const [me, setMe] = React.useState<Me | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [expandedEntryId, setExpandedEntryId] = React.useState<string | null>(null);

  const fetchBoard = React.useCallback(async () => {
    try {
      const j = await apiFetch<any>(`/tournaments/${encodeURIComponent(tournamentId)}/race-leaderboard`, { silent: true });
      if (j?.ok) {
        setRows(j.leaderboard || []);
        setMeta(j.tournament || null);
        setPool(j.pool || []);
        setMe(j.me || null);
      }
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  React.useEffect(() => {
    fetchBoard();
    const t = setInterval(fetchBoard, 8000);
    return () => clearInterval(t);
  }, [fetchBoard]);

  async function register() {
    setBusy(true);
    try {
      const j = await apiFetch(`/tournaments/${encodeURIComponent(tournamentId)}/register`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (j?.ok) weeredToast.success("Registered.");
      await fetchBoard();
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    const ok = await weeredConfirm({
      title: "Withdraw from this tournament?",
      confirmLabel: "Withdraw",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const j = await apiFetch(`/tournaments/${encodeURIComponent(tournamentId)}/register`, { method: "DELETE" });
      if (j?.ok) weeredToast("Withdrawn.");
      await fetchBoard();
    } finally {
      setBusy(false);
    }
  }

  if (loading && rows.length === 0 && !meta) {
    return <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.45)", fontSize: 13 }}>Loading leaderboard…</div>;
  }

  const poolById: Record<string, PoolDef> = {};
  for (const d of pool) poolById[d.id] = d;

  const completionCount: Record<string, number> = {};
  for (const r of rows) {
    for (const did of r.completedDefinitionIds || []) {
      completionCount[did] = (completionCount[did] || 0) + 1;
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        {meta && (
          <>
            {meta.raceWinCondition && (
              <span style={metaPillS}>
                <span style={metaLabelS}>Win</span> {meta.raceWinCondition.replace("_", " ")}
              </span>
            )}
            {meta.pointsToWin && (
              <span style={metaPillS}>
                <span style={metaLabelS}>Goal</span> {meta.pointsToWin} pts
              </span>
            )}
            <span style={metaPillS}>
              <span style={metaLabelS}>Per</span> {meta.pointsPerCompletion}/completion
            </span>
            <span style={metaPillS}>
              <span style={metaLabelS}>Field</span> {meta.entryCount}/{meta.maxEntries}
            </span>
          </>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {me?.isRegistered ? (
            <button type="button" onClick={withdraw} disabled={busy} style={withdrawBtnS}>
              {busy ? "…" : "Withdraw"}
            </button>
          ) : me?.canRegister ? (
            <button type="button" onClick={register} disabled={busy} style={registerBtnS}>
              {busy ? "Registering…" : "Register"}
            </button>
          ) : !me ? (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>Sign in to register</span>
          ) : null}
        </div>
      </div>

      {pool.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.4, color: "rgba(245,130,32,.7)", textTransform: "uppercase", marginBottom: 6 }}>
            Challenges in pool ({pool.length})
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {pool.map(d => {
              const meDone = me?.completedDefinitionIds?.includes(d.id);
              const totalDone = completionCount[d.id] || 0;
              return (
                <span key={d.id} title={`${d.title} (${d.category})${meDone ? " — you completed this" : ""}`} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 9px",
                  background: meDone ? `${ACCENT}28` : "rgba(255,255,255,.04)",
                  border: `1px solid ${meDone ? ACCENT : "rgba(255,255,255,.1)"}`,
                  color: meDone ? "#fff" : "rgba(255,255,255,.7)",
                  borderRadius: 999, fontSize: 11, fontWeight: 600,
                }}>
                  <span style={{ opacity: meDone ? 1 : 0.4 }}>{meDone ? "✓" : "○"}</span>
                  {d.title}
                  {totalDone > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.4)", letterSpacing: 0.4 }}>
                      {totalDone}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.5)", fontSize: 13, border: "1px dashed rgba(245,130,32,.25)", borderRadius: 6 }}>
          {me?.canRegister ? "No entries yet. Be the first — hit Register up top." : "No entries yet."}
        </div>
      ) : (
        <div style={{ border: "1px solid rgba(245,130,32,.25)", borderRadius: 4, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "inherit" }}>
            <thead>
              <tr style={{ background: "rgba(245,130,32,.12)", color: "rgba(245,130,32,.85)", fontSize: 9, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase" }}>
                <th style={thS}>#</th>
                <th style={{ ...thS, textAlign: "left" }}>Player</th>
                <th style={thS}>Done</th>
                <th style={thS}>Score</th>
                {meta?.pointsToWin ? <th style={thS}>Progress</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const mine = currentUserId && r.userId === currentUserId;
                const pct = meta?.pointsToWin ? Math.min(100, Math.round((r.score / meta.pointsToWin) * 100)) : null;
                const expanded = expandedEntryId === r.entryId;
                const expandable = (r.completedDefinitionIds || []).length > 0;
                return (
                  <React.Fragment key={r.entryId}>
                    <tr
                      onClick={() => expandable && setExpandedEntryId(expanded ? null : r.entryId)}
                      style={{
                        background: mine ? "rgba(245,130,32,.10)" : r.rank % 2 === 0 ? "rgba(255,255,255,.02)" : "transparent",
                        borderTop: "1px solid rgba(255,255,255,.05)",
                        cursor: expandable ? "pointer" : "default",
                      }}>
                      <td style={{ ...tdS, textAlign: "center", fontWeight: 800, color: r.rank === 1 ? "#fbbf24" : r.rank === 2 ? "#cbd5e1" : r.rank === 3 ? "#d97706" : "rgba(255,255,255,.5)" }}>
                        {r.rank}
                      </td>
                      <td style={{ ...tdS, fontWeight: 700, color: mine ? "#fff" : "rgba(255,255,255,.92)" }}>
                        {expandable && (
                          <span style={{ display: "inline-block", width: 10, color: "rgba(255,255,255,.4)", marginRight: 4 }}>
                            {expanded ? "▾" : "▸"}
                          </span>
                        )}
                        {r.displayName}
                        {mine && <span style={youPillS}>You</span>}
                      </td>
                      <td style={{ ...tdS, textAlign: "center", color: "rgba(255,255,255,.7)" }}>{r.completions}</td>
                      <td style={{ ...tdS, textAlign: "center", fontFamily: "monospace", color: ACCENT, fontWeight: 800 }}>{r.score}</td>
                      {pct != null && (
                        <td style={{ ...tdS, minWidth: 100 }}>
                          <div style={{ height: 6, background: "rgba(255,255,255,.06)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${ACCENT}, #ff9a40)` }} />
                          </div>
                        </td>
                      )}
                    </tr>
                    {expanded && (
                      <tr style={{ background: "rgba(10,8,4,.5)" }}>
                        <td></td>
                        <td colSpan={meta?.pointsToWin ? 4 : 3} style={{ padding: "8px 14px" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(r.completedDefinitionIds || []).map(did => {
                              const def = poolById[did];
                              return (
                                <span key={did} style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "3px 8px",
                                  background: "rgba(74,222,128,.12)",
                                  border: "1px solid rgba(74,222,128,.4)",
                                  color: "#4ade80", fontSize: 11, fontWeight: 600,
                                  borderRadius: 999,
                                }}>✓ {def?.title || did.slice(0, 8)}</span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const metaPillS: React.CSSProperties = { fontSize: 11, color: "rgba(255,255,255,.7)" };
const metaLabelS: React.CSSProperties = { color: "rgba(245,130,32,.7)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 800, fontSize: 9, marginRight: 4 };
const registerBtnS: React.CSSProperties = {
  padding: "8px 14px", background: `linear-gradient(135deg, ${ACCENT} 0%, #ff9a40 100%)`,
  color: "#1a0e04", border: `1px solid ${ACCENT}`,
  borderRadius: 3, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
  cursor: "pointer", fontFamily: "inherit",
};
const withdrawBtnS: React.CSSProperties = {
  padding: "8px 14px", background: "rgba(255,255,255,.04)",
  color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.18)",
  borderRadius: 3, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
  cursor: "pointer", fontFamily: "inherit",
};
const youPillS: React.CSSProperties = {
  marginLeft: 6, fontSize: 9, fontWeight: 800, letterSpacing: 1, padding: "1px 6px",
  background: `${ACCENT}28`, color: ACCENT, borderRadius: 999, textTransform: "uppercase",
};
const thS: React.CSSProperties = { padding: "7px 10px", textAlign: "center" };
const tdS: React.CSSProperties = { padding: "8px 10px" };

function EmptyState({ isStaff, onCreate }: { isStaff?: boolean; onCreate: () => void }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed rgba(245,130,32,.3)", borderRadius: 6, background: "rgba(20,14,8,.3)" }}>
      <div style={{ fontSize: 18, color: ACCENT, marginBottom: 6 }}>No tournaments yet.</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginBottom: 16 }}>
        {isStaff
          ? "Spin one up. Crucible 6v6, Trials weekly, raid race — whatever your community runs."
          : "Watch this space. When the lobby admins kick one off, it'll show up here."}
      </div>
      {isStaff && (
        <button onClick={onCreate} style={{ padding: "8px 18px", background: `linear-gradient(135deg, ${ACCENT} 0%, #ff9a40 100%)`, color: "#1a0e04", border: `1px solid ${ACCENT}`, borderRadius: 4, fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>+ Create First Tournament</button>
      )}
    </div>
  );
}

function toLocalDt(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type TournamentTemplate = {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  format: "BRACKET" | "BRACKET_DOUBLE" | "LEADERBOARD" | "ROUND_ROBIN" | "CHALLENGE_RACE";
  winCondition?: "THRESHOLD" | "DEADLINE" | "ALL_COMPLETED";
  pointsPerCompletion?: number;
  pointsToWin?: number | null;
  poolTitles?: string[];
  durationDays: number;
  maxEntries?: number;
  suggestedTitle: string;
  suggestedDescription: string;
};

const TOURNAMENT_TEMPLATES: Record<string, TournamentTemplate[]> = {
  chess: [
    {
      id: "bullet-bash",
      name: "Bullet Bash",
      blurb: "Speed-chess sprint. Most bullet wins in 24 hours takes it.",
      icon: "⚡",
      format: "CHALLENGE_RACE",
      winCondition: "DEADLINE",
      pointsPerCompletion: 100,
      pointsToWin: null,
      poolTitles: ["Bullet Sprint"],
      durationDays: 1,
      maxEntries: 64,
      suggestedTitle: "Bullet Bash — 24hr",
      suggestedDescription: "10 bullet wins per credit. Most credits when the clock hits zero takes it. Lichess or Chess.com both count.",
    },
    {
      id: "blitz-weekend",
      name: "Blitz Weekend",
      blurb: "Three-day blitz league. First to 5-streak wins.",
      icon: "♟️",
      format: "CHALLENGE_RACE",
      winCondition: "THRESHOLD",
      pointsPerCompletion: 100,
      pointsToWin: 100,
      poolTitles: ["Blitz Five-Streak"],
      durationDays: 3,
      maxEntries: 64,
      suggestedTitle: "Blitz Weekend Cup",
      suggestedDescription: "Hit a 5-game blitz win streak before the weekend ends. First player there is champion.",
    },
    {
      id: "rating-climb",
      name: "Rating Climb",
      blurb: "Week-long rating push. Most points gained takes it.",
      icon: "📈",
      format: "CHALLENGE_RACE",
      winCondition: "DEADLINE",
      pointsPerCompletion: 50,
      pointsToWin: null,
      poolTitles: ["Rating Climb — Blitz"],
      durationDays: 7,
      maxEntries: 64,
      suggestedTitle: "Weekly Rating Climb",
      suggestedDescription: "Every +50 net blitz rating earns a credit. Most credits at the end of the week wins. Lichess only (Chess.com doesn\'t expose ratingDiff per game).",
    },
    {
      id: "opening-month",
      name: "Opening of the Month",
      blurb: "Themed opening competition. This week: Sicilian.",
      icon: "🎯",
      format: "CHALLENGE_RACE",
      winCondition: "THRESHOLD",
      pointsPerCompletion: 100,
      pointsToWin: 300,
      poolTitles: ["Sicilian Specialist"],
      durationDays: 30,
      maxEntries: 32,
      suggestedTitle: "Sicilian Specialist Cup",
      suggestedDescription: "First to 3 sets of 5 Sicilian wins (15 wins total with ECO B20-B99) takes the cup.",
    },
  ],
  destiny2: [
    {
      id: "pantheon-cup",
      name: "Pantheon Cup",
      blurb: "Boss-rush race across the active raid rotation. Clear all the included challenges before the window closes.",
      icon: "👑",
      format: "CHALLENGE_RACE",
      winCondition: "ALL_COMPLETED",
      pointsPerCompletion: 100,
      pointsToWin: null,
      poolTitles: ["Boss Rush Marathon", "Master Raid Conqueror"],
      durationDays: 7,
      maxEntries: 32,
      suggestedTitle: "Pantheon Cup — Weekly",
      suggestedDescription: "Pantheon energy. Clear Boss Rush Marathon and Master Raid Conqueror before the week ends. PGCR-verified, no honor system.",
    },
    {
      id: "trials-weekend",
      name: "Trials Weekend",
      blurb: "Friday-to-Tuesday Trials competition. First to threshold wins.",
      icon: "⚔️",
      format: "CHALLENGE_RACE",
      winCondition: "THRESHOLD",
      pointsPerCompletion: 100,
      pointsToWin: 500,
      poolTitles: ["Trials Win Streak"],
      durationDays: 4,
      maxEntries: 64,
      suggestedTitle: "Trials Weekend Cup",
      suggestedDescription: "Five Trials of Osiris wins in a row earns 100 points. First player to 500 takes it.",
    },
    {
      id: "iron-banner-cup",
      name: "Iron Banner Cup",
      blurb: "When Saladin's in town. 10-win sprint with a points threshold.",
      icon: "🛡️",
      format: "CHALLENGE_RACE",
      winCondition: "THRESHOLD",
      pointsPerCompletion: 100,
      pointsToWin: 1000,
      poolTitles: ["Iron Banner Standout"],
      durationDays: 7,
      maxEntries: 64,
      suggestedTitle: "Iron Banner Cup",
      suggestedDescription: "10 Iron Banner wins per push. First to 1000 points carries the cup.",
    },
    {
      id: "solo-champion",
      name: "Solo Champion",
      blurb: "Solo dungeon prestige run. Two-week window for the brave.",
      icon: "🗡️",
      format: "CHALLENGE_RACE",
      winCondition: "ALL_COMPLETED",
      pointsPerCompletion: 100,
      pointsToWin: null,
      poolTitles: ["Solo Dungeon Marathon"],
      durationDays: 14,
      maxEntries: 32,
      suggestedTitle: "Solo Champion Run",
      suggestedDescription: "Three solo dungeon completions. Fireteam of one — verified by PGCR. Two-week window.",
    },
    {
      id: "speed-cup",
      name: "Speed Run Cup",
      blurb: "Fastest strike clears, deadline-based scoring.",
      icon: "⚡",
      format: "CHALLENGE_RACE",
      winCondition: "DEADLINE",
      pointsPerCompletion: 100,
      pointsToWin: null,
      poolTitles: ["Speed Demon"],
      durationDays: 7,
      maxEntries: 64,
      suggestedTitle: "Speed Run Cup",
      suggestedDescription: "Sub-6-minute strike clears. Most wins by the deadline takes it.",
    },
  ],
  "*": [
    {
      id: "open-bracket",
      name: "Open Bracket",
      blurb: "Single-elimination bracket. PvP-friendly. Manual reporting for now.",
      icon: "🏆",
      format: "BRACKET",
      durationDays: 7,
      maxEntries: 16,
      suggestedTitle: "Open Bracket",
      suggestedDescription: "Single-elimination. Sign up before the window closes; matches generate when registration ends.",
    },
    {
      id: "leaderboard",
      name: "Leaderboard",
      blurb: "Free-form points race. You set the scoring rule.",
      icon: "📊",
      format: "LEADERBOARD",
      durationDays: 7,
      maxEntries: 64,
      suggestedTitle: "Leaderboard Race",
      suggestedDescription: "Points-based competition. Submit results manually or via the platform-tracked metrics.",
    },
  ],
};

function getTemplatesForLobby(lobbyId: string): TournamentTemplate[] {
  const lobbySpecific = TOURNAMENT_TEMPLATES[lobbyId] || [];
  const universal = TOURNAMENT_TEMPLATES["*"] || [];
  return [...lobbySpecific, ...universal];
}

function TournamentFormModal({
  lobbyId, onClose, onSaved, existing,
}: {
  lobbyId: string;
  onClose: () => void;
  onSaved: (id: string) => void;
  existing?: Tournament;
}) {
  const isEdit = !!existing;
  const [title, setTitle] = React.useState(existing?.title ?? "");
  const [description, setDescription] = React.useState(existing?.description ?? "");
  const [format, setFormat] = React.useState<"BRACKET" | "BRACKET_DOUBLE" | "LEADERBOARD" | "ROUND_ROBIN" | "CHALLENGE_RACE">(existing?.format ?? "CHALLENGE_RACE");
  const [seeding, setSeeding] = React.useState<"random" | "rank">("random");
  const [maxEntries, setMaxEntries] = React.useState(String(existing?.maxEntries ?? 16));
  const [startsAt, setStartsAt] = React.useState(toLocalDt(existing?.startsAt));
  const [endsAt, setEndsAt] = React.useState(toLocalDt(existing?.endsAt));
  const [featuredMode, setFeaturedMode] = React.useState<"AUTO" | "UPCOMING" | "ACTIVE">(
    existing?.featuredMode === "UPCOMING" || existing?.featuredMode === "ACTIVE" ? existing.featuredMode : "AUTO"
  );

  const [pointsPerCompletion, setPointsPerCompletion] = React.useState(String(existing?.pointsPerCompletion ?? 100));
  const [pointsToWin, setPointsToWin] = React.useState(existing?.pointsToWin != null ? String(existing.pointsToWin) : "");
  const [winCondition, setWinCondition] = React.useState<"THRESHOLD" | "DEADLINE" | "ALL_COMPLETED">(
    (existing?.raceWinCondition as any) || "THRESHOLD"
  );
  const [poolIds, setPoolIds] = React.useState<string[]>(existing?.challengePoolIds || []);
  const [defOptions, setDefOptions] = React.useState<{ id: string; title: string; category: string }[]>([]);
  const [defsLoaded, setDefsLoaded] = React.useState(false);

  const [step, setStep] = React.useState<"template" | "form">(isEdit ? "form" : "template");

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (format !== "CHALLENGE_RACE" || defOptions.length > 0) return;
    const tok = (() => { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } })();
    fetch(`${API}/challenges/definitions?lobbyId=${encodeURIComponent(lobbyId)}`, {
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
    })
      .then(r => r.json())
      .then(j => {
        if (j?.ok && Array.isArray(j.definitions)) {
          setDefOptions(j.definitions.map((d: any) => ({ id: d.id, title: d.title, category: d.category || "" })));
        }
      })
      .catch(() => {})
      .finally(() => setDefsLoaded(true));
  }, [format, lobbyId, defOptions.length]);

  function applyTemplate(t: TournamentTemplate) {
    setTitle(t.suggestedTitle);
    setDescription(t.suggestedDescription);
    setFormat(t.format);
    if (t.maxEntries != null) setMaxEntries(String(t.maxEntries));

    const now = new Date();
    const start = new Date(Math.ceil(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000));
    const end = new Date(start.getTime() + t.durationDays * 24 * 60 * 60 * 1000);
    setStartsAt(toDtLocalInput(start));
    setEndsAt(toDtLocalInput(end));

    if (t.format === "CHALLENGE_RACE") {
      if (t.winCondition) setWinCondition(t.winCondition);
      if (t.pointsPerCompletion != null) setPointsPerCompletion(String(t.pointsPerCompletion));
      setPointsToWin(t.pointsToWin != null ? String(t.pointsToWin) : "");

      if (t.poolTitles && t.poolTitles.length > 0) {
        const matched = defOptions
          .filter(d => t.poolTitles!.includes(d.title))
          .map(d => d.id);
        setPoolIds(matched);
      } else {
        setPoolIds([]);
      }
    }

    setStep("form");
  }

  function toDtLocalInput(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function submit() {
    setBusy(true); setError("");
    try {
      const url = isEdit ? `${API}/tournaments/${encodeURIComponent(existing!.id)}` : `${API}/tournaments`;
      const method = isEdit ? "PATCH" : "POST";
      const body: any = {
        title: title.trim(),
        description: description.trim(),
        format,
        maxEntries: Number(maxEntries) || 16,
        featuredMode: featuredMode === "AUTO" ? null : featuredMode,
      };
      if (startsAt) body.startsAt = new Date(startsAt).toISOString();
      if (endsAt) body.endsAt = new Date(endsAt).toISOString();
      if (format === "CHALLENGE_RACE") {
        body.pointsPerCompletion = Number(pointsPerCompletion) || 100;
        if (pointsToWin.trim()) body.pointsToWin = Number(pointsToWin);
        else body.pointsToWin = null;
        body.raceWinCondition = winCondition;
        body.challengePoolIds = poolIds;
      }
      if (!isEdit) {
        body.lobbyId = lobbyId;
        body.minEntries = 2;
        if (!body.startsAt) body.startsAt = new Date(Date.now() + 60_000).toISOString();
        if (!body.endsAt) body.endsAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
        body.registrationOpensAt = new Date().toISOString();
        body.scoringRule = { type: "manual" };
      }
      const j = await apiFetch<any>(url.replace(API, ""), {
        method,
        body: JSON.stringify(body),
        silent: true,
      });
      if (j?.ok === false || !j?.tournament) {
        setError(j?.message || j?.error || (isEdit ? "Failed to save changes" : "Failed to create tournament"));
        return;
      }
      weeredToast.success(isEdit ? "Tournament updated." : "Tournament created.");
      onSaved(j.tournament.id);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); } }} tabIndex={0} role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(8,5,2,.82)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); } }} tabIndex={0} role="button" style={{
        width: "min(560px, 100%)", padding: 20,
        maxHeight: "90vh", overflowY: "auto",
        background: "linear-gradient(180deg, rgba(28,20,12,.97), rgba(14,10,6,.99))",
        border: "2px solid rgba(245,130,32,.6)", borderRadius: 6,
        color: "rgba(255,255,255,.92)", fontFamily: "inherit",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT, letterSpacing: 1, textTransform: "uppercase" }}>{isEdit ? "Edit Tournament" : (step === "template" ? "Pick a Template" : "New Tournament")}</div>
          <button onClick={onClose} style={{ width: 28, height: 28, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 3, color: "rgba(255,255,255,.7)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>

        {step === "template" && !isEdit && (
          <>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", marginBottom: 12, lineHeight: 1.5 }}>
              Pick a template to fill in sensible defaults. You\'ll be able to customize the title, dates, and any other field after.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {getTemplatesForLobby(lobbyId).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  style={{
                    textAlign: "left",
                    padding: "12px 12px",
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid rgba(245,130,32,.25)",
                    borderRadius: 4,
                    color: "rgba(255,255,255,.85)",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "all .12s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(245,130,32,.10)";
                    e.currentTarget.style.borderColor = "rgba(245,130,32,.55)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,.03)";
                    e.currentTarget.style.borderColor = "rgba(245,130,32,.25)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT, letterSpacing: 0.4, textTransform: "uppercase" }}>{t.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", lineHeight: 1.4, marginBottom: 6 }}>{t.blurb}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, fontSize: 9, color: "rgba(245,130,32,.65)", letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 700 }}>
                    <span>{t.format.replace("_", " ")}</span>
                    <span>·</span>
                    <span>{t.durationDays}d</span>
                    {t.poolTitles && t.poolTitles.length > 0 && <><span>·</span><span>{t.poolTitles.length} challenge{t.poolTitles.length === 1 ? "" : "s"}</span></>}
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep("form")}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "rgba(255,255,255,.04)",
                border: "1px dashed rgba(255,255,255,.18)",
                borderRadius: 4,
                color: "rgba(255,255,255,.7)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Skip — Build From Scratch
            </button>
          </>
        )}

        {step === "form" && !isEdit && (
          <button
            type="button"
            onClick={() => setStep("template")}
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,.55)",
              background: "transparent",
              border: "none",
              padding: "0 0 8px 0",
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: 0.4,
            }}
          >← Back to templates</button>
        )}

        {step === "form" && (<>
        <Field label="Title">
          <input value={title} onChange={e => setTitle(e.target.value.slice(0, 80))} placeholder="Trials of the Nine — Q2 Open" style={inputS} />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 500))} placeholder="Format, rules, prize pool…" rows={3} style={{ ...inputS, resize: "vertical" }} />
        </Field>
        <Field label="Format">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {([
              { v: "CHALLENGE_RACE", label: "Challenge Race", hint: "Clear strikes, raids & challenges for points" },
              { v: "LEADERBOARD", label: "Leaderboard", hint: "Ranked by a stat — fastest clear, most kills" },
              { v: "BRACKET", label: "Crucible Bracket", hint: "Head-to-head PvP, single elim" },
              { v: "BRACKET_DOUBLE", label: "Crucible Bracket — Double", hint: "PvP — lose twice, you're out" },
              { v: "ROUND_ROBIN", label: "Crucible League", hint: "Everyone plays everyone" },
            ] as const).map(o => (
              <button key={o.v} type="button" onClick={() => setFormat(o.v)} style={{
                flex: "1 1 30%", padding: "8px 10px", textAlign: "left",
                background: format === o.v ? `${ACCENT}28` : "rgba(255,255,255,.04)",
                border: `1px solid ${format === o.v ? ACCENT : "rgba(255,255,255,.1)"}`,
                color: format === o.v ? "#fff" : "rgba(255,255,255,.7)",
                borderRadius: 3, cursor: "pointer", fontFamily: "inherit",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{o.label}</div>
                <div style={{ fontSize: 9, fontWeight: 500, marginTop: 2, letterSpacing: 0, textTransform: "none", color: format === o.v ? "rgba(255,255,255,.72)" : "rgba(255,255,255,.4)" }}>{o.hint}</div>
              </button>
            ))}
          </div>
        </Field>

        {format === "CHALLENGE_RACE" && (
          <>
            <Field label="Win Condition">
              <div style={{ display: "flex", gap: 6 }}>
                {([
                  { v: "THRESHOLD", label: "First to Score", hint: "First entry to reach pointsToWin wins" },
                  { v: "DEADLINE",  label: "By Deadline",   hint: "Highest score when endsAt passes wins" },
                  { v: "ALL_COMPLETED", label: "All Cleared", hint: "First to finish every challenge in pool wins" },
                ] as const).map(opt => (
                  <button key={opt.v} type="button" onClick={() => setWinCondition(opt.v)} title={opt.hint} style={{
                    flex: 1, padding: "6px 10px",
                    background: winCondition === opt.v ? `${ACCENT}28` : "rgba(255,255,255,.04)",
                    border: `1px solid ${winCondition === opt.v ? ACCENT : "rgba(255,255,255,.1)"}`,
                    color: winCondition === opt.v ? "#fff" : "rgba(255,255,255,.7)",
                    borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit", letterSpacing: 0.4, textTransform: "uppercase",
                  }}>{opt.label}</button>
                ))}
              </div>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Points per completion">
                <input type="number" value={pointsPerCompletion} onChange={e => setPointsPerCompletion(e.target.value)} min={1} max={100000} style={inputS} />
              </Field>
              <Field label={winCondition === "THRESHOLD" ? "Points to Win (required)" : "Points to Win (optional)"}>
                <input type="number" value={pointsToWin} onChange={e => setPointsToWin(e.target.value)} placeholder={winCondition === "THRESHOLD" ? "e.g. 300" : "blank = no cap"} style={inputS} />
              </Field>
            </div>
            <Field label={`Challenge Pool (${poolIds.length === 0 ? "any in lobby" : `${poolIds.length} selected`})`}>
              <div style={{ maxHeight: 160, overflow: "auto", border: "1px solid rgba(245,130,32,.25)", borderRadius: 3, padding: 6, background: "rgba(10,8,4,.5)" }}>
                {defOptions.length === 0 ? (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", padding: 6, lineHeight: 1.5 }}>
                    {!defsLoaded ? (
                      <>Loading challenge definitions…</>
                    ) : (
                      <>
                        No active challenges in this lobby yet.
                        <br />
                        <span style={{ opacity: 0.7 }}>Your tournament will count any challenge a participant completes in this lobby.</span>
                      </>
                    )}
                  </div>
                ) : defOptions.map(d => {
                  const checked = poolIds.includes(d.id);
                  return (
                    <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", fontSize: 11, color: "rgba(255,255,255,.85)", cursor: "pointer", borderRadius: 2 }}>
                      <input type="checkbox" checked={checked} onChange={() => {
                        setPoolIds(prev => checked ? prev.filter(x => x !== d.id) : [...prev, d.id]);
                      }} />
                      <span style={{ flex: 1 }}>{d.title}</span>
                      {d.category && <span style={{ fontSize: 9, color: "rgba(245,130,32,.6)", textTransform: "uppercase", letterSpacing: 1 }}>{d.category}</span>}
                    </label>
                  );
                })}
              </div>
            </Field>
          </>
        )}

        {(format === "BRACKET" || format === "BRACKET_DOUBLE" || format === "ROUND_ROBIN") && (
          <Field label="Seeding">
            <div style={{ display: "flex", gap: 6 }}>
              {(["random", "rank"] as const).map(opt => (
                <button key={opt} type="button" onClick={() => setSeeding(opt)} style={{
                  flex: 1, padding: "6px 10px",
                  background: seeding === opt ? `${ACCENT}28` : "rgba(255,255,255,.04)",
                  border: `1px solid ${seeding === opt ? ACCENT : "rgba(255,255,255,.1)"}`,
                  color: seeding === opt ? "#fff" : "rgba(255,255,255,.7)",
                  borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit", letterSpacing: 0.4, textTransform: "uppercase",
                }}>{opt === "random" ? "Random" : "By Rank (Notoriety)"}</button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Max Entries">
          <input type="number" value={maxEntries} onChange={e => setMaxEntries(e.target.value)} min={2} max={256} style={inputS} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Starts">
            <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} style={inputS} />
          </Field>
          <Field label="Ends">
            <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} style={inputS} />
          </Field>
        </div>
        <Field label="Featured Visibility">
          <div style={{ display: "flex", gap: 6 }}>
            {([
              { v: "AUTO",     label: "Auto",     hint: "Banner appears 24h before start, then live when start passes" },
              { v: "UPCOMING", label: "Upcoming", hint: "Show 'starting soon' banner immediately" },
              { v: "ACTIVE",   label: "Active",   hint: "Show 'active' banner immediately" },
            ] as const).map(opt => (
              <button key={opt.v} type="button" onClick={() => setFeaturedMode(opt.v)} title={opt.hint} style={{
                flex: 1, padding: "6px 10px",
                background: featuredMode === opt.v ? `${ACCENT}28` : "rgba(255,255,255,.04)",
                border: `1px solid ${featuredMode === opt.v ? ACCENT : "rgba(255,255,255,.1)"}`,
                color: featuredMode === opt.v ? "#fff" : "rgba(255,255,255,.7)",
                borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit", letterSpacing: 0.4, textTransform: "uppercase",
              }}>{opt.label}</button>
            ))}
          </div>
        </Field>

        </>)}

        {step === "form" && error && <div style={{ marginTop: 10, padding: 8, background: "rgba(185,28,28,.18)", border: "1px solid rgba(239,68,68,.4)", color: "#fca5a5", fontSize: 11, borderRadius: 3 }}>{error}</div>}

        {step === "form" && <button onClick={submit} disabled={busy || title.trim().length < 3} style={{
          width: "100%", marginTop: 14, padding: "12px",
          background: title.trim().length >= 3 && !busy ? `linear-gradient(135deg, ${ACCENT} 0%, #ff9a40 100%)` : "rgba(255,255,255,.06)",
          color: title.trim().length >= 3 && !busy ? "#1a0e04" : "rgba(255,255,255,.4)",
          border: `1px solid ${title.trim().length >= 3 && !busy ? ACCENT : "rgba(255,255,255,.1)"}`,
          borderRadius: 4, fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
          cursor: title.trim().length >= 3 && !busy ? "pointer" : "default", fontFamily: "inherit",
        }}>
          {busy ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Tournament")}
        </button>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.4, color: "rgba(245,130,32,.7)", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const inputS: React.CSSProperties = {
  width: "100%", padding: "8px 10px",
  background: "rgba(10,8,4,.6)",
  border: "1px solid rgba(245,130,32,.3)",
  color: "rgba(255,255,255,.95)",
  borderRadius: 3, fontSize: 12, outline: "none",
  fontFamily: "inherit", boxSizing: "border-box",
};
