"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useWeered } from "../../../components/WeeredProvider";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

const PAL = {
  abyss: "#0a0a0c",
  stormDeep: "#0E1014",
  stormMid: "#14161A",
  stormFoam: "#1B1E25",
  brass: "#7c3aed",
  brassHi: "#e9eaf0",
  brassLow: "#4c1d95",
  parchment: "rgba(243,244,246,0.96)",
  parchDim: "rgba(148,163,184,0.72)",
  sea: "#3b0764",
  ink: "#000000",
};
const WR_DISPLAY = `var(--font-barlow), "Barlow Condensed", "Oswald", ui-sans-serif, sans-serif`;
const WR_SERIF = `var(--font-rajdhani), "Rajdhani", ui-sans-serif, system-ui, sans-serif`;
const WR_MONO = `"IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;

const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`;

function bannerChip(run = 12): React.CSSProperties {
  return {
    display: "inline-block",
    background: "#3b0764",
    color: "#fff",
    fontFamily: WR_DISPLAY,
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: "2px",
    textTransform: "uppercase",
    padding: `5px ${14 + run}px 5px 14px`,
    clipPath: `polygon(0 0, 100% 0, calc(100% - ${run}px) 100%, 0 100%)`,
    lineHeight: 1.1,
  };
}

type CrewMember = {
  userId: string;
  name: string;
  role: "LEADER" | "OFFICER" | "MEMBER";
  joinedAt: string;
};
type Crew = {
  id: string;
  name: string;
  tag: string;
  description: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  accentColor?: string | null;
  homePort?: string | null;
  recruiting: boolean;
  recruitingNote: string;
  publicInLobbies: string[];
  ownerId: string;
  createdAt: string;
  memberCount: number;
  members: CrewMember[];
};

const ROLE_ORDER: Record<string, number> = { LEADER: 0, OFFICER: 1, MEMBER: 2 };

export default function CrewView({ crewId, initial }: { crewId: string; initial: Crew | null }) {
  const [c, setC] = useState<Crew | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [err, setErr] = useState<string | null>(!initial ? "Crew not found." : null);
  const [copied, setCopied] = useState(false);
  const [crewMods, setCrewMods] = useState<any[]>([]);
  const [loadoutOpen, setLoadoutOpen] = useState(false);
  const [showAddMod, setShowAddMod] = useState(false);

  const ctx: any = useWeered();
  const meId: string = String(ctx?.me?.id || "");
  const myMembership = useMemo(
    () => (c?.members || []).find((m: CrewMember) => m.userId === meId) || null,
    [c?.members, meId],
  );
  const canManageLoadout =
    !!myMembership && (myMembership.role === "LEADER" || myMembership.role === "OFFICER");
  const isOfficer = canManageLoadout;
  const isLeaderRole =
    !!myMembership && (myMembership.role === "LEADER" || (c?.ownerId && meId === c.ownerId));

  const [joinState, setJoinState] = useState<"idle" | "sending" | "pending" | "error">("idle");
  const [pendingReqs, setPendingReqs] = useState<
    { id: string; userId: string; userName: string; note: string; createdAt: string }[]
  >([]);
  const [reqBusy, setReqBusy] = useState<string>("");
  const tok = () =>
    typeof window !== "undefined" ? localStorage.getItem("weered_token") || "" : "";

  async function refreshLoadout() {
    try {
      const r = await fetch(`${API}/crews/${encodeURIComponent(crewId)}/loadout`);
      const j = await r.json();
      if (Array.isArray(j?.crewMods)) setCrewMods(j.crewMods);
    } catch {}
  }

  async function removeMod(modId: string) {
    const token = typeof window !== "undefined" ? localStorage.getItem("weered_token") || "" : "";
    if (!token) return;
    await fetch(`${API}/crews/${encodeURIComponent(crewId)}/mods/${encodeURIComponent(modId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    await refreshLoadout();
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/crews/${encodeURIComponent(crewId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.ok && j.crew) {
          setC(j.crew);
          setErr(null);
        } else if (!initial) setErr("Crew not found.");
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setErr("Couldn't load this crew.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [crewId, initial]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/crews/${encodeURIComponent(crewId)}/loadout`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && Array.isArray(j?.crewMods)) setCrewMods(j.crewMods);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [crewId]);

  useEffect(() => {
    if (isOfficer) refreshRequests();
  }, [isOfficer, crewId]);

  function copyLink() {
    try {
      navigator.clipboard.writeText(typeof window !== "undefined" ? window.location.href : "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function askToJoin() {
    const token = tok();
    if (!token) {
      try {
        window.location.href = `/login?next=${encodeURIComponent(`/crew/${crewId}`)}`;
      } catch {}
      return;
    }
    setJoinState("sending");
    try {
      const r = await fetch(`${API}/crews/${encodeURIComponent(crewId)}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: "" }),
      });
      if (r.ok) {
        setJoinState("pending");
        return;
      }
      const j = await r.json().catch(() => ({}));
      if (j?.error === "Already a member") {
        setJoinState("idle");
        return;
      }
      setJoinState("error");
    } catch {
      setJoinState("error");
    }
  }

  async function refreshRequests() {
    if (!isOfficer) return;
    try {
      const r = await fetch(`${API}/crews/${encodeURIComponent(crewId)}/requests`, {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      const j = await r.json();
      if (Array.isArray(j?.requests)) setPendingReqs(j.requests);
    } catch {}
  }

  async function decideRequest(userId: string, decision: "approve" | "decline") {
    setReqBusy(userId);
    try {
      await fetch(
        `${API}/crews/${encodeURIComponent(crewId)}/requests/${encodeURIComponent(userId)}/${decision}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${tok()}` },
        },
      );
      setPendingReqs((cur) => cur.filter((p) => p.userId !== userId));
      if (decision === "approve") {
        fetch(`${API}/crews/${encodeURIComponent(crewId)}`)
          .then((r) => r.json())
          .then((j) => {
            if (j?.ok && j.crew) setC(j.crew);
          })
          .catch(() => {});
      }
    } finally {
      setReqBusy("");
    }
  }

  async function setMemberRole(userId: string, role: "OFFICER" | "MEMBER") {
    setReqBusy(userId);
    try {
      const r = await fetch(
        `${API}/crews/${encodeURIComponent(crewId)}/members/${encodeURIComponent(userId)}/role`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
          body: JSON.stringify({ role }),
        },
      );
      if (r.ok) {
        fetch(`${API}/crews/${encodeURIComponent(crewId)}`)
          .then((rr) => rr.json())
          .then((j) => {
            if (j?.ok && j.crew) setC(j.crew);
          })
          .catch(() => {});
      }
    } finally {
      setReqBusy("");
    }
  }

  const accent =
    c?.accentColor && /^#[0-9a-f]{6}$/i.test(c.accentColor) ? c.accentColor : PAL.brass;
  const sortedMembers = c
    ? [...c.members].sort(
        (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name),
      )
    : [];

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 28px 60px",
        background: `
        radial-gradient(ellipse 100% 55% at 50% -10%, rgba(124,58,237,0.13) 0%, transparent 55%),
        linear-gradient(180deg, ${PAL.stormDeep} 0%, ${PAL.abyss} 100%)
      `,
        color: PAL.parchment,
        fontFamily: WR_SERIF,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link
          href="/home"
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
          ← Weered Home
        </Link>

        {loading ? (
          <div
            style={{
              ...plaqueStyle(),
              padding: 28,
              fontSize: 14,
              color: PAL.parchDim,
              fontStyle: "italic",
            }}
          >
            Loading crew…
          </div>
        ) : err || !c ? (
          <div style={{ ...plaqueStyle(), padding: 28 }}>
            <h1 style={{ fontFamily: WR_DISPLAY, fontSize: 32, color: PAL.brassHi, margin: 0 }}>
              Crew not found
            </h1>
            <div style={{ fontSize: 14, color: PAL.parchDim, marginTop: 8, fontStyle: "italic" }}>
              This crew doesn't exist — or it's been disbanded.
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                position: "relative",
                padding: 0,
                border: `1px solid rgba(255,255,255,0.07)`,
                marginBottom: 20,
                overflow: "hidden",
                boxShadow: `0 16px 48px rgba(0,0,0,0.55)`,
              }}
            >
              <div
                style={{
                  height: 120,
                  background: c.bannerUrl
                    ? `linear-gradient(180deg, rgba(14,16,20,0.35), rgba(14,16,20,0.9)), url(${c.bannerUrl}) center/cover no-repeat`
                    : `${NOISE}, radial-gradient(ellipse 95% 75% at 28% 0%, ${accent}66 0%, transparent 66%), linear-gradient(150deg, ${PAL.sea} 0%, ${PAL.brassLow} 60%, ${PAL.abyss} 100%)`,
                  backgroundBlendMode: c.bannerUrl ? "normal" : "overlay, normal, normal",
                  backgroundSize: c.bannerUrl ? "cover" : "160px 160px, cover, cover",
                }}
              />
              <div
                style={{
                  padding: "18px 26px 22px",
                  display: "flex",
                  gap: 18,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  background: PAL.stormMid,
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    flexShrink: 0,
                    marginTop: -60,
                    background: c.logoUrl
                      ? `url(${c.logoUrl}) center/cover, ${PAL.stormDeep}`
                      : `${NOISE}, linear-gradient(135deg, ${accent}, ${PAL.brassLow})`,
                    backgroundBlendMode: c.logoUrl ? "normal" : "overlay, normal",
                    backgroundSize: c.logoUrl ? "cover" : "160px 160px, cover",
                    border: `2px solid ${accent}`,
                    outline: `3px solid ${PAL.stormMid}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: WR_DISPLAY,
                    fontSize: 36,
                    color: "#fff",
                    fontWeight: 800,
                    boxShadow: `0 6px 18px rgba(0,0,0,0.6)`,
                    letterSpacing: "0.5px",
                  }}
                >
                  {!c.logoUrl && (c.tag || c.name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0, marginTop: -6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h1
                      style={{
                        fontFamily: WR_DISPLAY,
                        fontSize: 40,
                        fontWeight: 800,
                        color: PAL.brassHi,
                        margin: 0,
                        letterSpacing: "1px",
                        lineHeight: 1.0,
                        textTransform: "uppercase",
                      }}
                    >
                      {c.name}
                    </h1>
                    {c.tag && (
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: WR_MONO,
                          color: "#c4b5fd",
                          letterSpacing: "1.5px",
                          padding: "3px 10px",
                          border: `1px solid rgba(124,58,237,0.5)`,
                          background: `rgba(124,58,237,0.12)`,
                        }}
                      >
                        [{c.tag}]
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      marginTop: 9,
                      flexWrap: "wrap",
                      fontSize: 11,
                      fontFamily: WR_MONO,
                      color: PAL.parchDim,
                      letterSpacing: "1px",
                    }}
                  >
                    <span>
                      <span style={{ color: PAL.parchment, fontWeight: 700 }}>{c.memberCount}</span>{" "}
                      member{c.memberCount === 1 ? "" : "s"}
                    </span>
                    {c.homePort && (
                      <>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span>
                          home <span style={{ color: PAL.parchment }}>{c.homePort}</span>
                        </span>
                      </>
                    )}
                    {c.recruiting ? (
                      <>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span style={{ color: "#5db765" }}>Recruiting</span>
                      </>
                    ) : (
                      <>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span>Not recruiting</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: -6 }}>
                  <button
                    type="button"
                    onClick={copyLink}
                    style={{
                      padding: "8px 16px",
                      border: `1px solid rgba(255,255,255,0.14)`,
                      background: copied ? `rgba(124,58,237,0.18)` : "transparent",
                      color: copied ? "#c4b5fd" : "rgba(243,244,246,0.9)",
                      cursor: "pointer",
                      fontFamily: WR_DISPLAY,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                    }}
                  >
                    {copied ? "Copied ✓" : "Copy Link"}
                  </button>
                  {c.recruiting &&
                    !myMembership &&
                    (joinState === "pending" ? (
                      <span
                        style={{
                          padding: "8px 18px",
                          fontFamily: WR_DISPLAY,
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: "2px",
                          textTransform: "uppercase",
                          color: "#86efac",
                          border: "1px solid rgba(34,197,94,0.4)",
                          background: "rgba(34,197,94,0.1)",
                        }}
                      >
                        Request sent ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={askToJoin}
                        disabled={joinState === "sending"}
                        style={{
                          padding: "8px 26px 8px 18px",
                          border: "none",
                          background: joinState === "error" ? "#9f1239" : "#5b21b6",
                          color: "#fff",
                          cursor: joinState === "sending" ? "default" : "pointer",
                          fontFamily: WR_DISPLAY,
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: "2px",
                          textTransform: "uppercase",
                          clipPath: "polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)",
                          opacity: joinState === "sending" ? 0.6 : 1,
                        }}
                      >
                        {joinState === "sending"
                          ? "Sending…"
                          : joinState === "error"
                            ? "Try again"
                            : "Ask to Join →"}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {c.description && (
              <div style={{ ...plaqueStyle(), padding: "18px 22px", marginBottom: 14 }}>
                <div style={{ ...bannerChip(), marginBottom: 14 }}>About</div>
                <div
                  style={{
                    fontSize: 15,
                    color: PAL.parchment,
                    lineHeight: 1.6,
                    fontStyle: "italic",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {c.description}
                </div>
              </div>
            )}

            {c.recruiting && c.recruitingNote && (
              <div
                style={{
                  padding: "14px 18px",
                  border: "1px solid rgba(93,183,101,0.3)",
                  background: "rgba(93,183,101,0.06)",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontFamily: WR_DISPLAY,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: "#5db765",
                    marginBottom: 8,
                  }}
                >
                  Looking for
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: PAL.parchment,
                    lineHeight: 1.55,
                    fontStyle: "italic",
                  }}
                >
                  {c.recruitingNote}
                </div>
              </div>
            )}

            {(crewMods.length > 0 || canManageLoadout) && (
              <div style={{ ...plaqueStyle(), padding: "14px 22px", marginBottom: 14 }}>
                <div
                  onClick={() => setLoadoutOpen((o) => !o)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setLoadoutOpen((o) => !o);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={bannerChip()}>Loadout ({crewMods.length})</div>
                  <div style={{ flex: 1 }} />
                  <div
                    style={{
                      fontSize: 10,
                      color: PAL.parchDim,
                      opacity: 0.6,
                      fontFamily: WR_MONO,
                      letterSpacing: "1.5px",
                    }}
                  >
                    {loadoutOpen ? "—" : "+"}
                  </div>
                </div>
                {loadoutOpen && (
                  <>
                    {crewMods.length === 0 && (
                      <div
                        style={{
                          marginTop: 14,
                          padding: "18px 12px",
                          fontSize: 13,
                          color: PAL.parchDim,
                          fontStyle: "italic",
                          textAlign: "center",
                          opacity: 0.7,
                        }}
                      >
                        No mods in the kit yet. Add one and your crew sees it in chat, hover cards,
                        and here.
                      </div>
                    )}
                    {crewMods.length > 0 && (
                      <div
                        style={{
                          marginTop: 14,
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                          gap: 8,
                        }}
                      >
                        {crewMods.map((cm: any) => {
                          const m = cm.mod || {};
                          return (
                            <div key={cm.id} style={{ position: "relative" }}>
                              <a
                                href={m.sourceUrl || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  padding: "8px 10px",
                                  background: `${PAL.ink}40`,
                                  border: `1px solid ${PAL.brass}25`,
                                  textDecoration: "none",
                                }}
                              >
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 0,
                                    flexShrink: 0,
                                    background: m.thumbnailUrl
                                      ? `url(${m.thumbnailUrl}) center/cover`
                                      : `linear-gradient(135deg, ${PAL.brass}, ${PAL.brassLow})`,
                                    border: `1px solid ${PAL.brass}40`,
                                  }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: PAL.parchment,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      fontFamily: WR_DISPLAY,
                                      letterSpacing: "0.2px",
                                    }}
                                  >
                                    {m.name || "Unnamed mod"}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: PAL.parchDim,
                                      fontFamily: WR_MONO,
                                      letterSpacing: "0.8px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {m.author ? `by ${m.author}` : ""}
                                    {cm.role && cm.role !== "RECOMMENDED"
                                      ? ` · ${String(cm.role).toLowerCase()}`
                                      : ""}
                                  </div>
                                </div>
                              </a>
                              {canManageLoadout && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void removeMod(m.id);
                                  }}
                                  aria-label={`Remove ${m.name || "mod"} from kit`}
                                  style={{
                                    position: "absolute",
                                    top: 4,
                                    right: 4,
                                    width: 18,
                                    height: 18,
                                    padding: 0,
                                    border: `1px solid ${PAL.brass}40`,
                                    background: `${PAL.ink}cc`,
                                    color: PAL.parchDim,
                                    fontSize: 11,
                                    lineHeight: 1,
                                    cursor: "pointer",
                                    borderRadius: 0,
                                  }}
                                  title="Remove from kit"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {canManageLoadout && (
                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: `1px solid ${PAL.brass}15`,
                          display: "flex",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          onClick={() => setShowAddMod(true)}
                          style={{
                            padding: "6px 14px",
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: "2px",
                            textTransform: "uppercase",
                            color: "#c4b5fd",
                            background: "rgba(124,58,237,0.12)",
                            border: `1px solid rgba(124,58,237,0.5)`,
                            cursor: "pointer",
                            fontFamily: WR_DISPLAY,
                          }}
                        >
                          + Add mod
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {showAddMod && canManageLoadout && (
              <AddModDialog
                crewId={crewId}
                onClose={() => setShowAddMod(false)}
                onAdded={() => {
                  setShowAddMod(false);
                  void refreshLoadout();
                }}
              />
            )}

            {isOfficer && pendingReqs.length > 0 && (
              <div style={{ ...plaqueStyle(), padding: "18px 22px", marginBottom: 14 }}>
                <div style={{ ...bannerChip(), marginBottom: 14 }}>
                  Join requests ({pendingReqs.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pendingReqs.map((req) => (
                    <div
                      key={req.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          background: `linear-gradient(135deg, ${PAL.brass}, ${PAL.brassLow})`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: WR_DISPLAY,
                          fontSize: 14,
                          color: "#fff",
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {(req.userName || "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            color: PAL.parchment,
                            fontFamily: WR_DISPLAY,
                            letterSpacing: "0.3px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {req.userName || "Someone"}
                        </div>
                        {req.note && (
                          <div
                            style={{
                              fontSize: 10,
                              color: PAL.parchDim,
                              fontFamily: WR_MONO,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {req.note}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={reqBusy === req.userId}
                        onClick={() => decideRequest(req.userId, "approve")}
                        style={{
                          padding: "5px 12px",
                          fontFamily: WR_DISPLAY,
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "1px",
                          textTransform: "uppercase",
                          border: "none",
                          background: "#5b21b6",
                          color: "#fff",
                          cursor: "pointer",
                          opacity: reqBusy === req.userId ? 0.5 : 1,
                          clipPath: "polygon(0 0, 100% 0, calc(100% - 9px) 100%, 0 100%)",
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={reqBusy === req.userId}
                        onClick={() => decideRequest(req.userId, "decline")}
                        style={{
                          padding: "5px 12px",
                          fontFamily: WR_DISPLAY,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "1px",
                          textTransform: "uppercase",
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "transparent",
                          color: "rgba(148,163,184,0.9)",
                          cursor: "pointer",
                          opacity: reqBusy === req.userId ? 0.5 : 1,
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ ...plaqueStyle(), padding: "18px 22px" }}>
              <div style={{ ...bannerChip(), marginBottom: 14 }}>Roster</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 8,
                }}
              >
                {sortedMembers.map((m) => {
                  const roleColor =
                    m.role === "LEADER"
                      ? "#e9eaf0"
                      : m.role === "OFFICER"
                        ? "#c4b5fd"
                        : PAL.parchDim;
                  const isLeader = m.role === "LEADER";
                  const canManageThis =
                    isLeaderRole &&
                    m.userId !== meId &&
                    m.userId !== c.ownerId &&
                    m.role !== "LEADER";
                  return (
                    <div
                      key={m.userId}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        background: "rgba(255,255,255,0.02)",
                        border: `1px solid ${isLeader ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <Link
                        href={`/windrose/hunter/${encodeURIComponent(m.userId)}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          textDecoration: "none",
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            background: `linear-gradient(135deg, ${PAL.brass}, ${PAL.brassLow})`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: WR_DISPLAY,
                            fontSize: 14,
                            color: "#fff",
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {(m.name || "?").slice(0, 1).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              color: PAL.parchment,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontFamily: WR_DISPLAY,
                              letterSpacing: "0.3px",
                            }}
                          >
                            {m.name}
                          </div>
                          <div
                            style={{
                              fontSize: 9,
                              color: roleColor,
                              fontFamily: WR_MONO,
                              letterSpacing: "1px",
                              textTransform: "uppercase",
                            }}
                          >
                            {m.role.toLowerCase()}
                          </div>
                        </div>
                      </Link>
                      {canManageThis && (
                        <button
                          type="button"
                          disabled={reqBusy === m.userId}
                          onClick={() =>
                            setMemberRole(m.userId, m.role === "OFFICER" ? "MEMBER" : "OFFICER")
                          }
                          style={{
                            margin: "0 8px 8px",
                            padding: "4px 8px",
                            fontFamily: WR_MONO,
                            fontSize: 9,
                            letterSpacing: "1px",
                            textTransform: "uppercase",
                            border: "1px solid rgba(124,58,237,0.4)",
                            background: "transparent",
                            color: "#c4b5fd",
                            cursor: reqBusy === m.userId ? "default" : "pointer",
                            opacity: reqBusy === m.userId ? 0.5 : 1,
                          }}
                        >
                          {m.role === "OFFICER" ? "Demote to member" : "Promote to officer"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
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
          Weered · Community hub
        </div>
      </div>
    </div>
  );
}

function plaqueStyle(): React.CSSProperties {
  return {
    border: `1px solid rgba(255,255,255,0.06)`,
    background: PAL.stormMid,
  };
}

function AddModDialog({
  crewId,
  onClose,
  onAdded,
}: {
  crewId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `${API}/mods?gameSlug=windrose&limit=20${q ? `&search=${encodeURIComponent(q)}` : ""}`,
        );
        const j = await r.json();
        setResults(Array.isArray(j?.mods) ? j.mods : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  async function pick(modId: string) {
    const token = typeof window !== "undefined" ? localStorage.getItem("weered_token") || "" : "";
    if (!token) return;
    setSubmitting(modId);
    try {
      const r = await fetch(`${API}/crews/${encodeURIComponent(crewId)}/mods`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ modId, role: "RECOMMENDED" }),
      });
      if (r.ok) onAdded();
    } catch {
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClose();
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(8,8,10,0.78)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        role="button"
        tabIndex={0}
        style={{
          ...plaqueStyle(),
          maxWidth: 560,
          width: "100%",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={bannerChip()}>Add to loadout</div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: PAL.parchDim,
              fontSize: 16,
              cursor: "pointer",
              padding: "2px 8px",
            }}
          >
            ×
          </button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Windrose mods…"
          style={{
            padding: "10px 12px",
            fontSize: 14,
            fontFamily: WR_SERIF,
            background: `${PAL.ink}80`,
            border: `1px solid ${PAL.brass}40`,
            color: PAL.parchment,
            outline: "none",
            marginBottom: 12,
          }}
        />
        <div
          style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}
        >
          {loading && results.length === 0 && (
            <div
              style={{
                fontSize: 12,
                color: PAL.parchDim,
                fontStyle: "italic",
                padding: 12,
                textAlign: "center",
              }}
            >
              Searching mods…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div
              style={{
                fontSize: 12,
                color: PAL.parchDim,
                fontStyle: "italic",
                padding: 12,
                textAlign: "center",
              }}
            >
              {query ? `No mods match "${query}".` : "No mods cached yet."}
            </div>
          )}
          {results.map((m: any) => (
            <button
              key={m.id}
              onClick={() => void pick(m.id)}
              disabled={submitting === m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: `${PAL.ink}40`,
                border: `1px solid ${PAL.brass}25`,
                color: PAL.parchment,
                textAlign: "left",
                cursor: submitting === m.id ? "wait" : "pointer",
                fontFamily: "inherit",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  background: m.thumbnailUrl
                    ? `url(${m.thumbnailUrl}) center/cover`
                    : `linear-gradient(135deg, ${PAL.brass}, ${PAL.brassLow})`,
                  border: `1px solid ${PAL.brass}40`,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: PAL.parchment,
                    fontFamily: WR_DISPLAY,
                    letterSpacing: "0.2px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: PAL.parchDim,
                    fontFamily: WR_MONO,
                    letterSpacing: "0.6px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.author ? `by ${m.author}` : ""}
                  {m.endorsements ? ` · ✦ ${Number(m.endorsements).toLocaleString()}` : ""}
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: WR_MONO,
                  color: PAL.brass,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                }}
              >
                {submitting === m.id ? "…" : "Add"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
