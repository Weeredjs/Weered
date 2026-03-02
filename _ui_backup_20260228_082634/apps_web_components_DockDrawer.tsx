"use client";

import React from "react";
import DockShell from "./DockShell";
export default function DockDrawer() {
  const [open, setOpen] = React.useState(false);

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

  
  // Close on ESC (feels like a real drawer)
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!open) return;

    const onKeyDown = (e: any) => {
      if (e?.key === "Escape") setOpen(false);
    };

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
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          bottom: 12,
          width: 420,
          maxWidth: "min(420px, calc(100vw - 24px))",
          transform: open ? "translateX(0)" : "translateX(110%)",
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          transition: "transform 220ms ease, opacity 180ms ease",
          zIndex: 30000,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <DockShell forceMode="floating" />
      </div>
    </>
  );
}
