"use client";
import React, { useState, useEffect } from "react";
import {
  PAL,
  S,
  SkullIcon,
  WR_FONT_DISPLAY,
  WR_FONT_MONO,
  WR_FONT_SERIF,
  apiFetch,
} from "./WrShared";
import { Bounty, HunterDossier, TierBadge, hunterTier, posterTier, timeAgo } from "./WrBounties";

export function HunterDossierModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [d, setD] = useState<HunterDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    apiFetch(`/windrose/hunter/${encodeURIComponent(userId)}`)
      .then((j) => {
        if (j?.ok) setD(j as HunterDossier);
        else setErr("No dossier on record.");
        setLoading(false);
      })
      .catch(() => {
        setErr("Couldn't pull the dossier.");
        setLoading(false);
      });
  }, [userId]);

  const avatarColor = d?.user.avatarColor || PAL.brass;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(5,5,10,.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...S.card,
          width: "min(620px, 100%)",
          padding: 0,
          maxHeight: "90vh",
          overflowY: "auto",
          borderColor: `${PAL.brass}55`,
        }}
      >
        <div
          style={{
            padding: "20px 26px 18px",
            background: `radial-gradient(ellipse 80% 60% at 20% 0%, ${PAL.brass}18 0%, transparent 60%), linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`,
            borderBottom: `1px solid ${PAL.brass}30`,
          }}
        >
          <div
            style={{ ...S.label, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}
          >
            <SkullIcon size={12} /> Hunter Dossier
          </div>
          {loading ? (
            <div style={{ fontSize: 13, color: PAL.parchDim, fontStyle: "italic" }}>
              Digging through the ledger…
            </div>
          ) : err ? (
            <div style={{ fontSize: 13, color: PAL.parchDim, fontStyle: "italic" }}>{err}</div>
          ) : d ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 4,
                  background: d.user.avatar
                    ? `url(${d.user.avatar}) center/cover`
                    : `linear-gradient(135deg, ${avatarColor}, ${PAL.brassLow})`,
                  border: `2px solid ${PAL.brass}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: WR_FONT_DISPLAY,
                  fontSize: 22,
                  color: PAL.abyss,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {!d.user.avatar && (d.user.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontFamily: WR_FONT_DISPLAY,
                    fontSize: 24,
                    color: PAL.brassHi,
                    letterSpacing: "0.3px",
                    lineHeight: 1.1,
                  }}
                >
                  {d.user.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: PAL.parchDim,
                    marginTop: 4,
                    fontFamily: WR_FONT_MONO,
                    letterSpacing: "0.5px",
                  }}
                >
                  {d.hunter.kills > 0 || d.poster.postedCount > 0
                    ? "ACTIVE ON THE BOUNTY BOARD"
                    : "NO BOUNTY ACTIVITY YET"}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <TierBadge tier={hunterTier(d.hunter.kills)} size="md" />
                  <TierBadge tier={posterTier(d.poster.postedCount)} size="md" />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {d && (
          <div
            style={{ padding: "18px 26px 22px", display: "flex", flexDirection: "column", gap: 16 }}
          >
            <section>
              <div
                style={{
                  ...S.label,
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ color: "#5db765" }}>⚔</span> As Hunter
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <DossierStat label="Delivered" value={d.hunter.kills.toLocaleString()} />
                <DossierStat
                  label="Earned"
                  value={d.hunter.totalEarned.toLocaleString()}
                  sub="Paper"
                  highlight
                />
                <DossierStat
                  label="Biggest Hit"
                  value={d.hunter.biggestHit ? d.hunter.biggestHit.amount.toLocaleString() : "—"}
                  sub={d.hunter.biggestHit ? d.hunter.biggestHit.target : undefined}
                />
                <DossierStat
                  label="Rank"
                  value={d.hunter.rank ? `#${d.hunter.rank}` : "—"}
                  sub={d.hunter.rank ? `of ${d.hunter.totalHunters}` : undefined}
                />
              </div>
              {d.hunter.pendingClaims > 0 && (
                <div style={{ fontSize: 11, color: PAL.brass, fontStyle: "italic", marginTop: 8 }}>
                  {d.hunter.pendingClaims} claim{d.hunter.pendingClaims === 1 ? "" : "s"} awaiting
                  settlement.
                </div>
              )}
              {d.hunter.recentKills.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    background: `${PAL.brass}06`,
                    border: `1px solid ${PAL.brass}18`,
                    borderRadius: 2,
                  }}
                >
                  <div style={{ ...S.label, fontSize: 9, marginBottom: 6 }}>Recent Deliveries</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {d.hunter.recentKills.map((k) => (
                      <div
                        key={k.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontSize: 12,
                          color: PAL.parchment,
                        }}
                      >
                        <span style={{ color: "#5db765", flexShrink: 0 }}>⚔</span>
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontStyle: "italic",
                          }}
                        >
                          {k.target}
                        </span>
                        <span
                          style={{
                            fontFamily: WR_FONT_MONO,
                            fontSize: 11,
                            color: PAL.brassHi,
                            fontVariantNumeric: "tabular-nums",
                            flexShrink: 0,
                          }}
                        >
                          {k.amount.toLocaleString()}
                        </span>
                        <span
                          style={{
                            fontFamily: WR_FONT_MONO,
                            fontSize: 10,
                            color: PAL.parchDim,
                            flexShrink: 0,
                            width: 60,
                            textAlign: "right",
                          }}
                        >
                          {timeAgo(k.at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section>
              <div
                style={{
                  ...S.label,
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ color: PAL.blood }}>☠</span> As Poster
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <DossierStat label="Posted" value={d.poster.postedCount.toLocaleString()} />
                <DossierStat
                  label="Total Staked"
                  value={d.poster.totalPosted.toLocaleString()}
                  sub="Paper"
                  highlight
                />
                <DossierStat label="In Flight" value={d.poster.open.toLocaleString()} />
                <DossierStat
                  label="Rank"
                  value={d.poster.rank ? `#${d.poster.rank}` : "—"}
                  sub={d.poster.rank ? `of ${d.poster.totalPosters}` : undefined}
                />
              </div>
              {d.poster.recentPosts.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    background: `${PAL.brass}06`,
                    border: `1px solid ${PAL.brass}18`,
                    borderRadius: 2,
                  }}
                >
                  <div style={{ ...S.label, fontSize: 9, marginBottom: 6 }}>
                    Recent Bounties Posted
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {d.poster.recentPosts.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontSize: 12,
                          color: PAL.parchment,
                        }}
                      >
                        <span
                          style={{
                            color:
                              p.status === "SETTLED"
                                ? "#5db765"
                                : p.status === "OPEN"
                                  ? PAL.blood
                                  : p.status === "CLAIMED"
                                    ? PAL.brassHi
                                    : PAL.parchDim,
                            flexShrink: 0,
                          }}
                        >
                          {p.status === "SETTLED"
                            ? "✓"
                            : p.status === "OPEN"
                              ? "☠"
                              : p.status === "CLAIMED"
                                ? "⋯"
                                : "✕"}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontStyle: "italic",
                          }}
                        >
                          {p.target}
                        </span>
                        <span
                          style={{
                            fontFamily: WR_FONT_MONO,
                            fontSize: 11,
                            color: PAL.brass,
                            fontVariantNumeric: "tabular-nums",
                            flexShrink: 0,
                          }}
                        >
                          {p.amount.toLocaleString()}
                        </span>
                        <span
                          style={{
                            fontFamily: WR_FONT_MONO,
                            fontSize: 10,
                            color: PAL.parchDim,
                            flexShrink: 0,
                            width: 60,
                            textAlign: "right",
                          }}
                        >
                          {timeAgo(p.at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <a
                href={`/windrose/hunter/${encodeURIComponent(userId)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...S.btn,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 10,
                }}
                title="Open the shareable dossier page"
              >
                Share · Open Full Dossier →
              </a>
              <button type="button" style={S.btn} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DossierStat({
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
        padding: "10px 12px",
        background: highlight
          ? `linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`
          : S.card.background,
        borderColor: highlight ? PAL.brass : `${PAL.brass}30`,
      }}
    >
      <div style={{ ...S.label, fontSize: 9, marginBottom: 3 }}>{label}</div>
      <div
        style={{
          fontFamily: WR_FONT_DISPLAY,
          fontSize: 20,
          color: highlight ? PAL.brassHi : PAL.parchment,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 9,
            color: PAL.parchDim,
            marginTop: 3,
            fontFamily: WR_FONT_MONO,
            letterSpacing: "0.5px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export function ClaimModal({
  bounty,
  onClose,
  onSubmitted,
}: {
  bounty: Bounty;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [proofNote, setProofNote] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!proofNote.trim() || busy) return;
    setErr(null);
    setBusy(true);
    const j = await apiFetch(`/windrose/bounties/${bounty.id}/claim`, {
      method: "POST",
      body: JSON.stringify({
        proofNote: proofNote.trim(),
        proofImageUrl: proofImageUrl.trim() || undefined,
      }),
    });
    setBusy(false);
    if (j?.ok) onSubmitted();
    else setErr(j?.message || j?.error || "Failed to submit claim.");
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(5,5,10,.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...S.card, width: "min(520px, calc(100% - 32px))", padding: "22px 26px" }}
      >
        <div style={{ ...S.label, marginBottom: 6 }}>Claiming bounty on</div>
        <div
          style={{
            fontFamily: WR_FONT_DISPLAY,
            fontSize: 22,
            color: PAL.parchment,
            letterSpacing: "0.3px",
            marginBottom: 4,
          }}
        >
          {bounty.targetHandle}
        </div>
        <div style={{ fontSize: 12, color: PAL.parchDim, fontStyle: "italic", marginBottom: 16 }}>
          {bounty.amount.toLocaleString()} Paper if the poster confirms the kill.
        </div>

        <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>Proof · what you delivered *</div>
        <textarea
          value={proofNote}
          onChange={(e) => setProofNote(e.target.value.slice(0, 500))}
          placeholder="Sank their galleon / Dropped off the rum / Brought back the Kraken tooth — whatever the bounty asked for. Link a screenshot or clip below if you've got one."
          style={{
            ...S.input,
            minHeight: 90,
            fontFamily: WR_FONT_SERIF,
            fontStyle: "italic",
          }}
        />

        <div style={{ ...S.label, fontSize: 9, marginBottom: 4, marginTop: 12 }}>
          Evidence link (optional)
        </div>
        <input
          value={proofImageUrl}
          onChange={(e) => setProofImageUrl(e.target.value.slice(0, 300))}
          placeholder="https://imgur.com/... or https://clips.twitch.tv/..."
          style={S.input}
        />

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

        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button type="button" style={S.btn} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            style={S.btnPrimary}
            onClick={submit}
            disabled={busy || !proofNote.trim()}
          >
            {busy ? "Submitting…" : "Submit Claim"}
          </button>
        </div>
      </div>
    </div>
  );
}
