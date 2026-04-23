"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useWeered } from "../../../components/WeeredProvider";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

const PAL = {
  abyss:     "#0e1826",
  stormDeep: "#19283e",
  stormMid:  "#243752",
  stormFoam: "#2e4363",
  brass:     "#c9a066",
  brassHi:   "#e8c48a",
  brassLow:  "#8a6b3e",
  parchment: "#e4d4b0",
  parchDim:  "#a89775",
  sea:       "#3a7488",
  ink:       "#0a1220",
};
const WR_DISPLAY = `"Pirata One", "Cinzel Decorative", "Luminari", "Georgia", serif`;
const WR_SERIF   = `"Cormorant Garamond", "EB Garamond", "Crimson Pro", "Palatino Linotype", Georgia, serif`;
const WR_MONO    = `"DM Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;

type CrewMember = { userId: string; name: string; role: "LEADER" | "OFFICER" | "MEMBER"; joinedAt: string };
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
  // Crew loadout — fetched lazily; hidden if empty (no "look what we have!")
  const [crewMods, setCrewMods] = useState<any[]>([]);
  const [loadoutOpen, setLoadoutOpen] = useState(false);
  const [showAddMod, setShowAddMod] = useState(false);

  // Is the viewer a crew officer+ ? Enables add/remove affordances.
  const ctx: any = useWeered();
  const meId: string = String(ctx?.me?.id || "");
  const myMembership = useMemo(
    () => (c?.members || []).find((m: CrewMember) => m.userId === meId) || null,
    [c?.members, meId],
  );
  const canManageLoadout = !!myMembership && (myMembership.role === "LEADER" || myMembership.role === "OFFICER");

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
      .then(r => r.json())
      .then(j => {
        if (cancelled) return;
        if (j?.ok && j.crew) { setC(j.crew); setErr(null); }
        else if (!initial) setErr("Crew not found.");
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setErr("Couldn't load this crew."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [crewId, initial]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/crews/${encodeURIComponent(crewId)}/loadout`)
      .then(r => r.json())
      .then(j => { if (!cancelled && Array.isArray(j?.crewMods)) setCrewMods(j.crewMods); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [crewId]);

  function copyLink() {
    try {
      navigator.clipboard.writeText(typeof window !== "undefined" ? window.location.href : "");
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  function askToJoin() {
    if (!c?.ownerId) return;
    const leader = c.members.find(m => m.userId === c.ownerId);
    try {
      window.dispatchEvent(new CustomEvent("weered:dock:open", {
        detail: { mode: "dm", peer: { id: c.ownerId, name: leader?.name || c.name } },
      }));
    } catch {}
  }

  const accent = c?.accentColor && /^#[0-9a-f]{6}$/i.test(c.accentColor) ? c.accentColor : PAL.brass;
  const sortedMembers = c ? [...c.members].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name)) : [];

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
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <Link href="/home" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          color: PAL.parchDim, textDecoration: "none", fontFamily: WR_MONO,
          fontSize: 11, letterSpacing: "2px", textTransform: "uppercase",
          marginBottom: 20,
        }}>
          ← Weered Home
        </Link>

        {loading ? (
          <div style={{ ...plaqueStyle(), padding: 28, fontSize: 14, color: PAL.parchDim, fontStyle: "italic" }}>Reading the crew charter…</div>
        ) : err || !c ? (
          <div style={{ ...plaqueStyle(), padding: 28 }}>
            <h1 style={{ fontFamily: WR_DISPLAY, fontSize: 32, color: PAL.brassHi, margin: 0 }}>Crew not found</h1>
            <div style={{ fontSize: 14, color: PAL.parchDim, marginTop: 8, fontStyle: "italic" }}>
              This crew doesn't exist — or it's been disbanded.
            </div>
          </div>
        ) : (
          <>
            {/* Banner header */}
            <div style={{
              position: "relative",
              padding: 0,
              border: `2px solid ${accent}55`,
              marginBottom: 20,
              overflow: "hidden",
              boxShadow: `0 12px 40px ${PAL.ink}`,
            }}>
              <div style={{
                height: 120,
                background: c.bannerUrl
                  ? `linear-gradient(180deg, rgba(14,24,38,0.4), rgba(14,24,38,0.85)), url(${c.bannerUrl}) center/cover no-repeat`
                  : `radial-gradient(ellipse 90% 60% at 30% 0%, ${accent}45 0%, transparent 60%), linear-gradient(180deg, ${PAL.stormMid}, ${PAL.stormDeep})`,
              }} />
              <div style={{ padding: "18px 26px 22px", display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap", background: `linear-gradient(180deg, ${PAL.stormMid}f0 0%, ${PAL.stormDeep} 100%)` }}>
                <div style={{
                  width: 80, height: 80, flexShrink: 0,
                  marginTop: -60,
                  background: c.logoUrl
                    ? `url(${c.logoUrl}) center/cover, ${PAL.stormDeep}`
                    : `linear-gradient(135deg, ${accent}, ${PAL.brassLow})`,
                  border: `3px solid ${accent}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: WR_DISPLAY, fontSize: 36, color: PAL.abyss, fontWeight: 700,
                  boxShadow: `0 4px 14px ${PAL.ink}`,
                }}>
                  {!c.logoUrl && (c.tag || c.name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0, marginTop: -6 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <h1 style={{ fontFamily: WR_DISPLAY, fontSize: 38, color: PAL.brassHi, margin: 0, letterSpacing: "0.5px", lineHeight: 1.1 }}>
                      {c.name}
                    </h1>
                    {c.tag && (
                      <span style={{ fontSize: 14, fontFamily: WR_MONO, color: accent, letterSpacing: "1.5px", padding: "3px 10px", border: `1px solid ${accent}50`, background: `${accent}15` }}>
                        [{c.tag}]
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", fontSize: 11, fontFamily: WR_MONO, color: PAL.parchDim, letterSpacing: "1px" }}>
                    <span><span style={{ color: PAL.parchment, fontWeight: 700 }}>{c.memberCount}</span> member{c.memberCount === 1 ? "" : "s"}</span>
                    {c.homePort && <><span>·</span><span>home port <span style={{ color: PAL.parchment }}>{c.homePort}</span></span></>}
                    {c.recruiting ? (
                      <><span>·</span><span style={{ color: "#5db765" }}>Recruiting</span></>
                    ) : (
                      <><span>·</span><span>Closed ranks</span></>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: -6 }}>
                  <button
                    type="button"
                    onClick={copyLink}
                    style={{
                      padding: "8px 14px",
                      border: `1px solid ${PAL.brass}`,
                      background: copied ? `${PAL.brass}30` : `linear-gradient(180deg, ${PAL.stormMid}, ${PAL.abyss})`,
                      color: PAL.brassHi, cursor: "pointer",
                      fontFamily: WR_SERIF, fontSize: 11, fontWeight: 700,
                      letterSpacing: "2px", textTransform: "uppercase",
                      boxShadow: `0 0 0 1px ${PAL.brassLow}`,
                    }}
                  >
                    {copied ? "Copied ✓" : "Copy Link"}
                  </button>
                  {c.recruiting && (
                    <button
                      type="button"
                      onClick={askToJoin}
                      style={{
                        padding: "8px 18px",
                        border: `1px solid rgba(93,183,101,0.55)`,
                        background: `linear-gradient(180deg, rgba(93,183,101,0.28), rgba(93,183,101,0.14))`,
                        color: "#8edc93", cursor: "pointer",
                        fontFamily: WR_SERIF, fontSize: 11, fontWeight: 700,
                        letterSpacing: "2px", textTransform: "uppercase",
                      }}
                    >
                      Ask to Join →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {c.description && (
              <div style={{ ...plaqueStyle(), padding: "18px 22px", marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: PAL.brass, opacity: 0.75, marginBottom: 8 }}>
                  Charter
                </div>
                <div style={{ fontSize: 15, color: PAL.parchment, lineHeight: 1.6, fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                  {c.description}
                </div>
              </div>
            )}

            {/* Recruiting note */}
            {c.recruiting && c.recruitingNote && (
              <div style={{
                padding: "14px 18px",
                border: "1px solid rgba(93,183,101,0.3)",
                background: "rgba(93,183,101,0.06)",
                marginBottom: 14,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#5db765", marginBottom: 8 }}>
                  Looking for
                </div>
                <div style={{ fontSize: 14, color: PAL.parchment, lineHeight: 1.55, fontStyle: "italic" }}>
                  {c.recruitingNote}
                </div>
              </div>
            )}

            {/* Loadout — collapsed by default. Hidden to non-managers if
                empty. Managers see it always so they can add mods.
                No callout styling, no badge, just a header row that expands. */}
            {(crewMods.length > 0 || canManageLoadout) && (
              <div style={{ ...plaqueStyle(), padding: "14px 22px", marginBottom: 14 }}>
                <div
                  onClick={() => setLoadoutOpen(o => !o)}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: PAL.brass, opacity: 0.75 }}>
                    Loadout ({crewMods.length})
                  </div>
                  <div style={{ flex: 1 }} />
                  <div style={{ fontSize: 10, color: PAL.parchDim, opacity: 0.6, fontFamily: WR_MONO, letterSpacing: "1.5px" }}>
                    {loadoutOpen ? "—" : "+"}
                  </div>
                </div>
                {loadoutOpen && (
                  <>
                    {crewMods.length === 0 && (
                      <div style={{ marginTop: 14, padding: "18px 12px", fontSize: 13, color: PAL.parchDim, fontStyle: "italic", textAlign: "center", opacity: 0.7 }}>
                        No mods in the kit yet. Add one and your crew sees it in chat, hover cards, and here.
                      </div>
                    )}
                    {crewMods.length > 0 && (
                      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                        {crewMods.map((cm: any) => {
                          const m = cm.mod || {};
                          return (
                            <div key={cm.id} style={{ position: "relative" }}>
                              <a
                                href={m.sourceUrl || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: "flex", alignItems: "center", gap: 10,
                                  padding: "8px 10px",
                                  background: `${PAL.ink}40`,
                                  border: `1px solid ${PAL.brass}25`,
                                  textDecoration: "none",
                                }}
                              >
                                <div style={{
                                  width: 32, height: 32, borderRadius: 2, flexShrink: 0,
                                  background: m.thumbnailUrl ? `url(${m.thumbnailUrl}) center/cover` : `linear-gradient(135deg, ${PAL.brass}, ${PAL.brassLow})`,
                                  border: `1px solid ${PAL.brass}40`,
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, color: PAL.parchment, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: WR_DISPLAY, letterSpacing: "0.2px" }}>
                                    {m.name || "Unnamed mod"}
                                  </div>
                                  <div style={{ fontSize: 9, color: PAL.parchDim, fontFamily: WR_MONO, letterSpacing: "0.8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {m.author ? `by ${m.author}` : ""}{cm.role && cm.role !== "RECOMMENDED" ? ` · ${String(cm.role).toLowerCase()}` : ""}
                                  </div>
                                </div>
                              </a>
                              {canManageLoadout && (
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); void removeMod(m.id); }}
                                  aria-label={`Remove ${m.name || "mod"} from kit`}
                                  style={{
                                    position: "absolute", top: 4, right: 4,
                                    width: 18, height: 18, padding: 0,
                                    border: `1px solid ${PAL.brass}40`, background: `${PAL.ink}cc`,
                                    color: PAL.parchDim, fontSize: 11, lineHeight: 1, cursor: "pointer",
                                    borderRadius: 2,
                                  }}
                                  title="Remove from kit"
                                >×</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {canManageLoadout && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${PAL.brass}15`, display: "flex", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => setShowAddMod(true)}
                          style={{
                            padding: "6px 14px", fontSize: 10, fontWeight: 800,
                            letterSpacing: "2px", textTransform: "uppercase",
                            color: PAL.parchment, background: `linear-gradient(180deg, ${PAL.brassHi}33, ${PAL.brass}22)`,
                            border: `1px solid ${PAL.brass}55`, cursor: "pointer",
                            fontFamily: WR_MONO,
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
                onAdded={() => { setShowAddMod(false); void refreshLoadout(); }}
              />
            )}

            {/* Roster */}
            <div style={{ ...plaqueStyle(), padding: "18px 22px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: PAL.brass, opacity: 0.75, marginBottom: 12 }}>
                Roster
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                {sortedMembers.map(m => {
                  const roleColor = m.role === "LEADER" ? PAL.brassHi : m.role === "OFFICER" ? accent : PAL.parchDim;
                  return (
                    <Link
                      key={m.userId}
                      href={`/windrose/hunter/${encodeURIComponent(m.userId)}`}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px",
                        background: `${PAL.ink}40`,
                        border: `1px solid ${roleColor}30`,
                        textDecoration: "none",
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 2,
                        background: `linear-gradient(135deg, ${roleColor}, ${PAL.brassLow})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: WR_DISPLAY, fontSize: 14, color: PAL.abyss, fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {(m.name || "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: PAL.parchment, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: WR_DISPLAY, letterSpacing: "0.2px" }}>
                          {m.name}
                        </div>
                        <div style={{ fontSize: 9, color: roleColor, fontFamily: WR_MONO, letterSpacing: "1px", textTransform: "uppercase" }}>
                          {m.role.toLowerCase()}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: 36, fontSize: 10, color: PAL.parchDim, fontFamily: WR_MONO, letterSpacing: "2px", textTransform: "uppercase", opacity: 0.7 }}>
          Weered · Community hub
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

// ── Add-mod dialog — minimal search + pick flow ────────────────────────────
function AddModDialog({
  crewId, onClose, onAdded,
}: { crewId: string; onClose: () => void; onAdded: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/mods?gameSlug=windrose&limit=20${q ? `&search=${encodeURIComponent(q)}` : ""}`);
        const j = await r.json();
        setResults(Array.isArray(j?.mods) ? j.mods : []);
      } catch { setResults([]); }
      finally { setLoading(false); }
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
    } catch {}
    finally { setSubmitting(null); }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(10,18,32,0.72)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...plaqueStyle(), maxWidth: 560, width: "100%", maxHeight: "80vh",
          display: "flex", flexDirection: "column", padding: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: PAL.brass, opacity: 0.75 }}>
            Add to loadout
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: PAL.parchDim, fontSize: 16, cursor: "pointer", padding: "2px 8px" }}
          >×</button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Windrose mods…"
          style={{
            padding: "10px 12px", fontSize: 14, fontFamily: WR_SERIF,
            background: `${PAL.ink}80`, border: `1px solid ${PAL.brass}40`,
            color: PAL.parchment, outline: "none", marginBottom: 12,
          }}
        />
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {loading && results.length === 0 && (
            <div style={{ fontSize: 12, color: PAL.parchDim, fontStyle: "italic", padding: 12, textAlign: "center" }}>
              Searching the Nexus catalog…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ fontSize: 12, color: PAL.parchDim, fontStyle: "italic", padding: 12, textAlign: "center" }}>
              {query ? `No mods match "${query}".` : "No mods cached yet."}
            </div>
          )}
          {results.map((m: any) => (
            <button
              key={m.id}
              onClick={() => void pick(m.id)}
              disabled={submitting === m.id}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                background: `${PAL.ink}40`, border: `1px solid ${PAL.brass}25`,
                color: PAL.parchment, textAlign: "left", cursor: submitting === m.id ? "wait" : "pointer",
                fontFamily: "inherit",
              }}
            >
              <div style={{
                width: 36, height: 36, flexShrink: 0,
                background: m.thumbnailUrl ? `url(${m.thumbnailUrl}) center/cover` : `linear-gradient(135deg, ${PAL.brass}, ${PAL.brassLow})`,
                border: `1px solid ${PAL.brass}40`,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: PAL.parchment, fontFamily: WR_DISPLAY, letterSpacing: "0.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.name}
                </div>
                <div style={{ fontSize: 10, color: PAL.parchDim, fontFamily: WR_MONO, letterSpacing: "0.6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.author ? `by ${m.author}` : ""}{m.endorsements ? ` · ✦ ${Number(m.endorsements).toLocaleString()}` : ""}
                </div>
              </div>
              <span style={{ fontSize: 10, fontFamily: WR_MONO, color: PAL.brass, letterSpacing: "1.5px", textTransform: "uppercase" }}>
                {submitting === m.id ? "…" : "Add"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
