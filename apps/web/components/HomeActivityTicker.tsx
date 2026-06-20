"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type ConvItem = {
  key: string;
  href: string;
  name: string;
  sub: string | null;
  logo: string | null;
  accent: string | null;
  online: number;
  live: boolean;
};

export default function HomeActivityTicker() {
  const [items, setItems] = useState<ConvItem[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      try {
        const tok = (() => {
          try {
            return localStorage.getItem("weered_token") || "";
          } catch {
            return "";
          }
        })();
        const headers: Record<string, string> = tok ? { Authorization: `Bearer ${tok}` } : {};
        const [liveR, lobR] = await Promise.all([
          fetch(`${API}/live/rooms`, { cache: "no-store", headers })
            .then((r) => r.json())
            .catch(() => ({})),
          fetch(`${API}/lobbies`, { headers })
            .then((r) => r.json())
            .catch(() => ({})),
        ]);
        if (!aliveRef.current) return;
        const rooms: any[] = Array.isArray(liveR?.rooms) ? liveR.rooms : [];
        const lobbies: any[] = Array.isArray(lobR?.lobbies) ? lobR.lobbies : [];

        const liveItems: ConvItem[] = rooms.map((r) => ({
          key: `r-${r.id}`,
          href: r.roomIsLobby ? `/lobby/${r.lobbyId}` : `/room/${r.id}`,
          name: r.roomIsLobby ? r.lobbyName || r.name : r.name,
          sub: r.roomIsLobby ? null : r.lobbyName || null,
          logo: r.lobbyLogoUrl || null,
          accent: r.lobbyAccentColor || null,
          online: r.onlineCount || 0,
          live: true,
        }));
        const liveLobbyIds = new Set(rooms.filter((r) => r.roomIsLobby).map((r) => r.lobbyId));
        const lobbyItems: ConvItem[] = lobbies
          .filter((l) => !liveLobbyIds.has(l.id))
          .map((l) => ({
            key: `l-${l.id}`,
            href: `/lobby/${l.id}`,
            name: l.name,
            sub: null,
            logo: l.logoUrl || null,
            accent: l.accentColor || null,
            online: 0,
            live: false,
          }));

        setItems([...liveItems, ...lobbyItems].slice(0, 32));
        setHasFetched(true);
      } catch {
        if (aliveRef.current) setHasFetched(true);
      }
      if (aliveRef.current) timer = setTimeout(load, 15_000);
    }
    load();

    return () => {
      aliveRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const belt = items.length > 0 ? [...items, ...items] : [];

  return (
    <>
      <style>{`
        .home-ticker {
          display: flex; align-items: center; gap: 12px;
          padding: 6px 0; height: 42px;
          background: transparent;
          border: none;
          font-family: var(--font-rajdhani), 'Rajdhani', system-ui, sans-serif;
        }
        .home-ticker-label {
          flex: 0 0 auto;
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 9px; font-weight: 800;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: #6ee7b7;
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
          flex: 1; overflow: hidden; height: 32px;
          display: flex; align-items: center;
          mask-image: linear-gradient(90deg, transparent, #000 28px, #000 calc(100% - 28px), transparent);
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 28px, #000 calc(100% - 28px), transparent);
        }
        .home-ticker-marquee {
          display: inline-flex; align-items: center;
          white-space: nowrap;
          animation: home-ticker-scroll 75s linear infinite;
        }
        .home-ticker:hover .home-ticker-marquee { animation-play-state: paused; }
        @keyframes home-ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .conv-item {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 4px 0; margin-right: 26px;
          color: rgba(232,232,236,.82); text-decoration: none;
          font-size: 13px; font-weight: 600; white-space: nowrap;
          transition: color .12s;
        }
        .conv-item:hover { color: #fff; }
        .conv-logo {
          width: 19px; height: 19px; border-radius: 2px; object-fit: cover; flex-shrink: 0;
          background: rgba(0,0,0,.3);
        }
        .conv-dot {
          width: 19px; height: 19px; border-radius: 2px; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 800; color: #fff;
        }
        .conv-sub { color: rgba(232,232,236,.45); font-size: 11px; font-weight: 500; }
        .conv-online {
          display: inline-flex; align-items: center; gap: 4px;
          color: #6ee7b7; font-size: 11px; font-weight: 800; letter-spacing: .02em;
        }
        .conv-online .d { width: 5px; height: 5px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 6px #22c55e; }
        .home-ticker-empty {
          font-size: 12px; color: rgba(232,232,236,.5); font-style: italic; letter-spacing: 0.04em;
        }
      `}</style>
      <div className="home-ticker" aria-label="Live rooms and lobbies across Weered">
        <div className="home-ticker-label">
          <span className="home-ticker-pulse" />
          live
        </div>
        <div className="home-ticker-track">
          {belt.length === 0 && hasFetched && (
            <div className="home-ticker-empty">no lobbies to show right now</div>
          )}
          {belt.length === 0 && !hasFetched && (
            <div className="home-ticker-empty">loading the belt…</div>
          )}
          {belt.length > 0 && (
            <div className="home-ticker-marquee">
              {belt.map((it, i) => (
                <Link
                  key={`${it.key}-${i}`}
                  href={it.href}
                  className={`conv-item${it.live && it.online > 0 ? " is-live" : ""}`}
                  title={it.sub ? `${it.name} · in ${it.sub}` : it.name}
                >
                  {it.logo ? (
                    <img className="conv-logo" src={it.logo} alt="" />
                  ) : (
                    <span
                      className="conv-dot"
                      style={{ background: it.accent || "linear-gradient(135deg,#7c3aed,#5800e5)" }}
                    >
                      {(it.name || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span>{it.name}</span>
                  {it.sub && <span className="conv-sub">/{it.sub}</span>}
                  {it.online > 0 && (
                    <span className="conv-online">
                      <span className="d" />
                      {it.online}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
