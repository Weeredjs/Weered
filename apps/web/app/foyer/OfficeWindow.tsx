"use client";

// The office window (James 2026-11-11: "I should have a fucking cool office.
// with like a legit window out into nature in 1080P. Just a crazy nice spot to
// conduct business and do presentations"). Cape Neddick Light, Maine, on the
// North Atlantic: Pexels 5695573, free for commercial use, served from disk by
// Caddy at /media/office/ (source noted in /opt/weered-media/office/SOURCE.txt).
//
// The clip is 18 seconds, so two copies cross-fade into each other and the
// loop never shows its seam. The whole Review Room sits in front of it: the
// door, the waiting room, the consult, and the host's desk. Rests in a hidden
// tab; holds a still frame for anyone who asked for less motion.
import { useEffect, useRef, useState } from "react";

const CLIP = "/media/office/window-cape-neddick-1080.mp4";
/** Seconds the two copies overlap at the seam. */
const FADE = 1.8;

export default function OfficeWindow() {
  const a = useRef<HTMLVideoElement>(null);
  const b = useRef<HTMLVideoElement>(null);
  const [front, setFront] = useState<"a" | "b">("a");
  // The copy being faded over stays whole underneath, so the seam never dims.
  const [under, setUnder] = useState<"a" | "b" | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const va = a.current;
    const vb = b.current;
    if (!va || !vb) return;
    const still =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let current: HTMLVideoElement = va;
    let next: HTMLVideoElement = vb;
    let handing = false;

    const play = (v: HTMLVideoElement) => {
      v.muted = true;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    const onTime = () => {
      if (handing || !current.duration) return;
      if (current.currentTime < current.duration - FADE) return;
      // The seam: start the other copy from the top and fade it in over this one.
      handing = true;
      next.currentTime = 0;
      play(next);
      setUnder(current === va ? "a" : "b");
      setFront(next === va ? "a" : "b");
      const was = current;
      window.setTimeout(
        () => {
          was.pause();
          setUnder(null);
          [current, next] = [next, was];
          handing = false;
        },
        FADE * 1000 + 120,
      );
    };
    const onReady = () => setReady(true);

    va.addEventListener("loadeddata", onReady, { once: true });
    va.addEventListener("timeupdate", onTime);
    vb.addEventListener("timeupdate", onTime);

    if (still) {
      // A still view: the first good frame, no motion.
      const hold = () => {
        try {
          va.currentTime = 2;
        } catch {}
      };
      if (va.readyState >= 1) hold();
      else va.addEventListener("loadedmetadata", hold, { once: true });
    } else play(va);

    // Rest in a hidden tab; carry on where it was when it's back.
    const onVis = () => {
      if (still) return;
      if (document.hidden) {
        va.pause();
        vb.pause();
      } else play(current);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      va.removeEventListener("timeupdate", onTime);
      vb.removeEventListener("timeupdate", onTime);
      va.pause();
      vb.pause();
    };
  }, []);

  return (
    <div className="ow" aria-hidden>
      <style>{CSS}</style>
      <div className={`ow-view${ready ? " is-ready" : ""}`}>
        <video
          ref={a}
          className={`ow-clip${front === "a" ? " is-front" : under === "a" ? " is-under" : ""}`}
          src={CLIP}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
        />
        <video
          ref={b}
          className={`ow-clip${front === "b" ? " is-front" : under === "b" ? " is-under" : ""}`}
          src={CLIP}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
        />
      </div>
      {/* The glass, the frame and its mullions, and the room's own light. */}
      <div className="ow-sheen" />
      <div className="ow-frame">
        <i className="ow-mullion is-1" />
        <i className="ow-mullion is-2" />
        <i className="ow-transom" />
      </div>
      <div className="ow-room" />
    </div>
  );
}

const CSS = `
.ow{position:fixed;inset:0;z-index:0;overflow:hidden;background:#0A1D35;pointer-events:none}
.ow-view{position:absolute;inset:0;background:
  linear-gradient(180deg,#9fb6cc 0%,#c9d6e0 38%,#41607a 52%,#24405a 70%,#1a2e44 100%);}
.ow-clip{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  transform:scale(1.035);opacity:0;transition:opacity ${FADE}s linear;
  filter:saturate(1.06) contrast(1.03)}
.ow-view.is-ready .ow-clip.is-front{opacity:1;z-index:2}
.ow-view.is-ready .ow-clip.is-under{opacity:1;z-index:1;transition:none}
/* Glass: a soft reflection from the room, top left. */
.ow-sheen{position:absolute;inset:0;background:
  linear-gradient(118deg,rgba(255,255,255,.075) 0%,rgba(255,255,255,.02) 22%,transparent 38%),
  linear-gradient(180deg,rgba(255,255,255,.035),transparent 30%)}
/* The frame: dark bronze, the depth of a real reveal. */
.ow-frame{position:absolute;inset:0;
  box-shadow:inset 0 0 0 14px #15130f, inset 0 0 0 15px rgba(198,161,91,.22),
    inset 0 0 0 22px #1c1914, inset 0 0 70px 26px rgba(0,0,0,.55)}
.ow-mullion{position:absolute;top:0;bottom:0;width:12px;margin-left:-6px;
  background:linear-gradient(90deg,#100e0b,#2a251d 45%,#3a3226 50%,#221e18 56%,#0f0d0a);
  box-shadow:0 0 18px rgba(0,0,0,.45)}
.ow-mullion.is-1{left:33.333%}
.ow-mullion.is-2{left:66.666%}
.ow-transom{position:absolute;left:0;right:0;top:17%;height:10px;margin-top:-5px;
  background:linear-gradient(180deg,#100e0b,#2c271f 45%,#3b3328 52%,#211d17 60%,#0f0d0a);
  box-shadow:0 0 18px rgba(0,0,0,.45)}
/* The room: dusk inside, warm lamp light along the sill, so the panels read. */
.ow-room{position:absolute;inset:0;background:
  radial-gradient(120% 70% at 50% 120%,rgba(198,161,91,.16),transparent 60%),
  linear-gradient(180deg,rgba(6,14,26,.28) 0%,rgba(6,14,26,.12) 35%,rgba(6,14,26,.42) 100%),
  radial-gradient(140% 100% at 50% 40%,transparent 55%,rgba(4,10,20,.55) 100%)}
@media (max-width:700px){.ow-mullion,.ow-transom{display:none}}
`;
