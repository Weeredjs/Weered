"use client";

import React from "react";
import DockShell from "./DockShell";
export default function DockDrawer() {
  const [open, setOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    try { mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply); }
    catch { mq.addListener(apply); return () => mq.removeListener(apply); }
  }, []);

  React.useEffect(() => {
    const onToggle = () => setOpen(v => !v);
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

  // Close on ESC
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!open) return;
    const onKeyDown = (e: any) => { if (e?.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown as any);
    return () => window.removeEventListener("keydown", onKeyDown as any);
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
        style={isMobile ? {
          /* ── Mobile: full-screen like a native app ── */
          position: "fixed",
          top: 0, right: 0, bottom: 0, left: 0,
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
        } : {
          /* ── Desktop: slide-in panel ── */
          position: "fixed" as const,
          top: 12, right: 12, bottom: 12,
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
        }}
      >
        <DockShell forceMode="floating" />
      </div>
    </>
  );
}


