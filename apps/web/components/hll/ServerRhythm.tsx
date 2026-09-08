"use client";
// What a server NORMALLY does at this hour, next to what it is doing now.
//
// A live browser says "19/100". That is a fact and not an answer. The question
// a unit actually has before committing an evening is "is 19 bad?" — and 19 is
// excellent at 06:00 on a Tuesday and dire at 20:00 on a Saturday. This is the
// component that answers it.
//
// The history is ours, polled from the same public Steam list every tracker
// reads. Nobody has privileged access to it; the only thing that was ever for
// sale is the polling, so we poll.
import React from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type Bucket = { dow: number; hour: number; avg: number; peak: number; n: number };
type Rhythm = {
  ok: boolean;
  server: { id: string; name: string; players: number; maxPlayers: number; online: boolean };
  buckets: Bucket[];
  now: {
    players: number;
    typical: number | null;
    peakSeen: number | null;
    samples: number;
    confident: boolean;
    delta: number | null;
  };
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ServerRhythm({
  serverId,
  accent = "#6f8f3f",
  livePlayers,
}: {
  serverId: string;
  accent?: string;
  /** The card's own live count. The aggregate polls every 10 minutes, so its
   *  snapshot can trail the browser's 60s one — and a card showing 95/100 in
   *  the header and 87 in the panel just below it reads as broken. The live
   *  number wins for "now"; the aggregate is only ever used for "normally". */
  livePlayers?: number;
}) {
  const [d, setD] = React.useState<Rhythm | null>(null);
  const [err, setErr] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setD(null);
    setErr(false);
    fetch(`${API}/gs/servers/${encodeURIComponent(serverId)}/rhythm`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => alive && (j?.ok ? setD(j) : setErr(true)))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [serverId]);

  if (err) return <Note>No history for this server yet.</Note>;
  if (!d) return <Note>Reading the history…</Note>;

  const players = livePlayers ?? d.now.players;
  const today = new Date().getUTCDay();
  const nowHour = new Date().getUTCHours();
  const todays = d.buckets.filter((b) => b.dow === today);
  const max = Math.max(d.server.maxPlayers || 100, ...todays.map((b) => b.peak), 1);

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 8,
        background: "rgba(0,0,0,.22)",
        border: "1px solid rgba(255,255,255,.07)",
      }}
    >
      {d.now.confident ? (
        <Verdict now={d.now} players={players} accent={accent} />
      ) : (
        // The honest state, and the common one in the first fortnight. Saying
        // "not yet" is better than averaging two samples and calling it normal.
        <div style={{ fontSize: 12, color: "rgba(226,232,240,.72)", lineHeight: 1.5 }}>
          <strong style={{ color: "rgba(236,242,250,.95)" }}>
            {players}/{d.server.maxPlayers}
          </strong>{" "}
          right now. Still building this server&rsquo;s pattern &mdash;{" "}
          {d.now.samples === 0 ? "no" : d.now.samples} reading
          {d.now.samples === 1 ? "" : "s"} for this hour so far. A weekday-by-hour picture settles
          after a couple of weeks of watching.
        </div>
      )}

      {todays.length > 0 && (
        <>
          <div
            style={{
              marginTop: 10,
              marginBottom: 4,
              fontSize: 10,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "rgba(148,163,184,.75)",
            }}
          >
            A typical {DOW[today]} (UTC)
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 46 }}>
            {Array.from({ length: 24 }, (_, h) => {
              const b = todays.find((x) => x.hour === h);
              const v = b ? b.avg : 0;
              const isNow = h === nowHour;
              return (
                <div
                  key={h}
                  title={
                    b
                      ? `${String(h).padStart(2, "0")}:00 UTC — avg ${b.avg}, peak ${b.peak} (${b.n} readings)`
                      : `${String(h).padStart(2, "0")}:00 UTC — no readings yet`
                  }
                  style={{
                    flex: 1,
                    height: `${Math.max(2, (v / max) * 100)}%`,
                    minHeight: 2,
                    borderRadius: 2,
                    background: isNow
                      ? accent
                      : b
                        ? "rgba(148,163,184,.4)"
                        : "rgba(148,163,184,.12)",
                    outline: isNow ? `1px solid ${accent}` : "none",
                  }}
                />
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 9,
              color: "rgba(148,163,184,.55)",
              marginTop: 3,
            }}
          >
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </>
      )}
    </div>
  );
}

function Verdict({
  now,
  players,
  accent,
}: {
  now: Rhythm["now"];
  players: number;
  accent: string;
}) {
  // Recomputed against the live count rather than trusting the server's delta,
  // which was calculated from the aggregate's older snapshot.
  const d = now.typical == null ? 0 : players - now.typical;
  const hot = d > 4;
  const cold = d < -4;
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "rgba(226,232,240,.85)" }}>
      <strong style={{ fontSize: 15, color: "rgba(236,242,250,.98)" }}>{players}</strong> on now,
      and it is normally <strong style={{ color: "rgba(236,242,250,.95)" }}>{now.typical}</strong>{" "}
      at this hour.
      <div
        style={{
          marginTop: 4,
          fontWeight: 700,
          color: hot ? accent : cold ? "#e8a08c" : "rgba(148,163,184,.85)",
        }}
      >
        {hot
          ? `Busier than usual (+${d}). Good night to join.`
          : cold
            ? `Quieter than usual (${d}). A seed would be doing real work.`
            : "About par for this hour."}
        <span style={{ fontWeight: 400, opacity: 0.6 }}>
          {" "}
          Peak seen at this hour: {now.peakSeen}.
        </span>
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10, fontSize: 12, color: "rgba(148,163,184,.7)" }}>{children}</div>
  );
}
