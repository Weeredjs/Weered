"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import SiteFooter from "./SiteFooter";

const NO_SHELL_ROUTES = ["/login", "/register", "/staff", "/about", "/premium", "/contact"];

// ── Icon strip SVGs ──────────────────────────────────────────────────────────
const ICO_NAV = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
);
const ICO_PRESENCE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" /></svg>
);
const ICO_STAR = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
);
const ICO_CONTROLS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
);
const ICO_ROOMS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
);
const ICO_FRIENDS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
);

const LEFT_ICONS  = [
  { id: "nav",      icon: ICO_NAV,      label: "Navigate" },
  { id: "presence", icon: ICO_PRESENCE,  label: "Presence" },
  { id: "favs",     icon: ICO_STAR,      label: "Favorites" },
];
const RIGHT_ICONS = [
  { id: "controls", icon: ICO_CONTROLS,  label: "Controls" },
  { id: "rooms",    icon: ICO_ROOMS,     label: "Rooms" },
  { id: "friends",  icon: ICO_FRIENDS,   label: "Friends" },
];

// ── Icon Strip ───────────────────────────────────────────────────────────────
function IconStrip({
  side,
  icons,
  active,
  onToggle,
}: {
  side: "left" | "right";
  icons: { id: string; icon: React.ReactNode; label: string }[];
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`weered-icon-strip weered-icon-strip-${side}`}>
      {icons.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          onClick={onToggle}
          className={`weered-icon-strip-btn ${active ? "weered-icon-strip-btn-active" : ""}`}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}

// ── Overlay Panel ────────────────────────────────────────────────────────────
function OverlayPanel({
  side,
  open,
  onClose,
  children,
}: {
  side: "left" | "right";
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="weered-overlay-backdrop" onClick={onClose} />
      <div className={`weered-overlay-panel weered-overlay-panel-${side}`}>
        {children}
      </div>
    </>
  );
}

// ── ShellGate ────────────────────────────────────────────────────────────────
export default function ShellGate({
  left,
  right,
  children,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const bare = NO_SHELL_ROUTES.some(
    r => pathname === r || pathname.startsWith(r + "/") || pathname.startsWith(r + "?")
  );

  const [overlay, setOverlay] = useState<"left" | "right" | null>(null);

  if (bare) return (
    <>
      {children}
      <SiteFooter />
    </>
  );

  const NO_FOOTER_ROUTES = ["/room/"];
  const hideFooter = NO_FOOTER_ROUTES.some(r => pathname.startsWith(r));

  return (
    <>
      <div className="weered-shell">
        {/* Full left rail — hidden by CSS at mid/narrow breakpoints */}
        <aside className="weered-left">{left}</aside>

        {/* Left icon strip — shown by CSS at mid/narrow breakpoints */}
        <IconStrip
          side="left"
          icons={LEFT_ICONS}
          active={overlay === "left"}
          onToggle={() => setOverlay(o => o === "left" ? null : "left")}
        />

        <main className="weered-center">{children}</main>

        {/* Right icon strip — shown by CSS at mid/narrow breakpoints */}
        <IconStrip
          side="right"
          icons={RIGHT_ICONS}
          active={overlay === "right"}
          onToggle={() => setOverlay(o => o === "right" ? null : "right")}
        />

        {/* Full right rail — hidden by CSS at mid/narrow breakpoints */}
        <aside className="weered-right">{right}</aside>
      </div>

      {/* Overlay panels — triggered by icon strip clicks */}
      <OverlayPanel side="left" open={overlay === "left"} onClose={() => setOverlay(null)}>
        {left}
      </OverlayPanel>
      <OverlayPanel side="right" open={overlay === "right"} onClose={() => setOverlay(null)}>
        {right}
      </OverlayPanel>

      {!hideFooter && <SiteFooter />}
    </>
  );
}
