"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  VA,
  HEAD_FONT,
  Epaulette,
  Locked,
  SampleBanner,
  cetTime,
  countdown,
  rankOf,
  useNow,
  vaFetch,
  type Airline,
  type Airport,
  type Fleet,
  type Rank,
} from "./vaShared";

/**
 * The group flight, as an airport departure display.
 *
 * Shaped on vAMSYS Slotted Events (waves, a fixed callsign per slot, a
 * departure time per slot), because the airline already books those there.
 * What the hub adds is the shared picture: who is flying which departure, a
 * board to watch fill up, one click to take an open slot. In stage two the
 * slots and bookings come from vAMSYS; the board does not change.
 */

type Holder = {
  kind: "sample" | "member";
  name: string;
  pilotId: string | null;
  rankKey: string | null;
  mine: boolean;
} | null;
type Slot = {
  key: string;
  std: string;
  callsign: string;
  flightNumber: string;
  dep: string;
  arr: string;
  fleet: Fleet;
  reg: string;
  gate: string;
  holder: Holder;
};
type Wave = { key: string; name: string; base: string; note: string; slots: Slot[] };
type Flight = {
  key: string;
  title: string;
  subtitle: string;
  briefing: string;
  startsAt: string;
  waves: Wave[];
  open: boolean;
  totals: { slots: number; booked: number };
  mySlot: string | null;
};

const ERRORS: Record<string, string> = {
  slot_taken: "Someone got that slot first. Pick another.",
  already_booked: "You already have a slot on this bank. Release it to move.",
  booking_closed: "Booking has closed. The bank is under way.",
  slow_down: "One moment, the board is updating.",
  crew_only: "Booking is for verified crew.",
};

const FLEET_SHORT: Record<Fleet, string> = {
  "A320-200": "A320",
  "A330-200": "A332",
  "A330-300": "A333",
};

export default function VaDepartureBoard({
  lobbyId,
  flightKey,
  airports,
  ranks,
  airline,
  canBook,
  signedIn,
}: {
  lobbyId: string;
  flightKey: string;
  airports: Airport[];
  ranks: Rank[];
  airline: Airline | null;
  canBook: boolean;
  signedIn: boolean;
}) {
  const [flight, setFlight] = useState<Flight | null>(null);
  const [status, setStatus] = useState(0);
  const [base, setBase] = useState<"ALL" | "FRA" | "MUC">("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [flipKey, setFlipKey] = useState(0);
  const now = useNow(30_000);
  const city = useMemo(() => new Map(airports.map((a) => [a.iata, a.city])), [airports]);

  const load = useCallback(async () => {
    const r = await vaFetch<{ flight: Flight }>(
      `/va/${encodeURIComponent(lobbyId)}/groupflights/${encodeURIComponent(flightKey)}`,
    );
    setStatus(r.status);
    if (r.status === 200 && r.data) setFlight(r.data.flight);
  }, [lobbyId, flightKey]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4200);
    return () => clearTimeout(t);
  }, [msg]);

  async function act(path: string, label: string) {
    setBusy(label);
    const r = await vaFetch<{ flight: Flight; error?: string }>(path, { method: "POST" });
    setBusy(null);
    if (r.status === 200 && r.data?.flight) {
      setFlight(r.data.flight);
      return true;
    }
    setMsg({
      tone: "bad",
      text: ERRORS[(r.data as any)?.error] || "That did not go through. Try again.",
    });
    load();
    return false;
  }

  const book = async (s: Slot) => {
    if (
      await act(
        `/va/${encodeURIComponent(lobbyId)}/groupflights/${encodeURIComponent(flightKey)}/slots/${encodeURIComponent(s.key)}/claim`,
        s.key,
      )
    )
      setMsg({
        tone: "ok",
        text: `Booked: ${s.callsign} to ${city.get(s.arr) || s.arr}, gate ${s.gate}, off-block ${cetTime(s.std)} CEST.`,
      });
  };
  const release = async () => {
    if (
      await act(
        `/va/${encodeURIComponent(lobbyId)}/groupflights/${encodeURIComponent(flightKey)}/release`,
        "release",
      )
    )
      setMsg({ tone: "ok", text: "Slot released. It is back on the board." });
  };

  if (status === 401 || status === 403)
    return <Locked need="crew" signedIn={signedIn} airline={airline} />;
  if (!flight)
    return <div style={{ padding: 40, color: VA.muted }}>Loading the departure board…</div>;

  const mine = flight.waves.flatMap((w) => w.slots).find((s) => s.holder?.mine) || null;
  const waves = flight.waves.filter((w) => base === "ALL" || w.base === base);
  const pct = flight.totals.slots ? flight.totals.booked / flight.totals.slots : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{BOARD_CSS}</style>
      <SampleBanner text="Demo event. Sample pilots hold some slots; the open ones are real and bookable. In production, slots and bookings sync with vAMSYS Slotted Events." />

      {/* Header */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 16,
          border: `1px solid ${VA.line}`,
          background: `linear-gradient(100deg, rgba(0,12,29,.96) 30%, rgba(0,12,29,.55)), url(/brand/vocn/rooms/dispatch-banner.webp) center/cover`,
          padding: "20px 22px",
        }}
      >
        <div
          style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: VA.sun }}
        >
          Group flight · Slotted event
        </div>
        <h2
          style={{
            margin: "6px 0 2px",
            fontFamily: HEAD_FONT,
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: ".02em",
            color: VA.text,
          }}
        >
          {flight.title}
        </h2>
        <div style={{ color: VA.ice, fontSize: 14 }}>{flight.subtitle}</div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 28,
            marginTop: 16,
            alignItems: "flex-end",
          }}
        >
          <Metric
            label="First wave"
            value={`${new Date(flight.startsAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Berlin" })} · ${cetTime(flight.startsAt)} CEST`}
          />
          <Metric
            label={flight.open ? "Pushback in" : "Status"}
            value={flight.open ? countdown(flight.startsAt, now) : "Under way"}
            accent
          />
          <div style={{ minWidth: 220, flex: 1, maxWidth: 360 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: VA.muted,
              }}
            >
              {flight.totals.booked} of {flight.totals.slots} slots booked
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: "rgba(255,255,255,.08)",
                marginTop: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round(pct * 100)}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${VA.sun}, #ffe680)`,
                  transition: "width .6s",
                }}
              />
            </div>
          </div>
        </div>
        <p
          style={{
            margin: "14px 0 0",
            maxWidth: 780,
            color: VA.ice,
            fontSize: 13.5,
            lineHeight: 1.55,
          }}
        >
          {flight.briefing}
        </p>
      </div>

      {/* Your booking */}
      {mine && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 16,
            padding: "14px 18px",
            borderRadius: 14,
            background: `linear-gradient(90deg, ${VA.sun}26, ${VA.sun}08)`,
            border: `1px solid ${VA.sun}88`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: VA.sun,
            }}
          >
            Your slot
          </div>
          <div
            style={{ fontFamily: HEAD_FONT, fontSize: 24, color: VA.text, letterSpacing: ".04em" }}
          >
            {mine.callsign} · {mine.dep} → {mine.arr}
          </div>
          <div style={{ color: VA.ice, fontSize: 13 }}>
            {city.get(mine.arr)} · {mine.fleet} · Gate {mine.gate} · Off-block {cetTime(mine.std)}{" "}
            CEST
          </div>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="va-btn ghost"
            onClick={() => downloadIcs(mine, flight, city)}
          >
            Add to calendar
          </button>
          {flight.open && (
            <button type="button" className="va-btn ghost" disabled={!!busy} onClick={release}>
              {busy === "release" ? "Releasing…" : "Release slot"}
            </button>
          )}
        </div>
      )}

      {/* Base filter */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {(["ALL", "FRA", "MUC"] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => {
              setBase(b);
              setFlipKey((k) => k + 1);
            }}
            className={`va-seg${base === b ? " on" : ""}`}
          >
            {b === "ALL" ? "Both bases" : b === "FRA" ? "Frankfurt" : "Munich"}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {!canBook && (
          <span style={{ fontSize: 12, color: VA.muted }}>Booking opens to verified crew.</span>
        )}
      </div>

      {/* The board */}
      <div key={flipKey} className="va-board">
        {waves.map((w, wi) => (
          <div key={w.key} className="va-wave">
            <div className="va-wave-head">
              <span className="va-wave-base">{w.base}</span>
              <span className="va-wave-name">{w.name}</span>
              <span className="va-wave-note">{w.note}</span>
              <span className="va-wave-count">
                {w.slots.filter((s) => s.holder).length}/{w.slots.length}
              </span>
            </div>
            <div className="va-row va-row-head">
              <span>STD</span>
              <span>Flight</span>
              <span>Destination</span>
              <span>A/C</span>
              <span>Gate</span>
              <span>Crew</span>
              <span />
            </div>
            {w.slots.map((s, si) => {
              const delay = (wi * 6 + si) * 45;
              const rank = rankOf(ranks, s.holder?.rankKey);
              return (
                <div key={s.key} className={`va-row${s.holder?.mine ? " mine" : ""}`}>
                  <Flap text={cetTime(s.std)} delay={delay} />
                  <Flap text={s.callsign} delay={delay + 30} />
                  <Flap
                    text={`${(city.get(s.arr) || s.arr).toUpperCase()}`}
                    delay={delay + 60}
                    sub={s.arr}
                  />
                  <Flap text={FLEET_SHORT[s.fleet]} delay={delay + 90} />
                  <Flap text={s.gate} delay={delay + 120} />
                  <span className="va-crew">
                    {s.holder ? (
                      <>
                        {rank && <Epaulette rank={rank} height={13} />}
                        <span style={{ color: s.holder.mine ? VA.sun : VA.ice }}>
                          {s.holder.mine ? "You" : s.holder.name}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: "#4d6680" }}>Open</span>
                    )}
                  </span>
                  <span style={{ textAlign: "right" }}>
                    {!s.holder && canBook && flight.open && !mine ? (
                      <button
                        type="button"
                        className="va-btn"
                        disabled={!!busy}
                        onClick={() => book(s)}
                      >
                        {busy === s.key ? "Booking…" : "Book"}
                      </button>
                    ) : s.holder?.mine ? (
                      <span className="va-tag">Booked</span>
                    ) : s.holder ? (
                      <span className="va-tag dim">Taken</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {msg && (
        <div
          role="status"
          style={{
            position: "sticky",
            bottom: 12,
            alignSelf: "center",
            padding: "10px 16px",
            borderRadius: 10,
            background: msg.tone === "ok" ? "#0b2a1d" : "#2d0f12",
            border: `1px solid ${msg.tone === "ok" ? VA.ok : VA.bad}88`,
            color: VA.text,
            fontSize: 13,
            boxShadow: "0 10px 30px rgba(0,0,0,.45)",
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
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
          fontSize: 22,
          fontWeight: 700,
          color: accent ? VA.sun : VA.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** One display cell. Flips in on mount; the board remounts on a base change. */
function Flap({ text, delay, sub }: { text: string; delay: number; sub?: string }) {
  return (
    <span className="va-flap" style={{ animationDelay: `${delay}ms` }}>
      {text}
      {sub ? <em>{sub}</em> : null}
    </span>
  );
}

function downloadIcs(s: Slot, f: Flight, city: Map<string, string>) {
  const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(Date.parse(s.std) + 4 * 3_600_000).toISOString();
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Weered//vOCN Crew Hub//EN",
    "BEGIN:VEVENT",
    `UID:${s.key}-${f.key}@weered.ca`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(s.std)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${s.callsign} ${s.dep}-${s.arr} · ${f.title}`,
    `DESCRIPTION:${s.fleet}\\, gate ${s.gate}\\, to ${city.get(s.arr) || s.arr}. Dispatch and file through vAMSYS.`,
    "BEGIN:VALARM",
    "TRIGGER:-PT60M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Dispatch opens",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${s.callsign}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const BOARD_CSS = `
.va-board { display:flex; flex-direction:column; gap:14px; }
.va-wave { background:#02070f; border:1px solid #1b2a3c; border-radius:14px; overflow:hidden; box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 10px 30px rgba(0,0,0,.35); }
.va-wave-head { display:flex; align-items:baseline; gap:12px; padding:12px 16px; background:linear-gradient(180deg,#0a1a30,#06101f); border-bottom:1px solid #1b2a3c; flex-wrap:wrap; }
.va-wave-base { font:800 13px/1 ${HEAD_FONT}; letter-spacing:.14em; color:${VA.navy}; background:${VA.sun}; padding:4px 7px; border-radius:4px; }
.va-wave-name { font:700 20px/1 ${HEAD_FONT}; letter-spacing:.08em; text-transform:uppercase; color:#fff; }
.va-wave-note { font-size:12.5px; color:${VA.muted}; flex:1; min-width:180px; }
.va-wave-count { font:700 15px/1 ${HEAD_FONT}; color:${VA.sun}; letter-spacing:.08em; }
.va-row { display:grid; grid-template-columns: 64px 96px minmax(150px,1.4fr) 58px 58px minmax(150px,1.2fr) 92px; gap:8px; align-items:center; padding:7px 16px; border-bottom:1px solid #0e1b2b; }
.va-row:last-child { border-bottom:0; }
.va-row.mine { background:linear-gradient(90deg, rgba(255,205,0,.13), transparent 70%); }
.va-row-head { padding-top:8px; padding-bottom:6px; font:600 11px/1 ${HEAD_FONT}; letter-spacing:.16em; text-transform:uppercase; color:#50698a; }
.va-flap { position:relative; display:inline-flex; align-items:baseline; gap:6px; font:700 19px/1.15 ${HEAD_FONT}; letter-spacing:.07em; color:#ffd84d; text-transform:uppercase; padding:3px 6px; border-radius:3px; background:linear-gradient(180deg,#141d29 0 49%, #0d141e 51% 100%); box-shadow: inset 0 0 0 1px #1d2a3a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; transform-origin:50% 50%; animation: vaFlip .5s cubic-bezier(.3,.7,.3,1) both; }
.va-flap::after { content:""; position:absolute; left:0; right:0; top:50%; height:1px; background:rgba(0,0,0,.65); }
.va-flap em { font-style:normal; font-size:12px; color:#8a7a3a; letter-spacing:.1em; }
@keyframes vaFlip { 0% { transform:perspective(300px) rotateX(-92deg); opacity:.2; } 60% { transform:perspective(300px) rotateX(12deg); opacity:1; } 100% { transform:perspective(300px) rotateX(0); } }
.va-crew { display:flex; align-items:center; gap:8px; font-size:13.5px; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.va-btn { font:800 13px/1 ${HEAD_FONT}; letter-spacing:.14em; text-transform:uppercase; color:${VA.navy}; background:${VA.sun}; border:0; border-radius:6px; padding:8px 14px; cursor:pointer; box-shadow:0 0 0 0 rgba(255,205,0,.5); transition: transform .12s, box-shadow .2s; }
.va-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 0 18px rgba(255,205,0,.55); }
.va-btn:disabled { opacity:.55; cursor:default; }
.va-btn.ghost { background:transparent; color:${VA.sun}; border:1px solid ${VA.sun}88; }
.va-tag { font:700 12px/1 ${HEAD_FONT}; letter-spacing:.14em; text-transform:uppercase; color:${VA.sun}; }
.va-tag.dim { color:#3d5470; }
.va-seg { font:700 14px/1 ${HEAD_FONT}; letter-spacing:.1em; text-transform:uppercase; padding:8px 14px; border-radius:8px; border:1px solid ${VA.line}; background:transparent; color:${VA.ice}; cursor:pointer; }
.va-seg.on { background:${VA.sun}; color:${VA.navy}; border-color:${VA.sun}; }
@media (max-width: 860px) {
  .va-row { grid-template-columns: 54px 84px 1fr 72px; }
  .va-row > :nth-child(4), .va-row > :nth-child(5), .va-row > :nth-child(6) { display:none; }
}
`;
