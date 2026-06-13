"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SiteFooter from "./SiteFooter";
import { LogoMenu } from "./LogoMenu";

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

const NO_SHELL_ROUTES = ["/", "/login", "/register", "/staff", "/about", "/premium", "/contact", "/mods", "/apply", "/desktop", "/why-not-discord", "/alternatives", "/tournaments", "/play", "/compare", "/lfg", "/explore", "/overlay", "/terms", "/privacy", "/guidelines", "/forgot-password", "/reset-password", "/verify-email", "/media-policy", "/safety", "/features", "/blog"];

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

const ICO_COLLAPSE_RIGHT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);
const ICO_EXPAND_LEFT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
);

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

  useEffect(() => {
    const parts = pathname.split("/").filter(Boolean);
    const isLobbyView = parts[0] === "lobby" && parts.length === 2 && parts[1] !== "create";
    if (isLobbyView) return;
    const forceFull = new URLSearchParams(window.location.search).get("chrome") === "full";
    const d = document.documentElement;
    if (!bare && !forceFull) d.setAttribute("data-weered-chrome", "min");
    else d.removeAttribute("data-weered-chrome");
  }, [pathname, bare]);

  const [overlay, setOverlay] = useState<"left" | "right" | null>(null);
  const [rightCollapsed, setRightCollapsed] = useState(true);

  const [dmUnreadOnly, setDmUnreadOnly] = useState<number>(() => {
    try { return Math.max(0, Number(localStorage.getItem("weered:dock:unread")) || 0); }
    catch { return 0; }
  });
  const [groupUnread, setGroupUnread] = useState<number>(0);
  const dmUnread = dmUnreadOnly + groupUnread;
  useEffect(() => {
    const onDm = (e: Event) => {
      setDmUnreadOnly(Math.max(0, Number((e as CustomEvent).detail?.count) || 0));
    };
    const onGroup = (e: Event) => {
      setGroupUnread(Math.max(0, Number((e as CustomEvent).detail?.count) || 0));
    };
    window.addEventListener("weered:dock:unread", onDm);
    window.addEventListener("weered:groups:unread", onGroup);
    return () => {
      window.removeEventListener("weered:dock:unread", onDm);
      window.removeEventListener("weered:groups:unread", onGroup);
    };
  }, []);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
    let cancelled = false;
    const tick = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("weered_token") || "" : "";
        if (!token) return;
        const r = await fetch(`${API}/groups`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        const total = (j?.threads || []).reduce((s: number, t: any) => s + (Number(t?.unread) || 0), 0);
        setGroupUnread(Math.max(0, total));
      } catch {}
    };
    void tick();
    const id = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("weered_right_collapsed");
    if (saved === "0") setRightCollapsed(false);
    else if (saved === "1") setRightCollapsed(true);
  }, []);
  const toggleRight = () => {
    setRightCollapsed(v => {
      localStorage.setItem("weered_right_collapsed", v ? "0" : "1");
      return !v;
    });
  };

  if (bare) {
    const isOverlay = pathname.startsWith("/overlay");
    return (
      <>
        <div className="legal-root" aria-hidden="true" style={{ display: "none" }} />
        {children}
        {!isOverlay && <SiteFooter />}
      </>
    );
  }

  const NO_FOOTER_ROUTES = ["/room/", "/lobby/"];
  const hideFooter = NO_FOOTER_ROUTES.some(r => pathname.startsWith(r));

  return (
    <>
      <div className={`weered-shell${hideFooter ? "" : " has-footer"}`}>
        <LeftRailScroll>{left}</LeftRailScroll>

        <IconStrip
          side="left"
          icons={LEFT_ICONS}
          active={overlay === "left"}
          onToggle={() => setOverlay(o => o === "left" ? null : "left")}
        />

        <main className="weered-center">{children}</main>

        {rightCollapsed ? (
          <div className="weered-rail-stack">
            <LogoMenu />
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
              title={
                dmUnread > 0
                  ? `${dmUnreadOnly > 0 ? `${dmUnreadOnly} DM${dmUnreadOnly === 1 ? "" : "s"}` : ""}${dmUnreadOnly > 0 && groupUnread > 0 ? " · " : ""}${groupUnread > 0 ? `${groupUnread} group` : ""} unread`
                  : "Open Messages"
              }
              badge={dmUnreadOnly}
              groupBadge={groupUnread}
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

      <OverlayPanel side="left" open={overlay === "left"} onClose={() => setOverlay(null)}>
        {left}
      </OverlayPanel>
      <OverlayPanel side="right" open={overlay === "right"} onClose={() => setOverlay(null)}>
        {right}
      </OverlayPanel>

      <MobileNav overlay={overlay} setOverlay={setOverlay} />

      {!hideFooter && <SiteFooter />}
    </>
  );
}

type QuickKind = "crew" | "friends" | "dms";

function RailQuickButton({
  kind, label, title, onClick, badge, groupBadge,
}: { kind: QuickKind; label: string; title: string; onClick: () => void; badge?: number; groupBadge?: number }) {
  const palette = QUICK_PALETTE[kind];
  const hot = ((badge ?? 0) + (groupBadge ?? 0)) > 0;
  const hasGroup = (groupBadge ?? 0) > 0;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`weered-rail-quick${hot ? " is-hot" : ""}`}
      style={{
        background: palette.bg,
        borderColor: palette.border,
        boxShadow: `0 0 16px ${palette.glow}, inset 0 1px 0 rgba(255,255,255,.12), inset 0 -1px 0 rgba(0,0,0,.35)`,
        color: palette.fg,
        position: "relative",
      }}
    >
      {(badge ?? 0) > 0 && (
        <span className="weered-rail-quick-badge">{badge! > 99 ? "99+" : badge}</span>
      )}
      {hasGroup && (
        <span
          className="weered-rail-quick-group-dot"
          title={`${groupBadge} group unread`}
          style={{
            position: "absolute",
            top: 18, right: -3,
            width: 9, height: 9, borderRadius: 999,
            background: "#3b82f6",
            border: "2px solid rgba(10,10,15,.9)",
            boxShadow: "0 0 8px rgba(59,130,246,.6)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />
      )}
      <span className="weered-rail-quick-icon">
        {kind === "crew" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 L20 6 V12 C20 16.5 16.5 20 12 21 C7.5 20 4 16.5 4 12 V6 Z" />
            <path d="M9 11 L11 13 L15 9" />
          </svg>
        ) : kind === "friends" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3.5 20 C4 16.5 6 15 9 15 C12 15 14 16.5 14.5 20" />
            <circle cx="16.5" cy="9" r="2.4" />
            <path d="M15 20.5 C15.5 17.5 17 16.5 19 16.5 C20.3 16.5 21.3 17.1 21.7 18" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
