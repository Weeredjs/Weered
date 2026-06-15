"use client";

import React from "react";
import DockShell from "./DockShell";

function useSwipeClose(
  ref: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
  enabled: boolean,
) {
  const touch = React.useRef<{ x: number; y: number; t: number } | null>(null);
  const offset = React.useRef(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
      offset.current = 0;
      el.style.transition = "none";
    };

    const onMove = (e: TouchEvent) => {
      if (!touch.current) return;
      const dx = e.touches[0].clientX - touch.current.x;
      const dy = e.touches[0].clientY - touch.current.y;
      if (Math.abs(dy) > Math.abs(dx) && offset.current === 0) {
        touch.current = null;
        return;
      }
      if (dx > 0) {
        offset.current = dx;
        el.style.transform = `translateX(${dx}px)`;
        el.style.opacity = String(Math.max(0, 1 - dx / 300));
      }
    };

    const onEnd = () => {
      if (!touch.current) return;
      const dx = offset.current;
      const dt = Date.now() - touch.current.t;
      const velocity = dx / Math.max(1, dt);

      el.style.transition = "transform 220ms ease, opacity 180ms ease";

      if (dx > 100 || velocity > 0.4) {
        el.style.transform = "translateX(100%)";
        el.style.opacity = "0";
        setTimeout(onClose, 200);
      } else {
        el.style.transform = "translateX(0)";
        el.style.opacity = "1";
      }
      touch.current = null;
      offset.current = 0;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [ref, onClose, enabled]);
}

export default function DockDrawer() {
  const [open, setOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  useSwipeClose(panelRef, () => setOpen(false), open);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    try {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } catch {
      mq.addListener(apply);
      return () => mq.removeListener(apply);
    }
  }, []);

  React.useEffect(() => {
    const onToggle = () => setOpen((v) => !v);
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    window.addEventListener("weered:dock:toggle", onToggle as any);
    window.addEventListener("weered:dock:open", onOpen as any);
    window.addEventListener("weered:dock:close", onClose as any);
    return () => {
      window.removeEventListener("weered:dock:toggle", onToggle as any);
      window.removeEventListener("weered:dock:open", onOpen as any);
      window.removeEventListener("weered:dock:close", onClose as any);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!open) return;
    const onKeyDown = (e: any) => {
      if (e?.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown as any);
    return () => window.removeEventListener("keydown", onKeyDown as any);
  }, [open]);

  React.useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.style.transition = "transform 220ms ease, opacity 180ms ease";
      panelRef.current.style.transform = "translateX(0)";
      panelRef.current.style.opacity = "1";
    }
  }, [open]);

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 180ms ease",
          zIndex: 25000,
        }}
      />

      <div
        ref={panelRef}
        style={
          isMobile
            ? {
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                width: "100%",
                background: "var(--weered-panel2)",
                border: "none",
                borderRadius: 0,
                overflow: "hidden",
                transform: open ? "translateX(0)" : "translateX(100%)",
                opacity: open ? 1 : 0,
                visibility: open ? ("visible" as const) : ("hidden" as const),
                transition: "transform 220ms ease, opacity 180ms ease",
                zIndex: 30000,
                pointerEvents: open ? ("auto" as const) : ("none" as const),
              }
            : {
                position: "fixed" as const,
                top: 12,
                right: 12,
                bottom: 12,
                width: 420,
                maxWidth: "min(420px, calc(100vw - 24px))",
                background: "var(--weered-panel2)",
                border: "1px solid var(--weered-bd2)",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 18px 60px rgba(0,0,0,.55)",
                transform: open ? "translateX(0)" : "translateX(110%)",
                opacity: open ? 1 : 0,
                visibility: open ? ("visible" as const) : ("hidden" as const),
                transition: "transform 220ms ease, opacity 180ms ease",
                zIndex: 30000,
                pointerEvents: open ? ("auto" as const) : ("none" as const),
              }
        }
      >
        <DockShell forceMode="floating" />
      </div>
    </>
  );
}
