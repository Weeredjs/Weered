"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

const PAL = {
  abyss:     "#0e1826",
  stormDeep: "#19283e",
  stormMid:  "#243752",
  stormFoam: "#2e4363",
  brass:     "#c9a066",
  brassHi:   "#e8c48a",
  brassLow:  "#8a6b3e",
  verdigris: "#4a8a9d",
  parchment: "#e4d4b0",
  parchDim:  "#a89775",
  sea:       "#3a7488",
  blood:     "#a33d3d",
  ink:       "#0a1220",
};

const WR_DISPLAY = `"Pirata One", "Cinzel Decorative", "Luminari", "Georgia", serif`;
const WR_SERIF   = `"Cormorant Garamond", "EB Garamond", "Crimson Pro", "Palatino Linotype", Georgia, serif`;
const WR_MONO    = `"DM Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;

type TierInfo = { label: string; color: string; glow: string; min: number };
const HUNTER_TIERS: TierInfo[] = [
  { label: "Reaper",  color: "#a33d3d", glow: "rgba(163,61,61,.35)",  min: 40 },
  { label: "Marshal", color: "#e8c48a", glow: "rgba(232,196,138,.35)", min: 15 },
  { label: "Tracker", color: "#f97316", glow: "rgba(249,115,22,.35)",  min: 5  },
  { label: "Outlaw",  color: "#5db765", glow: "rgba(93,183,101,.30)",  min: 1  },
];
const POSTER_TIERS: TierInfo[] = [
  { label: "Kingmaker", color: "#e8c48a", glow: "rgba(232,196,138,.35)", min: 40 },
  { label: "Broker",    color: "#c9a066", glow: "rgba(201,160,102,.30)", min: 15 },
  { label: "Runner",    color: "#f97316", glow: "rgba(249,115,22,.30)",  min: 5  },
  { label: "Informant", color: "#4a8a9d", glow: "rgba(74,138,157,.30)",  min: 1  },
];
const hunterTier = (k: number) => HUNTER_TIERS.find(t => k >= t.min) || null;
const posterTier = (p: number) => POSTER_TIERS.find(t => p >= t.min) || null;

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Dossier = {
  ok: true;
  user: { id: string; name: string; avatar?: string | null; avatarColor?: string | null; tier?: string };
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

export default function HunterDossierView({ userId, initial }: { userId: string; initial: Dossier | null }) {
  const [d, setD] = useState<Dossier | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/windrose/hunter/${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(j => { if (!cancelled) { if (j?.ok) setD(j as Dossier); else setErr("No dossier on record."); setLoading(false); } })
      .catch(() => { if (!cancelled) { setErr("Couldn't pull the dossier."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [userId]);

  function copyLink() {
    try {
      navigator.clipboard.writeText(typeof window !== "undefined" ? window.location.href : "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const hTier = d ? hunterTier(d.hunter.kills) : null;
  const pTier = d ? posterTier(d.poster.postedCount) : null;
  const avatarColor = d?.user.avatarColor || PAL.brass;

  return (
    <div style={{
      minHeight: "100vh",
      padding: "40px 20px 60px",
      background: `
        radial-gradient(ellipse 120% 80% at 50% -10%, ${PAL.stormFoam}70 0%, transparent 55%),
        radial-gradient(ellipse 80% 60% at 20% 110%, ${PAL.sea}25 0%, transparent 60%),
        linear-gradient(180deg, ${PAL.stormDeep} 0%, ${PAL.abyss} 100%)
      `,
      color: PAL.parchment,
      fontFamily: WR_SERIF,
    }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Link href="/lobby/windrose" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          color: PAL.parchDim, textDecoration: "none", fontFamily: WR_MONO,
          fontSize: 11, letterSpacing: "2px", textTransform: "uppercase",
          marginBottom: 20,
        }}>
          ← Windrose Hub
        </Link>

        <div style={{
          padding: "26px 30px 24px",
          background: `radial-gradient(ellipse 80% 60% at 20% 0%, ${PAL.brass}18 0%, transparent 60%), linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`,
          border: `2px solid ${PAL.brass}55`,
          borderRadius: 2,
          marginBottom: 20,
          position: "relative",
          boxShadow: `0 12px 40px ${PAL.ink}`,
        }}>
          <div style={{ fontFamily: WR_SERIF, fontSize: 10, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: PAL.brass, marginBottom: 10 }}>
            Bounty Hunter Dossier
          </div>
          {loading ? (
            <div style={{ fontSize: 14, color: PAL.parchDim, fontStyle: "italic" }}>Digging through the ledger…</div>
          ) : err ? (
            <div style={{ fontSize: 14, color: PAL.parchDim, fontStyle: "italic" }}>{err}</div>
          ) : d ? (
            <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              <div style={{
                width: 64, height: 64, borderRadius: 4,
                background: d.user.avatar ? `url(${d.user.avatar}) center/cover` : `linear-gradient(135deg, ${avatarColor}, ${PAL.brassLow})`,
                border: `2px solid ${PAL.brass}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: WR_DISPLAY, fontSize: 30, color: PAL.abyss, fontWeight: 700, flexShrink: 0,
              }}>
                {!d.user.avatar && (d.user.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontFamily: WR_DISPLAY, fontSize: 38, color: PAL.brassHi, letterSpacing: "0.5px", margin: 0, lineHeight: 1.1 }}>
                  {d.user.name}
                </h1>
                <div style={{ fontSize: 12, color: PAL.parchDim, marginTop: 6, fontFamily: WR_MONO, letterSpacing: "1px" }}>
                  {d.hunter.kills > 0 || d.poster.postedCount > 0 ? "ACTIVE ON THE BOUNTY BOARD" : "NO BOUNTY ACTIVITY YET"}
                </div>
                {(hTier || pTier) && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {hTier && <TierBadge tier={hTier} />}
                    {pTier && <TierBadge tier={pTier} />}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={copyLink}
                style={{
                  padding: "10px 18px", borderRadius: 2,
                  border: `1px solid ${PAL.brass}`,
                  background: copied ? `${PAL.brass}30` : `linear-gradient(180deg, ${PAL.stormMid}, ${PAL.abyss})`,
                  color: PAL.brassHi, cursor: "pointer",
                  fontFamily: WR_SERIF, fontSize: 12, fontWeight: 700,
                  letterSpacing: "2px", textTransform: "uppercase",
                  boxShadow: `0 0 0 1px ${PAL.brassLow}`,
                  flexShrink: 0,
                }}
              >
                {copied ? "Copied ✓" : "Copy Link"}
              </button>
            </div>
          ) : null}
        </div>

        {d && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Section title="As Hunter" glyph="⚔" glyphColor="#5db765">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <Stat label="Delivered" value={d.hunter.kills.toLocaleString()} />
                <Stat label="Earned" value={d.hunter.totalEarned.toLocaleString()} sub="Paper" highlight />
                <Stat
                  label="Biggest Hit"
                  value={d.hunter.biggestHit ? d.hunter.biggestHit.amount.toLocaleString() : "—"}
                  sub={d.hunter.biggestHit ? d.hunter.biggestHit.target : undefined}
                />
                <Stat
                  label="Rank"
                  value={d.hunter.rank ? `#${d.hunter.rank}` : "—"}
                  sub={d.hunter.rank ? `of ${d.hunter.totalHunters}` : undefined}
                />
              </div>
              {d.hunter.pendingClaims > 0 && (
                <div style={{ fontSize: 12, color: PAL.brass, fontStyle: "italic", marginTop: 12 }}>
                  {d.hunter.pendingClaims} claim{d.hunter.pendingClaims === 1 ? "" : "s"} awaiting settlement.
                </div>
              )}
              {d.hunter.recentKills.length > 0 && (
                <LedgerList
                  heading="Recent Deliveries"
                  rows={d.hunter.recentKills.map(k => ({
                    id: k.id, icon: "⚔", iconColor: "#5db765",
                    primary: k.target, amount: k.amount, amountColor: PAL.brassHi, at: k.at,
                  }))}
                />
              )}
            </Section>

            <Section title="As Poster" glyph="☠" glyphColor={PAL.blood}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <Stat label="Posted" value={d.poster.postedCount.toLocaleString()} />
                <Stat label="Total Staked" value={d.poster.totalPosted.toLocaleString()} sub="Paper" highlight />
                <Stat label="In Flight" value={d.poster.open.toLocaleString()} />
                <Stat
                  label="Rank"
                  value={d.poster.rank ? `#${d.poster.rank}` : "—"}
                  sub={d.poster.rank ? `of ${d.poster.totalPosters}` : undefined}
                />
              </div>
              {d.poster.recentPosts.length > 0 && (
                <LedgerList
                  heading="Recent Bounties Posted"
                  rows={d.poster.recentPosts.map(p => ({
                    id: p.id,
                    icon: p.status === "SETTLED" ? "✓" : p.status === "OPEN" ? "☠" : p.status === "CLAIMED" ? "⋯" : "✕",
                    iconColor: p.status === "SETTLED" ? "#5db765" : p.status === "OPEN" ? PAL.blood : p.status === "CLAIMED" ? PAL.brassHi : PAL.parchDim,
                    primary: p.target,
                    amount: p.amount,
                    amountColor: PAL.brass,
                    at: p.at,
                  }))}
                />
              )}
            </Section>

            <div style={{ textAlign: "center", paddingTop: 14, borderTop: `1px solid ${PAL.brass}20` }}>
              <Link href="/lobby/windrose" style={{
                display: "inline-block",
                padding: "10px 26px",
                background: `linear-gradient(180deg, ${PAL.brass}, ${PAL.brassLow})`,
                color: PAL.abyss,
                border: `1px solid ${PAL.brassHi}`,
                fontFamily: WR_DISPLAY, fontSize: 14, letterSpacing: "2px", textTransform: "uppercase",
                textDecoration: "none",
                boxShadow: `0 4px 18px ${PAL.brass}30`,
              }}>
                Open the Bounty Board
              </Link>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 36, fontSize: 10, color: PAL.parchDim, fontFamily: WR_MONO, letterSpacing: "2px", textTransform: "uppercase", opacity: 0.7 }}>
          Weered · Windrose community hub
        </div>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: TierInfo }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 12px",
      fontSize: 11, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase",
      fontFamily: WR_MONO,
      color: tier.color,
      background: `${tier.color}15`,
      border: `1px solid ${tier.color}50`,
      boxShadow: `0 0 10px ${tier.glow}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: tier.color }} />
      {tier.label}
    </span>
  );
}

function Section({ title, glyph, glyphColor, children }: { title: string; glyph: string; glyphColor: string; children: React.ReactNode }) {
  return (
    <section style={{
      padding: "20px 24px",
      border: `1px solid ${PAL.brass}35`,
      background: `linear-gradient(180deg, ${PAL.stormMid}c0 0%, ${PAL.stormDeep}e0 100%)`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 10, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: PAL.brass }}>
        <span style={{ color: glyphColor, fontSize: 14 }}>{glyph}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: "12px 14px",
      border: `1px solid ${highlight ? PAL.brass : `${PAL.brass}30`}`,
      background: highlight ? `linear-gradient(180deg, ${PAL.stormFoam} 0%, ${PAL.stormDeep} 100%)` : `${PAL.ink}40`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: PAL.brass, opacity: 0.75, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontFamily: WR_DISPLAY,
        fontSize: 22,
        color: highlight ? PAL.brassHi : PAL.parchment,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 9, color: PAL.parchDim, marginTop: 4, fontFamily: WR_MONO, letterSpacing: "0.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function LedgerList({ heading, rows }: {
  heading: string;
  rows: { id: string; icon: string; iconColor: string; primary: string; amount: number; amountColor: string; at: string }[];
}) {
  return (
    <div style={{ marginTop: 14, padding: "12px 14px", background: `${PAL.brass}06`, border: `1px solid ${PAL.brass}18` }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: PAL.brass, opacity: 0.75, marginBottom: 8 }}>
        {heading}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {rows.map(r => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: PAL.parchment }}>
            <span style={{ color: r.iconColor, flexShrink: 0, width: 14, textAlign: "center" }}>{r.icon}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic" }}>
              {r.primary}
            </span>
            <span style={{ fontFamily: WR_MONO, fontSize: 12, color: r.amountColor, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {r.amount.toLocaleString()}
            </span>
            <span style={{ fontFamily: WR_MONO, fontSize: 10, color: PAL.parchDim, flexShrink: 0, width: 64, textAlign: "right" }}>
              {timeAgo(r.at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
