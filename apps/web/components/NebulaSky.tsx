"use client";

// Nebula's sky, behind the whole app: drifting nebula clouds, an aurora band,
// two parallax star layers, bright stars that twinkle on their own clocks,
// and the odd shooting star. Drawn only under the Nebula theme (the
// stylesheet shows .nb-sky; see styles/95-nebula.css). Everything moves by
// transform and opacity, so it stays on the compositor. Starfield off
// (data-weered-stars="off") hides the stars; Reduce motion freezes it all.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// [left %, top %, size px, twinkle s, delay s]
const SPARKLES: [number, number, number, number, number][] = [
  [8, 12, 3, 4.2, 0.3],
  [22, 68, 2.5, 5.6, 1.9],
  [35, 24, 3.5, 3.4, 0.9],
  [48, 82, 2.5, 6.1, 3.2],
  [57, 9, 3, 4.8, 2.4],
  [66, 46, 2.5, 3.9, 0.1],
  [74, 77, 3.5, 5.2, 4.1],
  [83, 18, 3, 4.4, 1.2],
  [91, 58, 2.5, 6.4, 2.8],
  [14, 40, 2.5, 5.1, 3.6],
  [41, 52, 3, 4.6, 1.5],
  [62, 31, 2.5, 3.7, 4.6],
  [79, 92, 3, 5.8, 0.7],
  [5, 86, 3, 4.1, 2.1],
  [29, 6, 2.5, 6.6, 3.9],
  [95, 34, 3, 3.6, 1.7],
];

// [left %, top %, cycle s, delay s, length px]: each streaks once per cycle.
const SHOOTERS: [number, number, number, number, number][] = [
  [78, 6, 11, 2, 620],
  [52, 2, 17, 8, 520],
  [96, 22, 23, 14, 700],
];

export default function NebulaSky() {
  const [mounted, setMounted] = useState(false);
  const sky = useRef<HTMLDivElement | null>(null);
  useEffect(() => setMounted(true), []);

  // Depth: the layers lean away from the pointer by different amounts
  // (--mx/--my, -0.5..0.5; the stylesheet turns them into `translate`).
  useEffect(() => {
    const el = sky.current;
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const onMove = (e: PointerEvent) => {
      x = e.clientX / window.innerWidth - 0.5;
      y = e.clientY / window.innerHeight - 0.5;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        el.style.setProperty("--mx", x.toFixed(3));
        el.style.setProperty("--my", y.toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <div className="nb-sky" aria-hidden ref={sky}>
      <div className="nb-cloud nb-cloud-1" />
      <div className="nb-cloud nb-cloud-2" />
      <div className="nb-cloud nb-cloud-3" />
      <div className="nb-aurora" />
      <div className="nb-stars nb-stars-far" />
      <div className="nb-stars nb-stars-near" />
      <div className="nb-sparkles">
        {SPARKLES.map(([x, y, s, d, dl], i) => (
          <i
            key={i}
            style={
              {
                left: `${x}%`,
                top: `${y}%`,
                "--s": `${s}px`,
                "--d": `${d}s`,
                "--dl": `${dl}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="nb-shooting">
        {SHOOTERS.map(([x, y, d, dl, len], i) => (
          <i
            key={i}
            style={
              {
                left: `${x}%`,
                top: `${y}%`,
                "--d": `${d}s`,
                "--dl": `${dl}s`,
                "--len": `${len}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="nb-vignette" />
    </div>,
    document.body,
  );
}
