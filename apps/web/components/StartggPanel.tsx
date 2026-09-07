"use client";
// start.gg — the lobby's full bracket section (tier 2).
//
// The feed card (StartggCard) answers "what is next"; this answers "what is the
// whole picture": every upcoming tournament, each event with its entrant count
// and start time, the live stream queue, and recent results with the top three.
// It reuses StartggCard's polling hook and the same endpoint, so following a
// reference costs one request whichever surface is open.
//
// This one renders an explicit empty state rather than nothing, because it has
// its own entry in the rail: a member who clicks Brackets and gets a blank pane
// concludes the product is broken, not that the TO has linked nothing yet.
import React from "react";
import { useStartgg } from "./StartggCard";

const when = (ms: number | null) =>
  ms === null
    ? ""
    : new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(ms));

const CARD: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 10,
  border: "1px solid var(--weered-border, rgba(148,163,184,.18))",
  background: "var(--weered-panel, rgba(255,255,255,.03))",
  marginBottom: 14,
};

const TH: React.CSSProperties = {
  textAlign: "left",
  fontSize: 10,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  opacity: 0.55,
  padding: "6px 8px",
  borderBottom: "1px solid var(--weered-border, rgba(148,163,184,.18))",
};

function Empty({ text }: { text: string }) {
  return (
    <div style={{ ...CARD, textAlign: "center", opacity: 0.65, fontSize: 12, lineHeight: 1.6 }}>
      {text}
    </div>
  );
}

function Title({ t }: { t: any }) {
  return (
    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>
      {t.url ? (
        <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>
          {t.name}
        </a>
      ) : (
        t.name
      )}
    </h3>
  );
}

function Upcoming({ t, accent }: { t: any; accent: string }) {
  return (
    <section style={CARD}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <Title t={t} />
        {t.live && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: ".08em",
              padding: "2px 6px",
              borderRadius: 4,
              background: "#22c55e",
              color: "#0b0b0b",
            }}
          >
            LIVE
          </span>
        )}
        <span style={{ fontSize: 11, opacity: 0.6 }}>
          {when(t.startAt)}
          {t.where ? " · " + t.where : ""}
          {t.numAttendees ? " · " + t.numAttendees + " entrants" : ""}
        </span>
      </header>

      {t.isRegistrationOpen && (
        <div style={{ marginTop: 6, fontSize: 11, color: accent }}>
          Registration open
          {t.registrationClosesAt ? " · closes " + when(t.registrationClosesAt) : ""}
        </div>
      )}

      {t.events?.length > 0 && (
        // Wide event tables scroll inside their own box; the panel never scrolls sideways.
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Event", "Game", "Entrants", "Starts"].map((h) => (
                  <th key={h} style={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.events.map((e: any) => (
                <tr key={e.id}>
                  <td style={{ padding: "6px 8px" }}>{e.name}</td>
                  <td style={{ padding: "6px 8px", opacity: 0.75 }}>{e.game || "—"}</td>
                  <td style={{ padding: "6px 8px", fontVariantNumeric: "tabular-nums" }}>
                    {e.numEntrants || "—"}
                  </td>
                  <td style={{ padding: "6px 8px", opacity: 0.75 }}>{when(e.startAt) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {t.onStream?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: ".08em", opacity: 0.55, marginBottom: 6 }}>
            ON STREAM
          </div>
          {t.onStream.slice(0, 6).map((s: any, i: number) => (
            <div key={i} style={{ fontSize: 12, padding: "3px 0", opacity: 0.9 }}>
              {s.players.join(" vs ") || "TBD"}
              <span style={{ opacity: 0.6 }}>
                {" — " + s.round}
                {s.event ? " · " + s.event : ""}
              </span>
              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginLeft: 8, color: accent }}
                >
                  watch
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Result({ t }: { t: any }) {
  return (
    <section style={CARD}>
      <Title t={t} />
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{when(t.startAt)}</div>
      {t.events?.map((e: any) =>
        e.top?.length ? (
          <div key={e.id} style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{e.name}</div>
            {e.top.map((p: any) => (
              <div key={p.place} style={{ fontSize: 12, padding: "2px 0" }}>
                <span style={{ opacity: 0.6, marginRight: 8 }}>{p.place}.</span>
                {p.name}
              </div>
            ))}
          </div>
        ) : null,
      )}
    </section>
  );
}

export default function StartggPanel({
  lobbyId,
  accent = "#7c3aed",
}: {
  lobbyId: string;
  accent?: string;
}) {
  const data = useStartgg(lobbyId);

  if (!data) return <Empty text="Loading..." />;
  if (!data.configured)
    return (
      <Empty text="No start.gg reference linked yet. A lobby admin can add one under Admin, Modules, start.gg." />
    );
  if (data.missing) return <Empty text="start.gg has nothing at that reference any more." />;
  if (!data.upcoming?.length && !data.recent?.length)
    return <Empty text="Nothing scheduled on start.gg right now." />;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {data.stale && (
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 10 }}>
          Showing the last known data. start.gg is not answering right now.
        </div>
      )}

      {data.upcoming && data.upcoming.length > 0 && (
        <>
          <h2 style={{ fontSize: 12, letterSpacing: ".1em", opacity: 0.6, margin: "0 0 10px" }}>
            UPCOMING
          </h2>
          {data.upcoming.map((t: any) => (
            <Upcoming key={t.id} t={t} accent={accent} />
          ))}
        </>
      )}

      {data.recent && data.recent.length > 0 && (
        <>
          <h2 style={{ fontSize: 12, letterSpacing: ".1em", opacity: 0.6, margin: "8px 0 10px" }}>
            RESULTS
          </h2>
          {data.recent.map((t: any) => (
            <Result key={t.id} t={t} />
          ))}
        </>
      )}
    </div>
  );
}
