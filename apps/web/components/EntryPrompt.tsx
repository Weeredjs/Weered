"use client";
// The post-login fork: a full-screen "What are you doing?" with two answers.
// "I need a place" goes to the lobby composer; "I'm good" lets them in. Shown
// once per browser session until "Don't show this again" is ticked. Mostly new
// people see it; everyone else ticks the box once.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const OFF_KEY = "weered:entry-prompt:off";
const SEEN_KEY = "weered:entry-prompt:seen";

export default function EntryPrompt() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [never, setNever] = useState(false);
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("weered_user") || "null");
      if (!u?.id) return;
      if (localStorage.getItem(OFF_KEY) === "1") return;
      if (sessionStorage.getItem(SEEN_KEY) === "1") return;
    } catch {
      return;
    }
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  function remember() {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
      if (never) localStorage.setItem(OFF_KEY, "1");
    } catch {}
  }

  function close() {
    remember();
    setLeaving(true);
    setTimeout(() => setShow(false), 380);
  }

  function build() {
    remember();
    router.push("/lobby/create");
  }

  if (!show) return null;

  // Portalled: the app shell is a stacking context the site banner sits over.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ep-title"
      className={`ep-root${leaving ? " ep-out" : ""}`}
    >
      <style>{CSS}</style>
      <div className="ep-glow ep-glow-a" aria-hidden />
      <div className="ep-glow ep-glow-b" aria-hidden />
      <div className="ep-grain" aria-hidden />

      <div className="ep-stage">
        <img className="ep-mark" src="/brand/logo/weered-logo-128.png" alt="" />
        <h1 id="ep-title" className="ep-title">
          What are you doing?
        </h1>

        <div className="ep-choices">
          <button ref={primary} type="button" className="ep-choice ep-main" onClick={build}>
            <span className="ep-choice-label">I need a place</span>
            <span className="ep-choice-sub">Build a lobby. Takes a minute.</span>
            <span className="ep-arrow" aria-hidden>
              →
            </span>
          </button>
          <button type="button" className="ep-choice ep-alt" onClick={close}>
            <span className="ep-choice-label">I&apos;m good</span>
            <span className="ep-choice-sub">Let me in.</span>
          </button>
        </div>

        <label className="ep-never">
          <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />
          <span>Don&apos;t show this again</span>
        </label>
      </div>
    </div>,
    document.body,
  );
}

const CSS = `
.ep-root {
  position: fixed; inset: 0; z-index: 99995;
  display: grid; place-items: center;
  padding: 24px 16px;
  background: rgba(6,5,14,.78);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  overflow: hidden;
  animation: ep-in .5s ease both;
  font-family: var(--font-rajdhani), 'Rajdhani', system-ui, sans-serif;
}
.ep-root.ep-out { animation: ep-fade .38s ease both; }
.ep-glow { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; }
.ep-glow-a {
  width: 62vmax; height: 62vmax; left: -18vmax; top: -22vmax;
  background: radial-gradient(circle, rgba(124,58,237,.55), transparent 65%);
  animation: ep-drift-a 18s ease-in-out infinite alternate;
}
.ep-glow-b {
  width: 54vmax; height: 54vmax; right: -16vmax; bottom: -20vmax;
  background: radial-gradient(circle, rgba(14,165,233,.32), transparent 65%);
  animation: ep-drift-b 22s ease-in-out infinite alternate;
}
.ep-grain {
  position: absolute; inset: 0; pointer-events: none; opacity: .07;
  background-image: radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px);
  background-size: 3px 3px;
  mask-image: radial-gradient(70% 70% at 50% 50%, #000, transparent);
}
.ep-stage {
  position: relative; width: min(760px, 100%);
  display: flex; flex-direction: column; align-items: center; text-align: center;
}
.ep-mark {
  width: 46px; height: 46px; margin-bottom: 22px;
  filter: drop-shadow(0 0 18px rgba(167,139,250,.6));
  animation: ep-rise .6s .05s cubic-bezier(.2,.8,.2,1) both;
}
.ep-title {
  margin: 0; color: #fff;
  font-size: clamp(42px, 9vw, 92px); line-height: .95;
  font-weight: 700; letter-spacing: -0.02em;
  text-shadow: 0 0 40px rgba(167,139,250,.35), 0 2px 0 rgba(0,0,0,.25);
  animation: ep-rise .7s .12s cubic-bezier(.2,.8,.2,1) both;
}
.ep-choices {
  margin-top: clamp(28px, 6vh, 52px);
  display: grid; grid-template-columns: 1.25fr 1fr; gap: 14px; width: 100%;
}
.ep-choice {
  position: relative; overflow: hidden;
  display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
  min-height: 112px; padding: 22px 24px;
  border-radius: 18px; cursor: pointer; text-align: left;
  font-family: inherit; color: #fff;
  transition: transform .18s ease, box-shadow .25s ease, border-color .25s ease, background .25s ease;
  animation: ep-rise .7s cubic-bezier(.2,.8,.2,1) both;
}
.ep-choice:focus-visible { outline: 2px solid #c4b5fd; outline-offset: 3px; }
.ep-main {
  border: 1px solid rgba(196,181,253,.55);
  background: linear-gradient(135deg, rgba(124,58,237,.95), rgba(76,29,149,.95));
  box-shadow: 0 18px 60px rgba(124,58,237,.45), inset 0 1px 0 rgba(255,255,255,.22);
  animation-delay: .24s;
}
.ep-main::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.22) 50%, transparent 70%);
  transform: translateX(-120%);
  animation: ep-sheen 3.6s 1.2s ease-in-out infinite;
}
.ep-main:hover { transform: translateY(-3px); box-shadow: 0 24px 70px rgba(124,58,237,.6), inset 0 1px 0 rgba(255,255,255,.25); }
.ep-alt {
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.05);
  animation-delay: .32s;
}
.ep-alt:hover { transform: translateY(-3px); border-color: rgba(255,255,255,.34); background: rgba(255,255,255,.09); }
.ep-choice-label { font-size: clamp(24px, 4.4vw, 32px); font-weight: 700; line-height: 1; letter-spacing: -0.01em; }
.ep-choice-sub { font-size: 15px; font-weight: 500; color: rgba(255,255,255,.72); }
.ep-arrow {
  position: absolute; right: 22px; bottom: 18px; font-size: 26px; font-weight: 700;
  transition: transform .2s ease;
}
.ep-main:hover .ep-arrow { transform: translateX(5px); }
.ep-never {
  margin-top: 22px; display: inline-flex; align-items: center; gap: 9px;
  font-size: 14px; color: rgba(255,255,255,.5); cursor: pointer; min-height: 32px;
  animation: ep-rise .7s .42s cubic-bezier(.2,.8,.2,1) both;
}
.ep-never input { width: 16px; height: 16px; accent-color: #7c3aed; cursor: pointer; }
.ep-never:hover { color: rgba(255,255,255,.75); }
@media (max-width: 560px) {
  .ep-choices { grid-template-columns: 1fr; }
  .ep-choice { min-height: 92px; padding: 18px 20px; }
}
@keyframes ep-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes ep-fade { from { opacity: 1 } to { opacity: 0; transform: scale(1.02) } }
@keyframes ep-rise { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
@keyframes ep-sheen { 0% { transform: translateX(-120%) } 55%, 100% { transform: translateX(120%) } }
@keyframes ep-drift-a { to { transform: translate(8vmax, 6vmax) } }
@keyframes ep-drift-b { to { transform: translate(-7vmax, -5vmax) } }
@media (prefers-reduced-motion: reduce) {
  .ep-root, .ep-root *, .ep-root *::after { animation: none !important; transition: none !important; }
}
`;
