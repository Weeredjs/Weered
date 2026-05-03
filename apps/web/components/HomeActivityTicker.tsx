"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type Event = {
  id: string;
  ts: number;
  kind: string;
  lobbyId: string | null;
  lobbyName: string | null;
  userId: string | null;
  userName: string | null;
  text: string;
  accent?: string | null;
};

export default function HomeActivityTicker() {
  const [events, setEvents] = useState<Event[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const tok = (() => {
          try { return localStorage.getItem("weered_token") || ""; } catch { return ""; }
        })();
        const r = await fetch(`${API}/activity/recent`, {
          cache: "no-store",
          headers: tok ? { Authorization: `Bearer ${tok}` } : {},
        });
        const j = await r.json();
        if (!aliveRef.current) return;
        const all: Event[] = Array.isArray(j?.events) ? j.events : [];
        setEvents(all);
        setHasFetched(true);
      } catch {
        if (aliveRef.current) setHasFetched(true);
      }
      if (aliveRef.current) timer = setTimeout(tick, 10_000);
    }
    tick();

    return () => {
      aliveRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const display = events.slice(0, 8);

  return (
    <>
      <style>{`
        .home-ticker {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 16px;
          height: 44px;
          border-radius: 10px;
          background: linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,.01));
          border: 1px solid rgba(255,255,255,.06);
          font-family: var(--font-rajdhani), 'Rajdhani', system-ui, sans-serif;
        }
        .home-ticker-label {
          flex: 0 0 auto;
          display: inline-flex; align-items: center; gap: 6px;
          padding: 3px 9px;
          font-size: 9px; font-weight: 800;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: #d9a942;
          background: rgba(217,169,66,.08);
          border: 1px solid rgba(217,169,66,.2);
          border-radius: 3px;
        }
        .home-ticker-pulse {
          width: 5px; height: 5px; border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 0 rgba(34,197,94,.55);
          animation: home-ticker-pulse 1.6s infinite;
        }
        @keyframes home-ticker-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,.55); }
          70%  { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        .home-ticker-track {
          flex: 1; overflow: hidden; height: 24px;
          display: flex; align-items: center;
          mask-image: linear-gradient(90deg, transparent, #000 32px, #000 calc(100% - 32px), transparent);
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 32px, #000 calc(100% - 32px), transparent);
        }
        .home-ticker-marquee {
          display: inline-flex; align-items: center; gap: 0;
          white-space: nowrap;
          animation: home-ticker-scroll 60s linear infinite;
        }
        .home-ticker:hover .home-ticker-marquee { animation-play-state: paused; }
        @keyframes home-ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .home-ticker-item {
          display: inline-flex; align-items: baseline; gap: 8px;
          font-size: 13px;
          color: rgba(232,232,236,.85);
        }
        .home-ticker-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #d9a942;
          align-self: center;
        }
        .home-ticker-text { color: rgba(232,232,236,.92); }
        .home-ticker-lobby {
          color: rgba(232,232,236,.55);
          text-decoration: none;
          padding-left: 6px;
          transition: color .12s, text-decoration-color .12s;
          text-decoration: underline;
          text-decoration-color: transparent;
          text-underline-offset: 3px;
        }
        .home-ticker-lobby:hover {
          color: #d9a942;
          text-decoration-color: rgba(217,169,66,.5);
        }
        .home-ticker-ts   { color: rgba(232,232,236,.4); font-size: 11px; }
        .home-ticker-sep  { color: rgba(232,232,236,.18); padding: 0 14px; }
        .home-ticker-empty {
          font-size: 12px;
          color: rgba(232,232,236,.5);
          font-style: italic;
          letter-spacing: 0.04em;
        }
      `}</style>
      <div className="home-ticker" aria-label="Recent activity across Weered">
        <div className="home-ticker-label">
          <span className="home-ticker-pulse" />
          live
        </div>
        <div className="home-ticker-track">
          {display.length === 0 && hasFetched && (
            <div className="home-ticker-empty">
              the platform's quiet right now — go make some noise
            </div>
          )}
          {display.length === 0 && !hasFetched && (
            <div className="home-ticker-empty">listening…</div>
          )}
          {display.length > 0 && (
            <div className="home-ticker-marquee">
              {[...display, ...display].map((ev, i) => (
                <span key={`${ev.id}-${i}`} className="home-ticker-item">
                  <span
                    className="home-ticker-dot"
                    style={{ background: ev.accent || "#d9a942" }}
                  />
                  <span className="home-ticker-text">{ev.text}</span>
                  {ev.lobbyId && (
                    <Link
                      href={`/lobby/${ev.lobbyId}`}
                      className="home-ticker-lobby"
                      title={`Open /${ev.lobbyId}`}
                    >
                      /{ev.lobbyId}
                    </Link>
                  )}
                  <span className="home-ticker-ts">{timeAgo(ev.ts)}</span>
                  <span className="home-ticker-sep">·</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}
