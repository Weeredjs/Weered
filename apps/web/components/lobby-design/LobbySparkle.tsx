"use client";

// Cursor sparkle: a short trail of accent-coloured glints behind the pointer
// inside a designed lobby. Pure fun; off for touch, and when the viewer turns
// animations off unless the lobby forces its effects on (lib/motion.ts).
import { useEffect } from "react";
import { useMotionOff } from "../../lib/motion";

export default function LobbySparkle({
  accent,
  scope = ".weered-lobby-page",
  forced = false,
}: {
  accent: string;
  scope?: string;
  forced?: boolean;
}) {
  const still = useMotionOff(forced);
  useEffect(() => {
    if (still) return;
    if (window.matchMedia?.("(pointer: coarse)").matches) return;
    const root = document.querySelector(scope) as HTMLElement | null;
    if (!root) return;
    let last = 0;
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - last < 28) return;
      last = now;
      const s = document.createElement("span");
      const size = 4 + Math.random() * 6;
      s.setAttribute("aria-hidden", "true");
      s.style.cssText = `position:fixed;left:${e.clientX - size / 2}px;top:${e.clientY - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;pointer-events:none;z-index:9999;background:${accent};box-shadow:0 0 ${size * 2}px ${accent};transition:transform .7s ease-out, opacity .7s ease-out;`;
      document.body.appendChild(s);
      requestAnimationFrame(() => {
        s.style.transform = `translate(${(Math.random() - 0.5) * 30}px, ${10 + Math.random() * 24}px) scale(.2)`;
        s.style.opacity = "0";
      });
      setTimeout(() => s.remove(), 750);
    };
    root.addEventListener("pointermove", onMove);
    return () => root.removeEventListener("pointermove", onMove);
  }, [accent, scope, still]);
  return null;
}
