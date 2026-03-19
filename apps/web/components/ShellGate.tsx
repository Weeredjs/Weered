"use client";

import React, { useCallback } from "react";
import { usePathname } from "next/navigation";
import { useRailMode } from "./useRailMode";
import SiteFooter from "./SiteFooter";

const NO_SHELL_ROUTES = ["/login", "/register", "/staff", "/about", "/premium", "/contact"];

// ── Icon strip icons ─────────────────────────────────────────────────────────
const ICON_NAV = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
);
const ICON_PRESENCE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
  </svg>
);
const ICON_ROOMS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const ICON_CONTROLS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);
const ICON_FRIENDS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const ICON_STAR = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const LEFT_ICONS = [
  { id: "nav",      icon: ICON_NAV,      label: "Navigate" },
  { id: "presence", icon: ICON_PRESENCE,  label: "Presence" },
  { id: "favs",     icon: ICON_STAR,      label: "Favorites" },
];

const RIGHT_ICONS = [
  { id: "controls", icon: ICON_CONTROLS,  label: "Controls" },
  { id: "rooms",    icon: ICON_ROOMS,     label: "Rooms" },
  { id: "friends",  icon: ICON_FRIENDS,   label: "Friends" },
];

// ── Icon Strip ───────────────────────────────────────────────────────────────
function IconStrip({
  side,
  icons,
  isOverlayOpen,
  onToggle,
}: {
  side: "left" | "right";
  icons: { id: string; icon: React.ReactNode; label: string }[];
  isOverlayOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`weered-icon-strip weered-icon-strip-${side}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "14px 0",
        width: 48,
        flexShrink: 0,
        background: "var(--weered-panel)",
        border: "1px solid var(--weered-border)",
        borderRadius: 16,
        maxHeight: "calc(100vh - 24px)",
        overflow: "hidden",
      }}
    >
      {icons.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          onClick={onToggle}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: "none",
            background: isOverlayOpen ? "rgba(124,58,237,.15)" : "transparent",
            color: isOverlayOpen ? "rgba(167,139,250,.95)" : "rgba(148,163,184,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!isOverlayOpen) {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.06)";
              (e.currentTarget as HTMLElement).style.color = "rgba(243,244,246,.85)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isOverlayOpen) {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,.55)";
            }
          }}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}

// ── Overlay Panel (slides out over content) ──────────────────────────────────
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

  const posStyle: React.CSSProperties = side === "left"
    ? { left: 60, right: "auto" }
    : { right: 60, left: "auto" };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.35)",
          zIndex: 999,
          backdropFilter: "blur(2px)",
          animation: "weeredFadeIn 0.15s ease-out",
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 12,
          bottom: 12,
          ...posStyle,
          width: side === "left" ? 320 : 340,
          zIndex: 1000,
          background: "var(--weered-panel)",
          border: "1px solid var(--weered-border)",
          borderRadius: 16,
          overflow: "auto",
          overflowX: "hidden",
          boxShadow: "0 16px 48px rgba(0,0,0,.55)",
          animation: side === "left"
            ? "weeredSlideInLeft 0.2s cubic-bezier(0.22,1,0.36,1)"
            : "weeredSlideInRight 0.2s cubic-bezier(0.22,1,0.36,1)",
          scrollbarWidth: "thin" as any,
          scrollbarColor: "rgba(148,163,184,.2) transparent",
        }}
      >
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
    (r) => pathname === r || pathname.startsWith(r + "/") || pathname.startsWith(r + "?")
  );

  const railMode = useRailMode();

  if (bare)
    return (
      <>
        {children}
        <SiteFooter />
      </>
    );

  const NO_FOOTER_ROUTES = ["/room/"];
  const hideFooter = NO_FOOTER_ROUTES.some((r) => pathname.startsWith(r));

  const toggleLeft = useCallback(() => {
    railMode.setOverlay(railMode.overlay === "left" ? null : "left");
  }, [railMode.overlay, railMode.setOverlay]);

  const toggleRight = useCallback(() => {
    railMode.setOverlay(railMode.overlay === "right" ? null : "right");
  }, [railMode.overlay, railMode.setOverlay]);

  const closeOverlay = useCallback(() => {
    railMode.setOverlay(null);
  }, [railMode.setOverlay]);

  return (
    <>
      <div className="weered-shell">
        {/* Left rail — full or icon strip */}
        {railMode.left === "full" ? (
          <aside className="weered-left">{left}</aside>
        ) : railMode.left === "icons" ? (
          <IconStrip
            side="left"
            icons={LEFT_ICONS}
            isOverlayOpen={railMode.overlay === "left"}
            onToggle={toggleLeft}
          />
        ) : null}

        {/* Center content */}
        <main className="weered-center">{children}</main>

        {/* Right rail — full or icon strip */}
        {railMode.right === "full" ? (
          <aside className="weered-right">{right}</aside>
        ) : railMode.right === "icons" ? (
          <IconStrip
            side="right"
            icons={RIGHT_ICONS}
            isOverlayOpen={railMode.overlay === "right"}
            onToggle={toggleRight}
          />
        ) : null}
      </div>

      {/* Overlay panels */}
      <OverlayPanel side="left" open={railMode.overlay === "left"} onClose={closeOverlay}>
        {left}
      </OverlayPanel>
      <OverlayPanel side="right" open={railMode.overlay === "right"} onClose={closeOverlay}>
        {right}
      </OverlayPanel>

      {!hideFooter && <SiteFooter />}
    </>
  );
}
