"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  VA,
  HEAD_FONT,
  CREW_LEVEL,
  Card,
  Epaulette,
  SampleBanner,
  StatusChip,
  ago,
  cetTime,
  countdown,
  hhmm,
  hours,
  landingColor,
  rankOf,
  useNow,
  vaFetch,
  type Hub,
  type Pirep,
} from "./vaShared";

const VaLiveMap = dynamic(() => import("./VaLiveMap"), { ssr: false });

/**
 * The crew hub's front page: one screen for what is otherwise spread across
 * vAMSYS, the airline's own site and Discord. Who is flying, what just
 * landed, what is coming up, where you stand. The public sees the airline;
 * crew see the people in it.
 */

type LobbyEvent = {
  id: string;
  title: string;
  category: string;
  startsAt: string;
  endsAt: string | null;
  description: string;
};

const CATEGORY: Record<string, { label: string; color: string }> = {
  group_flight: { label: "Group flight", color: VA.sun },
  event: { label: "Event", color: VA.info },
  training: { label: "Training", color: VA.ok },
  meeting: { label: "Crew meeting", color: "#c49bff" },
};

export default function VaHub({
  hub,
  lobbyId,
  onGo,
  onOpenPilot,
}: {
  hub: Hub;
  lobbyId: string;
  onGo: (tab: string) => void;
  onOpenPilot: (id: string) => void;
}) {
  const crew = hub.me.level >= CREW_LEVEL;
  const now = useNow(1000);
  const [events, setEvents] = useState<LobbyEvent[]>([]);

  useEffect(() => {
    vaFetch<{ events: LobbyEvent[] }>(
      `/lobbies/${encodeURIComponent(lobbyId)}/events?limit=12`,
    ).then((r) => {
      if (r.status === 200 && r.data)
        setEvents(r.data.events.filter((e) => Date.parse(e.endsAt || e.startsAt) > Date.now()));
    });
  }, [lobbyId]);

  // A PIREP that was not there on the previous poll gets a brief highlight:
  // the moment a flight from the map lands in the log.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const ids = new Set(hub.pireps.map((p) => p.id));
    const prev = seen.current;
    seen.current = ids;
    if (prev) setFresh(new Set([...ids].filter((id) => !prev.has(id))));
  }, [hub.pireps]);

  const s = hub.stats;
  const gf = hub.groupFlight;
  const hour = new Date(now).toLocaleString("en-GB", {
    hour: "numeric",
    hour12: false,
    timeZone: "Europe/Berlin",
  });
  const greeting =
    Number(hour) < 12 ? "Good morning" : Number(hour) < 18 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{`@keyframes vaFresh{0%{background:rgba(255,205,0,.28)}100%{background:transparent}} .va-hub-2{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:14px} .va-hub-3{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr);gap:14px} @media (max-width:1100px){.va-hub-3{grid-template-columns:1fr 1fr}} @media (max-width:820px){.va-hub-2,.va-hub-3{grid-template-columns:1fr}}`}</style>

      {/* Hero */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 18,
          border: `1px solid ${VA.line}`,
          minHeight: 190,
          background: `linear-gradient(90deg, rgba(0,12,29,.96) 18%, rgba(0,12,29,.2) 70%), url(/brand/vocn/cockpit-gate.webp) 50% 38%/cover`,
          padding: "26px 26px 22px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 18,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: VA.sun,
            }}
          >
            {hub.airline.legalName || hub.airline.name} · Crew Hub
          </div>
          <h2
            style={{
              margin: "8px 0 4px",
              fontFamily: HEAD_FONT,
              fontSize: 38,
              fontWeight: 800,
              lineHeight: 1.02,
              color: VA.text,
            }}
          >
            {crew
              ? `${greeting}. ${s.liveNow ? `${s.liveNow} crews are out there.` : "The bases are quiet."}`
              : "Holiday flying, with a crew around you."}
          </h2>
          <div style={{ color: VA.ice, fontSize: 14, maxWidth: 560 }}>
            {crew
              ? `Frankfurt ${cetTime(new Date(now).toISOString())} CEST. ${s.pirepsToday} flights filed today${s.busiestRoute ? `; ${s.busiestRoute.dep}–${s.busiestRoute.arr} is the busiest route this month` : ""}.`
              : hub.airline.tagline}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {gf && (
            <button type="button" className="va-btn" onClick={() => onGo(crew ? "board" : "join")}>
              {crew ? "Book the Autumn Sun Bank" : "Join the crew"}
            </button>
          )}
          <button type="button" className="va-btn ghost" onClick={() => onGo("map")}>
            Live map
          </button>
        </div>
      </div>

      {hub.sample && <SampleBanner />}

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        <Kpi label="Flying now" value={s.liveNow} live />
        <Kpi label="Filed today" value={s.pirepsToday} />
        <Kpi label="Hours this month" value={s.hours30d.toLocaleString("en-GB")} />
        <Kpi label="Active pilots" value={`${s.activePilots30d}/${s.pilots}`} />
        <Kpi
          label="Avg landing, 7 days"
          value={s.avgLandingFpm7d != null ? `${s.avgLandingFpm7d}` : "–"}
          sub="fpm"
          color={s.avgLandingFpm7d != null ? landingColor(s.avgLandingFpm7d) : undefined}
        />
      </div>

      {/* Map + departures */}
      <div className="va-hub-2">
        <Card
          title="Live traffic"
          right={
            <button type="button" onClick={() => onGo("map")} style={linkBtn}>
              Full map →
            </button>
          }
          pad={10}
        >
          <VaLiveMap hub={hub} height={340} compact />
        </Card>
        <Card title={crew ? "Booked departures" : "In the air"}>
          {crew ? (
            <>
              {!hub.departures.length && (
                <div style={{ color: VA.muted, fontSize: 13 }}>
                  Nothing booked in the next 90 minutes.
                </div>
              )}
              {hub.departures.map((d) => (
                <Row key={d.id}>
                  <span style={{ fontFamily: HEAD_FONT, fontSize: 18, width: 58 }}>
                    {cetTime(d.departsAt)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: HEAD_FONT, fontSize: 16 }}>{d.callsign}</span>{" "}
                    <span style={{ color: VA.sun }}>
                      {d.dep}→{d.arr}
                    </span>
                    <br />
                    <button type="button" onClick={() => onOpenPilot(d.pilotId)} style={nameBtn}>
                      {d.pilotName}
                    </button>{" "}
                    <span style={{ color: VA.faint, fontSize: 12 }}>· {d.fleet}</span>
                  </span>
                  <span style={{ fontSize: 12, color: VA.muted }}>
                    in {countdown(d.departsAt, now)}
                  </span>
                </Row>
              ))}
            </>
          ) : (
            hub.live.slice(0, 7).map((f) => (
              <Row key={f.id}>
                <span style={{ fontFamily: HEAD_FONT, fontSize: 16, width: 76 }}>{f.callsign}</span>
                <span style={{ flex: 1, color: VA.sun }}>
                  {f.dep} → {f.arr}
                </span>
                <span style={{ fontSize: 12, color: VA.muted }}>{f.phase}</span>
              </Row>
            ))
          )}
        </Card>
      </div>

      {/* Feed + leaders + upcoming */}
      <div className="va-hub-3">
        <Card
          title="Just landed"
          right={
            crew ? (
              <button type="button" onClick={() => onGo("logbook")} style={linkBtn}>
                Logbook →
              </button>
            ) : null
          }
        >
          {hub.pireps.map((p: Pirep) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr auto",
                gap: 8,
                alignItems: "center",
                padding: "8px 6px",
                borderTop: `1px solid ${VA.line}`,
                borderRadius: 6,
                animation: fresh.has(p.id) ? "vaFresh 4s ease-out" : undefined,
              }}
            >
              <span style={{ fontFamily: HEAD_FONT, fontSize: 16 }}>{p.callsign}</span>
              <span style={{ minWidth: 0, fontSize: 13 }}>
                <span style={{ color: VA.ice }}>
                  {p.dep} → {p.arr}
                </span>{" "}
                <span style={{ color: VA.faint }}>· {hhmm(p.blockMinutes)}</span>
                {p.pilotName && (
                  <>
                    <br />
                    <button
                      type="button"
                      onClick={() => p.pilotId && onOpenPilot(p.pilotId)}
                      style={nameBtn}
                    >
                      {p.pilotName}
                    </button>
                    <span style={{ color: VA.faint, fontSize: 12 }}> · {ago(p.filedAt, now)}</span>
                  </>
                )}
              </span>
              <span style={{ textAlign: "right" }}>
                <div
                  style={{
                    color: landingColor(p.landingRateFpm),
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 13,
                  }}
                >
                  {p.landingRateFpm} fpm
                </div>
                {crew && <StatusChip status={p.status} />}
              </span>
            </div>
          ))}
        </Card>

        {crew && hub.leaders ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card title="Most hours · 30 days">
              {hub.leaders.hours.map((l, i) => (
                <Row key={l.pilotId}>
                  <span
                    style={{
                      fontFamily: HEAD_FONT,
                      fontSize: 18,
                      width: 18,
                      color: i === 0 ? VA.sun : VA.faint,
                    }}
                  >
                    {i + 1}
                  </span>
                  <Epaulette rank={rankOf(hub.ranks, l.rankKey)} height={13} />
                  <button
                    type="button"
                    onClick={() => onOpenPilot(l.pilotId)}
                    style={{ ...nameBtn, flex: 1, textAlign: "left" }}
                  >
                    {l.name}
                  </button>
                  <span style={{ fontFamily: HEAD_FONT, fontSize: 16 }}>{hours(l.minutes)} h</span>
                </Row>
              ))}
            </Card>
            <Card title="Butter board · 7 days">
              {hub.leaders.landings.map((l, i) => (
                <Row key={`${l.pilotId}-${i}`}>
                  <span
                    style={{
                      fontFamily: HEAD_FONT,
                      fontSize: 18,
                      width: 18,
                      color: i === 0 ? VA.sun : VA.faint,
                    }}
                  >
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenPilot(l.pilotId)}
                    style={{ ...nameBtn, flex: 1, textAlign: "left" }}
                  >
                    {l.name}
                    <span style={{ color: VA.faint, fontSize: 11.5 }}>
                      {" "}
                      · {l.route.replace("-", "→")}
                    </span>
                  </button>
                  <span
                    style={{
                      color: landingColor(l.landingRateFpm),
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {l.landingRateFpm}
                  </span>
                </Row>
              ))}
            </Card>
          </div>
        ) : (
          <Card title="Why fly with us">
            <p style={{ margin: 0, color: VA.ice, fontSize: 14, lineHeight: 1.6 }}>
              Leisure routes out of Frankfurt and Munich on three Airbus types, events every week,
              and a crew room that is actually a room. The roster, the logbook and the group-flight
              board open once you are aboard.
            </p>
            <button
              type="button"
              className="va-btn"
              style={{ marginTop: 14 }}
              onClick={() => onGo("join")}
            >
              How to join
            </button>
          </Card>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {gf && (
            <Card title="Group flight" pad={16}>
              <div
                style={{ fontFamily: HEAD_FONT, fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}
              >
                {gf.title}
              </div>
              <div style={{ fontSize: 12.5, color: VA.muted, marginTop: 4 }}>{gf.subtitle}</div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginTop: 12,
                }}
              >
                <span style={{ fontFamily: HEAD_FONT, fontSize: 26, color: VA.sun }}>
                  {countdown(gf.startsAt, now)}
                </span>
                <span style={{ fontSize: 12, color: VA.muted }}>
                  {gf.booked}/{gf.slots} slots booked
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "rgba(255,255,255,.08)",
                  marginTop: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.round((gf.booked / Math.max(1, gf.slots)) * 100)}%`,
                    height: "100%",
                    background: VA.sun,
                  }}
                />
              </div>
              <button
                type="button"
                className="va-btn"
                style={{ marginTop: 14, width: "100%" }}
                onClick={() => onGo(crew ? "board" : "join")}
              >
                {crew ? "Open the departure board" : "Join to book a slot"}
              </button>
            </Card>
          )}
          <Card title="Coming up">
            {!events.length && (
              <div style={{ color: VA.muted, fontSize: 13 }}>No events scheduled.</div>
            )}
            {events.slice(0, 4).map((e) => {
              const c = CATEGORY[e.category] || { label: e.category || "Event", color: VA.info };
              return (
                <div key={e.id} style={{ padding: "9px 0", borderTop: `1px solid ${VA.line}` }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      fontSize: 11,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                    }}
                  >
                    <span style={{ color: c.color }}>{c.label}</span>
                    <span style={{ color: VA.muted }}>in {countdown(e.startsAt, now)}</span>
                  </div>
                  <div style={{ fontSize: 14, marginTop: 3, color: VA.text }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: VA.faint }}>
                    {new Date(e.startsAt).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      timeZone: "Europe/Berlin",
                    })}{" "}
                    · {cetTime(e.startsAt)} CEST
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
      {hub.airline.disclaimer && (
        <div
          style={{ fontSize: 11.5, color: VA.faint, textAlign: "center", padding: "2px 20px 8px" }}
        >
          {hub.airline.disclaimer}
        </div>
      )}
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: "none",
  border: 0,
  color: VA.sun,
  cursor: "pointer",
  fontSize: 12.5,
  padding: 0,
};
const nameBtn: React.CSSProperties = {
  background: "none",
  border: 0,
  padding: 0,
  color: VA.ice,
  cursor: "pointer",
  fontSize: 13,
};

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderTop: `1px solid ${VA.line}`,
      }}
    >
      {children}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  live,
  color,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  live?: boolean;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: "13px 16px",
        borderRadius: 12,
        background: VA.card,
        border: `1px solid ${VA.line}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: VA.muted,
        }}
      >
        {live && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              background: VA.ok,
              boxShadow: `0 0 8px ${VA.ok}`,
              animation: "vaPulse 2s infinite",
            }}
          />
        )}
        {label}
      </div>
      <div
        style={{
          fontFamily: HEAD_FONT,
          fontSize: 32,
          fontWeight: 800,
          color: color || VA.text,
          lineHeight: 1.1,
        }}
      >
        {value}{" "}
        {sub && <span style={{ fontSize: 14, color: VA.faint, fontWeight: 600 }}>{sub}</span>}
      </div>
    </div>
  );
}
