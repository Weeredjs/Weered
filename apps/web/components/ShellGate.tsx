"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SiteFooter from "./SiteFooter";

function LeftRailScroll({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);

  return (
    <aside
      className="weered-left"
      data-rail-hover={hovered ? "1" : "0"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <style>{`
        .weered-left {
          overflow-y: scroll !important;
          overflow-x: hidden !important;
          scrollbar-gutter: stable !important;
          scrollbar-width: thin !important;
          scrollbar-color: transparent transparent !important;
        }
        .weered-left::-webkit-scrollbar { width: 6px !important; }
        .weered-left::-webkit-scrollbar-track { background: transparent !important; }
        .weered-left::-webkit-scrollbar-thumb { background: transparent !important; border: none !important; background-clip: unset !important; }
        .weered-left[data-rail-hover="1"] {
          scrollbar-color: rgba(148,163,184,.25) transparent !important;
        }
        .weered-left[data-rail-hover="1"]::-webkit-scrollbar-thumb {
          background: rgba(148,163,184,.25) !important;
          border-radius: 999px !important;
        }
      `}</style>
      {children}
    </aside>
  );
}

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

const MOB_ICO_PANEL = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <circle cx="17.5" cy="17.5" r="3.5" />
    <path d="M17.5 15.5v4M15.5 17.5h4" opacity=".7" />
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
        className="weered-mobile-nav-btn"
        onClick={() => { setOverlay(null); router.push("/home"); }}
      >
        {MOB_ICO_HOME}<span>Home</span>
      </button>
      <button
        type="button"
        className={`weered-mobile-nav-btn ${overlay === "right" ? "weered-mobile-nav-btn-active" : ""}`}
        onClick={() => setOverlay(o => o === "right" ? null : "right")}
      >
        {MOB_ICO_PANEL}<span>Panel</span>
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
        <LeftRailScroll>{left}</LeftRailScroll>

        {/* Left icon strip — shown by CSS at mid/narrow breakpoints */}
        <IconStrip
          side="left"
          icons={LEFT_ICONS}
          active={overlay === "left"}
          onToggle={() => setOverlay(o => o === "left" ? null : "left")}
        />

        <main className="weered-center">{children}</main>

        {/* Collapse/expand tab — always visible on the right edge, with a
            vertical stack of quick-launch buttons above it that each open
            a specific Burner tab. Hidden when the rail is expanded. */}
        {rightCollapsed ? (
          <div className="weered-rail-stack">
            {/* Logo at the top of the collapsed rail — fills the otherwise-empty
                space and gives the collapsed shell a brand anchor. */}
            <a href="/home" className="weered-rail-logo" title="Home">
              <img src="/brand/logo/weered-shieldlogo-512.png" alt="Weered" />
            </a>
            <RailQuickButton
              kind="crew"
              label="Crew"
              title="Open Crew"
              onClick={() => { try { window.dispatchEvent(new CustomEvent("weered:dock:open", { detail: { tab: "crew" } })); } catch {} }}
            />
            <RailQuickButton
              kind="friends"
              label="Friends"
              title="Open Friends"
              onClick={() => { try { window.dispatchEvent(new CustomEvent("weered:dock:open", { detail: { tab: "friends" } })); } catch {} }}
            />
            <RailQuickButton
              kind="dms"
              label="DMs"
              title="Open Messages"
              onClick={() => { try { window.dispatchEvent(new CustomEvent("weered:dock:open", { detail: { tab: "dms" } })); } catch {} }}
            />
            <button
              type="button"
              title="Expand panel"
              onClick={toggleRight}
              className="weered-rail-tab weered-rail-tab-glow"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M15 3v18" /><polyline points="10 8 7 12 10 16" /></svg>
              <span className="weered-rail-tab-label">Panel</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="2" /><circle cx="12" cy="5" r="2" /><circle cx="12" cy="19" r="2" /></svg>
            </button>
          </div>
        ) : (
          <aside className="weered-right">
            {/* Collapse button — prominent, top-right */}
            <button
              type="button"
              title="Hide panel"
              onClick={toggleRight}
              className="weered-rail-close"
            >
              {ICO_COLLAPSE_RIGHT}
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".5px" }}>HIDE</span>
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

// ── Rail-side quick-launch buttons ──────────────────────────────────────────
// Stacked above the collapsed Panel tab. Each fires weered:dock:open with a
// specific tab so the Burner comes up pre-targeted. Hidden on mobile/narrow
// where the mobile nav already serves this role.
type QuickKind = "crew" | "friends" | "dms";

function RailQuickButton({
  kind, label, title, onClick,
}: { kind: QuickKind; label: string; title: string; onClick: () => void }) {
  const palette = QUICK_PALETTE[kind];
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="weered-rail-quick"
      style={{
        background: palette.bg,
        borderColor: palette.border,
        boxShadow: `0 0 16px ${palette.glow}, inset 0 1px 0 rgba(255,255,255,.12), inset 0 -1px 0 rgba(0,0,0,.35)`,
        color: palette.fg,
      }}
    >
      <span className="weered-rail-quick-icon">
        {kind === "crew" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* shield crest */}
            <path d="M12 3 L20 6 V12 C20 16.5 16.5 20 12 21 C7.5 20 4 16.5 4 12 V6 Z" />
            <path d="M9 11 L11 13 L15 9" />
          </svg>
        ) : kind === "friends" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* two people */}
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3.5 20 C4 16.5 6 15 9 15 C12 15 14 16.5 14.5 20" />
            <circle cx="16.5" cy="9" r="2.4" />
            <path d="M15 20.5 C15.5 17.5 17 16.5 19 16.5 C20.3 16.5 21.3 17.1 21.7 18" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* message bubble */}
            <path d="M4 6 C4 4.9 4.9 4 6 4 H18 C19.1 4 20 4.9 20 6 V15 C20 16.1 19.1 17 18 17 H11 L7 21 V17 H6 C4.9 17 4 16.1 4 15 Z" />
            <line x1="8" y1="9" x2="16" y2="9" opacity=".6" />
            <line x1="8" y1="12" x2="14" y2="12" opacity=".6" />
          </svg>
        )}
      </span>
      <span className="weered-rail-quick-label">{label}</span>
    </button>
  );
}

const QUICK_PALETTE: Record<QuickKind, { bg: string; border: string; glow: string; fg: string }> = {
  crew:    { bg: "linear-gradient(180deg, rgba(217,169,66,0.25) 0%, rgba(138,107,62,0.32) 100%)",   border: "rgba(217,169,66,0.55)",  glow: "rgba(217,169,66,0.18)", fg: "#f3d48a" },
  friends: { bg: "linear-gradient(180deg, rgba(52,211,153,0.22) 0%, rgba(16,122,88,0.30) 100%)",    border: "rgba(52,211,153,0.50)",  glow: "rgba(52,211,153,0.16)", fg: "#a7f3d0" },
  dms:     { bg: "linear-gradient(180deg, rgba(167,139,250,0.26) 0%, rgba(124,58,237,0.32) 100%)",  border: "rgba(167,139,250,0.52)", glow: "rgba(124,58,237,0.22)", fg: "#d8caff" },
};
