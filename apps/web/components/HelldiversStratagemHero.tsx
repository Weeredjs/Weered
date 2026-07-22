"use client";

// Stratagem Hero — the arcade minigame, playable in the lobby. Codes come from
// our own stratagem DB (56 entries with real input sequences). Keyboard arrows
// or WASD on desktop, a tap d-pad on mobile. One best score per user on the
// leaderboard.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const GOLD = "#FFD700";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

type Strat = { name: string; code: string };
type Arrow = "↑" | "↓" | "←" | "→";
const KEY_TO_ARROW: Record<string, Arrow> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  w: "↑",
  s: "↓",
  a: "←",
  d: "→",
  W: "↑",
  S: "↓",
  A: "←",
  D: "→",
};

const ROUND_SIZE = 6;
const ROUND_TIME_BASE = 11; // seconds; + per-strat allowance, shrinking by round
const PER_ARROW = 5;
const STRAT_BONUS = 25;
const TIME_BONUS_PER_SEC = 10;

// Tiny WebAudio juice: blip on hit, buzz on miss, chirp on clear. Guarded —
// audio is allowed to fail silently anywhere.
function useBlips(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback(
    (kind: "hit" | "miss" | "clear") => {
      if (muted) return;
      try {
        if (!ctxRef.current)
          ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const ctx = ctxRef.current;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        const now = ctx.currentTime;
        if (kind === "hit") {
          o.frequency.value = 880;
          g.gain.setValueAtTime(0.05, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
          o.start(now);
          o.stop(now + 0.07);
        } else if (kind === "miss") {
          o.type = "sawtooth";
          o.frequency.value = 110;
          g.gain.setValueAtTime(0.06, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          o.start(now);
          o.stop(now + 0.18);
        } else {
          o.frequency.setValueAtTime(660, now);
          o.frequency.setValueAtTime(880, now + 0.08);
          o.frequency.setValueAtTime(1320, now + 0.16);
          g.gain.setValueAtTime(0.05, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          o.start(now);
          o.stop(now + 0.3);
        }
      } catch {}
    },
    [muted],
  );
}

type Phase = "idle" | "playing" | "over";

export default function HelldiversStratagemHero({
  accent = GOLD,
  currentUserId,
}: {
  accent?: string;
  currentUserId?: string;
}) {
  const [pool, setPool] = useState<Strat[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(1);
  const [queue, setQueue] = useState<Strat[]>([]);
  const [qi, setQi] = useState(0); // which stratagem in the round
  const [pos, setPos] = useState(0); // progress inside the current code
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [roundTime, setRoundTime] = useState(0);
  const [flash, setFlash] = useState<"none" | "miss">("none");
  const [muted, setMuted] = useState(false);
  const [board, setBoard] = useState<any[]>([]);
  const [meRank, setMeRank] = useState<any>(null);
  const [submitted, setSubmitted] = useState<string>("");
  const blip = useBlips(muted);

  // refs mirror hot state for the keydown handler
  const st = useRef({ phase, queue, qi, pos, round, score, timeLeft });
  st.current = { phase, queue, qi, pos, round, score, timeLeft };

  useEffect(() => {
    fetch(`${API}/helldivers/stratagems`)
      .then((r) => r.json())
      .then((j) => {
        const rows = (j?.stratagems || [])
          .map((s: any) => ({ name: String(s.name), code: String(s.code || "") }))
          .filter((s: Strat) => s.code.length >= 3);
        setPool(rows);
      })
      .catch(() => {});
    void loadBoard();
  }, []);

  async function loadBoard() {
    try {
      const r = await fetch(`${API}/helldivers/strat-hero/leaderboard`, {
        headers: authHeaders(),
      });
      const j = await r.json();
      if (j?.ok) {
        setBoard(j.top || []);
        setMeRank(j.me || null);
      }
    } catch {}
  }

  const buildRound = useCallback(
    (r: number): Strat[] => {
      // Later rounds bias toward longer codes.
      const sorted = [...pool].sort(() => Math.random() - 0.5);
      const minLen = r <= 2 ? 3 : r <= 4 ? 4 : 5;
      const eligible = sorted.filter((s) => s.code.length >= minLen);
      const picks = (eligible.length >= ROUND_SIZE ? eligible : sorted).slice(0, ROUND_SIZE);
      return picks;
    },
    [pool],
  );

  const startRound = useCallback(
    (r: number, carryScore: number) => {
      const q = buildRound(r);
      const t = Math.max(6, Math.round(ROUND_TIME_BASE + ROUND_SIZE * 1.6 - r * 0.8));
      setQueue(q);
      setQi(0);
      setPos(0);
      setRound(r);
      setScore(carryScore);
      setTimeLeft(t);
      setRoundTime(t);
      setPhase("playing");
    },
    [buildRound],
  );

  const start = useCallback(() => {
    setSubmitted("");
    startRound(1, 0);
  }, [startRound]);

  // countdown
  useEffect(() => {
    if (phase !== "playing") return;
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setPhase("over");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, round]);

  // submit on game over
  useEffect(() => {
    if (phase !== "over") return;
    const s = st.current.score;
    if (!currentUserId || s <= 0) return;
    (async () => {
      try {
        const r = await fetch(`${API}/helldivers/strat-hero/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ score: s, rounds: st.current.round }),
        });
        const j = await r.json();
        if (j?.ok) {
          setSubmitted(
            j.improved
              ? `New personal best. Rank #${j.rank} on the board.`
              : `Best stands at ${j.best.toLocaleString()}. Rank #${j.rank}.`,
          );
          void loadBoard();
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const input = useCallback(
    (arrow: Arrow) => {
      const s = st.current;
      if (s.phase !== "playing") return;
      const strat = s.queue[s.qi];
      if (!strat) return;
      const expected = strat.code[s.pos] as Arrow | undefined;
      if (arrow === expected) {
        blip("hit");
        const nextPos = s.pos + 1;
        setScore((v) => v + PER_ARROW);
        if (nextPos >= strat.code.length) {
          // stratagem complete
          setScore((v) => v + STRAT_BONUS);
          if (s.qi + 1 >= s.queue.length) {
            // round clear: bank remaining time, next round
            blip("clear");
            setScore((v) => v + s.timeLeft * TIME_BONUS_PER_SEC);
            startRound(
              s.round + 1,
              s.score + PER_ARROW + STRAT_BONUS + s.timeLeft * TIME_BONUS_PER_SEC,
            );
          } else {
            setQi(s.qi + 1);
            setPos(0);
          }
        } else {
          setPos(nextPos);
        }
      } else {
        blip("miss");
        setPos(0);
        setFlash("miss");
        setTimeout(() => setFlash("none"), 180);
      }
    },
    [blip, startRound],
  );

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const arrow = KEY_TO_ARROW[e.key];
      if (!arrow) return;
      if (st.current.phase === "playing") e.preventDefault();
      input(arrow);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [input]);

  const strat = queue[qi];
  const upNext = useMemo(() => queue.slice(qi + 1, qi + 4), [queue, qi]);

  const chip = (a: string, i: number) => {
    const state = i < pos ? "done" : i === pos ? "now" : "todo";
    return (
      <span
        key={i}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: 6,
          fontSize: 20,
          fontWeight: 900,
          border: `2px solid ${state === "done" ? accent : state === "now" ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.16)"}`,
          background: state === "done" ? `${accent}2b` : "rgba(0,0,0,.3)",
          color: state === "done" ? accent : state === "now" ? "#fff" : "rgba(255,255,255,.35)",
          transition: "all .08s",
        }}
      >
        {a}
      </span>
    );
  };

  const dpadBtn = (a: Arrow, label: string) => (
    <button
      onClick={() => input(a)}
      aria-label={label}
      style={{
        width: 54,
        height: 54,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,.2)",
        background: "rgba(255,255,255,.06)",
        color: "rgba(255,255,255,.85)",
        fontSize: 24,
        fontWeight: 900,
        cursor: "pointer",
        touchAction: "manipulation",
      }}
    >
      {a}
    </button>
  );

  return (
    <div style={{ padding: "6px 4px", color: "rgba(236,242,250,.95)" }}>
      <div
        style={{
          border: `1px solid ${flash === "miss" ? "rgba(220,80,70,.8)" : "rgba(255,255,255,.1)"}`,
          borderRadius: 12,
          padding: 16,
          background: "rgba(0,0,0,.25)",
          textAlign: "center",
          transition: "border-color .1s",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".24em",
            color: accent,
            marginBottom: 8,
          }}
        >
          STRATAGEM HERO
        </div>

        {phase === "idle" && (
          <>
            <p
              style={{
                fontSize: 13,
                color: "rgba(148,163,184,.85)",
                margin: "8px auto 14px",
                maxWidth: 420,
              }}
            >
              Punch in stratagem codes before the clock runs out. Arrow keys or WASD. A wrong input
              resets the code. Clear the round, bank the remaining seconds, and the next round comes
              faster.
            </p>
            <button
              onClick={start}
              disabled={pool.length === 0}
              style={{
                padding: "10px 26px",
                borderRadius: 8,
                border: `1px solid ${accent}`,
                background: `${accent}22`,
                color: accent,
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: ".08em",
                cursor: "pointer",
              }}
            >
              {pool.length ? "DEPLOY" : "LOADING CODES…"}
            </button>
          </>
        )}

        {phase === "playing" && strat && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              <span>ROUND {round}</span>
              <span style={{ color: accent }}>{score.toLocaleString()} pts</span>
              <span>
                {qi + 1}/{queue.length}
              </span>
            </div>
            <div
              style={{
                height: 5,
                borderRadius: 3,
                background: "rgba(255,255,255,.1)",
                marginBottom: 14,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(timeLeft / Math.max(1, roundTime)) * 100}%`,
                  height: "100%",
                  background: timeLeft <= 3 ? "rgba(220,80,70,.9)" : accent,
                  transition: "width 1s linear",
                }}
              />
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>{strat.name}</div>
            <div
              style={{
                display: "flex",
                gap: 6,
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              {strat.code.split("").map((c, i) => chip(c, i))}
            </div>
            {upNext.length > 0 && (
              <div style={{ fontSize: 11, color: "rgba(148,163,184,.6)" }}>
                up next: {upNext.map((s) => s.name).join(" · ")}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
              {dpadBtn("←", "left")}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dpadBtn("↑", "up")}
                {dpadBtn("↓", "down")}
              </div>
              {dpadBtn("→", "right")}
            </div>
          </>
        )}

        {phase === "over" && (
          <>
            <div style={{ fontSize: 13, color: "rgba(148,163,184,.8)", marginTop: 6 }}>
              TRANSMISSION ENDED
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, color: accent, margin: "6px 0" }}>
              {score.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: "rgba(148,163,184,.75)", marginBottom: 8 }}>
              {round} round{round === 1 ? "" : "s"} of managed democracy delivered
            </div>
            {submitted && (
              <div style={{ fontSize: 12.5, color: accent, marginBottom: 8 }}>{submitted}</div>
            )}
            {!currentUserId && (
              <div style={{ fontSize: 12, color: "rgba(148,163,184,.7)", marginBottom: 8 }}>
                Sign in and your score enters the lobby leaderboard.
              </div>
            )}
            <button
              onClick={start}
              style={{
                padding: "9px 22px",
                borderRadius: 8,
                border: `1px solid ${accent}`,
                background: `${accent}22`,
                color: accent,
                fontWeight: 800,
                letterSpacing: ".08em",
                cursor: "pointer",
              }}
            >
              REDEPLOY
            </button>
          </>
        )}

        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => setMuted((m) => !m)}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(148,163,184,.55)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {muted ? "sound: off" : "sound: on"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: ".2em",
            color: "rgba(148,163,184,.7)",
            marginBottom: 8,
          }}
        >
          LOBBY LEADERBOARD
        </div>
        {meRank && (
          <div style={{ fontSize: 12, color: accent, marginBottom: 6 }}>
            Your best: {meRank.score.toLocaleString()} · rank #{meRank.rank}
          </div>
        )}
        {board.length === 0 && (
          <div style={{ fontSize: 12.5, color: "rgba(148,163,184,.65)" }}>
            No scores yet. The first name on this board is going to look very good in the history
            books.
          </div>
        )}
        {board.map((r, i) => (
          <div
            key={r.userId || i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 10px",
              borderRadius: 8,
              background: i === 0 ? `${accent}14` : "transparent",
              border: i === 0 ? `1px solid ${accent}44` : "1px solid transparent",
            }}
          >
            <span
              style={{
                width: 26,
                fontWeight: 800,
                color: i < 3 ? accent : "rgba(148,163,184,.6)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {i + 1}
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {r.name}
            </span>
            <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {Number(r.score).toLocaleString()}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "rgba(148,163,184,.55)",
                width: 44,
                textAlign: "right",
              }}
            >
              r{r.rounds}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
