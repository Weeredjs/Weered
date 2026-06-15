"use client";

import React, { useRef, useState } from "react";

export type FeaturedLobby = {
  id: string;
  name: string;
  description: string;
  moduleType: string;
  accentColor: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  memberCount: number;
  liveCount: number;
  verified: boolean;
  keywords: string[];
};

export default function LandingLobbyCard({
  lobby,
  onOpen,
}: {
  lobby: FeaturedLobby;
  onOpen: (l: FeaturedLobby) => void;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, px: 50, py: 50 });

  function handleMove(e: React.MouseEvent<HTMLButtonElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - y) * 8;
    const ry = (x - 0.5) * 10;
    setTilt({ rx, ry, px: x * 100, py: y * 100 });
  }
  function handleLeave() {
    setTilt({ rx: 0, ry: 0, px: 50, py: 50 });
  }

  const accent = lobby.accentColor || "#D9A942";
  const banner = lobby.bannerUrl || "";
  const live = lobby.liveCount || 0;
  const totalMembers = lobby.memberCount || 0;

  return (
    <button
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={() => onOpen(lobby)}
      className="lp-wall-card"
      style={{
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        ["--lp-card-accent" as any]: accent,
        ["--lp-card-px" as any]: `${tilt.px}%`,
        ["--lp-card-py" as any]: `${tilt.py}%`,
      }}
      aria-label={`Open ${lobby.name}`}
    >
      <div
        className="lp-wall-card-bg"
        style={banner ? { backgroundImage: `url(${banner})` } : undefined}
      />
      <div className="lp-wall-card-scrim" />
      <div className="lp-wall-card-glare" />

      <div className="lp-wall-card-body">
        <div className="lp-wall-card-top">
          {lobby.logoUrl ? (
            <img src={lobby.logoUrl} alt="" className="lp-wall-card-logo" />
          ) : (
            <div className="lp-wall-card-logo lp-wall-card-logo--placeholder">
              {lobby.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="lp-wall-card-titles">
            <div className="lp-wall-card-name">{lobby.name}</div>
            <div className="lp-wall-card-tag">/{lobby.id}</div>
          </div>
        </div>

        <div className="lp-wall-card-desc">{(lobby.description || "").slice(0, 110) || "—"}</div>

        <div className="lp-wall-card-foot">
          <span className="lp-wall-card-live">
            <span className={`lp-wall-card-dot${live > 0 ? " is-on" : ""}`} />
            {live > 0 ? `${live} online` : `${totalMembers.toLocaleString()} members`}
          </span>
          <span className="lp-wall-card-cta">peek →</span>
        </div>
      </div>
    </button>
  );
}
