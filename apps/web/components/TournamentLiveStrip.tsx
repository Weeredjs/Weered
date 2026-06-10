"use client";

import React from "react";
import TournamentMatchModal from "./TournamentMatchModal";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#f58220";

type LiveMatchItem = {
  kind: "live_match";
  id: string;
  round: number;
  bracketPosition: number;
  bracketSide: "WINNERS" | "LOSERS" | "GRAND" | null;
  scoreA: number | null;
  scoreB: number | null;
  liveAt: string | null;
  twitchLogin: string | null;
  pgcrInstanceId: string | null;
  tournament: { id: string; title: string; format: string; lobbyId: string };
  entryA: { id: string; displayName: string; userId: string | null } | null;
  entryB: { id: string; displayName: string; userId: string | null } | null;
};

type TournamentRowItem = {
  kind: "active" | "upcoming";
  tournament: {
    id: string; title: string; description: string; format: string; lobbyId: string;
    status: "REGISTRATION" | "ACTIVE";
    startsAt: string; endsAt: string; registrationOpensAt: string;
    maxEntries: number; minEntries: number; entryCount: number;
    leader?: { displayName: string; score: number; userId: string | null } | null;
    pointsToWin?: number | null;
  };
};

type ChampionItem = {
  kind: "recent_champion";
  tournament: { id: string; title: string; format: string; lobbyId: string; completedAt: string };
  champion: { displayName: string; userId: string | null; score: number } | null;
};

type FeaturedItem = LiveMatchItem | TournamentRowItem | ChampionItem;

export default function TournamentLiveStrip({
  lobbyId,
  currentUserId,
}: {
  lobbyId: string;
  currentUserId?: string;
}) {
  const [items, setItems] = React.useState<FeaturedItem[]>([]);
  const [openMatchId, setOpenMatchId] = React.useState<string | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);

  const fetchFeatured = React.useCallback(async () => {
    try {
      const r = await fetch(`${API}/tournaments/featured?lobbyId=${encodeURIComponent(lobbyId)}`);
      const j = await r.json();
      if (j?.ok) setItems(j.items || []);
    } catch {}
  }, [lobbyId]);

  React.useEffect(() => {
    fetchFeatured();
    const t = setInterval(fetchFeatured, 12_000);
    return () => clearInterval(t);
  }, [fetchFeatured]);

  if (items.length === 0) return null;

  const liveCount = items.filter(i => i.kind === "live_match").length;
  const activeCount = items.filter(i => i.kind === "active").length;
  const upcomingCount = items.filter(i => i.kind === "upcoming").length;
  const championCount = items.filter(i => i.kind === "recent_champion").length;
  const headerColor = liveCount > 0 ? "rgba(74,222,128,.85)" : championCount > 0 ? "rgba(251,191,36,.9)" : activeCount > 0 ? "rgba(245,130,32,.85)" : "rgba(165,180,252,.85)";
  const dotColor = liveCount > 0 ? "#22c55e" : championCount > 0 ? "#fbbf24" : activeCount > 0 ? ACCENT : "#a5b4fc";
  const headerLabel = (() => {
    const parts: string[] = [];
    if (liveCount) parts.push(`${liveCount} match${liveCount > 1 ? "es" : ""} live`);
    if (championCount) parts.push(`${championCount} recent champion${championCount > 1 ? "s" : ""}`);
    if (activeCount) parts.push(`${activeCount} active`);
    if (upcomingCount) parts.push(`${upcomingCount} starting soon`);
    return parts.join(" · ");
  })();

  const openMatchItem = items.find(i => i.kind === "live_match" && i.id === openMatchId) as LiveMatchItem | undefined;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
          textTransform: "uppercase",
          color: headerColor,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: 4, background: dotColor,
            boxShadow: `0 0 6px ${dotColor}cc`,
            animation: liveCount > 0 ? "tls-pulse 1.4s ease-in-out infinite" : "none",
          }} />
          {headerLabel}
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            style={{
              marginLeft: "auto",
              background: "transparent", border: "none",
              color: "rgba(255,255,255,.45)", fontSize: 10,
              letterSpacing: 1, textTransform: "uppercase",
              cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
            }}>{collapsed ? "Show" : "Hide"}</button>
        </div>

        {!collapsed && items.map(it => {
          if (it.kind === "live_match") {
            return <LiveMatchRow key={`m-${it.id}`} match={it} currentUserId={currentUserId} onOpen={() => setOpenMatchId(it.id)} />;
          }
          if (it.kind === "recent_champion") {
            return <ChampionRow key={`c-${it.tournament.id}`} item={it} onOpen={() => {
              try { window.dispatchEvent(new CustomEvent("weered:openTournamentsTab", { detail: { tournamentId: it.tournament.id } })); } catch {}
            }} />;
          }
          return <TournamentStateRow key={`t-${it.tournament.id}`} item={it} onOpen={(tid) => {
            try {
              window.dispatchEvent(new CustomEvent("weered:openTournamentsTab", { detail: { tournamentId: tid } }));
            } catch {}
          }} />;
        })}

        <style>{`
          @keyframes tls-pulse {
            0%, 100% { opacity: 1;   transform: scale(1); }
            50%      { opacity: .55; transform: scale(.85); }
          }
        `}</style>
      </div>

      {openMatchItem && (
        <TournamentMatchModal
          matchId={openMatchItem.id}
          tournamentId={openMatchItem.tournament.id}
          currentUserId={currentUserId}
          isStaff={false}
          onClose={() => { setOpenMatchId(null); fetchFeatured(); }}
          onChanged={fetchFeatured}
        />
      )}
    </>
  );
}

function LiveMatchRow({ match, currentUserId, onOpen }: { match: LiveMatchItem; currentUserId?: string; onOpen: () => void }) {
  const isMine = currentUserId && [match.entryA?.userId, match.entryB?.userId].includes(currentUserId);
  const sideLabel = match.bracketSide === "WINNERS" ? "WB"
    : match.bracketSide === "LOSERS" ? "LB"
    : match.bracketSide === "GRAND" ? "GF" : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 12px",
        background: "linear-gradient(90deg, rgba(34,197,94,.12), rgba(20,14,8,.5) 70%)",
        border: `1px solid ${isMine ? ACCENT : "rgba(34,197,94,.4)"}`,
        borderRadius: 4,
        cursor: "pointer", fontFamily: "inherit", color: "inherit", textAlign: "left",
        boxShadow: isMine ? `0 0 8px ${ACCENT}33` : "none",
      }}>
      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
        padding: "2px 7px",
        background: "rgba(34,197,94,.22)",
        color: "#4ade80",
        borderRadius: 999,
      }}>● Live</span>

      <span style={{ fontSize: 12, color: "rgba(255,255,255,.5)", fontWeight: 600 }}>
        {match.tournament.title}
      </span>

      <span style={{ fontSize: 9, color: "rgba(255,255,255,.4)", letterSpacing: 0.6, textTransform: "uppercase" }}>
        {sideLabel ? `${sideLabel} R${match.round}` : `R${match.round}`}
      </span>

      <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.92)", flex: 1, textAlign: "center" }}>
        {match.entryA?.displayName || "TBD"}
        <span style={{ opacity: 0.45, margin: "0 8px", fontSize: 10 }}>vs</span>
        {match.entryB?.displayName || "TBD"}
        {(match.scoreA != null || match.scoreB != null) && (
          <span style={{ marginLeft: 10, fontFamily: "monospace", color: ACCENT, fontWeight: 800, fontSize: 12 }}>
            {match.scoreA ?? 0}–{match.scoreB ?? 0}
          </span>
        )}
      </span>

      {match.twitchLogin && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          padding: "3px 8px",
          background: "rgba(145,70,255,.18)",
          color: "#c4b5fd",
          borderRadius: 999, textTransform: "uppercase",
        }}>📺 Watch</span>
      )}

      {isMine && (
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
          padding: "2px 7px",
          background: `${ACCENT}28`,
          color: ACCENT,
          borderRadius: 999,
        }}>You</span>
      )}
    </button>
  );
}

function TournamentStateRow({ item, onOpen }: { item: TournamentRowItem; onOpen: (tournamentId: string) => void }) {
  const t = item.tournament;
  const isActive = item.kind === "active";
  const accent = isActive ? ACCENT : "#a5b4fc";
  const bg = isActive
    ? "linear-gradient(90deg, rgba(245,130,32,.14), rgba(20,14,8,.5) 70%)"
    : "linear-gradient(90deg, rgba(99,102,241,.12), rgba(20,14,8,.5) 70%)";
  const chipBg = isActive ? "rgba(245,130,32,.22)" : "rgba(99,102,241,.22)";
  const chipLabel = isActive ? "● Active" : "○ Soon";

  const startsAt = new Date(t.startsAt);
  const now = Date.now();
  const diffMs = startsAt.getTime() - now;
  const timeLabel = (() => {
    if (isActive) {
      if (t.status === "ACTIVE") return "in progress";
      const past = Math.abs(diffMs);
      const h = Math.floor(past / 3600_000);
      if (h < 1) return "starting now";
      if (h < 24) return `started ${h}h ago`;
      return `started ${Math.floor(h / 24)}d ago`;
    }
    const h = Math.floor(diffMs / 3600_000);
    const m = Math.floor((diffMs % 3600_000) / 60_000);
    if (h <= 0 && m <= 0) return "starting now";
    if (h <= 0) return `in ${m}m`;
    if (h < 24) return `in ${h}h ${m}m`;
    return `in ${Math.floor(h / 24)}d`;
  })();

  return (
    <button
      type="button"
      onClick={() => onOpen(t.id)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 12px",
        background: bg,
        border: `1px solid ${accent}55`,
        borderRadius: 4,
        cursor: "pointer", fontFamily: "inherit", color: "inherit",
        textAlign: "left", width: "100%",
        transition: "border-color .12s, box-shadow .12s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px ${accent}33`; (e.currentTarget as HTMLElement).style.borderColor = accent; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.borderColor = `${accent}55`; }}
    >
      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
        padding: "2px 7px",
        background: chipBg,
        color: accent,
        borderRadius: 999,
      }}>{chipLabel}</span>

      <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.92)" }}>
        {t.title}
      </span>

      <span style={{ fontSize: 10, color: "rgba(255,255,255,.45)", letterSpacing: 0.4, textTransform: "uppercase" }}>
        {t.format.replace("_", " ")}
      </span>

      <span style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginLeft: "auto" }}>
        {t.format === "CHALLENGE_RACE" && t.leader
          ? <>Leader: <span style={{ color: "rgba(255,255,255,.85)", fontWeight: 700 }}>{t.leader.displayName}</span> <span style={{ color: ACCENT, fontFamily: "monospace", fontWeight: 800 }}>@ {t.leader.score}{t.pointsToWin ? `/${t.pointsToWin}` : ""}pts</span></>
          : <>{t.entryCount}/{t.maxEntries} entered · {timeLabel}</>}
      </span>

      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
        padding: "3px 9px",
        background: `${accent}20`,
        color: accent,
        borderRadius: 3,
        border: `1px solid ${accent}50`,
      }}>Open Tab</span>
    </button>
  );
}

function ChampionRow({ item, onOpen }: { item: ChampionItem; onOpen: () => void }) {
  const t = item.tournament;
  const c = item.champion;
  const completedAt = new Date(t.completedAt);
  const ageHours = Math.floor((Date.now() - completedAt.getTime()) / 3600_000);
  const ageLabel = ageHours < 1 ? "just now" : ageHours < 2 ? "1h ago" : ageHours < 24 ? `${ageHours}h ago` : `${Math.floor(ageHours / 24)}d ago`;
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 12px",
        background: "linear-gradient(90deg, rgba(251,191,36,.18), rgba(20,14,8,.5) 70%)",
        border: "1px solid rgba(251,191,36,.5)",
        borderRadius: 4,
        cursor: "pointer", fontFamily: "inherit", color: "inherit",
        textAlign: "left", width: "100%",
        boxShadow: "0 0 8px rgba(251,191,36,.18)",
        transition: "border-color .12s, box-shadow .12s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(251,191,36,.35)"; (e.currentTarget as HTMLElement).style.borderColor = "#fbbf24"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 8px rgba(251,191,36,.18)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(251,191,36,.5)"; }}
    >
      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
        padding: "2px 7px",
        background: "rgba(251,191,36,.28)",
        color: "#fbbf24",
        borderRadius: 999,
      }}>🏆 Champion</span>

      <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.92)" }}>
        {c?.displayName || "TBD"}
      </span>

      <span style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>
        won
      </span>

      <span style={{ fontSize: 12, color: "rgba(255,255,255,.85)", fontWeight: 600 }}>
        {t.title}
      </span>

      <span style={{ fontSize: 10, color: "rgba(255,255,255,.45)", letterSpacing: 0.4, textTransform: "uppercase", marginLeft: "auto" }}>
        {ageLabel}
      </span>

      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
        padding: "3px 9px",
        background: "rgba(251,191,36,.20)",
        color: "#fbbf24",
        borderRadius: 3,
        border: "1px solid rgba(251,191,36,.5)",
      }}>Hall of Fame</span>
    </button>
  );
}

