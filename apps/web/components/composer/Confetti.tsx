"use client";

// A one-shot confetti burst on a full-screen canvas. Bump `fire` to launch;
// `onDone` runs when the last piece has fallen (or at once for reduced motion).
import React, { useEffect, useRef } from "react";

type Bit = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  shape: 0 | 1;
};

export default function Confetti({
  fire,
  origin,
  colors,
  onDone,
}: {
  fire: number;
  /** Viewport point the burst leaves from; defaults to the lower middle. */
  origin?: { x: number; y: number } | null;
  colors: string[];
  onDone?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const colorsRef = useRef(colors);
  colorsRef.current = colors;
  const originRef = useRef(origin);
  originRef.current = origin;

  useEffect(() => {
    if (!fire) return;
    const canvas = ref.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || reduce) {
      doneRef.current?.();
      return;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const o = originRef.current || { x: W / 2, y: H * 0.8 };
    const pal = colorsRef.current.length ? colorsRef.current : ["#7c3aed", "#fff"];
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const bits: Bit[] = [];
    // Two bursts: a tight fountain from the button and a wide spray from the top corners.
    for (let i = 0; i < 170; i++) {
      const ang = rnd(-Math.PI * 0.85, -Math.PI * 0.15);
      const sp = rnd(7, 17);
      bits.push({
        x: o.x,
        y: o.y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        w: rnd(5, 10),
        h: rnd(8, 14),
        rot: rnd(0, 6.28),
        vr: rnd(-0.3, 0.3),
        color: pal[i % pal.length],
        shape: Math.random() < 0.3 ? 1 : 0,
      });
    }
    for (let i = 0; i < 60; i++) {
      const left = i % 2 === 0;
      bits.push({
        x: left ? 0 : W,
        y: rnd(0, H * 0.2),
        vx: (left ? 1 : -1) * rnd(4, 11),
        vy: rnd(-4, 2),
        w: rnd(5, 9),
        h: rnd(8, 13),
        rot: rnd(0, 6.28),
        vr: rnd(-0.3, 0.3),
        color: pal[(i + 2) % pal.length],
        shape: Math.random() < 0.3 ? 1 : 0,
      });
    }

    let raf = 0;
    let last = performance.now();
    const start = last;
    function frame(now: number) {
      const dt = Math.min(2.5, (now - last) / 16.7);
      last = now;
      ctx!.clearRect(0, 0, W, H);
      let alive = 0;
      const fade = Math.max(0, 1 - Math.max(0, now - start - 1600) / 900);
      for (const b of bits) {
        b.vy += 0.32 * dt;
        b.vx *= 0.985;
        b.vy *= 0.985;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rot += b.vr * dt;
        if (b.y > H + 30) continue;
        alive++;
        ctx!.save();
        ctx!.globalAlpha = fade;
        ctx!.translate(b.x, b.y);
        ctx!.rotate(b.rot);
        ctx!.scale(1, Math.cos(b.rot * 2.3));
        ctx!.fillStyle = b.color;
        if (b.shape === 1) {
          ctx!.beginPath();
          ctx!.arc(0, 0, b.w / 2, 0, 6.283);
          ctx!.fill();
        } else ctx!.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx!.restore();
      }
      if (alive > 0 && fade > 0) raf = requestAnimationFrame(frame);
      else {
        ctx!.clearRect(0, 0, W, H);
        doneRef.current?.();
      }
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [fire]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 10000,
      }}
    />
  );
}
