"use client";
import React, { useState, useEffect, useCallback } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import {
  BrassDivider,
  PAL,
  S,
  SkullIcon,
  WR_FONT_DISPLAY,
  WR_FONT_MONO,
  WR_FONT_SERIF,
  apiFetch,
} from "./WrShared";
import { ClaimModal, HunterDossierModal } from "./WrHunter";

export type TierInfo = { label: string; color: string; glow: string; min: number };

export const HUNTER_TIERS: TierInfo[] = [
  { label: "Reaper", color: "#a33d3d", glow: "rgba(163,61,61,.35)", min: 40 },
  { label: "Marshal", color: "#e8c48a", glow: "rgba(232,196,138,.35)", min: 15 },
  { label: "Tracker", color: "#f97316", glow: "rgba(249,115,22,.35)", min: 5 },
  { label: "Outlaw", color: "#5db765", glow: "rgba(93,183,101,.30)", min: 1 },
];
export const POSTER_TIERS: TierInfo[] = [
  { label: "Kingmaker", color: "#e8c48a", glow: "rgba(232,196,138,.35)", min: 40 },
  { label: "Broker", color: "#c9a066", glow: "rgba(201,160,102,.30)", min: 15 },
  { label: "Runner", color: "#f97316", glow: "rgba(249,115,22,.30)", min: 5 },
  { label: "Informant", color: "#4a8a9d", glow: "rgba(74,138,157,.30)", min: 1 },
];

export function hunterTier(kills: number): TierInfo | null {
  return HUNTER_TIERS.find((t) => kills >= t.min) || null;
}
export function posterTier(posts: number): TierInfo | null {
  return POSTER_TIERS.find((t) => posts >= t.min) || null;
}

export function TierBadge({ tier, size = "sm" }: { tier: TierInfo | null; size?: "sm" | "md" }) {
  if (!tier) return null;
  const sm = size === "sm";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: sm ? 3 : 5,
        padding: sm ? "2px 7px" : "3px 10px",
        fontSize: sm ? 9 : 11,
        fontWeight: 800,
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        fontFamily: WR_FONT_MONO,
        color: tier.color,
        background: `${tier.color}15`,
        border: `1px solid ${tier.color}50`,
        boxShadow: `0 0 8px ${tier.glow}`,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: sm ? 4 : 5,
          height: sm ? 4 : 5,
          borderRadius: "50%",
          background: tier.color,
        }}
      />
      {tier.label}
    </span>
  );
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export type CommunityServer = {
  id: string;
  name: string;
  host: string;
  dashboardUrl?: string | null;
  queryUrl?: string | null;
  region?: string | null;
  description?: string | null;
  tags?: string[];
  maxSlots?: number | null;
  framework?: string | null;
  status: string;
  lastSeenAt?: string | null;
  lastState?: any;
  createdAt: string;
  owner?: { id: string; name: string; avatar?: string | null; avatarColor?: string | null };
};

export type PublicServer = {
  addr: string;
  steamId: string;
  name: string;
  players: number;
  maxPlayers: number;
  map: string;
  gameType: string;
  version: string;
  os: string;
  secure: boolean;
  passworded: boolean;
};

export type PortRow = {
  key: string;
  source: "registered" | "public" | "both";
  name: string;
  addr: string;
  description?: string | null;
  region?: string | null;
  framework?: string | null;
  tags?: string[];
  players: number;
  maxPlayers: number;
  passworded?: boolean;
  secure?: boolean;
  owner?: CommunityServer["owner"];
  dashboardUrl?: string | null;
  status?: string;
};

export const WR_REGIONS_LIST = ["NA-East", "NA-West", "EU", "OCE", "ASIA", "SA", "MENA"];
export const WR_FRAMEWORKS = ["WindrosePlus", "Vanilla", "Other"];

export type Bounty = {
  id: string;
  posterId: string;
  posterName: string;
  targetHandle: string;
  targetServer?: string | null;
  amount: number;
  reason: string;
  status: "OPEN" | "CLAIMED" | "SETTLED" | "CANCELLED";
  claimantId?: string | null;
  claimantName?: string | null;
  proofNote?: string | null;
  proofImageUrl?: string | null;
  createdAt: string;
  claimedAt?: string | null;
  settledAt?: string | null;
  cancelledAt?: string | null;
};

export type BountyFilter = "OPEN" | "CLAIMED" | "SETTLED" | "MINE" | "LEADERBOARD";

export type HunterDossier = {
  user: {
    id: string;
    name: string;
    avatar?: string | null;
    avatarColor?: string | null;
    tier?: string;
    globalRole?: string;
  };
  hunter: {
    kills: number;
    totalEarned: number;
    biggestHit: { target: string; amount: number; at: string } | null;
    pendingClaims: number;
    rank: number | null;
    totalHunters: number;
    recentKills: { id: string; target: string; amount: number; at: string }[];
  };
  poster: {
    postedCount: number;
    totalPosted: number;
    open: number;
    settled: number;
    rank: number | null;
    totalPosters: number;
    recentPosts: { id: string; target: string; amount: number; status: string; at: string }[];
  };
};

export type LeaderboardData = {
  mostWanted: { targetHandle: string; openCount: number; totalAmount: number }[];
  topHunters: { userId: string; userName: string; kills: number; totalEarned: number }[];
  biggestPosters: { userId: string; userName: string; postedCount: number; totalPosted: number }[];
  stats: { openCount: number; openTotal: number; settledCount: number; settledTotal: number };
};

export function BountiesTab() {
  const [bounties, setBounties] = useState<Bounty[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BountyFilter>("OPEN");
  const [balance, setBalance] = useState<number | null>(null);

  const [target, setTarget] = useState("");
  const [server, setServer] = useState("");
  const [amount, setAmount] = useState<number>(1000);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [claiming, setClaiming] = useState<Bounty | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);

  const [myDossier, setMyDossier] = useState<HunterDossier | null>(null);

  const [dossierUserId, setDossierUserId] = useState<string | null>(null);

  const [targetFilter, setTargetFilter] = useState<string>("");

  const [myId, setMyId] = useState<string>("");
  useEffect(() => {
    apiFetch("/auth/me")
      .then((j) => {
        if (j?.user?.id) setMyId(j.user.id);
      })
      .catch(() => {});
    apiFetch("/paper/wallet")
      .then((j) => {
        if (typeof j?.balance === "number") setBalance(j.balance);
      })
      .catch(() => {});
  }, []);

  const loadDossier = useCallback(() => {
    if (!myId) return;
    apiFetch(`/windrose/hunter/${encodeURIComponent(myId)}`)
      .then((j) => {
        if (j?.ok) setMyDossier(j as HunterDossier);
      })
      .catch(() => {});
  }, [myId]);
  useEffect(() => {
    loadDossier();
  }, [loadDossier]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      if (filter === "LEADERBOARD") {
        const j = await apiFetch("/windrose/bounties/leaderboard");
        setLeaderboard(j?.ok ? (j as LeaderboardData) : null);
      } else {
        const params = new URLSearchParams();
        if (targetFilter) {
          params.set("target", targetFilter);
        } else {
          if (filter === "MINE") params.set("mine", "1");
          if (filter === "OPEN") params.set("status", "OPEN");
          if (filter === "CLAIMED") params.set("status", "CLAIMED");
          if (filter === "SETTLED") params.set("status", "SETTLED");
        }
        const qs = params.toString() ? `?${params.toString()}` : "";
        const j = await apiFetch(`/windrose/bounties${qs}`);
        if (j?.ok && Array.isArray(j.bounties)) setBounties(j.bounties);
        else setBounties([]);
      }
    } catch {
      setBounties([]);
      setLeaderboard(null);
    }
    setLoading(false);
  }, [filter, targetFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function refreshWallet() {
    try {
      const j = await apiFetch("/paper/wallet");
      if (typeof j?.balance === "number") setBalance(j.balance);
    } catch {}
  }

  async function postBounty() {
    if (!target.trim() || busy) return;
    setErr(null);
    setBusy(true);
    const j = await apiFetch("/windrose/bounties", {
      method: "POST",
      body: JSON.stringify({
        targetHandle: target.trim(),
        targetServer: server.trim() || undefined,
        amount,
        reason: reason.trim(),
      }),
    });
    setBusy(false);
    if (j?.ok) {
      setTarget("");
      setServer("");
      setReason("");
      setAmount(1000);
      if (typeof j.balance === "number") setBalance(j.balance);
      reload();
    } else {
      setErr(j?.message || j?.error || "Failed to post bounty.");
    }
  }

  async function settleBounty(id: string) {
    const j = await apiFetch(`/windrose/bounties/${id}/settle`, { method: "POST", body: "{}" });
    if (j?.ok) {
      reload();
      refreshWallet();
      loadDossier();
    }
  }
  async function rejectBounty(id: string) {
    const j = await apiFetch(`/windrose/bounties/${id}/reject`, { method: "POST", body: "{}" });
    if (j?.ok) {
      reload();
      loadDossier();
    }
  }
  async function cancelBounty(id: string) {
    if (!window.confirm("Cancel and refund this bounty?")) return;
    const j = await apiFetch(`/windrose/bounties/${id}/cancel`, { method: "POST", body: "{}" });
    if (j?.ok) {
      reload();
      refreshWallet();
      loadDossier();
    }
  }

  const openBountyTotal = (bounties || [])
    .filter((b) => b.status === "OPEN" || b.status === "CLAIMED")
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...S.card, padding: "18px 22px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ ...S.label, marginBottom: 4 }}>The Bounty Board</div>
            <h3
              style={{
                fontFamily: WR_FONT_DISPLAY,
                fontSize: 24,
                color: PAL.brassHi,
                margin: 0,
                letterSpacing: "0.5px",
              }}
            >
              Put a price on anything.
            </h3>
            <div
              style={{
                fontSize: 13,
                color: PAL.parchDim,
                marginTop: 6,
                fontStyle: "italic",
                lineHeight: 1.55,
              }}
            >
              Paper bounty on whatever you want hunted down — a sailor, a Kraken tooth, a lighthouse
              seed, a cargo run. A hunter delivers proof, you confirm, Paper changes hands. Stake's
              escrowed the moment you post — refunded only on cancel.
            </div>
          </div>
          <div style={{ display: "flex", gap: 22, flexShrink: 0, alignItems: "flex-start" }}>
            {myDossier && (myDossier.hunter.kills > 0 || myDossier.poster.postedCount > 0) && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 4,
                  paddingRight: 22,
                  borderRight: `1px solid ${PAL.brass}25`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ ...S.label, fontSize: 9 }}>Your Hunter Record</div>
                  <TierBadge tier={hunterTier(myDossier.hunter.kills)} />
                </div>
                <div style={{ display: "flex", gap: 18, alignItems: "flex-end" }}>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: WR_FONT_DISPLAY,
                        fontSize: 22,
                        color: PAL.parchment,
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {myDossier.hunter.kills}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: PAL.parchDim,
                        fontFamily: WR_FONT_MONO,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        marginTop: 3,
                      }}
                    >
                      delivered
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: WR_FONT_DISPLAY,
                        fontSize: 22,
                        color: "#5db765",
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {myDossier.hunter.totalEarned.toLocaleString()}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: PAL.parchDim,
                        fontFamily: WR_FONT_MONO,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        marginTop: 3,
                      }}
                    >
                      earned
                    </div>
                  </div>
                  {myDossier.hunter.rank ? (
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontFamily: WR_FONT_DISPLAY,
                          fontSize: 22,
                          color: PAL.brassHi,
                          lineHeight: 1,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        #{myDossier.hunter.rank}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: PAL.parchDim,
                          fontFamily: WR_FONT_MONO,
                          letterSpacing: "1px",
                          textTransform: "uppercase",
                          marginTop: 3,
                        }}
                      >
                        of {myDossier.hunter.totalHunters}
                      </div>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => myId && setDossierUserId(myId)}
                  style={{ ...S.btn, fontSize: 10, padding: "5px 12px", marginTop: 4 }}
                >
                  View dossier →
                </button>
              </div>
            )}

            <div
              style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}
            >
              <div style={{ ...S.label, fontSize: 9 }}>Your Paper</div>
              <div
                style={{
                  fontFamily: WR_FONT_DISPLAY,
                  fontSize: 28,
                  color: PAL.brassHi,
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {balance === null ? "—" : balance.toLocaleString()}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: PAL.parchDim,
                  fontFamily: WR_FONT_MONO,
                  letterSpacing: "0.5px",
                }}
              >
                · {openBountyTotal.toLocaleString()} in flight
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...S.card, padding: 18 }}>
        <div
          style={{ ...S.label, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}
        >
          <SkullIcon size={14} />
          Post a bounty
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>Mark *</div>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value.slice(0, 60))}
              placeholder="BlackbeardXL · Kraken tooth · Rum run to Tortuga"
              style={S.input as React.CSSProperties}
            />
            <div style={{ fontSize: 9, color: PAL.parchDim, marginTop: 3, fontStyle: "italic" }}>
              Sailor, beast, cargo, location — whatever you want hunted.
            </div>
          </div>
          <div>
            <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>Server (optional)</div>
            <input
              value={server}
              onChange={(e) => setServer(e.target.value.slice(0, 120))}
              placeholder="play.myserver.com"
              style={S.input as React.CSSProperties}
            />
          </div>
          <div>
            <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>Amount (Paper) *</div>
            <input
              type="number"
              min={100}
              max={500000}
              step={100}
              value={amount}
              onChange={(e) =>
                setAmount(Math.max(100, Math.min(500000, Number(e.target.value) || 100)))
              }
              style={{ ...S.input, fontVariantNumeric: "tabular-nums" } as React.CSSProperties}
            />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>Terms (optional)</div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 400))}
            placeholder="What counts as delivered. A grudge, a trade, a dare — spell it out so the hunter knows what proof you'll accept."
            style={
              {
                ...S.input,
                minHeight: 54,
                fontFamily: WR_FONT_SERIF,
                fontStyle: "italic",
              } as React.CSSProperties
            }
          />
        </div>
        {err && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              background: "rgba(163,61,61,0.12)",
              border: "1px solid rgba(163,61,61,0.35)",
              borderRadius: 3,
              color: "rgba(232,196,138,0.9)",
              fontSize: 12,
            }}
          >
            {err}
          </div>
        )}
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <span style={{ fontFamily: WR_FONT_MONO, fontSize: 10, color: PAL.parchDim }}>
            {amount.toLocaleString()} Paper will be held in escrow
          </span>
          <button
            type="button"
            style={S.btnPrimary}
            onClick={postBounty}
            disabled={busy || !target.trim()}
          >
            {busy ? "Posting…" : "Post Bounty"}
          </button>
        </div>
      </div>

      {targetFilter && (
        <div
          style={{
            ...S.card,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            borderColor: PAL.blood,
            background: `radial-gradient(ellipse 80% 60% at 10% 0%, ${PAL.blood}20 0%, transparent 65%), ${S.card.background}`,
          }}
        >
          <SkullIcon size={18} color={PAL.blood} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...S.label, fontSize: 9, color: PAL.blood, marginBottom: 3 }}>
              Rap Sheet
            </div>
            <div
              style={{
                fontFamily: WR_FONT_DISPLAY,
                fontSize: 20,
                color: PAL.brassHi,
                letterSpacing: "0.3px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Every bounty on {targetFilter}
            </div>
          </div>
          <button
            type="button"
            style={{ ...S.btn, fontSize: 10, padding: "6px 14px" }}
            onClick={() => setTargetFilter("")}
          >
            Clear ✕
          </button>
        </div>
      )}

      {!targetFilter && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(
            [
              { id: "OPEN", label: "Open" },
              { id: "CLAIMED", label: "Claimed" },
              { id: "MINE", label: "Mine" },
              { id: "SETTLED", label: "Settled" },
              { id: "LEADERBOARD", label: "⚑ Hall of Fame" },
            ] as { id: BountyFilter; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              style={{
                ...S.btn,
                padding: "6px 14px",
                fontSize: 11,
                borderColor: filter === t.id ? PAL.brass : `${PAL.brass}35`,
                background: filter === t.id ? `${PAL.brass}20` : S.btn.background,
                color: filter === t.id ? PAL.brassHi : PAL.parchDim,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingState
          label={
            filter === "LEADERBOARD" ? "Tallying the tales..." : "Combing the wanted posters..."
          }
        />
      ) : filter === "LEADERBOARD" ? (
        <BountyLeaderboard
          data={leaderboard}
          onPickTarget={(h) => {
            setTargetFilter(h);
            setFilter("OPEN");
          }}
        />
      ) : !bounties || bounties.length === 0 ? (
        <EmptyState
          icon="🏴‍☠️"
          title={filter === "MINE" ? "You've posted nothing." : "No bounties yet."}
          hint={
            filter === "MINE"
              ? "No marks on your tally — yet."
              : "Be the first to put a price on the board."
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 12,
          }}
        >
          {bounties.map((b) => (
            <BountyCard
              key={b.id}
              b={b}
              meId={myId}
              onClaim={() => setClaiming(b)}
              onSettle={() => settleBounty(b.id)}
              onReject={() => rejectBounty(b.id)}
              onCancel={() => cancelBounty(b.id)}
              onOpenHunter={(uid) => setDossierUserId(uid)}
              onFilterTarget={(h) => setTargetFilter(h)}
            />
          ))}
        </div>
      )}

      {claiming && (
        <ClaimModal
          bounty={claiming}
          onClose={() => setClaiming(null)}
          onSubmitted={() => {
            setClaiming(null);
            reload();
            loadDossier();
          }}
        />
      )}

      {dossierUserId && (
        <HunterDossierModal userId={dossierUserId} onClose={() => setDossierUserId(null)} />
      )}
    </div>
  );
}

export function BountyLeaderboard({
  data,
  onPickTarget,
}: {
  data: LeaderboardData | null;
  onPickTarget: (handle: string) => void;
}) {
  if (!data) {
    return (
      <EmptyState
        icon="⚑"
        title="No legends yet"
        hint="Once the first bounty settles, the Hall of Fame opens its doors."
      />
    );
  }
  const { mostWanted, topHunters, biggestPosters, stats } = data;
  const hasAny = mostWanted.length > 0 || topHunters.length > 0 || biggestPosters.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <StatTile
          label="Open bounties"
          value={stats.openCount.toLocaleString()}
          sub="on the board"
        />
        <StatTile
          label="Paper in flight"
          value={stats.openTotal.toLocaleString()}
          sub="held in escrow"
          highlight
        />
        <StatTile
          label="Bounties settled"
          value={stats.settledCount.toLocaleString()}
          sub="kills confirmed"
        />
        <StatTile
          label="Paper paid out"
          value={stats.settledTotal.toLocaleString()}
          sub="to hunters"
          highlight
        />
      </div>

      {!hasAny ? (
        <EmptyState
          icon="⚑"
          title="No legends yet"
          hint="Post a few bounties and settle a few kills — the Hall of Fame fills itself."
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 12,
          }}
        >
          <LeaderboardColumn
            title="Most Wanted"
            caption="Highest bounty on a sailor's head"
            emptyLabel="No open marks right now."
            rows={mostWanted.map((r, i) => ({
              key: r.targetHandle,
              rank: i + 1,
              primary: r.targetHandle,
              secondary: `${r.openCount} bounty${r.openCount === 1 ? "" : "ies"} open`,
              value: r.totalAmount,
              onClick: () => onPickTarget(r.targetHandle),
            }))}
          />
          <LeaderboardColumn
            title="Top Hunters"
            caption="Most Paper earned on delivered bounties"
            emptyLabel="No one's cashed in yet."
            rows={topHunters.map((r, i) => ({
              key: r.userId,
              rank: i + 1,
              primary: r.userName,
              secondary: `${r.kills} delivered`,
              value: r.totalEarned,
            }))}
          />
          <LeaderboardColumn
            title="Biggest Posters"
            caption="Most Paper put on the board"
            emptyLabel="No one's opened their purse."
            rows={biggestPosters.map((r, i) => ({
              key: r.userId,
              rank: i + 1,
              primary: r.userName,
              secondary: `${r.postedCount} bount${r.postedCount === 1 ? "y" : "ies"} posted`,
              value: r.totalPosted,
            }))}
          />
        </div>
      )}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        ...S.card,
        padding: "12px 14px",
        textAlign: "center",
        background: highlight
          ? `linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`
          : S.card.background,
        borderColor: highlight ? PAL.brass : `${PAL.brass}35`,
      }}
    >
      <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontFamily: WR_FONT_DISPLAY,
          fontSize: 24,
          color: highlight ? PAL.brassHi : PAL.parchment,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: PAL.parchDim, marginTop: 5, fontStyle: "italic" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function LeaderboardColumn({
  title,
  caption,
  rows,
  emptyLabel,
}: {
  title: string;
  caption: string;
  emptyLabel: string;
  rows: {
    key: string;
    rank: number;
    primary: string;
    secondary: string;
    value: number;
    onClick?: () => void;
  }[];
}) {
  return (
    <div
      style={{ ...S.card, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div>
        <div
          style={{
            fontFamily: WR_FONT_DISPLAY,
            fontSize: 18,
            color: PAL.brassHi,
            letterSpacing: "0.3px",
            lineHeight: 1,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 11, color: PAL.parchDim, marginTop: 3, fontStyle: "italic" }}>
          {caption}
        </div>
      </div>
      <BrassDivider />
      {rows.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: PAL.parchDim,
            fontStyle: "italic",
            padding: "16px 0",
            textAlign: "center",
          }}
        >
          {emptyLabel}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map((r) => (
            <div
              key={r.key}
              onClick={r.onClick}
              title={r.onClick ? "See all bounties on this target" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background:
                  r.rank === 1
                    ? `${PAL.brass}12`
                    : r.rank === 2
                      ? `${PAL.brass}08`
                      : r.rank === 3
                        ? `${PAL.brass}05`
                        : "transparent",
                border: `1px solid ${r.rank <= 3 ? `${PAL.brass}25` : `${PAL.brass}10`}`,
                borderRadius: 2,
                cursor: r.onClick ? "pointer" : "default",
                transition: "border-color .15s, background .15s",
              }}
              onMouseEnter={(e) => {
                if (r.onClick) (e.currentTarget as HTMLElement).style.borderColor = PAL.brass;
              }}
              onMouseLeave={(e) => {
                if (r.onClick)
                  (e.currentTarget as HTMLElement).style.borderColor =
                    r.rank <= 3 ? `${PAL.brass}25` : `${PAL.brass}10`;
              }}
            >
              <span
                style={{
                  width: 22,
                  textAlign: "center",
                  fontFamily: WR_FONT_DISPLAY,
                  fontSize: r.rank === 1 ? 18 : 14,
                  color: r.rank === 1 ? PAL.brassHi : r.rank <= 3 ? PAL.brass : PAL.parchDim,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {r.rank}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: WR_FONT_DISPLAY,
                    fontSize: 14,
                    color: r.rank === 1 ? PAL.parchment : PAL.parchment,
                    letterSpacing: "0.3px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.primary}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: PAL.parchDim,
                    fontStyle: "italic",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.secondary}
                </div>
              </div>
              <div
                style={{
                  textAlign: "right",
                  flexShrink: 0,
                  fontFamily: WR_FONT_MONO,
                  fontSize: 12,
                  fontVariantNumeric: "tabular-nums",
                  color: r.rank <= 3 ? PAL.brassHi : PAL.brass,
                  fontWeight: 600,
                }}
              >
                {r.value.toLocaleString()}
                <div
                  style={{ fontSize: 8, color: PAL.parchDim, letterSpacing: "1px", marginTop: 1 }}
                >
                  PAPER
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BountyCard({
  b,
  meId,
  onClaim,
  onSettle,
  onReject,
  onCancel,
  onOpenHunter,
  onFilterTarget,
}: {
  b: Bounty;
  meId: string;
  onClaim: () => void;
  onSettle: () => void;
  onReject: () => void;
  onCancel: () => void;
  onOpenHunter: (userId: string) => void;
  onFilterTarget: (handle: string) => void;
}) {
  const mine = !!meId && meId === b.posterId;
  const mineClaim = !!meId && meId === b.claimantId;
  const statusColor =
    b.status === "OPEN"
      ? "#5db765"
      : b.status === "CLAIMED"
        ? PAL.brassHi
        : b.status === "SETTLED"
          ? PAL.brass
          : "#a54848";
  const statusLabel =
    b.status === "OPEN"
      ? "OPEN"
      : b.status === "CLAIMED"
        ? "AWAITING SETTLE"
        : b.status === "SETTLED"
          ? "SETTLED"
          : "CANCELLED";

  return (
    <div
      style={{ ...S.card, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...S.label, fontSize: 9, marginBottom: 2 }}>
            <SkullIcon size={10} /> Wanted
          </div>
          <button
            type="button"
            onClick={() => onFilterTarget(b.targetHandle)}
            title="See all bounties on this target"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "block",
              textAlign: "left",
              maxWidth: "100%",
              fontFamily: WR_FONT_DISPLAY,
              fontSize: 20,
              color: PAL.parchment,
              lineHeight: 1.1,
              letterSpacing: "0.3px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = PAL.brassHi)}
            onMouseLeave={(e) => (e.currentTarget.style.color = PAL.parchment)}
          >
            {b.targetHandle}
          </button>
          {b.targetServer && (
            <div
              style={{
                fontFamily: WR_FONT_MONO,
                fontSize: 10,
                color: PAL.parchDim,
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              on {b.targetServer}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontFamily: WR_FONT_DISPLAY,
              fontSize: 22,
              color: PAL.brassHi,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {b.amount.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: 9,
              color: PAL.parchDim,
              fontFamily: WR_FONT_MONO,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            Paper
          </div>
        </div>
      </div>

      {b.reason && (
        <div
          style={{
            fontSize: 12,
            color: PAL.parchment,
            lineHeight: 1.5,
            fontStyle: "italic",
            opacity: 0.85,
            borderLeft: `2px solid ${PAL.brass}55`,
            paddingLeft: 10,
          }}
        >
          {b.reason.length > 160 ? `${b.reason.slice(0, 160)}…` : b.reason}
        </div>
      )}

      {(b.status === "CLAIMED" || b.status === "SETTLED") && b.proofNote && (
        <div
          style={{
            padding: "8px 10px",
            background: `${PAL.brass}10`,
            border: `1px solid ${PAL.brass}25`,
            borderRadius: 2,
            fontSize: 11,
            color: PAL.parchment,
          }}
        >
          <div style={{ ...S.label, fontSize: 8, marginBottom: 3 }}>
            Proof ·{" "}
            {b.claimantId ? (
              <button
                type="button"
                onClick={() => onOpenHunter(b.claimantId!)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: PAL.brass,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: "inherit",
                  textTransform: "inherit",
                  textDecoration: "underline dotted",
                  textDecorationColor: `${PAL.brass}60`,
                  textUnderlineOffset: 2,
                }}
              >
                {b.claimantName || "hunter"}
              </button>
            ) : (
              b.claimantName || "hunter"
            )}
          </div>
          <div style={{ lineHeight: 1.4, fontStyle: "italic" }}>
            {b.proofNote.length > 180 ? `${b.proofNote.slice(0, 180)}…` : b.proofNote}
          </div>
          {b.proofImageUrl && (
            <div style={{ marginTop: 6 }}>
              <a
                href={b.proofImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: PAL.verdigris,
                  fontSize: 10,
                  fontFamily: WR_FONT_MONO,
                  letterSpacing: "0.5px",
                }}
              >
                View evidence →
              </a>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 9,
            fontFamily: WR_FONT_MONO,
            color: statusColor,
            letterSpacing: "1px",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
            }}
          />
          {statusLabel}
        </span>
        <span style={{ fontSize: 10, color: PAL.parchDim, fontStyle: "italic" }}>
          posted by{" "}
          <button
            type="button"
            onClick={() => onOpenHunter(b.posterId)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: PAL.brass,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 10,
              fontStyle: "italic",
              textDecoration: "underline dotted",
              textDecorationColor: `${PAL.brass}60`,
              textUnderlineOffset: 2,
            }}
          >
            {b.posterName}
          </button>{" "}
          · {timeAgo(b.createdAt)}
        </span>
        <span style={{ flex: 1 }} />
        <a
          href={`/windrose/bounty/${encodeURIComponent(b.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open the shareable bounty page"
          style={{
            fontSize: 10,
            color: PAL.parchDim,
            textDecoration: "none",
            fontFamily: WR_FONT_MONO,
            letterSpacing: "0.5px",
            padding: "2px 6px",
            border: `1px solid ${PAL.brass}20`,
            transition: "border-color .15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${PAL.brass}55`)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = `${PAL.brass}20`)}
        >
          share ↗
        </a>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
        {b.status === "OPEN" && !mine && meId && (
          <button
            type="button"
            style={{ ...S.btnPrimary, fontSize: 11, padding: "7px 14px" }}
            onClick={onClaim}
          >
            I got 'em — Claim
          </button>
        )}
        {b.status === "OPEN" && mine && (
          <button
            type="button"
            style={{
              ...S.btn,
              fontSize: 10,
              padding: "6px 12px",
              color: "rgba(252,165,165,0.85)",
              borderColor: "rgba(163,61,61,0.45)",
            }}
            onClick={onCancel}
          >
            Cancel & Refund
          </button>
        )}
        {b.status === "CLAIMED" && mine && (
          <>
            <button
              type="button"
              style={{ ...S.btnPrimary, fontSize: 11, padding: "7px 14px" }}
              onClick={onSettle}
            >
              Settle · Pay {b.amount.toLocaleString()}
            </button>
            <button
              type="button"
              style={{
                ...S.btn,
                fontSize: 10,
                padding: "6px 12px",
                color: "rgba(252,165,165,0.85)",
              }}
              onClick={onReject}
            >
              Reject
            </button>
          </>
        )}
        {b.status === "CLAIMED" && !mine && mineClaim && (
          <span style={{ fontSize: 11, color: PAL.brass, fontStyle: "italic", padding: "6px 0" }}>
            Awaiting poster's confirmation…
          </span>
        )}
        {b.status === "SETTLED" && (
          <span style={{ fontSize: 11, color: PAL.brass, fontStyle: "italic" }}>
            Paid to{" "}
            {b.claimantId ? (
              <button
                type="button"
                onClick={() => onOpenHunter(b.claimantId!)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: PAL.brassHi,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontStyle: "italic",
                  fontSize: 11,
                  textDecoration: "underline dotted",
                  textDecorationColor: `${PAL.brassHi}60`,
                  textUnderlineOffset: 2,
                }}
              >
                {b.claimantName || "hunter"}
              </button>
            ) : (
              b.claimantName || "hunter"
            )}
          </span>
        )}
      </div>
    </div>
  );
}
