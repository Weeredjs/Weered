"use client";

// Ambient effect layer for a designed lobby, and for the viewer's own Weered
// (components/shell/ShellAmbient.tsx): stars, snow, a blizzard, embers, rain,
// petals, bubbles, fireflies, code rain, or a symbol of your own floating by,
// drawn on one canvas behind the content. Pointer-transparent, paused when the
// tab is hidden, off for reduced motion.
import React, { useEffect, useRef } from "react";
import type { EffectId } from "../lib/lobbyLayout";

type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  t: number;
  c?: string;
};

export default function LobbyAmbient({
  effect,
  accent = "#7c3aed",
  intensity = 1,
  symbol = "✦",
  light = false,
  style,
}: {
  effect?: EffectId;
  accent?: string;
  intensity?: number;
  /** What floats by when the effect is "symbol". */
  symbol?: string;
  /** Drawn over a light background (Blizzard): flakes go grey-blue to show. */
  light?: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !effect || effect === "none") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let parts: P[] = [];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    const density: Record<string, number> = {
      stars: 0.00018,
      snow: 0.00012,
      embers: 0.00008,
      rain: 0.00016,
      petals: 0.00005,
      bubbles: 0.00005,
      fireflies: 0.00005,
      matrix: 0,
      blizzard: 0.00042,
      symbol: 0.000022,
    };

    function spawn(initial: boolean): P {
      const y0 = initial ? rnd(0, h) : effect === "embers" || effect === "bubbles" ? h + 10 : -10;
      switch (effect) {
        case "stars":
          return {
            x: rnd(0, w),
            y: rnd(0, h),
            vx: rnd(-0.02, 0.02),
            vy: rnd(0.01, 0.05),
            r: rnd(0.4, 1.6),
            a: rnd(0.2, 1),
            t: rnd(0, 6.28),
          };
        case "snow":
          return {
            x: rnd(0, w),
            y: y0,
            vx: rnd(-0.3, 0.3),
            vy: rnd(0.3, 1.1),
            r: rnd(1, 3.2),
            a: rnd(0.4, 0.9),
            t: rnd(0, 6.28),
          };
        case "blizzard":
          // Driven by a wind from the left: some come in over the top,
          // some from the side.
          return Math.random() < 0.35 && !initial
            ? {
                x: -20,
                y: rnd(0, h),
                vx: rnd(3, 6),
                vy: rnd(1.2, 3),
                r: rnd(0.6, 2.2),
                a: rnd(0.45, 0.95),
                t: rnd(0, 6.28),
              }
            : {
                x: rnd(-w * 0.3, w),
                y: y0,
                vx: rnd(3, 6),
                vy: rnd(1.2, 3),
                r: rnd(0.6, 2.2),
                a: rnd(0.45, 0.95),
                t: rnd(0, 6.28),
              };
        case "symbol":
          return {
            x: rnd(0, w),
            y: initial ? rnd(0, h) : h + 15,
            vx: rnd(-0.25, 0.25),
            vy: -rnd(0.12, 0.45),
            r: rnd(14, 34),
            a: rnd(0.35, 0.85),
            t: rnd(0, 6.28),
          };
        case "embers":
          return {
            x: rnd(0, w),
            y: y0,
            vx: rnd(-0.3, 0.3),
            vy: -rnd(0.4, 1.4),
            r: rnd(0.8, 2.4),
            a: rnd(0.5, 1),
            t: rnd(0, 6.28),
          };
        case "rain":
          return {
            x: rnd(-50, w),
            y: y0,
            vx: 1.2,
            vy: rnd(7, 12),
            r: rnd(8, 18),
            a: rnd(0.15, 0.4),
            t: 0,
          };
        case "petals":
          return {
            x: rnd(0, w),
            y: y0,
            vx: rnd(0.2, 0.8),
            vy: rnd(0.4, 1),
            r: rnd(3, 6),
            a: rnd(0.5, 0.9),
            t: rnd(0, 6.28),
          };
        case "bubbles":
          return {
            x: rnd(0, w),
            y: y0,
            vx: 0,
            vy: -rnd(0.3, 0.9),
            r: rnd(2, 7),
            a: rnd(0.2, 0.5),
            t: rnd(0, 6.28),
          };
        case "fireflies":
        default:
          return {
            x: rnd(0, w),
            y: rnd(0, h),
            vx: rnd(-0.3, 0.3),
            vy: rnd(-0.3, 0.3),
            r: rnd(1, 2.4),
            a: 0,
            t: rnd(0, 6.28),
          };
      }
    }

    // Code rain keeps columns instead of particles.
    let cols: number[] = [];
    const glyphs = "アイウエオカキクケコサシスセソ0123456789ABCDEF<>/=+*";

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(w * h * (density[effect!] || 0.0001) * intensity);
      parts = Array.from({ length: Math.min(600, n) }, () => spawn(true));
      cols = Array.from({ length: Math.ceil(w / 16) }, () => rnd(-h, 0));
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let last = performance.now();
    const flake = light ? "rgba(71,85,105,1)" : "rgba(255,255,255,1)";
    const glyphFont = (px: number) =>
      `${Math.round(px)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",system-ui,sans-serif`;
    function frame(now: number) {
      const dt = Math.min(3, (now - last) / 16.7);
      last = now;
      if (document.hidden) {
        raf = requestAnimationFrame(frame);
        return;
      }
      ctx!.clearRect(0, 0, w, h);

      if (effect === "matrix") {
        ctx!.font = "14px ui-monospace, monospace";
        for (let i = 0; i < cols.length; i++) {
          const x = i * 16;
          const y = cols[i];
          for (let k = 0; k < 14; k++) {
            const yy = y - k * 16;
            if (yy < -16 || yy > h + 16) continue;
            ctx!.fillStyle =
              k === 0
                ? "rgba(220,255,220,.9)"
                : `rgba(34,197,94,${(0.55 * (1 - k / 14) * intensity).toFixed(3)})`;
            ctx!.fillText(glyphs[(i * 7 + k * 13 + Math.floor(y / 16)) % glyphs.length], x, yy);
          }
          cols[i] += (2 + (i % 5) * 0.6) * dt;
          if (cols[i] - 14 * 16 > h) cols[i] = rnd(-200, 0);
        }
        raf = requestAnimationFrame(frame);
        return;
      }

      // The blizzard's wind comes in gusts.
      const gust =
        effect === "blizzard" ? 1 + 0.55 * Math.sin(now / 2300) + 0.3 * Math.sin(now / 710) : 1;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.t += 0.02 * dt;
        p.x +=
          (p.vx * gust + (effect === "snow" || effect === "petals" ? Math.sin(p.t) * 0.3 : 0)) * dt;
        p.y += p.vy * dt;
        if (effect === "fireflies") {
          p.vx += rnd(-0.03, 0.03);
          p.vy += rnd(-0.03, 0.03);
          p.vx = Math.max(-0.5, Math.min(0.5, p.vx));
          p.vy = Math.max(-0.5, Math.min(0.5, p.vy));
          p.a = 0.5 + 0.5 * Math.sin(p.t * 2);
        }
        const out = p.y > h + 20 || p.y < -20 || p.x < -60 || p.x > w + 60;
        if (out) {
          if (effect === "stars" || effect === "fireflies") {
            p.x = (p.x + w) % w;
            p.y = (p.y + h) % h;
          } else parts[i] = spawn(false);
          continue;
        }
        ctx!.globalAlpha = Math.max(
          0,
          Math.min(1, p.a * (effect === "stars" ? 0.6 + 0.4 * Math.sin(p.t * 3) : 1)),
        );
        switch (effect) {
          case "blizzard": {
            // Streaks along the wind, longer in a gust.
            ctx!.strokeStyle = flake;
            ctx!.lineWidth = p.r;
            ctx!.lineCap = "round";
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(p.x - p.vx * gust * 1.6, p.y - p.vy * 1.6);
            ctx!.stroke();
            break;
          }
          case "symbol":
            ctx!.save();
            ctx!.translate(p.x, p.y);
            ctx!.rotate(Math.sin(p.t) * 0.35);
            ctx!.font = glyphFont(p.r);
            ctx!.textAlign = "center";
            ctx!.textBaseline = "middle";
            ctx!.fillStyle = accent;
            ctx!.fillText(symbol || "✦", 0, 0);
            ctx!.restore();
            break;
          case "rain":
            ctx!.strokeStyle = "rgba(180,200,255,1)";
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(p.x - p.vx * 2, p.y - p.r);
            ctx!.stroke();
            break;
          case "petals":
            ctx!.fillStyle = "#f9a8d4";
            ctx!.save();
            ctx!.translate(p.x, p.y);
            ctx!.rotate(p.t);
            ctx!.beginPath();
            ctx!.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, 6.283);
            ctx!.fill();
            ctx!.restore();
            break;
          case "bubbles":
            ctx!.strokeStyle = "rgba(186,230,253,1)";
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.arc(p.x + Math.sin(p.t) * 4, p.y, p.r, 0, 6.283);
            ctx!.stroke();
            break;
          case "embers": {
            const g = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
            g.addColorStop(0, "rgba(255,200,120,1)");
            g.addColorStop(0.4, "rgba(249,115,22,.7)");
            g.addColorStop(1, "rgba(249,115,22,0)");
            ctx!.fillStyle = g;
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, p.r * 3, 0, 6.283);
            ctx!.fill();
            break;
          }
          case "fireflies": {
            const g = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
            g.addColorStop(0, accent);
            g.addColorStop(1, "transparent");
            ctx!.fillStyle = g;
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, p.r * 5, 0, 6.283);
            ctx!.fill();
            break;
          }
          default:
            ctx!.fillStyle = effect === "snow" ? "#f1f5f9" : "#e2e8f0";
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, p.r, 0, 6.283);
            ctx!.fill();
        }
      }
      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [effect, accent, intensity, symbol, light]);

  if (!effect || effect === "none") return null;
  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        ...style,
      }}
    />
  );
}
