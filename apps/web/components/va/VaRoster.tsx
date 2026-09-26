"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  VA,
  HEAD_FONT,
  Card,
  Epaulette,
  Locked,
  SampleBanner,
  StatusChip,
  ago,
  cetTime,
  Country,
  hhmm,
  hours,
  landingColor,
  rankOf,
  vaFetch,
  type Airline,
  type Departure,
  type LiveFlight,
  type Pilot,
  type Pirep,
  type Rank,
} from "./vaShared";

/** The roster, sorted by hours like a seniority list, and the profile sheet. */

type Sort = "hours" | "rank" | "recent" | "landing";

export default function VaRoster({
  lobbyId,
  airline,
  signedIn,
  onOpenPilot,
}: {
  lobbyId: string;
  airline: Airline | null;
  signedIn: boolean;
  onOpenPilot: (id: string) => void;
}) {
  const [data, setData] = useState<{ pilots: Pilot[]; ranks: Rank[] } | null>(null);
  const [status, setStatus] = useState(0);
  const [q, setQ] = useState("");
  const [hub, setHub] = useState<"ALL" | "FRA" | "MUC">("ALL");
  const [sort, setSort] = useState<Sort>("hours");

  useEffect(() => {
    vaFetch<{ pilots: Pilot[]; ranks: Rank[] }>(`/va/${encodeURIComponent(lobbyId)}/pilots`).then(
      (r) => {
        setStatus(r.status);
        if (r.status === 200 && r.data) setData(r.data);
      },
    );
  }, [lobbyId]);

  const list = useMemo(() => {
    if (!data) return [];
    const order = new Map(data.ranks.map((r, i) => [r.key, i]));
    const needle = q.trim().toLowerCase();
    return data.pilots
      .filter((p) => hub === "ALL" || p.hub === hub)
      .filter(
        (p) =>
          !needle || p.name.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle),
      )
      .sort((a, b) => {
        if (sort === "rank")
          return (order.get(b.rankKey) ?? 0) - (order.get(a.rankKey) ?? 0) || b.minutes - a.minutes;
        if (sort === "recent")
          return Date.parse(b.lastFlightAt || "0") - Date.parse(a.lastFlightAt || "0");
        if (sort === "landing") return (b.avgLandingFpm ?? -9999) - (a.avgLandingFpm ?? -9999);
        return b.minutes - a.minutes;
      });
  }, [data, q, hub, sort]);

  if (status === 401 || status === 403)
    return <Locked need="crew" signedIn={signedIn} airline={airline} />;
  if (!data) return <div style={{ padding: 40, color: VA.muted }}>Loading the roster…</div>;

  const byRank = new Map<string, number>();
  for (const p of data.pilots) byRank.set(p.rankKey, (byRank.get(p.rankKey) || 0) + 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SampleBanner text="Sample roster. The names are invented placeholders, not vOCN members; in production the roster, ranks and hours sync from vAMSYS." />
      <Card title="Rank structure" pad={14}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {data.ranks
            .filter((r) => !r.honorary)
            .map((r) => (
              <div
                key={r.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "rgba(0,0,0,.18)",
                  border: `1px solid ${VA.line}`,
                }}
              >
                <Epaulette rank={r} height={18} />
                <div>
                  <div style={{ fontSize: 13, color: VA.text }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: VA.faint }}>
                    {r.hours ? `${r.hours} h · ${r.pireps} PIREPs` : "Entry"} ·{" "}
                    {byRank.get(r.key) || 0} pilots
                  </div>
                </div>
              </div>
            ))}
        </div>
      </Card>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or OCN id"
          style={{
            flex: "1 1 220px",
            maxWidth: 320,
            padding: "9px 12px",
            borderRadius: 8,
            border: `1px solid ${VA.line}`,
            background: "rgba(0,0,0,.25)",
            color: VA.text,
          }}
        />
        {(["ALL", "FRA", "MUC"] as const).map((h) => (
          <button
            key={h}
            type="button"
            className={`va-seg${hub === h ? " on" : ""}`}
            onClick={() => setHub(h)}
          >
            {h === "ALL" ? "Both bases" : h}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${VA.line}`,
            background: VA.deep,
            color: VA.text,
          }}
        >
          <option value="hours">Most hours</option>
          <option value="rank">Rank</option>
          <option value="recent">Last flown</option>
          <option value="landing">Softest landings</option>
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
          gap: 10,
        }}
      >
        {list.map((p) => {
          const rank = rankOf(data.ranks, p.rankKey);
          const hon = rankOf(data.ranks, p.honoraryKey);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpenPilot(p.id)}
              style={{
                textAlign: "left",
                cursor: "pointer",
                padding: 14,
                borderRadius: 12,
                color: VA.text,
                background: p.isMe ? `linear-gradient(135deg, ${VA.sun}22, ${VA.card})` : VA.card,
                border: `1px solid ${p.isMe ? `${VA.sun}88` : VA.line}`,
                opacity: p.active ? 1 : 0.62,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Epaulette rank={rank} height={20} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <Country cc={p.country} />
                    {p.name} {p.isMe && <span style={{ color: VA.sun, fontSize: 11 }}>· YOU</span>}
                  </div>
                  <div style={{ fontSize: 12, color: VA.muted }}>
                    {p.id} · {rank?.name}
                    {hon ? <span style={{ color: VA.sun }}> · {hon.abbr}</span> : null}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 6,
                  marginTop: 12,
                }}
              >
                <Tiny label="Hours" value={hours(p.minutes)} />
                <Tiny label="Base" value={p.hub} />
                <Tiny
                  label="Avg ldg"
                  value={p.avgLandingFpm != null ? `${p.avgLandingFpm}` : "–"}
                  color={p.avgLandingFpm != null ? landingColor(p.avgLandingFpm) : undefined}
                />
              </div>
              <div style={{ fontSize: 11, color: VA.faint, marginTop: 8 }}>
                {p.active ? `Last flight ${ago(p.lastFlightAt)}` : "Inactive 30+ days"} ·{" "}
                {p.network}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Tiny({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div
        style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: VA.faint }}
      >
        {label}
      </div>
      <div
        style={{ fontFamily: HEAD_FONT, fontSize: 19, fontWeight: 700, color: color || VA.text }}
      >
        {value}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ profile sheet

type Profile = {
  pilot: Pilot;
  rank: Rank | null;
  honorary: Rank | null;
  progress: {
    rank: Rank;
    hours: { have: number; need: number };
    points: { have: number; need: number };
    pireps: { have: number; need: number };
    fraction: number;
  } | null;
  live: LiveFlight | null;
  booked: Departure | null;
  stats: {
    windowPireps: number;
    byFleetMinutes: Record<string, number>;
    topRoutes: { route: string; flights: number }[];
    airportsVisited: number;
    bestLanding: { fpm: number; route: string; at: string } | null;
  };
  pireps: Pirep[];
};

export function VaPilotSheet({
  lobbyId,
  pilotId,
  onClose,
}: {
  lobbyId: string;
  pilotId: string;
  onClose: () => void;
}) {
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setP(null);
    vaFetch<Profile>(
      `/va/${encodeURIComponent(lobbyId)}/pilots/${encodeURIComponent(pilotId)}`,
    ).then((r) => {
      if (r.status === 200 && r.data) setP(r.data);
      else setErr(true);
    });
  }, [lobbyId, pilotId]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  // Portalled to <body>: inside the hub panel the sheet is trapped in the panel's
  // stacking context, and no z-index can lift it above the site's announcement bar.
  return createPortal(
    <div
      role="presentation"
      tabIndex={-1}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,6,16,.62)",
        backdropFilter: "blur(3px)",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pilot profile"
        style={{
          width: 520,
          maxWidth: "100%",
          height: "100%",
          overflowY: "auto",
          background: `linear-gradient(180deg, ${VA.deep}, ${VA.night})`,
          borderLeft: `1px solid ${VA.sun}44`,
          boxShadow: "-20px 0 60px rgba(0,0,0,.5)",
          color: VA.text,
          animation: "vaSlide .28s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <style>{`@keyframes vaSlide{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}`}</style>
        {!p && !err && <div style={{ padding: 40, color: VA.muted }}>Loading pilot…</div>}
        {err && <div style={{ padding: 40, color: VA.muted }}>That pilot could not be loaded.</div>}
        {p && (
          <>
            <div
              style={{
                position: "relative",
                padding: "26px 24px 20px",
                background:
                  "linear-gradient(180deg, rgba(0,12,29,.35), rgba(0,12,29,.95)), url(/brand/vocn/rooms/flightdeck-banner.webp) center/cover",
                borderBottom: `1px solid ${VA.line}`,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  position: "absolute",
                  right: 14,
                  top: 12,
                  background: "none",
                  border: 0,
                  color: VA.ice,
                  fontSize: 24,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
              <Epaulette rank={p.rank || undefined} height={30} />
              <div
                style={{
                  fontFamily: HEAD_FONT,
                  fontSize: 32,
                  fontWeight: 800,
                  marginTop: 10,
                  letterSpacing: ".02em",
                }}
              >
                <Country cc={p.pilot.country} />
                {p.pilot.name}
              </div>
              <div style={{ color: VA.ice, fontSize: 13 }}>
                {p.pilot.id} · {p.rank?.name}
                {p.honorary ? <span style={{ color: VA.sun }}> · {p.honorary.name}</span> : null} ·
                Based {p.pilot.hub}
              </div>
              {p.live && (
                <div
                  style={{
                    marginTop: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: `${VA.ok}22`,
                    border: `1px solid ${VA.ok}66`,
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: VA.ok,
                      boxShadow: `0 0 8px ${VA.ok}`,
                    }}
                  />
                  Flying now: {p.live.callsign} {p.live.dep} → {p.live.arr} · {p.live.phase}
                </div>
              )}
              {!p.live && p.booked && (
                <div style={{ marginTop: 12, fontSize: 13, color: VA.ice }}>
                  Booked: {p.booked.callsign} {p.booked.dep} → {p.booked.arr}, off-block{" "}
                  {cetTime(p.booked.departsAt)} CEST
                </div>
              )}
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                <Tiny label="Hours" value={hours(p.pilot.minutes)} />
                <Tiny label="PIREPs" value={p.pilot.pireps.toLocaleString("en-GB")} />
                <Tiny label="Points" value={p.pilot.points.toLocaleString("en-GB")} />
                <Tiny
                  label="Avg ldg"
                  value={p.pilot.avgLandingFpm != null ? String(p.pilot.avgLandingFpm) : "–"}
                  color={
                    p.pilot.avgLandingFpm != null ? landingColor(p.pilot.avgLandingFpm) : undefined
                  }
                />
              </div>

              {p.progress ? (
                <Card
                  title={`Next: ${p.progress.rank.name}`}
                  right={
                    <span style={{ fontFamily: HEAD_FONT, fontSize: 20, color: VA.sun }}>
                      {Math.round(p.progress.fraction * 100)}%
                    </span>
                  }
                  pad={14}
                >
                  <Req label="Hours" have={p.progress.hours.have} need={p.progress.hours.need} />
                  <Req label="Points" have={p.progress.points.have} need={p.progress.points.need} />
                  <Req label="PIREPs" have={p.progress.pireps.have} need={p.progress.pireps.need} />
                  <div style={{ fontSize: 11.5, color: VA.faint, marginTop: 6 }}>
                    vAMSYS promotes when all three are met.
                  </div>
                </Card>
              ) : (
                <Card title="Top of the ladder" pad={14}>
                  <div style={{ color: VA.ice, fontSize: 13 }}>
                    Senior Captain. Nothing left to earn but the respect of the First Officers.
                  </div>
                </Card>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Card title="Fleet" pad={14}>
                  {Object.entries(p.stats.byFleetMinutes)
                    .sort((a, b) => b[1] - a[1])
                    .map(([f, m]) => (
                      <div
                        key={f}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 13,
                          padding: "3px 0",
                        }}
                      >
                        <span>{f}</span>
                        <span style={{ color: VA.muted }}>{hhmm(m)}</span>
                      </div>
                    ))}
                  {!Object.keys(p.stats.byFleetMinutes).length && (
                    <div style={{ fontSize: 12, color: VA.faint }}>No flights this month.</div>
                  )}
                </Card>
                <Card title="Routes" pad={14}>
                  {p.stats.topRoutes.map((r) => (
                    <div
                      key={r.route}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        padding: "3px 0",
                      }}
                    >
                      <span>{r.route.replace("-", " → ")}</span>
                      <span style={{ color: VA.muted }}>×{r.flights}</span>
                    </div>
                  ))}
                  {p.stats.bestLanding && (
                    <div style={{ fontSize: 12, color: VA.muted, marginTop: 6 }}>
                      Best:{" "}
                      <span style={{ color: landingColor(p.stats.bestLanding.fpm) }}>
                        {p.stats.bestLanding.fpm} fpm
                      </span>{" "}
                      {p.stats.bestLanding.route.replace("-", "→")}
                    </div>
                  )}
                </Card>
              </div>

              <Card title="Recent PIREPs" pad={0}>
                <div style={{ padding: "0 14px 8px" }}>
                  {p.pireps.slice(0, 12).map((x) => (
                    <div
                      key={x.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "76px 1fr auto auto",
                        gap: 10,
                        alignItems: "center",
                        padding: "8px 0",
                        borderTop: `1px solid ${VA.line}`,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontFamily: HEAD_FONT, fontSize: 16 }}>{x.callsign}</span>
                      <span style={{ color: VA.ice }}>
                        {x.dep} → {x.arr}{" "}
                        <span style={{ color: VA.faint }}>· {hhmm(x.blockMinutes)}</span>
                      </span>
                      <span
                        style={{
                          color: landingColor(x.landingRateFpm),
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {x.landingRateFpm}
                      </span>
                      <StatusChip status={x.status} />
                    </div>
                  ))}
                  {!p.pireps.length && (
                    <div style={{ padding: "12px 0", color: VA.faint, fontSize: 13 }}>
                      No reports in the last month.
                    </div>
                  )}
                </div>
              </Card>
              <div style={{ fontSize: 11.5, color: VA.faint }}>
                Joined{" "}
                {new Date(p.pilot.joinedAt).toLocaleDateString("en-GB", {
                  month: "long",
                  year: "numeric",
                })}{" "}
                · {p.pilot.simulator} · {p.pilot.network}
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Req({ label, have, need }: { label: string; have: number; need: number }) {
  const f = need ? Math.min(1, have / need) : 1;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <span style={{ color: VA.ice }}>{label}</span>
        <span style={{ color: f >= 1 ? VA.ok : VA.muted, fontVariantNumeric: "tabular-nums" }}>
          {have.toLocaleString("en-GB")} / {need.toLocaleString("en-GB")}
        </span>
      </div>
      <div
        style={{
          height: 5,
          borderRadius: 3,
          background: "rgba(255,255,255,.07)",
          marginTop: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.round(f * 100)}%`,
            height: "100%",
            background: f >= 1 ? VA.ok : VA.sun,
          }}
        />
      </div>
    </div>
  );
}
