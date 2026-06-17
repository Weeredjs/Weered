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
import { StatTile, timeAgo } from "./WrBounties";
import { LfgPost } from "./WrLog";
import { Labeled } from "./WrStreams";

export const WR_MODES = [
  "Any",
  "PvE Solo",
  "Co-op 2",
  "Co-op 4",
  "Co-op 8",
  "Boss Run",
  "Exploration",
  "Naval",
];
export const WR_REGIONS = ["Any", "NA", "EU", "OCE", "ASIA", "SA", "MENA"];
export const WR_TAGS = [
  "chill",
  "mic-required",
  "no-mic",
  "first-time",
  "veteran",
  "streaming",
  "18+",
];

export type PublishedCrew = {
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
  memberCount: number;
  updatedAt: string;
  bountyKills?: number;
  bountyEarned?: number;
  ownerId?: string;
  ownerName?: string;
};

export type CrewLeaderboardData = {
  stats: { crewCount: number; totalMembers: number; recruitingCount: number; totalKills: number };
  largest: {
    id: string;
    name: string;
    tag: string;
    logoUrl?: string | null;
    accentColor?: string | null;
    memberCount: number;
    bountyEarned: number;
    bountyKills: number;
    recruiting: boolean;
  }[];
  mostDecorated: {
    id: string;
    name: string;
    tag: string;
    logoUrl?: string | null;
    accentColor?: string | null;
    memberCount: number;
    bountyEarned: number;
    bountyKills: number;
    recruiting: boolean;
  }[];
  recruiting: {
    id: string;
    name: string;
    tag: string;
    logoUrl?: string | null;
    accentColor?: string | null;
    memberCount: number;
    bountyEarned: number;
    bountyKills: number;
    recruiting: boolean;
  }[];
};

export type MyCrew = {
  id: string;
  name: string;
  tag: string;
  description: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  accentColor?: string | null;
  tagShape?: string | null;
  homePort?: string | null;
  recruiting: boolean;
  recruitingNote: string;
  publicInLobbies: string[];
  myRole: "LEADER" | "OFFICER" | "MEMBER";
};

export function CrewTab({ lobbyId }: { lobbyId: string }) {
  const [posts, setPosts] = useState<LfgPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState(WR_MODES[0]);
  const [region, setRegion] = useState(WR_REGIONS[0]);
  const [slots, setSlots] = useState(1);
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const [crews, setCrews] = useState<PublishedCrew[]>([]);
  const [myCrews, setMyCrews] = useState<MyCrew[]>([]);
  const [editingCrew, setEditingCrew] = useState<MyCrew | null>(null);
  const [showCrewLeaders, setShowCrewLeaders] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [lfgJ, crewsJ, mineJ] = await Promise.all([
      apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`).catch(() => null),
      apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/crews`).catch(() => null),
      apiFetch("/crews/mine").catch(() => null),
    ]);
    if (lfgJ?.ok && Array.isArray(lfgJ.posts)) setPosts(lfgJ.posts);
    if (crewsJ?.ok && Array.isArray(crewsJ.crews)) setCrews(crewsJ.crews);
    if (mineJ && Array.isArray(mineJ.crews)) setMyCrews(mineJ.crews);
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function post() {
    if (!note.trim() || busy) return;
    setBusy(true);
    const body = {
      mode: mode === "Any" ? null : mode,
      region: region === "Any" ? null : region,
      tags: Array.from(tags),
      note: note.trim(),
      slotsWanted: slots,
    };
    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (j?.ok) {
      setNote("");
      setTags(new Set());
      reload();
    }
  }

  function toggleTag(t: string) {
    setTags((prev) => {
      const n = new Set(prev);
      n.has(t) ? n.delete(t) : n.add(t);
      return n;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...S.card, padding: 18 }}>
        <div
          style={{ ...S.label, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}
        >
          <SkullIcon size={14} />
          Raise Your Flag
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 240))}
          placeholder="Looking for 3 for a lighthouse run. Mic preferred. PvE, chill pace."
          style={{
            ...S.input,
            minHeight: 64,
            fontFamily: WR_FONT_SERIF,
            fontSize: 14,
            fontStyle: "italic",
          }}
        />
        <div
          style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}
        >
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{ ...S.input, width: "auto" }}
          >
            {WR_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={{ ...S.input, width: "auto" }}
          >
            {WR_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ ...S.label, fontSize: 9 }}>Need</span>
            <input
              type="number"
              min={1}
              max={7}
              value={slots}
              onChange={(e) => setSlots(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
              style={{ ...S.input, width: 60, textAlign: "center" }}
            />
          </div>
          <div style={{ flex: 1 }} />
          <button type="button" style={S.btnPrimary} onClick={post} disabled={busy || !note.trim()}>
            {busy ? "Hoisting…" : "Raise Flag"}
          </button>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {WR_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(t)}
              style={{
                ...S.btn,
                padding: "4px 10px",
                fontSize: 10,
                letterSpacing: "1px",
                borderColor: tags.has(t) ? PAL.brass : `${PAL.brass}35`,
                background: tags.has(t) ? `${PAL.brass}20` : S.btn.background,
                color: tags.has(t) ? PAL.brassHi : PAL.parchDim,
              }}
            >
              #{t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...S.card, padding: "18px 22px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ ...S.label, marginBottom: 4 }}>Established Crews</div>
            <h3
              style={{
                fontFamily: WR_FONT_DISPLAY,
                fontSize: 20,
                color: PAL.brassHi,
                margin: 0,
                letterSpacing: "0.3px",
              }}
            >
              Who's sailing under colors.
            </h3>
            <div style={{ fontSize: 12, color: PAL.parchDim, marginTop: 4, fontStyle: "italic" }}>
              Persistent crew profiles — home port, colors, recruiting status. Different from the
              flags below (which are one-off calls).
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={S.btn} onClick={() => setShowCrewLeaders(true)}>
              ⚑ Hall of Crews
            </button>
            {myCrews.some((c) => c.myRole === "LEADER") && (
              <button
                type="button"
                style={S.btnPrimary}
                onClick={() => {
                  const leaderCrews = myCrews.filter((c) => c.myRole === "LEADER");
                  const unpublished = leaderCrews.find(
                    (c) => !(c.publicInLobbies || []).includes(lobbyId),
                  );
                  setEditingCrew(unpublished || leaderCrews[0]);
                }}
              >
                {myCrews.some(
                  (c) => c.myRole === "LEADER" && (c.publicInLobbies || []).includes(lobbyId),
                )
                  ? "Edit My Crew"
                  : "Publish My Crew Here"}
              </button>
            )}
          </div>
        </div>
      </div>

      {crews.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 12,
          }}
        >
          {crews.map((c) => (
            <CrewProfileCard key={c.id} crew={c} isMember={myCrews.some((mc) => mc.id === c.id)} />
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0" }}>
        <div
          style={{
            flex: 1,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${PAL.brass}40, transparent)`,
          }}
        />
        <div style={{ ...S.label, fontSize: 9, whiteSpace: "nowrap" }}>Flags Flying Right Now</div>
        <div
          style={{
            flex: 1,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${PAL.brass}40, transparent)`,
          }}
        />
      </div>

      {editingCrew && (
        <CrewProfileEditor
          crew={editingCrew}
          lobbyId={lobbyId}
          onClose={() => setEditingCrew(null)}
          onSaved={() => {
            setEditingCrew(null);
            reload();
          }}
        />
      )}

      {showCrewLeaders && (
        <CrewLeaderboardModal lobbyId={lobbyId} onClose={() => setShowCrewLeaders(false)} />
      )}

      {loading ? (
        <LoadingState label="Scanning the horizon..." />
      ) : posts.length === 0 ? (
        <EmptyState
          icon="🏴‍☠️"
          title="No flags flying"
          hint="Be the first to raise one. Your crew is out there."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {posts.map((p) => (
            <div key={p.id} style={{ ...S.card, padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    background: p.userAvatar
                      ? `url(${p.userAvatar}) center/cover`
                      : `linear-gradient(135deg, ${PAL.brass}, ${PAL.brassLow})`,
                    border: `1px solid ${PAL.brass}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: WR_FONT_DISPLAY,
                    fontSize: 18,
                    color: PAL.abyss,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {!p.userAvatar && (p.userName || "?").slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontFamily: WR_FONT_DISPLAY,
                        fontSize: 15,
                        color: PAL.brassHi,
                        letterSpacing: "0.3px",
                      }}
                    >
                      {p.userName}
                    </span>
                    {p.mode && <span style={{ ...S.label, fontSize: 9 }}>· {p.mode}</span>}
                    {p.region && <span style={{ ...S.label, fontSize: 9 }}>· {p.region}</span>}
                    {p.slotsWanted ? (
                      <span style={{ ...S.label, fontSize: 9, color: PAL.brass }}>
                        · need {p.slotsWanted}
                      </span>
                    ) : null}
                    <span style={{ flex: 1 }} />
                    <span
                      style={{
                        fontFamily: WR_FONT_MONO,
                        fontSize: 10,
                        color: PAL.parchDim,
                        opacity: 0.6,
                      }}
                    >
                      {timeAgo(p.createdAt)}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 14,
                      color: PAL.parchment,
                      lineHeight: 1.5,
                      fontStyle: "italic",
                      opacity: 0.9,
                    }}
                  >
                    {p.note}
                  </p>
                  {p.tags && p.tags.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {p.tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: 10,
                            color: PAL.brass,
                            fontFamily: WR_FONT_MONO,
                            letterSpacing: "0.5px",
                          }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CrewProfileCard({ crew, isMember }: { crew: PublishedCrew; isMember: boolean }) {
  const accent =
    crew.accentColor && /^#[0-9a-f]{6}$/i.test(crew.accentColor) ? crew.accentColor : PAL.brass;

  function askToJoin() {
    if (!crew.ownerId) return;
    try {
      window.dispatchEvent(
        new CustomEvent("weered:dock:open", {
          detail: {
            mode: "dm",
            peer: { id: crew.ownerId, name: crew.ownerName || crew.name },
          },
        }),
      );
    } catch {}
  }
  return (
    <div
      style={{
        ...S.card,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        borderColor: `${accent}45`,
      }}
    >
      <div
        style={{
          height: 76,
          background: crew.bannerUrl
            ? `linear-gradient(180deg, rgba(10,18,32,0.2), rgba(10,18,32,0.85)), url(${crew.bannerUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${accent}35, ${PAL.stormDeep})`,
          position: "relative",
        }}
      >
        {crew.recruiting && (
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 10,
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              padding: "3px 8px",
              background: "rgba(93,183,101,0.22)",
              color: "#5db765",
              border: "1px solid rgba(93,183,101,0.45)",
              fontFamily: WR_FONT_MONO,
            }}
          >
            Recruiting
          </span>
        )}
      </div>

      <div
        style={{
          padding: "14px 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: -30 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 4,
              background: crew.logoUrl
                ? `url(${crew.logoUrl}) center/cover no-repeat, ${PAL.stormDeep}`
                : `linear-gradient(135deg, ${accent}, ${PAL.brassLow})`,
              border: `2px solid ${accent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: WR_FONT_DISPLAY,
              fontSize: 22,
              color: PAL.abyss,
              fontWeight: 700,
              flexShrink: 0,
              boxShadow: `0 2px 8px ${PAL.ink}`,
            }}
          >
            {!crew.logoUrl && (crew.tag || crew.name || "?").slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0, marginTop: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: WR_FONT_DISPLAY,
                  fontSize: 18,
                  color: PAL.brassHi,
                  letterSpacing: "0.3px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {crew.name}
              </span>
              {crew.tag && (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: WR_FONT_MONO,
                    color: accent,
                    letterSpacing: "1.5px",
                    padding: "2px 6px",
                    border: `1px solid ${accent}45`,
                    background: `${accent}10`,
                  }}
                >
                  [{crew.tag}]
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 10,
                color: PAL.parchDim,
                fontFamily: WR_FONT_MONO,
                letterSpacing: "0.5px",
                marginTop: 2,
              }}
            >
              {crew.memberCount} member{crew.memberCount === 1 ? "" : "s"}
              {crew.homePort ? <> · {crew.homePort}</> : null}
            </div>
          </div>
        </div>

        {crew.description && (
          <div
            style={{
              fontSize: 12,
              color: PAL.parchment,
              lineHeight: 1.55,
              fontStyle: "italic",
              opacity: 0.88,
            }}
          >
            {crew.description.length > 160
              ? `${crew.description.slice(0, 160)}…`
              : crew.description}
          </div>
        )}

        {crew.recruiting && (
          <div
            style={{
              padding: "8px 10px",
              background: "rgba(93,183,101,0.08)",
              border: "1px solid rgba(93,183,101,0.25)",
              borderRadius: 2,
              fontSize: 11,
              color: PAL.parchment,
              lineHeight: 1.5,
              fontStyle: "italic",
            }}
          >
            {crew.recruitingNote && (
              <>
                <div style={{ ...S.label, fontSize: 8, marginBottom: 3, color: "#5db765" }}>
                  Looking for
                </div>
                <div style={{ marginBottom: crew.ownerId && !isMember ? 8 : 0 }}>
                  {crew.recruitingNote.length > 140
                    ? `${crew.recruitingNote.slice(0, 140)}…`
                    : crew.recruitingNote}
                </div>
              </>
            )}
            {crew.ownerId && !isMember && (
              <button
                type="button"
                onClick={askToJoin}
                style={{
                  ...S.btnPrimary,
                  background: `linear-gradient(180deg, rgba(93,183,101,0.22), rgba(93,183,101,0.10))`,
                  borderColor: "rgba(93,183,101,0.5)",
                  color: "#8edc93",
                  padding: "7px 14px",
                  fontSize: 11,
                  letterSpacing: "1.5px",
                }}
              >
                Ask to Join →
              </button>
            )}
          </div>
        )}

        {((crew.bountyKills || 0) > 0 || (crew.bountyEarned || 0) > 0) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingTop: 10,
              borderTop: `1px solid ${PAL.brass}20`,
              fontFamily: WR_FONT_MONO,
              fontSize: 10,
              color: PAL.parchDim,
              letterSpacing: "0.5px",
            }}
          >
            <span style={{ color: "#5db765" }}>⚔</span>
            <span>
              <span
                style={{
                  color: PAL.parchment,
                  fontWeight: 600,
                  fontFamily: WR_FONT_DISPLAY,
                  fontSize: 13,
                  marginRight: 4,
                }}
              >
                {(crew.bountyKills || 0).toLocaleString()}
              </span>
              delivered
            </span>
            <span style={{ color: `${PAL.brass}60` }}>·</span>
            <span>
              <span
                style={{
                  color: accent,
                  fontWeight: 600,
                  fontFamily: WR_FONT_DISPLAY,
                  fontSize: 13,
                  marginRight: 4,
                }}
              >
                {(crew.bountyEarned || 0).toLocaleString()}
              </span>
              earned
            </span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <a
            href={`/crew/${encodeURIComponent(crew.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 10,
              color: PAL.parchDim,
              textDecoration: "none",
              fontFamily: WR_FONT_MONO,
              letterSpacing: "0.5px",
              padding: "3px 10px",
              border: `1px solid ${PAL.brass}20`,
              transition: "border-color .15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${PAL.brass}55`)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = `${PAL.brass}20`)}
          >
            view ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export function CrewLeaderboardModal({
  lobbyId,
  onClose,
}: {
  lobbyId: string;
  onClose: () => void;
}) {
  const [d, setD] = useState<CrewLeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/crews/leaderboard`)
      .then((j) => {
        if (j?.ok) setD(j as CrewLeaderboardData);
        else setErr("Couldn't pull the rankings.");
        setLoading(false);
      })
      .catch(() => {
        setErr("Couldn't pull the rankings.");
        setLoading(false);
      });
  }, [lobbyId]);

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
          width: "min(860px, 100%)",
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
          <div style={{ ...S.label, marginBottom: 4 }}>Hall of Crews</div>
          <div
            style={{
              fontFamily: WR_FONT_DISPLAY,
              fontSize: 24,
              color: PAL.brassHi,
              letterSpacing: "0.3px",
              lineHeight: 1.1,
            }}
          >
            Who's flying the biggest colors.
          </div>
        </div>

        <div
          style={{ padding: "18px 26px 22px", display: "flex", flexDirection: "column", gap: 16 }}
        >
          {loading ? (
            <LoadingState label="Tallying the roster..." />
          ) : err ? (
            <div
              style={{
                fontSize: 13,
                color: PAL.parchDim,
                fontStyle: "italic",
                padding: 16,
                textAlign: "center",
              }}
            >
              {err}
            </div>
          ) : !d ? null : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <StatTile label="Crews listed" value={d.stats.crewCount.toLocaleString()} />
                <StatTile
                  label="Total members"
                  value={d.stats.totalMembers.toLocaleString()}
                  highlight
                />
                <StatTile label="Recruiting now" value={d.stats.recruitingCount.toLocaleString()} />
                <StatTile
                  label="Bounties delivered"
                  value={d.stats.totalKills.toLocaleString()}
                  highlight
                />
              </div>

              {d.largest.length === 0 &&
              d.mostDecorated.length === 0 &&
              d.recruiting.length === 0 ? (
                <EmptyState
                  icon="⚑"
                  title="No crews on the board yet"
                  hint="Publish a crew to take your spot."
                />
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 12,
                  }}
                >
                  <CrewLeaderColumn
                    title="Largest Crews"
                    caption="By member headcount"
                    rows={d.largest.map((c, i) => ({
                      ...c,
                      rank: i + 1,
                      value: c.memberCount,
                      sub: "members",
                    }))}
                    emptyLabel="No members rostered yet."
                  />
                  <CrewLeaderColumn
                    title="Most Decorated"
                    caption="Paper earned on the bounty board"
                    rows={d.mostDecorated.map((c, i) => ({
                      ...c,
                      rank: i + 1,
                      value: c.bountyEarned,
                      sub: `${c.bountyKills} bount${c.bountyKills === 1 ? "y" : "ies"} delivered`,
                    }))}
                    emptyLabel="No crew's delivered a bounty yet."
                    valueKey="Paper"
                  />
                  <CrewLeaderColumn
                    title="Recruiting Now"
                    caption="Hoisted colors, taking hands"
                    rows={d.recruiting.map((c, i) => ({
                      ...c,
                      rank: i + 1,
                      value: c.memberCount,
                      sub: "crew size",
                    }))}
                    emptyLabel="No crews recruiting right now."
                  />
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" style={S.btn} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CrewLeaderColumn({
  title,
  caption,
  rows,
  emptyLabel,
  valueKey,
}: {
  title: string;
  caption: string;
  rows: {
    id: string;
    rank: number;
    name: string;
    tag: string;
    logoUrl?: string | null;
    accentColor?: string | null;
    value: number;
    sub: string;
  }[];
  emptyLabel: string;
  valueKey?: string;
}) {
  return (
    <div
      style={{ ...S.card, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div>
        <div
          style={{
            fontFamily: WR_FONT_DISPLAY,
            fontSize: 16,
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
            padding: "14px 0",
            textAlign: "center",
          }}
        >
          {emptyLabel}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map((r) => {
            const accent =
              r.accentColor && /^#[0-9a-f]{6}$/i.test(r.accentColor) ? r.accentColor : PAL.brass;
            return (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 8px",
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
                }}
              >
                <span
                  style={{
                    width: 20,
                    textAlign: "center",
                    fontFamily: WR_FONT_DISPLAY,
                    fontSize: r.rank === 1 ? 16 : 13,
                    color: r.rank === 1 ? PAL.brassHi : r.rank <= 3 ? PAL.brass : PAL.parchDim,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {r.rank}
                </span>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 2,
                    flexShrink: 0,
                    background: r.logoUrl
                      ? `url(${r.logoUrl}) center/cover`
                      : `linear-gradient(135deg, ${accent}, ${PAL.brassLow})`,
                    border: `1px solid ${accent}40`,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: WR_FONT_DISPLAY,
                      fontSize: 13,
                      color: PAL.parchment,
                      letterSpacing: "0.2px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.name}
                    {r.tag ? (
                      <span
                        style={{
                          fontSize: 9,
                          color: accent,
                          marginLeft: 6,
                          fontFamily: WR_FONT_MONO,
                        }}
                      >
                        [{r.tag}]
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 9, color: PAL.parchDim, fontStyle: "italic" }}>
                    {r.sub}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: WR_FONT_MONO,
                      fontSize: 12,
                      color: r.rank <= 3 ? PAL.brassHi : PAL.brass,
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                    }}
                  >
                    {r.value.toLocaleString()}
                  </div>
                  {valueKey && (
                    <div
                      style={{
                        fontSize: 7,
                        color: PAL.parchDim,
                        letterSpacing: "1px",
                        marginTop: 1,
                      }}
                    >
                      {valueKey}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CrewProfileEditor({
  crew,
  lobbyId,
  onClose,
  onSaved,
}: {
  crew: MyCrew;
  lobbyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(crew.name);
  const [tag, setTag] = useState(crew.tag);
  const [description, setDescription] = useState(crew.description);
  const [logoUrl, setLogoUrl] = useState(crew.logoUrl || "");
  const [bannerUrl, setBannerUrl] = useState(crew.bannerUrl || "");
  const [accentColor, setAccentColor] = useState(crew.accentColor || "");
  const [tagShape, setTagShape] = useState((crew as any).tagShape || "rounded");
  const [homePort, setHomePort] = useState(crew.homePort || "");
  const [recruiting, setRecruiting] = useState(crew.recruiting);
  const [recruitingNote, setRecruitingNote] = useState(crew.recruitingNote);
  const [publish, setPublish] = useState((crew.publicInLobbies || []).includes(lobbyId));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const lobbies = new Set(crew.publicInLobbies || []);
    if (publish) lobbies.add(lobbyId);
    else lobbies.delete(lobbyId);
    const j = await apiFetch(`/crews/${crew.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name,
        tag,
        description,
        logoUrl,
        bannerUrl,
        accentColor,
        tagShape,
        homePort,
        recruiting,
        recruitingNote,
        publicInLobbies: Array.from(lobbies),
      }),
    });
    setBusy(false);
    if (j?.ok) onSaved();
    else setErr(j?.message || j?.error || "Failed to save.");
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
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...S.card,
          width: "min(560px, 100%)",
          padding: "22px 26px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ ...S.label, marginBottom: 4 }}>Crew Profile</div>
        <div
          style={{
            fontFamily: WR_FONT_DISPLAY,
            fontSize: 22,
            color: PAL.brassHi,
            marginBottom: 14,
            letterSpacing: "0.3px",
          }}
        >
          {crew.name}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 10 }}>
          <Labeled label="Crew name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              style={S.input}
            />
          </Labeled>
          <Labeled label="Tag">
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="[WR]"
              style={S.input}
            />
          </Labeled>
        </div>

        <div style={{ marginTop: 10 }}>
          <Labeled label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 800))}
              style={{
                ...S.input,
                minHeight: 70,
                fontFamily: WR_FONT_SERIF,
                fontStyle: "italic",
              }}
            />
          </Labeled>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <Labeled label="Logo URL">
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value.slice(0, 500))}
              placeholder="https://..."
              style={S.input}
            />
          </Labeled>
          <Labeled label="Banner URL">
            <input
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value.slice(0, 500))}
              placeholder="https://..."
              style={S.input}
            />
          </Labeled>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 10, marginTop: 10 }}
        >
          <Labeled label="Accent color">
            <input
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value.slice(0, 7))}
              placeholder="#c9a066"
              style={{
                ...S.input,
                fontFamily: WR_FONT_MONO,
                textTransform: "lowercase",
              }}
            />
          </Labeled>
          <Labeled label="Tag shape">
            <select
              value={tagShape}
              onChange={(e) => setTagShape(e.target.value)}
              style={{ ...S.input, fontFamily: WR_FONT_MONO }}
            >
              <option value="rounded">Rounded</option>
              <option value="square">Square</option>
              <option value="pill">Pill</option>
            </select>
          </Labeled>
          <Labeled label="Home port">
            <input
              value={homePort}
              onChange={(e) => setHomePort(e.target.value.slice(0, 80))}
              placeholder="Tortuga · EU-3"
              style={S.input}
            />
          </Labeled>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            background: "rgba(93,183,101,0.06)",
            border: "1px solid rgba(93,183,101,0.2)",
            borderRadius: 2,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: 12,
              color: PAL.parchment,
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={recruiting}
              onChange={(e) => setRecruiting(e.target.checked)}
            />
            Recruiting new members
          </label>
          {recruiting && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={recruitingNote}
                onChange={(e) => setRecruitingNote(e.target.value.slice(0, 400))}
                placeholder="Looking for 2 cannoneers, 40+ level, mic preferred. No drama."
                style={{
                  ...S.input,
                  minHeight: 50,
                  fontFamily: WR_FONT_SERIF,
                  fontStyle: "italic",
                  fontSize: 12,
                }}
              />
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            background: `${PAL.brass}10`,
            border: `1px solid ${PAL.brass}30`,
            borderRadius: 2,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: 12,
              color: PAL.parchment,
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            List this crew in the {lobbyId} lobby
          </label>
          <div
            style={{
              fontSize: 10,
              color: PAL.parchDim,
              marginTop: 4,
              fontStyle: "italic",
              marginLeft: 24,
            }}
          >
            Other captains in this lobby will see your crew profile. Uncheck to delist.
          </div>
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

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button type="button" style={S.btn} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" style={S.btnPrimary} onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
