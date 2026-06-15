"use client";

import React, { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type Event = {
  id: string;
  ts: number;
  kind: string;
  lobbyId?: string;
  text: string;
  accent?: string;
};

export default function LandingActivityTicker() {
  const [events, setEvents] = useState<Event[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const r = await fetch(`${API}/public/activity`, { cache: "no-store" });
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
    <div className="lp-ticker" aria-label="Recent activity across Weered">
      <div className="lp-ticker-label">
        <span className="lp-ticker-pulse" />
        live
      </div>
      <div className="lp-ticker-track">
        {display.length === 0 && hasFetched && (
          <div className="lp-ticker-empty">quiet right now, be the first to make some noise</div>
        )}
        {display.length === 0 && !hasFetched && <div className="lp-ticker-empty">connecting…</div>}
        {display.length > 0 && (
          <div className="lp-ticker-marquee">
            {[...display, ...display].map((ev, i) => (
              <span key={`${ev.id}-${i}`} className="lp-ticker-item">
                <span className="lp-ticker-dot" style={{ background: ev.accent || "#D9A942" }} />
                <span className="lp-ticker-text">{ev.text}</span>
                <span className="lp-ticker-ts">{timeAgo(ev.ts)}</span>
                <span className="lp-ticker-sep">·</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
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
