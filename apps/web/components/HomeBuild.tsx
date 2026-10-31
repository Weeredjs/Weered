"use client";

// "Build your own", the top of Home (James 2026-10-30: "we also need to have a
// focus on build your own. Right at the top."). Two doors: build a lobby (the
// composer, with a few ways in) and design your own Weered (Design mode, and
// the look in Settings). Lobby owners and admins also get their lobbies here,
// one click from Home. Styles: app/styles/52-home.css (+ Nebula in 96).
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useOverlay } from "./overlays/OverlayProvider";
import { startDesign } from "../lib/shellDesign";
import { PALETTES, PALETTE_IDS } from "../lib/uiPrefs";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

type Lobby = {
  id?: string;
  name?: string;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  roleLevel?: number;
};

/** Ways into the composer (/lobby/create?start=): a group of templates, or
 *  one template (components/composer/catalog.ts ids). */
const STARTS = [
  { id: "games", icon: "🎮", label: "Game lobby" },
  { id: "NONE", icon: "✦", label: "Community" },
  { id: "CLUB", icon: "🛡", label: "Club" },
  { id: "OFFICE", icon: "🛎", label: "Digital office" },
];

/** The art strip: official lobbies whose banners are their own art, best first. */
const ART_ORDER = [
  "poe2",
  "eve",
  "league-of-legends",
  "warframe",
  "fortnite",
  "apex-legends",
  "counter-strike-2",
  "destiny2",
];

export default function HomeBuild({
  lobbies,
  signedIn,
  canDesign,
}: {
  lobbies: Lobby[];
  signedIn: boolean;
  /** Design mode is offered (signed in, not the office desk). */
  canDesign: boolean;
}) {
  const { openSheet } = useOverlay() as any;
  const [mine, setMine] = useState<Lobby[]>([]);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    fetch(`${API}/me/lobbies`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !Array.isArray(j?.lobbies)) return;
        // The ones you run: owners (5) and admins (4).
        setMine(j.lobbies.filter((l: Lobby) => (l.roleLevel ?? 1) >= 4 && l.id !== "lobby"));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [signedIn]);

  const art = useMemo(() => {
    const byId = new Map(lobbies.map((l) => [l.id, l]));
    return ART_ORDER.map((id) => byId.get(id))
      .filter((l): l is Lobby => !!l?.bannerUrl)
      .slice(0, 3);
  }, [lobbies]);

  return (
    <section className="home-build-wrap" aria-label="Build your own">
      <div className={`home-build${canDesign ? "" : " is-solo"}`}>
        <div className={`home-build-card home-build-lobby${mine.length ? " has-mine" : ""}`}>
          {art.length > 0 && (
            <div className="home-build-art" aria-hidden>
              {art.map((l, i) => (
                <span key={l.id} className="home-build-art-panel" style={{ zIndex: 3 - i }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- lobby banners, sized by the strip */}
                  <img
                    src={l.bannerUrl as string}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                </span>
              ))}
            </div>
          )}
          <div className="home-build-body">
            <div className="home-build-eyebrow">Build your own</div>
            <h2 className="home-build-title">Build a lobby</h2>
            <p className="home-build-line">
              Your game, your crew, your club or your business. Rooms, a front door and your own
              look, up in a minute.
            </p>
            <div className="home-build-row">
              <Link href="/lobby/create" className="home-build-go">
                Start building →
              </Link>
              {STARTS.map((s) => (
                <Link
                  key={s.id}
                  href={`/lobby/create?start=${encodeURIComponent(s.id)}`}
                  className="home-build-chip"
                >
                  <span aria-hidden>{s.icon}</span>
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
          {/* The lobbies you run, along the bottom of the card. */}
          {mine.length > 0 && (
            <div className="home-build-mine">
              <span className="home-build-mine-label">Yours</span>
              {mine.slice(0, 3).map((l) => (
                <span key={l.id} className="home-build-mine-item">
                  <Link href={`/lobby/${encodeURIComponent(l.id || "")}`} title={l.name || l.id}>
                    {l.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a lobby's own logo
                      <img src={l.logoUrl} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="home-build-mine-dot" aria-hidden>
                        {(l.name || l.id || "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="home-build-mine-name">{l.name || l.id}</span>
                  </Link>
                  <Link
                    href={`/lobby/${encodeURIComponent(l.id || "")}?design=1`}
                    className="home-build-mine-design"
                    title={`Design ${l.name || l.id}`}
                  >
                    Design
                  </Link>
                </span>
              ))}
            </div>
          )}
        </div>

        {canDesign && (
          <div className="home-build-card home-build-shell">
            <ShellSketch />
            <div className="home-build-body">
              <div className="home-build-eyebrow">Your Weered</div>
              {/* James 2026-10-30: "Say change your drip." */}
              <h2 className="home-build-title">Change your drip</h2>
              <p className="home-build-line">
                Move every section, add blocks, pick a colourway, corners and effects.
              </p>
              <div className="home-build-swatches" aria-hidden>
                {PALETTE_IDS.map((id) => (
                  <span
                    key={id}
                    title={PALETTES[id].name}
                    style={{
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${PALETTES[id].a}, ${PALETTES[id].c})`,
                    }}
                  />
                ))}
              </div>
              <div className="home-build-row">
                <button
                  type="button"
                  className="home-build-go home-build-design"
                  onClick={() => startDesign()}
                >
                  ✦ Open Design
                </button>
                <button
                  type="button"
                  className="home-build-ghost"
                  onClick={() => openSheet?.("settings", { tab: "appearance" })}
                >
                  Pick a look
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** Your Weered in miniature: the left sidebar, Home and the right panel,
 *  with one block on its way from the panel to the sidebar. */
function ShellSketch() {
  return (
    <div className="home-build-sketch" aria-hidden>
      <div className="hbs-col hbs-left">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="hbs-col hbs-home">
        <b />
        <span>
          <i />
          <i />
        </span>
        <span>
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="hbs-col hbs-right">
        <i />
        <i />
        <i />
      </div>
      <em className="hbs-moving" />
    </div>
  );
}
