"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { FeaturedLobby } from "./LandingLobbyCard";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type RecentEvent = { id: string; ts: number; text: string; kind: string; accent?: string };

export default function LandingLobbyPreviewModal({
  lobby,
  onClose,
  loginHref,
}: {
  lobby: FeaturedLobby;
  onClose: () => void;
  loginHref: string;
}) {
  const [recent, setRecent] = useState<RecentEvent[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API}/public/activity`, { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        const all = Array.isArray(j?.events) ? j.events : [];
        const filtered = all.filter((e: any) => !e.lobbyId || e.lobbyId === lobby.id).slice(0, 6);
        setRecent(filtered);
      } catch {
        if (alive) setRecent([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [lobby.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const accent = lobby.accentColor || "#D9A942";
  const banner = lobby.bannerUrl || "";

  return (
    <div
      className="lp-modal-back"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClose();
        }
      }}
      tabIndex={0}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="lp-modal-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        style={{ ["--lp-modal-accent" as any]: accent }}
      >
        <button className="lp-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div
          className="lp-modal-banner"
          style={banner ? { backgroundImage: `url(${banner})` } : undefined}
        >
          <div className="lp-modal-banner-scrim" />
        </div>

        <div className="lp-modal-head">
          {lobby.logoUrl && <img src={lobby.logoUrl} alt="" className="lp-modal-logo" />}
          <div>
            <div className="lp-modal-name">{lobby.name}</div>
            <div className="lp-modal-id">/lobby/{lobby.id}</div>
          </div>
          <div className="lp-modal-counts">
            <div className="lp-modal-live">
              <span className={`lp-wall-card-dot${lobby.liveCount > 0 ? " is-on" : ""}`} />
              {lobby.liveCount > 0
                ? `${lobby.liveCount} online now`
                : `${lobby.memberCount.toLocaleString()} members`}
            </div>
          </div>
        </div>

        <div className="lp-modal-desc">
          {lobby.description || `A ${lobby.moduleType.toLowerCase()} lobby on Weered.`}
        </div>

        {!!lobby.keywords?.length && (
          <div className="lp-modal-kw">
            {lobby.keywords.map((k) => (
              <span key={k} className="lp-modal-kw-pill">
                {k}
              </span>
            ))}
          </div>
        )}

        <div className="lp-modal-section-label">Recent activity</div>
        <div className="lp-modal-feed">
          {recent === null && <div className="lp-modal-empty">listening…</div>}
          {recent?.length === 0 && (
            <div className="lp-modal-empty">Quiet right now. Be the first in.</div>
          )}
          {recent?.map((ev) => (
            <div key={ev.id} className="lp-modal-feed-row">
              <span className="lp-modal-feed-dot" style={{ background: ev.accent || accent }} />
              <span className="lp-modal-feed-text">{ev.text}</span>
              <span className="lp-modal-feed-ts">{timeAgo(ev.ts)}</span>
            </div>
          ))}
        </div>

        <div className="lp-modal-cta-row">
          <Link
            href={`${loginHref.split("?")[0]}?next=${encodeURIComponent("/lobby/" + lobby.id)}`}
            className="lp-btn-primary lp-modal-cta"
          >
            get_in() to enter
          </Link>
          <button className="lp-btn-secondary" onClick={onClose}>
            back to the wall
          </button>
        </div>
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
