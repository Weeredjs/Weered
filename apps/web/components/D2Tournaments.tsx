"use client";
import { useState, useEffect, useCallback } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import { S, apiFetch } from "./D2Shared";

export const FORMAT_LABELS: Record<string, string> = {
  LEADERBOARD: "Leaderboard",
  BRACKET: "Bracket",
  ROUND_ROBIN: "Round Robin",
};
export const STATUS_COLORS: Record<string, string> = {
  REGISTRATION: "#22c55e",
  ACTIVE: "#3b82f6",
  COMPLETED: "#94a3b8",
  CANCELED: "#ef4444",
};

export function TournamentCard({
  tournament,
  myEntry,
  onRegister,
  onWithdraw,
  onView,
}: {
  tournament: any;
  myEntry: any;
  onRegister: () => void;
  onWithdraw: () => void;
  onView: () => void;
}) {
  const t = tournament;
  const isRegistered = !!myEntry;
  const statusColor = STATUS_COLORS[t.status] || "#94a3b8";
  const startsAt = new Date(t.startsAt);
  const endsAt = new Date(t.endsAt);
  const now = Date.now();
  const isLive = t.status === "ACTIVE";
  const isOpen = t.status === "REGISTRATION";

  return (
    <div
      style={{
        ...S.card,
        borderColor: isLive
          ? "rgba(59,130,246,.3)"
          : isRegistered
            ? "rgba(34,197,94,.2)"
            : "rgba(255,255,255,.08)",
        background: isLive ? "rgba(59,130,246,.05)" : "rgba(255,255,255,.03)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span
              style={{
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: "1px",
                textTransform: "uppercase",
                padding: "1px 6px",
                borderRadius: 2,
                background: `${statusColor}20`,
                color: statusColor,
              }}
            >
              {t.status}
            </span>
            <span style={{ fontSize: 9, opacity: 0.4 }}>{FORMAT_LABELS[t.format] || t.format}</span>
            <span style={{ fontSize: 9, opacity: 0.4 }}>{t.entryType}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(243,244,246,.92)" }}>
            {t.title}
          </div>
          {t.description && (
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{t.description}</div>
          )}
        </div>
        <div
          style={{
            textAlign: "center",
            padding: "6px 10px",
            borderRadius: 2,
            background: "rgba(59,130,246,.1)",
            border: "1px solid rgba(59,130,246,.2)",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900, color: "#93c5fd" }}>
            {t._count?.entries || 0}
          </div>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              opacity: 0.5,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            /{t.maxEntries}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, fontSize: 10, opacity: 0.4 }}>
        <span>
          Starts: {startsAt.toLocaleDateString()}{" "}
          {startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
        <span>Ends: {endsAt.toLocaleDateString()}</span>
      </div>

      {(() => {
        const rewards = Array.isArray(t.rewards) ? t.rewards : [];
        const flair = rewards.find((r: any) => r?.kind === "FLAIR" && r?.rank === 1 && r?.item);
        if (!flair) return null;
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 10px",
              borderRadius: 2,
              background: "rgba(124,58,237,.08)",
              border: "1px solid rgba(124,58,237,.22)",
            }}
          >
            {flair.item.imageUrl ? (
              <img
                src={flair.item.imageUrl}
                alt={flair.item.name}
                style={{ width: 20, height: 20, borderRadius: 2, objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 12 }}>🏷️</span>
            )}
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".4px",
                color: "rgb(216,180,254)",
              }}
            >
              WINNER FLAIR
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(243,244,246,.85)" }}>
              {flair.item.name}
            </div>
            <div style={{ fontSize: 9, opacity: 0.45, marginLeft: "auto" }}>
              {flair.item.rarity}
            </div>
          </div>
        );
      })()}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 2,
        }}
      >
        <button onClick={onView} style={{ ...S.btn, fontSize: 10, padding: "4px 10px" }}>
          View Leaderboard
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {isOpen && !isRegistered && (
            <button onClick={onRegister} style={{ ...S.btnPri, fontSize: 11, padding: "5px 14px" }}>
              Register
            </button>
          )}
          {isOpen && isRegistered && (
            <button
              onClick={onWithdraw}
              style={{
                ...S.btn,
                fontSize: 10,
                padding: "3px 10px",
                borderColor: "rgba(239,68,68,.25)",
                color: "rgba(252,165,165,.7)",
              }}
            >
              Withdraw
            </button>
          )}
          {isRegistered && (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 2,
                fontSize: 10,
                fontWeight: 700,
                background: "rgba(34,197,94,.12)",
                color: "#86efac",
              }}
            >
              Registered
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function TournamentLeaderboardView({
  tournamentId,
  title,
  onBack,
}: {
  tournamentId: string;
  title: string;
  onBack: () => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/tournaments/${tournamentId}/leaderboard`).then((res) => {
      if (res?.leaderboard) setRows(res.leaderboard);
      setLoading(false);
    });
  }, [tournamentId]);

  const RANK_COLORS = ["#fcd34d", "#94a3b8", "#cd7f32"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={onBack}
        style={{ ...S.btn, fontSize: 10, padding: "3px 10px", alignSelf: "flex-start" }}
      >
        ← Back
      </button>
      <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(243,244,246,.9)" }}>{title}</div>
      {loading ? (
        <LoadingState compact label="Loading" />
      ) : rows.length === 0 ? (
        <EmptyState compact title="No entries yet." />
      ) : (
        rows.map((r: any) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 10px",
              borderRadius: 2,
              background: r.rank <= 3 ? `${RANK_COLORS[r.rank - 1]}08` : "transparent",
              borderLeft:
                r.rank <= 3 ? `3px solid ${RANK_COLORS[r.rank - 1]}` : "3px solid transparent",
            }}
          >
            <span
              style={{
                width: 22,
                textAlign: "center",
                fontWeight: 900,
                fontSize: 13,
                color: r.rank <= 3 ? RANK_COLORS[r.rank - 1] : "rgba(255,255,255,.3)",
                fontFamily: "monospace",
              }}
            >
              {r.rank}
            </span>
            <span
              style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.85)" }}
            >
              {r.displayName || "Unknown"}
            </span>
            <span
              style={{ fontSize: 13, fontWeight: 900, color: "#93c5fd", fontFamily: "monospace" }}
            >
              {r.score.toLocaleString()}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

export function TournamentBoard({ lobbyId }: { lobbyId: string }) {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const res = await apiFetch(`/tournaments?lobbyId=${encodeURIComponent(lobbyId)}&status=all`);
    if (res?.tournaments) setTournaments(res.tournaments);
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const register = async (id: string) => {
    await apiFetch(`/tournaments/${id}/register`, { method: "POST", body: JSON.stringify({}) });
    fetchAll();
  };
  const withdraw = async (id: string) => {
    await apiFetch(`/tournaments/${id}/register`, { method: "DELETE", body: JSON.stringify({}) });
    fetchAll();
  };

  if (loading)
    return <div style={{ padding: 20, opacity: 0.4, fontSize: 12 }}>Loading tournaments...</div>;

  if (viewId) {
    const t = tournaments.find((t) => t.id === viewId);
    return (
      <TournamentLeaderboardView
        tournamentId={viewId}
        title={t?.title || "Tournament"}
        onBack={() => setViewId(null)}
      />
    );
  }

  if (tournaments.length === 0) {
    return <EmptyState compact title="No tournaments up." hint="Check back after reset." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tournaments.map((t) => (
        <TournamentCard
          key={t.id}
          tournament={t}
          myEntry={null}
          onRegister={() => register(t.id)}
          onWithdraw={() => withdraw(t.id)}
          onView={() => setViewId(t.id)}
        />
      ))}
    </div>
  );
}
