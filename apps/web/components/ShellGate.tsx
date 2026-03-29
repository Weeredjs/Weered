"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SiteFooter from "./SiteFooter";

const NO_SHELL_ROUTES = ["/login", "/register", "/staff", "/about", "/premium", "/contact"];

// ── Icon strip SVGs (sharp, bold, 20×20 on 24-viewBox) ──────────────────────
const ICO_NAV = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M4 7h16M4 12h12M4 17h16" />
  </svg>
);
const ICO_PRESENCE = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5.5 21v-1.5A5 5 0 0110.5 14h3a5 5 0 015 5.5V21" />
  </svg>
);
const ICO_STAR = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" opacity=".85">
    <polygon points="12 2.5 14.9 8.5 21.5 9.3 16.7 13.9 17.8 20.5 12 17.3 6.2 20.5 7.3 13.9 2.5 9.3 9.1 8.5 12 2.5" />
  </svg>
);
const ICO_CONTROLS = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
  </svg>
);
const ICO_ROOMS = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </svg>
);
const ICO_FRIENDS = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7.5" r="3" />
    <path d="M3 21v-1a5 5 0 015-5h2a5 5 0 015 5v1" />
    <circle cx="17.5" cy="8.5" r="2.5" />
    <path d="M21 21v-.5a4 4 0 00-3-3.85" />
  </svg>
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

// ── Overlay Panel (with swipe-to-close) ─────────────────────────────────────
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
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el || !open) return;

    let start: { x: number; y: number; t: number } | null = null;
    let dx = 0;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, t: Date.now() };
      dx = 0;
      el.style.transition = "none";
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const moveX = e.touches[0].clientX - start.x;
      const moveY = e.touches[0].clientY - start.y;
      if (Math.abs(moveY) > Math.abs(moveX) && dx === 0) { start = null; return; }
      // Left panel: swipe left to close (negative dx). Right panel: swipe right (positive dx).
      const dismiss = side === "left" ? -moveX : moveX;
      if (dismiss > 0) {
        dx = dismiss;
        el.style.transform = side === "left" ? `translateX(${-dx}px)` : `translateX(${dx}px)`;
        el.style.opacity = String(Math.max(0, 1 - dx / 250));
      }
    };

    const onEnd = () => {
      if (!start) return;
      const dt = Date.now() - start.t;
      const velocity = dx / Math.max(1, dt);
      el.style.transition = "transform 220ms ease, opacity 180ms ease";
      if (dx > 80 || velocity > 0.4) {
        el.style.transform = side === "left" ? "translateX(-100%)" : "translateX(100%)";
        el.style.opacity = "0";
        setTimeout(onClose, 200);
      } else {
        el.style.transform = "translateX(0)";
        el.style.opacity = "1";
      }
      start = null;
      dx = 0;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [open, side, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="weered-overlay-backdrop" onClick={onClose} />
      <div ref={panelRef} className={`weered-overlay-panel weered-overlay-panel-${side}`}>
        {/* Close button — visible on mobile where backdrop is covered */}
        <button
          type="button"
          onClick={onClose}
          className="weered-overlay-close"
          aria-label="Close panel"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        {children}
      </div>
    </>
  );
}

// ── Mobile bottom nav (shown <768px) ─────────────────────────────────────
const MOB_ICO_HOME = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10l9-7 9 7v10a2 2 0 01-2 2H5a2 2 0 01-2-2V10z" />
    <path d="M9 22V13h6v9" />
  </svg>
);
const MOB_ICO_DOCK = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    <path d="M8 9h8M8 13h5" opacity=".5" />
  </svg>
);

function MobileNav({
  overlay,
  setOverlay,
}: {
  overlay: "left" | "right" | null;
  setOverlay: React.Dispatch<React.SetStateAction<"left" | "right" | null>>;
}) {
  const router = useRouter();
  return (
    <nav className="weered-mobile-nav">
      <button
        type="button"
        className={`weered-mobile-nav-btn ${overlay === "left" ? "weered-mobile-nav-btn-active" : ""}`}
        onClick={() => setOverlay(o => o === "left" ? null : "left")}
      >
        {ICO_NAV}<span>Menu</span>
      </button>
      <button
        type="button"
        className={`weered-mobile-nav-btn ${overlay === "right" ? "weered-mobile-nav-btn-active" : ""}`}
        onClick={() => setOverlay(o => o === "right" ? null : "right")}
      >
        {ICO_ROOMS}<span>Rooms</span>
      </button>
      <button
        type="button"
        className="weered-mobile-nav-btn"
        onClick={() => { setOverlay(null); router.push("/home"); }}
      >
        {MOB_ICO_HOME}<span>Home</span>
      </button>
      <button
        type="button"
        className="weered-mobile-nav-btn"
        onClick={() => setOverlay(o => o === "left" ? null : "left")}
      >
        {ICO_PRESENCE}<span>People</span>
      </button>
      <button
        type="button"
        className="weered-mobile-nav-btn"
        onClick={() => { setOverlay(null); window.dispatchEvent(new CustomEvent("weered:dock:toggle")); }}
      >
        {MOB_ICO_DOCK}<span>DMs</span>
      </button>
    </nav>
  );
}

// ── Collapse toggle chevron ──────────────────────────────────────────────
const ICO_COLLAPSE_RIGHT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);
const ICO_EXPAND_LEFT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
);

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
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Persist right rail collapse state
  useEffect(() => {
    const saved = localStorage.getItem("weered_right_collapsed");
    if (saved === "1") setRightCollapsed(true);
  }, []);
  const toggleRight = () => {
    setRightCollapsed(v => {
      localStorage.setItem("weered_right_collapsed", v ? "0" : "1");
      return !v;
    });
  };

  if (bare) return (
    <>
      {children}
      <SiteFooter />
    </>
  );

  const NO_FOOTER_ROUTES = ["/room/", "/lobby/"];
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

        {/* Collapse/expand tab — always visible on the right edge */}
        {rightCollapsed ? (
          <button
            type="button"
            title="Expand panel"
            onClick={toggleRight}
            className="weered-rail-tab weered-rail-tab-glow"
          >
            {ICO_EXPAND_LEFT}
          </button>
        ) : (
          <aside className="weered-right">
            {/* Collapse button inside the rail */}
            <button
              type="button"
              title="Collapse panel"
              onClick={toggleRight}
              style={{
                position: "absolute", top: 10, right: 10, zIndex: 2,
                width: 24, height: 24, borderRadius: 6,
                border: "1px solid rgba(255,255,255,.08)",
                background: "rgba(255,255,255,.04)",
                color: "rgba(255,255,255,.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.15s",
                padding: 0,
              }}
            >
              {ICO_COLLAPSE_RIGHT}
            </button>
            {right}
          </aside>
        )}
      </div>

      {/* Overlay panels — triggered by icon strip clicks */}
      <OverlayPanel side="left" open={overlay === "left"} onClose={() => setOverlay(null)}>
        {left}
      </OverlayPanel>
      <OverlayPanel side="right" open={overlay === "right"} onClose={() => setOverlay(null)}>
        {right}
      </OverlayPanel>

      {/* Mobile bottom nav — shown <768px by CSS */}
      <MobileNav overlay={overlay} setOverlay={setOverlay} />

      {!hideFooter && <SiteFooter />}
    </>
  );
}
