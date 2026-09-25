"use client";

import React, { useEffect, useState } from "react";
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
  landingColor,
  rankOf,
  vaFetch,
  type Airline,
  type Pirep,
  type Rank,
} from "./vaShared";

/**
 * The staff desk. It is a WINDOW onto the airline's operations, not a second
 * admin panel: accepting a PIREP or approving an application stays in vAMSYS,
 * where the airline already does it, and every action here links there. What
 * the desk adds is everything a staff member needs to see in one place.
 */

type Desk = {
  review: Pirep[];
  recentlyRejected: Pirep[];
  applications: {
    id: string;
    name: string;
    country: string;
    simulator: string;
    network: string;
    hoursElsewhere: number;
    appliedAt: string;
    note: string;
  }[];
  inactive: {
    id: string;
    name: string;
    rankKey: string;
    hub: string;
    lastFlightAt: string | null;
  }[];
  byRank: Record<string, number>;
  ranks: Rank[];
  event: {
    title: string;
    startsAt: string;
    totals: { slots: number; booked: number };
    waves: { key: string; name: string; base: string; slots: number; booked: number }[];
  } | null;
  recentClaims: { slotKey: string; name: string; at: string }[];
};

export default function VaStaffDesk({
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
  const [d, setD] = useState<Desk | null>(null);
  const [http, setHttp] = useState(0);
  useEffect(() => {
    const load = () =>
      vaFetch<Desk>(`/va/${encodeURIComponent(lobbyId)}/staff`).then((r) => {
        setHttp(r.status);
        if (r.status === 200 && r.data) setD(r.data);
      });
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [lobbyId]);

  if (http === 401 || http === 403)
    return <Locked need="staff" signedIn={signedIn} airline={airline} />;
  if (!d) return <div style={{ padding: 40, color: VA.muted }}>Opening the staff desk…</div>;

  const orwell = airline?.loginUrl || "https://vamsys.io";
  const total = Object.values(d.byRank).reduce((a, b) => a + b, 0) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SampleBanner text="Sample queue. In production the review queue, applications and roster come from vAMSYS, and each action opens the record there." />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
        }}
      >
        <Kpi
          label="Awaiting review"
          value={d.review.length}
          tone={d.review.length ? VA.sun : VA.ok}
        />
        <Kpi label="New applications" value={d.applications.length} tone={VA.info} />
        <Kpi
          label="Inactive 30 days"
          value={d.inactive.length}
          tone={d.inactive.length ? VA.bad : VA.ok}
        />
        {d.event && (
          <Kpi
            label="Bank booked"
            value={`${d.event.totals.booked}/${d.event.totals.slots}`}
            tone={VA.sun}
          />
        )}
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 14 }}
        className="va-desk-grid"
      >
        <Card
          title="PIREP review queue"
          right={
            <a
              href={orwell}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12, color: VA.sun }}
            >
              Open in vAMSYS ↗
            </a>
          }
        >
          {!d.review.length && <div style={{ color: VA.muted, fontSize: 13 }}>Queue is clear.</div>}
          {d.review.map((p) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                padding: "10px 0",
                borderTop: `1px solid ${VA.line}`,
              }}
            >
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: HEAD_FONT, fontSize: 18 }}>{p.callsign}</span>
                  <span style={{ color: VA.ice, fontSize: 13 }}>
                    {p.dep} → {p.arr} · {p.fleet} · {hhmm(p.blockMinutes)}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: VA.muted, marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => p.pilotId && onOpenPilot(p.pilotId)}
                    style={{
                      background: "none",
                      border: 0,
                      padding: 0,
                      color: VA.ice,
                      cursor: "pointer",
                    }}
                  >
                    {p.pilotName}
                  </button>{" "}
                  · filed {ago(p.filedAt)} ·{" "}
                  <span style={{ color: landingColor(p.landingRateFpm) }}>
                    {p.landingRateFpm} fpm, {p.gForce.toFixed(2)}g
                  </span>
                  {p.landingRateFpm < -480 ? (
                    <span style={{ color: VA.bad }}> · AutoReject: firm arrival</span>
                  ) : (
                    <span> · AutoReject: flagged event</span>
                  )}
                </div>
              </div>
              <StatusChip status={p.status} />
            </div>
          ))}
          {!!d.recentlyRejected.length && (
            <div style={{ marginTop: 10, fontSize: 12, color: VA.faint }}>
              Recently rejected or invalidated:{" "}
              {d.recentlyRejected.map((p) => p.callsign).join(", ")}
            </div>
          )}
        </Card>

        <Card
          title="Applications"
          right={
            <a
              href={orwell}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12, color: VA.sun }}
            >
              Review ↗
            </a>
          }
        >
          {d.applications.map((a) => (
            <div key={a.id} style={{ padding: "10px 0", borderTop: `1px solid ${VA.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 14 }}>
                  <Country cc={a.country} />
                  {a.name}
                </span>
                <span style={{ fontSize: 12, color: VA.muted }}>{ago(a.appliedAt)}</span>
              </div>
              <div style={{ fontSize: 12, color: VA.muted }}>
                {a.simulator} · {a.network} ·{" "}
                {a.hoursElsewhere ? `${a.hoursElsewhere} h elsewhere` : "new to online flying"}
              </div>
              <div style={{ fontSize: 12.5, color: VA.ice, marginTop: 4, lineHeight: 1.45 }}>
                “{a.note}”
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 14,
        }}
      >
        {d.event && (
          <Card
            title="Autumn Sun Bank · fill by wave"
            right={
              <span style={{ fontSize: 12, color: VA.muted }}>
                {cetTime(d.event.startsAt)} CEST
              </span>
            }
          >
            {d.event.waves.map((w) => (
              <div key={w.key} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>
                    <span style={{ color: VA.sun, fontFamily: HEAD_FONT, letterSpacing: ".1em" }}>
                      {w.base}
                    </span>{" "}
                    {w.name}
                  </span>
                  <span style={{ color: VA.muted }}>
                    {w.booked}/{w.slots}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "rgba(255,255,255,.07)",
                    marginTop: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round((w.booked / Math.max(1, w.slots)) * 100)}%`,
                      height: "100%",
                      background: VA.sun,
                    }}
                  />
                </div>
              </div>
            ))}
            {!!d.recentClaims.length && (
              <div style={{ fontSize: 12, color: VA.muted, marginTop: 6 }}>
                Latest bookings: {d.recentClaims.map((c) => `${c.name} (${c.slotKey})`).join(", ")}
              </div>
            )}
          </Card>
        )}

        <Card title="Roster by rank">
          {d.ranks
            .filter((r) => !r.honorary)
            .map((r) => {
              const n = d.byRank[r.key] || 0;
              return (
                <div
                  key={r.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr 34px",
                    gap: 10,
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <Epaulette rank={r} height={16} />
                  <div>
                    <div style={{ fontSize: 12.5 }}>{r.name}</div>
                    <div
                      style={{
                        height: 5,
                        borderRadius: 3,
                        background: "rgba(255,255,255,.07)",
                        marginTop: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.round((n / total) * 100)}%`,
                          height: "100%",
                          background: VA.info,
                        }}
                      />
                    </div>
                  </div>
                  <span style={{ textAlign: "right", fontFamily: HEAD_FONT, fontSize: 17 }}>
                    {n}
                  </span>
                </div>
              );
            })}
        </Card>

        <Card title="Gone quiet (30+ days)">
          {!d.inactive.length && (
            <div style={{ color: VA.muted, fontSize: 13 }}>Everyone has flown this month.</div>
          )}
          {d.inactive.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpenPilot(p.id)}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                background: "none",
                border: 0,
                borderTop: `1px solid ${VA.line}`,
                color: VA.text,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Epaulette rank={rankOf(d.ranks, p.rankKey)} height={14} />
              <span style={{ flex: 1, fontSize: 13 }}>{p.name}</span>
              <span style={{ fontSize: 12, color: VA.muted }}>
                {p.hub} · {p.lastFlightAt ? `last ${ago(p.lastFlightAt)}` : "no flights"}
              </span>
            </button>
          ))}
        </Card>
      </div>
      <style>{`@media (max-width: 900px){ .va-desk-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: VA.card,
        border: `1px solid ${VA.line}`,
        borderTop: `3px solid ${tone}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: VA.muted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: HEAD_FONT,
          fontSize: 34,
          fontWeight: 800,
          color: VA.text,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
