"use client";
// start.gg card: the lobby's next tournament, live state, and recent results.
// Renders nothing until a lobby admin points the lobby at a start.gg reference
// (Admin → Modules → start.gg). Data comes from our API, never from start.gg
// directly; polls every 60 s while a tournament is live, every 5 min otherwise.
import React, { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type Ev = {
  id: string;
  name: string;
  state: string;
  numEntrants: number;
  game: string | null;
  top?: { place: number; name: string }[];
};
type T = {
  id: string;
  name: string;
  url: string | null;
  startAt: number | null;
  endAt: number | null;
  state: string;
  live: boolean;
  numAttendees: number;
  isOnline: boolean;
  isRegistrationOpen: boolean;
  registrationClosesAt: number | null;
  where: string | null;
  image: string | null;
  events: Ev[];
  streams: { name: string; url: string | null }[];
  onStream: {
    stream: string;
    url: string | null;
    round: string;
    event: string;
    state: string;
    players: string[];
  }[];
};
type Payload = {
  ok: boolean;
  configured: boolean;
  missing?: boolean;
  stale?: boolean;
  error?: string | null;
  ref?: string;
  source?: {
    kind: string;
    name: string;
    url: string;
    image: string | null;
    location: string | null;
  };
  upcoming?: T[];
  recent?: T[];
  live?: boolean;
  fetchedAt?: number;
};

const fmtWhen = (ms: number | null) =>
  ms === null
    ? ""
    : new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(ms));
const fmtDay = (ms: number | null) =>
  ms === null
    ? ""
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ms));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function useStartgg(lobbyId: string) {
  const [data, setData] = useState<Payload | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: any = null;
    const load = async () => {
      try {
        const r = await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/startgg`, {
          cache: "no-store",
        });
        const j = (await r.json()) as Payload;
        if (!alive) return;
        setData(j);
        timer = setTimeout(load, j?.live ? 60_000 : 300_000);
      } catch {
        if (alive) timer = setTimeout(load, 120_000);
      }
    };
    void load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [lobbyId]);
  return data;
}

export default function StartggCard({
  lobbyId,
  accent = "#7c3aed",
  style,
}: {
  lobbyId: string;
  accent?: string;
  style?: React.CSSProperties;
}) {
  const data = useStartgg(lobbyId);
  const [showReg, setShowReg] = useState(false);
  const [showResults, setShowResults] = useState(false);
  if (!data || !data.configured) return null;

  const src = data.source;
  const next = data.upcoming?.[0] || null;
  const others = (data.upcoming || []).slice(1);
  const recent = data.recent || [];
  const muted = "rgba(148,163,184,.75)";
  const line = "1px solid rgba(255,255,255,.07)";

  const card: React.CSSProperties = {
    border: line,
    borderRadius: 12,
    background: "rgba(255,255,255,.03)",
    padding: "12px 14px",
    marginBottom: 12,
    ...style,
  };
  const pill = (bg: string, color: string): React.CSSProperties => ({
    display: "inline-block",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    padding: "2px 7px",
    borderRadius: 999,
    background: bg,
    color,
  });
  const btn: React.CSSProperties = {
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    textDecoration: "none",
    background: accent,
    color: "#fff",
    border: "none",
    cursor: "pointer",
  };
  const ghost: React.CSSProperties = {
    ...btn,
    background: "rgba(255,255,255,.06)",
    color: "rgba(243,244,246,.9)",
  };

  return (
    <div className="weered-startgg" style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1.2,
            color: muted,
            textTransform: "uppercase",
          }}
        >
          Tournaments
        </span>
        {src && (
          <a
            href={src.url}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12, color: "rgba(243,244,246,.85)", textDecoration: "none" }}
          >
            {src.name} <span style={{ color: muted }}>· start.gg</span>
          </a>
        )}
        {data.live && <span style={pill("rgba(239,68,68,.18)", "#fca5a5")}>● Live</span>}
        {data.stale && (
          <span style={pill("rgba(234,179,8,.15)", "#fde68a")} title={data.error || ""}>
            cached
          </span>
        )}
      </div>

      {data.missing && (
        <div style={{ fontSize: 12, color: muted }}>
          start.gg has nothing at {data.ref}. An admin can fix it under Modules.
        </div>
      )}

      {!next && !data.missing && (
        <div style={{ fontSize: 12, color: muted }}>
          Nothing scheduled right now{src?.kind === "organizer" ? ` for ${src.name}` : ""}.
          {recent.length > 0 && (
            <>
              {" "}
              Last event: <b style={{ color: "rgba(243,244,246,.85)" }}>{recent[0].name}</b>,{" "}
              {fmtDay(recent[0].startAt)}.
            </>
          )}
        </div>
      )}

      {next && (
        <div style={{ display: "flex", gap: 12 }}>
          {next.image && (
            <img
              src={next.image}
              alt=""
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
            />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <a
                href={next.url || "#"}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: "rgba(243,244,246,.95)",
                  textDecoration: "none",
                }}
              >
                {next.name}
              </a>
              {next.live && <span style={pill("rgba(239,68,68,.18)", "#fca5a5")}>Live now</span>}
              {!next.live && next.isRegistrationOpen && (
                <span style={pill("rgba(16,185,129,.15)", "#6ee7b7")}>Registration open</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: muted, marginTop: 3 }}>
              {fmtWhen(next.startAt)}
              {next.where ? ` · ${next.where}` : ""}
              {next.numAttendees ? ` · ${plural(next.numAttendees, "attendee")}` : ""}
            </div>

            {next.events.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {next.events.slice(0, 8).map((e) => (
                  <span
                    key={e.id}
                    title={e.game || ""}
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,.06)",
                      color: "rgba(243,244,246,.85)",
                    }}
                  >
                    {e.name}
                    {e.numEntrants ? <span style={{ color: muted }}> {e.numEntrants}</span> : null}
                    {next.live && e.state === "ACTIVE" && (
                      <span style={{ color: "#fca5a5" }}> ●</span>
                    )}
                  </span>
                ))}
                {next.events.length > 8 && (
                  <span style={{ fontSize: 11, color: muted, alignSelf: "center" }}>
                    +{next.events.length - 8} more
                  </span>
                )}
              </div>
            )}

            {next.live && next.onStream.length > 0 && (
              <div style={{ marginTop: 10, borderTop: line, paddingTop: 8 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 1,
                    color: muted,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  On stream
                </div>
                {next.onStream.slice(0, 4).map((s, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 12,
                      color: "rgba(243,244,246,.9)",
                      display: "flex",
                      gap: 8,
                      alignItems: "baseline",
                    }}
                  >
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#c4b5fd", textDecoration: "none" }}
                      >
                        {s.stream}
                      </a>
                    ) : (
                      <span>{s.stream}</span>
                    )}
                    <span style={{ color: muted }}>
                      {s.event}
                      {s.round ? ` · ${s.round}` : ""}
                    </span>
                    <span>{s.players.join(" vs ")}</span>
                  </div>
                ))}
              </div>
            )}
            {next.live && next.onStream.length === 0 && next.streams.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: muted }}>
                Streams:{" "}
                {next.streams.slice(0, 4).map((s, i) => (
                  <React.Fragment key={s.name}>
                    {i > 0 && ", "}
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#c4b5fd", textDecoration: "none" }}
                      >
                        {s.name}
                      </a>
                    ) : (
                      s.name
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {next.isRegistrationOpen && next.url && (
                <>
                  <a href={`${next.url}/register`} target="_blank" rel="noreferrer" style={btn}>
                    Register on start.gg
                  </a>
                  <button type="button" style={ghost} onClick={() => setShowReg((v) => !v)}>
                    {showReg ? "Hide form" : "Register here"}
                  </button>
                </>
              )}
              {next.url && (!next.isRegistrationOpen || next.live) && (
                <a href={next.url} target="_blank" rel="noreferrer" style={ghost}>
                  {next.live ? "Brackets & schedule" : "Details"}
                </a>
              )}
            </div>
            {showReg && next.url && (
              <div style={{ marginTop: 10, borderRadius: 8, overflow: "hidden", border: line }}>
                <iframe
                  title="start.gg registration"
                  src={`${next.url}/register/embed`}
                  style={{ width: "100%", height: 600, border: 0, background: "#fff" }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div style={{ marginTop: 10, borderTop: line, paddingTop: 8 }}>
          {others.map((t) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                gap: 10,
                fontSize: 12,
                padding: "2px 0",
                alignItems: "baseline",
              }}
            >
              <span style={{ color: muted, minWidth: 52 }}>{fmtDay(t.startAt)}</span>
              <a
                href={t.url || "#"}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "rgba(243,244,246,.9)",
                  textDecoration: "none",
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.name}
              </a>
              {t.numAttendees ? <span style={{ color: muted }}>{t.numAttendees}</span> : null}
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (next || others.length > 0) && (
        <div style={{ marginTop: 10, borderTop: line, paddingTop: 8 }}>
          <button
            type="button"
            onClick={() => setShowResults((v) => !v)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
              color: muted,
            }}
          >
            {showResults ? "▾" : "▸"} Recent results · {recent[0].name}
          </button>
          {showResults &&
            recent.slice(0, 2).map((t) => (
              <div key={t.id} style={{ marginTop: 6 }}>
                {recent.length > 1 && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(243,244,246,.85)" }}>
                    {t.name}{" "}
                    <span style={{ color: muted, fontWeight: 400 }}>{fmtDay(t.startAt)}</span>
                  </div>
                )}
                {t.events
                  .filter((e) => e.top && e.top.length)
                  .slice(0, 6)
                  .map((e) => (
                    <div
                      key={e.id}
                      style={{
                        fontSize: 12,
                        display: "flex",
                        gap: 8,
                        padding: "2px 0",
                        alignItems: "baseline",
                      }}
                    >
                      <span
                        style={{
                          color: muted,
                          minWidth: 120,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {e.name}
                      </span>
                      <span style={{ color: "rgba(243,244,246,.9)" }}>
                        {e.top!.map((p) => `${p.place}. ${p.name}`).join("  ")}
                      </span>
                    </div>
                  ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
