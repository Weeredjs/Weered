"use client";

import React from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#a78bfa";

type Contest = {
  id: string;
  title: string;
  theme: string;
  status: "SUBMISSIONS" | "VOTING" | "COMPLETED" | "CANCELED";
  submissionClosesAt: string;
  voteClosesAt: string;
  _count?: { submissions: number };
};

function timeRemaining(target: string): string {
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return "ending now";
  const days = Math.floor(ms / 86400_000);
  const hours = Math.floor((ms % 86400_000) / 3600_000);
  const mins = Math.floor((ms % 3600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

/**
 * Strip showing active VOTING + SUBMISSIONS flair contests for a lobby.
 * Hides itself when nothing is active. Polls every 30s.
 */
export default function FlairContestStrip({ lobbyId }: { lobbyId: string }) {
  const [contests, setContests] = React.useState<Contest[]>([]);
  const [collapsed, setCollapsed] = React.useState(false);

  const fetchActive = React.useCallback(async () => {
    try {
      const url = `${API}/flair-contests?lobbyId=${encodeURIComponent(lobbyId)}&status=SUBMISSIONS&status=VOTING`;
      const r = await fetch(url);
      const j = await r.json();
      if (j?.ok) setContests((j.contests || []).filter((c: Contest) => c.status === "SUBMISSIONS" || c.status === "VOTING"));
    } catch {}
  }, [lobbyId]);

  React.useEffect(() => {
    fetchActive();
    const t = setInterval(fetchActive, 30_000);
    return () => clearInterval(t);
  }, [fetchActive]);

  if (contests.length === 0) return null;

  function openContestsTab() {
    try { window.dispatchEvent(new Event("weered:openContestsTab")); } catch {}
  }

  return (
    <div style={{
      borderRadius: 6,
      border: "1px solid rgba(167,139,250,.3)",
      background: "linear-gradient(180deg, rgba(28,20,48,.65), rgba(20,14,40,.55))",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          padding: "8px 14px",
          display: "flex", alignItems: "center", gap: 10,
          cursor: "pointer", userSelect: "none",
          borderBottom: collapsed ? "none" : "1px solid rgba(167,139,250,.15)",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: "rgba(196,181,253,.85)", textTransform: "uppercase" }}>
          {contests.length} design contest{contests.length > 1 ? "s" : ""} active
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,.5)" }}>{collapsed ? "▾" : "▴"}</span>
      </div>

      {!collapsed && (
        <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {contests.map(c => {
            const isVoting = c.status === "VOTING";
            const target = isVoting ? c.voteClosesAt : c.submissionClosesAt;
            return (
              <div
                key={c.id}
                onClick={openContestsTab}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                  background: "rgba(28,20,48,.5)",
                  border: "1px solid rgba(167,139,250,.18)",
                  borderRadius: 4,
                  cursor: "pointer", transition: "background .12s, border-color .12s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = ACCENT; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,.18)"; }}
              >
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: isVoting ? "#86efac" : ACCENT, textTransform: "uppercase", padding: "2px 6px", border: `1px solid ${isVoting ? "rgba(74,222,128,.35)" : "rgba(167,139,250,.4)"}`, borderRadius: 3 }}>
                  {isVoting ? "Vote" : "Submit"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                  {c.theme && <div style={{ fontSize: 10, color: "rgba(255,255,255,.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.theme}</div>}
                </div>
                <span style={{ fontSize: 10, color: "rgba(196,181,253,.75)", fontWeight: 700, flexShrink: 0 }}>{timeRemaining(target)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
