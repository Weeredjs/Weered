"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

const PAL = {
  abyss: "#0e1826",
  stormDeep: "#19283e",
  stormMid: "#243752",
  stormFoam: "#2e4363",
  brass: "#c9a066",
  brassHi: "#e8c48a",
  brassLow: "#8a6b3e",
  parchment: "#e4d4b0",
  parchDim: "#a89775",
  sea: "#3a7488",
  blood: "#a33d3d",
  ink: "#0a1220",
  verdigris: "#4a8a9d",
};
const WR_DISPLAY = `"Pirata One", "Cinzel Decorative", "Luminari", "Georgia", serif`;
const WR_SERIF = `"Cormorant Garamond", "EB Garamond", "Crimson Pro", "Palatino Linotype", Georgia, serif`;
const WR_MONO = `"DM Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;

type Bounty = {
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

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function BountyView({ id, initial }: { id: string; initial: Bounty | null }) {
  const [b, setB] = useState<Bounty | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [err, setErr] = useState<string | null>(!initial ? "Bounty not found." : null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/windrose/bounties/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.ok && j.bounty) {
          setB(j.bounty);
          setErr(null);
        } else if (!initial) setErr("Bounty not found.");
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setErr("Couldn't load this bounty.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, initial]);

  function copyLink() {
    try {
      navigator.clipboard.writeText(typeof window !== "undefined" ? window.location.href : "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const statusConf = b
    ? (() => {
        switch (b.status) {
          case "OPEN":
            return {
              label: "Open · On the Board",
              color: PAL.blood,
              sub: `Posted ${timeAgo(b.createdAt)}`,
            };
          case "CLAIMED":
            return {
              label: "Delivered · Awaiting Settlement",
              color: PAL.brassHi,
              sub: `Claim submitted ${timeAgo(b.claimedAt)}`,
            };
          case "SETTLED":
            return {
              label: "Settled · Paid Out",
              color: "#5db765",
              sub: `Settled ${timeAgo(b.settledAt)}`,
            };
          case "CANCELLED":
            return {
              label: "Cancelled · Refunded",
              color: PAL.parchDim,
              sub: `Cancelled ${timeAgo(b.cancelledAt)}`,
            };
        }
      })()
    : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px 20px 60px",
        background: `
        radial-gradient(ellipse 120% 80% at 50% -10%, ${PAL.stormFoam}70 0%, transparent 55%),
        radial-gradient(ellipse 80% 60% at 20% 110%, ${PAL.sea}25 0%, transparent 60%),
        linear-gradient(180deg, ${PAL.stormDeep} 0%, ${PAL.abyss} 100%)
      `,
        color: PAL.parchment,
        fontFamily: WR_SERIF,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          href="/lobby/windrose"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: PAL.parchDim,
            textDecoration: "none",
            fontFamily: WR_MONO,
            fontSize: 11,
            letterSpacing: "2px",
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          ← Windrose Hub
        </Link>

        {loading ? (
          <Plaque>
            <div style={{ fontSize: 14, color: PAL.parchDim, fontStyle: "italic" }}>
              Digging through the ledger…
            </div>
          </Plaque>
        ) : err || !b ? (
          <Plaque>
            <h1 style={{ fontFamily: WR_DISPLAY, fontSize: 32, color: PAL.brassHi, margin: 0 }}>
              Bounty not found
            </h1>
            <div style={{ fontSize: 14, color: PAL.parchDim, marginTop: 8, fontStyle: "italic" }}>
              This bounty was never posted, or it's been purged from the ledger.
            </div>
          </Plaque>
        ) : (
          <>
            <div
              style={{
                padding: "30px 32px 28px",
                background: `
                radial-gradient(ellipse 60% 40% at 50% 0%, ${PAL.blood}22 0%, transparent 60%),
                radial-gradient(ellipse 60% 40% at 50% 100%, ${PAL.brass}14 0%, transparent 55%),
                linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)
              `,
                border: `2px solid ${PAL.brass}`,
                boxShadow: `inset 0 0 60px ${PAL.ink}80, 0 12px 40px ${PAL.ink}`,
                marginBottom: 20,
                position: "relative",
                textAlign: "center",
              }}
            >
              {[
                { t: 10, l: 10 },
                { t: 10, r: 10 },
                { b: 10, l: 10 },
                { b: 10, r: 10 },
              ].map((p, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    top: p.t,
                    left: p.l,
                    bottom: p.b,
                    right: p.r,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 30% 30%, ${PAL.brassHi}, ${PAL.brassLow})`,
                    boxShadow: `inset 0 1px 2px ${PAL.ink}, 0 1px 2px ${PAL.ink}`,
                  }}
                />
              ))}

              <div
                style={{
                  fontFamily: WR_MONO,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "6px",
                  textTransform: "uppercase",
                  color: PAL.blood,
                  marginBottom: 10,
                }}
              >
                ☠ Wanted ☠
              </div>
              <h1
                style={{
                  fontFamily: WR_DISPLAY,
                  fontSize: 56,
                  lineHeight: 1,
                  color: PAL.brassHi,
                  margin: "6px 0 16px",
                  letterSpacing: "1px",
                  textShadow: `0 2px 14px ${PAL.brass}40`,
                  wordBreak: "break-word",
                }}
              >
                {b.targetHandle}
              </h1>
              {b.targetServer && (
                <div
                  style={{
                    fontSize: 12,
                    color: PAL.parchDim,
                    fontFamily: WR_MONO,
                    letterSpacing: "1px",
                    marginBottom: 20,
                  }}
                >
                  on {b.targetServer}
                </div>
              )}

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 12,
                  padding: "14px 28px",
                  background: `${PAL.ink}60`,
                  border: `1px solid ${PAL.brass}40`,
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    fontFamily: WR_DISPLAY,
                    fontSize: 54,
                    lineHeight: 1,
                    color: PAL.brassHi,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {b.amount.toLocaleString()}
                </div>
                <div
                  style={{
                    fontFamily: WR_MONO,
                    fontSize: 14,
                    color: PAL.brass,
                    letterSpacing: "3px",
                  }}
                >
                  PAPER
                </div>
              </div>

              {statusConf && (
                <div style={{ marginTop: 6, marginBottom: 8 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 14px",
                      fontFamily: WR_MONO,
                      fontSize: 11,
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      color: statusConf.color,
                      background: `${statusConf.color}12`,
                      border: `1px solid ${statusConf.color}50`,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: statusConf.color,
                        boxShadow: `0 0 6px ${statusConf.color}`,
                      }}
                    />
                    {statusConf.label}
                  </span>
                  <div
                    style={{ fontSize: 11, color: PAL.parchDim, marginTop: 6, fontStyle: "italic" }}
                  >
                    {statusConf.sub}
                  </div>
                </div>
              )}
            </div>

            {b.reason && (
              <div
                style={{
                  padding: "18px 22px",
                  border: `1px solid ${PAL.brass}35`,
                  background: `linear-gradient(180deg, ${PAL.stormMid}c0 0%, ${PAL.stormDeep}e0 100%)`,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: PAL.brass,
                    marginBottom: 8,
                    opacity: 0.75,
                  }}
                >
                  Terms
                </div>
                <div
                  style={{
                    fontSize: 15,
                    color: PAL.parchment,
                    lineHeight: 1.6,
                    fontStyle: "italic",
                  }}
                >
                  {b.reason}
                </div>
              </div>
            )}

            {(b.status === "CLAIMED" || b.status === "SETTLED") && b.proofNote && (
              <div
                style={{
                  padding: "18px 22px",
                  border: `1px solid ${PAL.brass}35`,
                  background: `${PAL.brass}06`,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: PAL.brass,
                    marginBottom: 8,
                    opacity: 0.75,
                  }}
                >
                  Proof ·{" "}
                  {b.claimantId ? (
                    <Link
                      href={`/windrose/hunter/${encodeURIComponent(b.claimantId)}`}
                      style={{
                        color: PAL.brass,
                        textDecoration: "underline dotted",
                        textDecorationColor: `${PAL.brass}60`,
                        textUnderlineOffset: 2,
                      }}
                    >
                      {b.claimantName || "hunter"}
                    </Link>
                  ) : (
                    b.claimantName || "hunter"
                  )}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: PAL.parchment,
                    lineHeight: 1.6,
                    fontStyle: "italic",
                  }}
                >
                  {b.proofNote}
                </div>
                {b.proofImageUrl && (
                  <div style={{ marginTop: 10 }}>
                    <a
                      href={b.proofImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: PAL.verdigris,
                        fontSize: 11,
                        fontFamily: WR_MONO,
                        letterSpacing: "0.5px",
                      }}
                    >
                      View evidence →
                    </a>
                  </div>
                )}
              </div>
            )}

            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}
            >
              <div style={{ ...plaqueStyle(), padding: "14px 16px" }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: PAL.brass,
                    opacity: 0.75,
                    marginBottom: 6,
                  }}
                >
                  Posted by
                </div>
                <Link
                  href={`/windrose/hunter/${encodeURIComponent(b.posterId)}`}
                  style={{
                    fontFamily: WR_DISPLAY,
                    fontSize: 20,
                    color: PAL.brassHi,
                    letterSpacing: "0.3px",
                    textDecoration: "underline dotted",
                    textDecorationColor: `${PAL.brass}60`,
                    textUnderlineOffset: 3,
                  }}
                >
                  {b.posterName}
                </Link>
                <div
                  style={{ fontSize: 11, color: PAL.parchDim, marginTop: 4, fontStyle: "italic" }}
                >
                  {timeAgo(b.createdAt)}
                </div>
              </div>
              {b.claimantId ? (
                <div style={{ ...plaqueStyle(), padding: "14px 16px" }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      color: b.status === "SETTLED" ? "#5db765" : PAL.brass,
                      opacity: 0.75,
                      marginBottom: 6,
                    }}
                  >
                    {b.status === "SETTLED" ? "Claimed by" : "Pending claim by"}
                  </div>
                  <Link
                    href={`/windrose/hunter/${encodeURIComponent(b.claimantId)}`}
                    style={{
                      fontFamily: WR_DISPLAY,
                      fontSize: 20,
                      color: PAL.brassHi,
                      letterSpacing: "0.3px",
                      textDecoration: "underline dotted",
                      textDecorationColor: `${PAL.brass}60`,
                      textUnderlineOffset: 3,
                    }}
                  >
                    {b.claimantName || "hunter"}
                  </Link>
                  <div
                    style={{ fontSize: 11, color: PAL.parchDim, marginTop: 4, fontStyle: "italic" }}
                  >
                    {timeAgo(b.claimedAt || "")}
                  </div>
                </div>
              ) : (
                <div style={{ ...plaqueStyle(), padding: "14px 16px", opacity: 0.6 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      color: PAL.brass,
                      opacity: 0.75,
                      marginBottom: 6,
                    }}
                  >
                    Claimed by
                  </div>
                  <div
                    style={{
                      fontFamily: WR_DISPLAY,
                      fontSize: 20,
                      color: PAL.parchDim,
                      fontStyle: "italic",
                    }}
                  >
                    — no one yet —
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                type="button"
                onClick={copyLink}
                style={{
                  padding: "10px 22px",
                  border: `1px solid ${PAL.brass}`,
                  background: copied
                    ? `${PAL.brass}30`
                    : `linear-gradient(180deg, ${PAL.stormMid}, ${PAL.abyss})`,
                  color: PAL.brassHi,
                  cursor: "pointer",
                  fontFamily: WR_SERIF,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  boxShadow: `0 0 0 1px ${PAL.brassLow}`,
                }}
              >
                {copied ? "Copied ✓" : "Copy Link"}
              </button>
              <Link
                href="/lobby/windrose"
                style={{
                  display: "inline-block",
                  padding: "10px 26px",
                  background: `linear-gradient(180deg, ${PAL.brass}, ${PAL.brassLow})`,
                  color: PAL.abyss,
                  border: `1px solid ${PAL.brassHi}`,
                  fontFamily: WR_DISPLAY,
                  fontSize: 14,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  boxShadow: `0 4px 18px ${PAL.brass}30`,
                }}
              >
                Open the Bounty Board
              </Link>
            </div>
          </>
        )}

        <div
          style={{
            textAlign: "center",
            marginTop: 36,
            fontSize: 10,
            color: PAL.parchDim,
            fontFamily: WR_MONO,
            letterSpacing: "2px",
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          Weered · Windrose community hub
        </div>
      </div>
    </div>
  );
}

function plaqueStyle(): React.CSSProperties {
  return {
    border: `1px solid ${PAL.brass}35`,
    background: `linear-gradient(180deg, ${PAL.stormMid}c0 0%, ${PAL.stormDeep}e0 100%)`,
  };
}

function Plaque({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "26px 30px", ...plaqueStyle() }}>{children}</div>;
}
