"use client";

import React from "react";
import FlairContestDetail from "./FlairContestDetail";
import CreateFlairContestModal from "./CreateFlairContestModal";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#a78bfa";

type Contest = {
  id: string;
  lobbyId: string | null;
  title: string;
  description: string;
  theme: string;
  kind: "BADGE" | "BANNER" | "NAMEPLATE";
  status: "SUBMISSIONS" | "VOTING" | "COMPLETED" | "CANCELED";
  submissionOpensAt: string;
  submissionClosesAt: string;
  voteOpensAt: string;
  voteClosesAt: string;
  winnerSubmissionId?: string | null;
  rewardFlairId?: string | null;
  createdById: string;
  _count?: { submissions: number };
  mySubmission?: any;
  myVote?: any;
};

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

export default function FlairContestsPanel({
  lobbyId,
  currentUserId,
  isStaff,
}: {
  lobbyId: string;
  currentUserId?: string;
  isStaff?: boolean;
}) {
  const [contests, setContests] = React.useState<Contest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);

  const fetchList = React.useCallback(async () => {
    try {
      const r = await fetch(`${API}/flair-contests?lobbyId=${encodeURIComponent(lobbyId)}`, {
        headers: { ...authHeaders() },
      });
      const j = await r.json();
      if (j?.ok) setContests(j.contests || []);
    } finally {
      setLoading(false);
    }
  }, [lobbyId]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  function canManage(c: Contest): boolean {
    if (isStaff) return true;
    if (currentUserId && c.createdById === currentUserId) return true;
    return false;
  }

  async function deleteContest(c: Contest) {
    const msg = `Delete "${c.title}"? Active contests with submissions will be canceled instead.`;
    if (typeof window !== "undefined" && !window.confirm(msg)) return;
    try {
      const r = await fetch(`${API}/flair-contests/${encodeURIComponent(c.id)}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        alert(j?.error || "Failed to delete");
        return;
      }
      if (openId === c.id) setOpenId(null);
      fetchList();
    } catch (e: any) {
      alert(e?.message || "Failed");
    }
  }

  const active = contests.filter(c => c.status === "SUBMISSIONS" || c.status === "VOTING");
  const past = contests.filter(c => c.status === "COMPLETED" || c.status === "CANCELED");

  if (openId) {
    const c = contests.find(x => x.id === openId);
    if (!c) {
      setOpenId(null);
      return null;
    }
    return (
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "14px 16px", color: "rgba(255,255,255,.92)", fontFamily: "inherit" }}>
        <FlairContestDetail
          contestId={c.id}
          currentUserId={currentUserId}
          canManage={canManage(c)}
          onBack={() => { setOpenId(null); fetchList(); }}
          onChanged={fetchList}
        />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "14px 16px", color: "rgba(255,255,255,.92)", fontFamily: "inherit" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1.2, color: ACCENT, textTransform: "uppercase" }}>
            Design Contests
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
            {active.length} active · {past.length} past
          </div>
        </div>
        {isStaff && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            style={{
              padding: "8px 14px",
              background: `linear-gradient(135deg, ${ACCENT} 0%, #c4b5fd 100%)`,
              color: "#1e1b3a", border: `1px solid ${ACCENT}`,
              borderRadius: 4, fontSize: 11, fontWeight: 800, letterSpacing: 1,
              textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
            }}
          >+ New Contest</button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.45)", fontSize: 13 }}>
          Loading contests...
        </div>
      ) : contests.length === 0 ? (
        <EmptyState isStaff={isStaff} onCreate={() => setShowCreate(true)} />
      ) : (
        <>
          {active.length > 0 && (
            <Section title="Active">
              {active.map(c => (
                <ContestRow key={c.id} c={c} onOpen={() => setOpenId(c.id)} canManage={canManage(c)} onDelete={() => deleteContest(c)} />
              ))}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="Past">
              {past.map(c => (
                <ContestRow key={c.id} c={c} onOpen={() => setOpenId(c.id)} muted canManage={canManage(c)} onDelete={() => deleteContest(c)} />
              ))}
            </Section>
          )}
        </>
      )}

      {showCreate && (
        <CreateFlairContestModal
          lobbyId={lobbyId}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchList(); }}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.4, color: "rgba(167,139,250,.7)", textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function ContestRow({ c, onOpen, muted, canManage, onDelete }: { c: Contest; onOpen: () => void; muted?: boolean; canManage?: boolean; onDelete?: () => void }) {
  const statusColor =
    c.status === "VOTING" ? "#4ade80" :
    c.status === "SUBMISSIONS" ? ACCENT :
    c.status === "COMPLETED" ? "#fbbf24" :
    "rgba(255,255,255,.4)";
  const deadlineDate =
    c.status === "SUBMISSIONS" ? new Date(c.submissionClosesAt) :
    c.status === "VOTING" ? new Date(c.voteClosesAt) :
    new Date(c.voteClosesAt);
  const deadlineLabel =
    c.status === "SUBMISSIONS" ? `Submit by ${deadlineDate.toLocaleString()}` :
    c.status === "VOTING" ? `Vote by ${deadlineDate.toLocaleString()}` :
    `Ended ${deadlineDate.toLocaleDateString()}`;
  const subCount = c._count?.submissions ?? 0;

  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      style={{
        width: "100%", padding: "10px 14px",
        background: muted ? "rgba(20,12,40,.4)" : "rgba(28,20,48,.92)",
        border: `1px solid ${muted ? "rgba(167,139,250,.12)" : "rgba(167,139,250,.3)"}`,
        borderRadius: 4, cursor: "pointer", color: "inherit", textAlign: "left", fontFamily: "inherit",
        transition: "all .12s", boxSizing: "border-box",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = ACCENT; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = muted ? "rgba(167,139,250,.12)" : "rgba(167,139,250,.3)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: muted ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.95)" }}>{c.title}</span>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2, color: statusColor, textTransform: "uppercase" }}>● {c.status}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "2px 7px", background: "rgba(255,255,255,.05)", borderRadius: 999, color: "rgba(255,255,255,.65)", letterSpacing: 0.4 }}>
          {c.kind}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", background: "rgba(167,139,250,.12)", borderRadius: 999, color: "rgba(196,181,253,.85)" }}>
          {subCount} {subCount === 1 ? "entry" : "entries"}
        </span>
        {canManage && onDelete && (
          <button type="button"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            title="Delete contest"
            style={{
              width: 26, height: 26,
              background: "rgba(10,8,16,.6)",
              border: "1px solid rgba(167,139,250,.25)",
              color: "#fca5a5",
              borderRadius: 3, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0,
            }}>🗑</button>
        )}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>
        {c.theme ? <><span style={{ color: "rgba(196,181,253,.7)", fontWeight: 600 }}>Theme:</span> {c.theme} · </> : null}
        {deadlineLabel}
      </div>
    </div>
  );
}

function EmptyState({ isStaff, onCreate }: { isStaff?: boolean; onCreate: () => void }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed rgba(167,139,250,.3)", borderRadius: 6, background: "rgba(20,12,40,.3)" }}>
      <div style={{ fontSize: 18, color: ACCENT, marginBottom: 6 }}>No design contests yet.</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginBottom: 16 }}>
        {isStaff
          ? "Run a design contest. Pick a theme, set dates, mint the winner's design as flair."
          : "When the lobby admins kick one off, it will show up here."}
      </div>
      {isStaff && (
        <button onClick={onCreate} style={{ padding: "8px 18px", background: `linear-gradient(135deg, ${ACCENT} 0%, #c4b5fd 100%)`, color: "#1e1b3a", border: `1px solid ${ACCENT}`, borderRadius: 4, fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>+ Create First Contest</button>
      )}
    </div>
  );
}
