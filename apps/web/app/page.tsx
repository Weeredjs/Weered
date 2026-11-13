"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import LandingFilm from "../components/LandingFilm";
import { sizedImage } from "../lib/sizedImage";
import { isSitePath } from "../lib/shellLayout";

/** Downtown as a signed-out visitor sees it, photographed on the live site. A
 *  new shot gets a new name, so a cached old one is never shown for it. */
const TOWN_SHOT = "/brand/landing/downtown-2026-11-12.webp";

function AuthRouter({ onUnauthed }: { onUnauthed: (next: string) => void }) {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const n = sp?.get("next") || "";
    const next = isSitePath(n) ? n : "/home"; // no "//", tab or newline tricks
    try {
      const tok = localStorage.getItem("weered_user") || "";
      if (tok) router.replace(next);
      else onUnauthed(next);
    } catch {
      onUnauthed(next);
    }
  }, [router, sp, onUnauthed]);

  return null;
}

export default function Page() {
  const [nextPath, setNextPath] = useState("/home");

  return (
    <>
      <Suspense fallback={null}>
        <AuthRouter onUnauthed={(next) => setNextPath(next)} />
      </Suspense>
      <style>{`
        .lp-authed-splash { display: none; }
        html[data-weered-authed] .lp-authed-splash { display: grid; }
        html[data-weered-authed] .lp-root { display: none; }
      `}</style>
      <div className="lp-authed-splash">
        <InitialSplash />
      </div>
      <Landing nextPath={nextPath} />
    </>
  );
}

function InitialSplash() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#07060d",
        color: "rgba(255,255,255,.5)",
        fontFamily: "var(--font-rajdhani), 'Rajdhani', system-ui, sans-serif",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}
    >
      connecting…
    </div>
  );
}

// The front door. People arrive already knowing what Weered is (word of mouth,
// sales), so this says one thing and gets them in. No feature tour.
function Landing({ nextPath }: { nextPath: string }) {
  const signIn = `/login?next=${encodeURIComponent(nextPath)}`;
  const getIn = `/login?mode=register&next=${encodeURIComponent(nextPath)}`;

  return (
    <>
      <style>{LANDING_CSS}</style>
      <div className="lp-root">
        <div className="lp-aura" aria-hidden />
        <div className="lp-grid" aria-hidden />

        <nav className="lp-nav">
          <a href="/" className="lp-brand">
            <img src="/brand/logo/weered-logo-128.png" alt="" />
            Weered
          </a>
          <Link href={signIn} className="lp-signin">
            Sign in
          </Link>
        </nav>

        <main className="lp-hero">
          <h1 className="lp-headline">A place for anything.</h1>
          {/* Who it's for, then what it does (2026-11-10: the line was a feature
              list, and "Get in" read the same as "Sign in"). */}
          <p className="lp-sub">
            Your crew, your club, your business. Say what you want and it&apos;s built: rooms,
            voice, video and your own look. On your own domain if you want it.
          </p>
          <div className="lp-cta">
            <Link href={getIn} className="lp-btn lp-btn-main">
              Join free
            </Link>
            <Link href={signIn} className="lp-btn lp-btn-ghost">
              Sign in
            </Link>
          </div>
          <a href="/requests?meeting=1" className="lp-biz">
            Building for a business? <span>Book a meeting →</span>
          </a>
          <LandingFilm />
        </main>

        {/* The premise (James 2026-11-12: the mall is "the entire premise of the
            platform", and the page above sold only the builder). One line and
            the town itself: the picture is Downtown as a visitor sees it, and it
            opens Downtown right here, no account needed. */}
        <section className="lp-town" aria-labelledby="lp-town-h">
          <p className="lp-kicker">One town</p>
          <h2 id="lp-town-h" className="lp-h2">
            Every lobby sits in one town.
          </h2>
          <p className="lp-town-sub">
            Walk from one into the next. One account, one friends list, and a Town Square where
            everyone on Weered talks.
          </p>
          <button
            type="button"
            className="lp-town-shot"
            onClick={() => window.dispatchEvent(new CustomEvent("weered:lobby:browse"))}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a screenshot, sized by lib/sizedImage */}
            <img
              src={sizedImage(TOWN_SHOT, 1200)}
              srcSet={`${sizedImage(TOWN_SHOT, 828)} 828w, ${sizedImage(TOWN_SHOT, 1200)} 1200w, ${sizedImage(TOWN_SHOT, 1920)} 1920w`}
              sizes="(max-width: 1000px) 94vw, 960px"
              alt="Downtown: every lobby on Weered, side by side"
              width={1600}
              height={1000}
              loading="lazy"
            />
            <span className="lp-town-go">Walk around Downtown →</span>
          </button>
        </section>

        <footer className="lp-foot">
          <span>© weered.ca</span>
          <a href="/about">About</a>
          <a href="/pricing">Pricing</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/contact">Contact</a>
        </footer>
      </div>
    </>
  );
}

const LANDING_CSS = `
.lp-root {
  position: relative;
  min-height: 100vh;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  background: #07060d;
  color: #fff;
  font-family: var(--font-rajdhani), 'Rajdhani', system-ui, sans-serif;
  overflow: hidden;
}
.lp-aura {
  position: absolute;
  inset: -25%;
  pointer-events: none;
  background:
    radial-gradient(34% 34% at 30% 30%, rgba(124,58,237,.55), transparent 70%),
    radial-gradient(30% 30% at 72% 68%, rgba(14,165,233,.26), transparent 70%),
    radial-gradient(22% 22% at 78% 24%, rgba(217,70,239,.18), transparent 70%);
  filter: blur(40px);
  animation: lp-drift 22s ease-in-out infinite alternate;
}
.lp-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(60% 55% at 50% 45%, #000 20%, transparent 100%);
  -webkit-mask-image: radial-gradient(60% 55% at 50% 45%, #000 20%, transparent 100%);
}
.lp-nav {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 20px clamp(16px, 4vw, 40px);
}
.lp-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 22px;
  letter-spacing: .01em;
  color: #fff !important;
  text-decoration: none;
}
.lp-brand img { width: 34px; height: 34px; filter: drop-shadow(0 0 14px rgba(167,139,250,.55)); }
.lp-signin {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.04);
  color: #fff !important;
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  transition: background .2s, border-color .2s;
}
.lp-signin:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.32); }
.lp-hero {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px 16px 64px;
}
.lp-headline {
  margin: 0;
  font-size: clamp(52px, 12vw, 138px);
  line-height: .9;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #fff;
  text-shadow: 0 0 60px rgba(167,139,250,.35);
  animation: lp-rise .8s .05s cubic-bezier(.2,.8,.2,1) both;
}
.lp-sub {
  margin: clamp(18px, 3vh, 26px) 0 0;
  max-width: 40ch;
  font-size: clamp(18px, 2.4vw, 22px);
  line-height: 1.4;
  font-weight: 500;
  color: rgba(255,255,255,.72);
  animation: lp-rise .8s .15s cubic-bezier(.2,.8,.2,1) both;
}
.lp-cta {
  margin-top: clamp(28px, 5vh, 44px);
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  animation: lp-rise .8s .25s cubic-bezier(.2,.8,.2,1) both;
}
.lp-btn {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  min-width: 168px;
  padding: 0 30px;
  border-radius: 14px;
  font-weight: 700;
  font-size: 19px;
  letter-spacing: .01em;
  text-decoration: none;
  color: #fff !important;
  transition: transform .18s ease, box-shadow .25s ease, background .2s, border-color .2s;
}
.lp-btn-main {
  border: 1px solid rgba(196,181,253,.55);
  background: linear-gradient(135deg, #7c3aed, #5b21b6);
  box-shadow: 0 16px 50px rgba(124,58,237,.45), inset 0 1px 0 rgba(255,255,255,.22);
}
.lp-btn-main::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.22) 50%, transparent 70%);
  transform: translateX(-120%);
  animation: lp-sheen 4s 1.4s ease-in-out infinite;
}
.lp-btn-main:hover { transform: translateY(-2px); box-shadow: 0 22px 60px rgba(124,58,237,.6), inset 0 1px 0 rgba(255,255,255,.25); }
.lp-btn-ghost {
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.04);
}
.lp-btn-ghost:hover { transform: translateY(-2px); background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.32); }
.lp-biz {
  margin-top: 26px;
  font-size: 15px;
  font-weight: 600;
  color: rgba(255,255,255,.55) !important;
  text-decoration: none;
  animation: lp-rise .8s .35s cubic-bezier(.2,.8,.2,1) both;
}
.lp-biz span { color: #c4b5fd !important; }
.lp-biz:hover { color: rgba(255,255,255,.8) !important; }
.lp-film {
  position: relative;
  width: min(960px, 100%);
  aspect-ratio: 16 / 9;
  margin-top: clamp(30px, 5vh, 48px);
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(196,181,253,.28);
  background: #0b0716;
  box-shadow: 0 30px 90px rgba(0,0,0,.6), 0 0 80px -20px rgba(124,58,237,.55);
  animation: lp-rise .8s .45s cubic-bezier(.2,.8,.2,1) both;
}
.lp-film video { display: block; width: 100%; height: 100%; object-fit: cover; }
.lp-film-sound, .lp-film-play {
  position: absolute;
  right: 14px;
  bottom: 14px;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.22);
  background: rgba(7,6,13,.7);
  backdrop-filter: blur(6px);
  color: #fff;
  font: inherit;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  transition: background .2s, border-color .2s;
}
.lp-film-sound:hover, .lp-film-play:hover { background: rgba(124,58,237,.55); border-color: rgba(196,181,253,.6); }
.lp-film-play {
  right: 50%;
  bottom: 50%;
  transform: translate(50%, 50%);
  min-height: 54px;
  padding: 0 26px;
  font-size: 18px;
  background: rgba(124,58,237,.75);
}
.lp-town {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: clamp(28px, 7vh, 72px) 16px clamp(40px, 8vh, 84px);
}
.lp-kicker {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: .28em;
  text-transform: uppercase;
  color: #c4b5fd;
}
.lp-h2 {
  margin: 12px 0 0;
  font-size: clamp(34px, 6.2vw, 68px);
  line-height: 1;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
  text-shadow: 0 0 50px rgba(167,139,250,.3);
}
.lp-town-sub {
  margin: 18px 0 0;
  max-width: 46ch;
  font-size: clamp(17px, 2.2vw, 21px);
  line-height: 1.4;
  font-weight: 500;
  color: rgba(255,255,255,.72);
}
.lp-town-shot {
  position: relative;
  display: block;
  width: min(960px, 100%);
  margin-top: clamp(26px, 4vh, 40px);
  padding: 0;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(196,181,253,.28);
  background: #0b0716;
  box-shadow: 0 30px 90px rgba(0,0,0,.6), 0 0 80px -20px rgba(124,58,237,.55);
  cursor: pointer;
  font: inherit;
  transition: transform .2s ease, border-color .2s ease, box-shadow .25s ease;
}
.lp-town-shot img { display: block; width: 100%; height: auto; }
.lp-town-shot:hover, .lp-town-shot:focus-visible {
  transform: translateY(-3px);
  border-color: rgba(196,181,253,.6);
  box-shadow: 0 36px 100px rgba(0,0,0,.65), 0 0 90px -16px rgba(124,58,237,.7);
}
.lp-town-go {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  min-height: 46px;
  padding: 0 22px;
  border-radius: 999px;
  border: 1px solid rgba(196,181,253,.55);
  background: linear-gradient(135deg, rgba(124,58,237,.94), rgba(91,33,182,.94));
  color: #fff;
  font-weight: 700;
  font-size: 17px;
  white-space: nowrap;
  box-shadow: 0 12px 36px rgba(0,0,0,.5);
}
.lp-foot {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 18px;
  padding: 18px 16px 22px;
  font-size: 13px;
  color: rgba(255,255,255,.38);
}
.lp-foot a { color: inherit !important; text-decoration: none; }
.lp-foot a:hover { color: rgba(255,255,255,.75) !important; }
@keyframes lp-drift { to { transform: translate(5%, 4%) rotate(6deg); } }
@keyframes lp-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes lp-sheen { 0% { transform: translateX(-120%); } 55%, 100% { transform: translateX(120%); } }
@media (prefers-reduced-motion: reduce) {
  .lp-root *, .lp-root *::after { animation: none !important; }
}
`;
