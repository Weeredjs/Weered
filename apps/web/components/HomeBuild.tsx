"use client";

// "Build your own", the top of Home (James 2026-10-30: "we also need to have a
// focus on build your own. Right at the top."). Two doors: build a lobby (say
// what you want and the composer builds it, or go step by step) and design
// your own Weered (Design mode, and the look in Settings). Lobby owners and
// admins also get their lobbies here, one click from Home. Styles:
// app/styles/52-home.css (+ Nebula in 96).
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOverlay } from "./overlays/OverlayProvider";
import { startDesign } from "../lib/shellDesign";
import { PALETTES, PALETTE_IDS, paletteColours } from "../lib/uiPrefs";
import { useShellLook } from "../lib/shellDesign";
import { makePlace, myPlace, placeAddress, type Place } from "../lib/place";
import { GATES, setPlaceGate, type Gate } from "./PlaceGate";
import { useWeered } from "./WeeredProvider";
import { sizedImage } from "../lib/sizedImage";

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
  const router = useRouter();
  const [mine, setMine] = useState<Lobby[]>([]);
  const [ask, setAsk] = useState("");
  // Your place (lib/place.ts): undefined while loading, null when there isn't one.
  const { me } = useWeered() as any;
  const look = useShellLook();
  const [place, setPlace] = useState<Place | null | undefined>(undefined);
  const [making, setMaking] = useState<"" | "busy" | "failed">("");
  useEffect(() => {
    if (!signedIn || !canDesign) return;
    let alive = true;
    void myPlace().then((p) => alive && setPlace(p));
    return () => {
      alive = false;
    };
  }, [signedIn, canDesign]);
  const makeMine = async () => {
    setMaking("busy");
    try {
      const accent =
        look?.theme === "nebula" ? paletteColours(look.palette, look.accent).a : "#7c3aed";
      const p = await makePlace(String(me?.name || "My"), accent);
      router.push(`/lobby/${encodeURIComponent(p.id)}?design=1`);
    } catch {
      setMaking("failed");
    }
  };

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    fetch(`${API}/me/lobbies`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !Array.isArray(j?.lobbies)) return;
        // The ones you run: owners (5) and admins (4).
        // Your place has its own strip below, so it isn't one of these too.
        setMine(
          j.lobbies.filter(
            (l: Lobby) =>
              (l.roleLevel ?? 1) >= 4 && l.id !== "lobby" && !String(l.id).startsWith("u-"),
          ),
        );
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
            {/* James 2026-10-30: "Vibe code your own lobby". Live since the
                builder could do it (2026-10-31, lib/aiBuild.ts). */}
            <h2 className="home-build-title">Vibe code your own lobby</h2>
            <p className="home-build-line">
              Say what you want: your game, your crew, your club or your business. Rooms, a front
              door and your own look, built in seconds.
            </p>
            <form
              className="home-build-ask"
              onSubmit={(e) => {
                e.preventDefault();
                const words = ask.trim();
                if (words.length < 3) return;
                const to = `/lobby/create?describe=${encodeURIComponent(words.slice(0, 600))}`;
                router.push(signedIn ? to : `/login?next=${encodeURIComponent(to)}`);
              }}
            >
              <input
                className="home-build-ask-input"
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder="A Helldivers crew, dark and loud, war room, squad board"
                maxLength={600}
                aria-label="Describe your lobby"
              />
              <button type="submit" className="home-build-go" disabled={ask.trim().length < 3}>
                <span aria-hidden>✦</span> Build it
              </button>
            </form>
            <div className="home-build-row">
              <Link href="/lobby/create" className="home-build-chip">
                Step by step →
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
                      <img
                        src={sizedImage(l.logoUrl, 96)}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
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
          <div
            className={`home-build-card home-build-shell${place !== undefined ? " has-mine" : ""}`}
          >
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
            {/* Your place: a lobby of your own, free (lib/place.ts). */}
            {place !== undefined && (
              <div className="home-build-mine">
                <span className="home-build-mine-label">Your place</span>
                {place ? (
                  <span className="home-build-mine-item">
                    <Link href={`/lobby/${encodeURIComponent(place.id)}`} title="Open your place">
                      <span className="home-build-mine-dot" aria-hidden>
                        🏠
                      </span>
                      <span className="home-build-mine-name">{placeAddress(place)}</span>
                    </Link>
                    <Link
                      href={`/lobby/${encodeURIComponent(place.id)}?design=1`}
                      className="home-build-mine-design"
                    >
                      Design
                    </Link>
                    {/* Who can come in, one tap from Home (components/PlaceGate.tsx). */}
                    <select
                      className="home-build-mine-gate"
                      aria-label="Who can come in"
                      title="Who can come in"
                      value={place.gate || "anyone"}
                      onChange={async (e) => {
                        const was = place;
                        const g = e.target.value as Gate;
                        setPlace({ ...place, gate: g });
                        try {
                          await setPlaceGate(g);
                        } catch {
                          setPlace(was);
                        }
                      }}
                    >
                      {GATES.map((g) => (
                        <option key={g.id} value={g.id}>
                          🚪 {g.label}
                        </option>
                      ))}
                    </select>
                    {/* A code address: yourname.weered.ca is the $6 plan's (lib/place.ts). */}
                    {!place.host && (
                      <Link href="/subscribe" className="home-build-mine-design" title="Plans">
                        Get yourname.weered.ca
                      </Link>
                    )}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="home-build-chip"
                    onClick={makeMine}
                    disabled={making === "busy"}
                  >
                    <span aria-hidden>🏠</span>
                    {making === "busy"
                      ? "Making it…"
                      : making === "failed"
                        ? "Didn't work. Try again"
                        : "Make it, free"}
                  </button>
                )}
              </div>
            )}
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
