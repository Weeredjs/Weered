"use client";
import React from "react";
import { avatarBg } from "../../lib/avatarColor";
import LinkPreviewCard from "../LinkPreviewCard";

// Pure helpers + small presentational atoms extracted from DockShell.

export const IMG_RE = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;
export const TENOR_DM_RE = /https?:\/\/media\.tenor\.com\/[^\s]+/i;

export function linkify(text: string): React.ReactNode {
  const urlRx = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRx);
  const nodes: React.ReactNode[] = [];
  const images: string[] = [];
  const previews: string[] = [];

  parts.forEach((p, i) => {
    if (urlRx.test(p)) {
      nodes.push(
        <a
          key={i}
          href={p}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "rgb(167,139,250)", textDecoration: "underline", wordBreak: "break-all" }}
        >
          {p}
        </a>,
      );
      if (IMG_RE.test(p) || TENOR_DM_RE.test(p)) images.push(p);
      else previews.push(p);
    } else {
      nodes.push(p);
    }
  });

  return (
    <>
      <div>{nodes}</div>
      {images.map((src, i) => (
        <img
          key={`dm-img-${i}`}
          src={src}
          alt="Chat image"
          loading="lazy"
          style={{
            maxWidth: 200,
            maxHeight: 160,
            borderRadius: 8,
            marginTop: 4,
            border: "1px solid rgba(255,255,255,.1)",
            display: "block",
          }}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      ))}
      {previews.slice(0, 1).map((url, i) => (
        <LinkPreviewCard key={`dm-lp-${i}`} url={url} />
      ))}
    </>
  );
}

export const WEERED_THEME_KEY = "weered_theme_v2";
export type WeeredThemeName =
  | "slate"
  | "zinc"
  | "stone"
  | "gray"
  | "ishimura"
  | "broadcast"
  | "press";

export const WEERED_THEMES: Record<WeeredThemeName, any> = {
  slate: {
    bg: "rgb(2,6,23)",
    panel: "rgba(15,23,42,.92)",
    panel2: "rgba(17,24,39,.94)",
    bd: "rgba(148,163,184,.14)",
    bd2: "rgba(148,163,184,.26)",
    text: "rgba(229,231,235,.96)",
    muted: "rgba(148,163,184,.75)",
    accentBg: "rgba(14,165,233,.18)",
    accentRing: "rgba(14,165,233,.35)",
    accentText: "rgba(56,189,248,.95)",
  },
  zinc: {
    bg: "rgb(9,9,11)",
    panel: "rgba(24,24,27,.92)",
    panel2: "rgba(24,24,27,.94)",
    bd: "rgba(161,161,170,.18)",
    bd2: "rgba(161,161,170,.28)",
    text: "rgba(244,244,245,.96)",
    muted: "rgba(161,161,170,.78)",
    accentBg: "rgba(34,197,94,.16)",
    accentRing: "rgba(34,197,94,.34)",
    accentText: "rgba(74,222,128,.95)",
  },
  stone: {
    bg: "rgb(12,10,9)",
    panel: "rgba(28,25,23,.92)",
    panel2: "rgba(28,25,23,.94)",
    bd: "rgba(168,162,158,.18)",
    bd2: "rgba(168,162,158,.28)",
    text: "rgba(245,245,244,.96)",
    muted: "rgba(168,162,158,.78)",
    accentBg: "rgba(245,158,11,.16)",
    accentRing: "rgba(245,158,11,.34)",
    accentText: "rgba(251,191,36,.95)",
  },
  gray: {
    bg: "rgb(3,7,18)",
    panel: "rgba(17,24,39,.92)",
    panel2: "rgba(17,24,39,.94)",
    bd: "rgba(156,163,175,.18)",
    bd2: "rgba(156,163,175,.28)",
    text: "rgba(243,244,246,.96)",
    muted: "rgba(156,163,175,.78)",
    accentBg: "rgba(20,184,166,.16)",
    accentRing: "rgba(20,184,166,.34)",
    accentText: "rgba(45,212,191,.95)",
  },
  ishimura: {
    bg: "rgb(10,8,6)",
    panel: "rgba(14,12,10,.94)",
    panel2: "rgba(10,8,6,.95)",
    bd: "rgba(212,146,10,.18)",
    bd2: "rgba(212,146,10,.28)",
    text: "rgba(243,234,220,.96)",
    muted: "rgba(180,165,140,.72)",
    accentBg: "rgba(212,146,10,.14)",
    accentRing: "rgba(212,146,10,.30)",
    accentText: "rgba(212,146,10,.95)",
  },
  broadcast: {
    bg: "rgb(14,14,16)",
    panel: "rgba(20,20,22,.95)",
    panel2: "rgba(14,14,16,.96)",
    bd: "rgba(232,168,60,.18)",
    bd2: "rgba(232,168,60,.32)",
    text: "rgba(240,234,216,.96)",
    muted: "rgba(200,190,170,.65)",
    accentBg: "rgba(232,168,60,.14)",
    accentRing: "rgba(232,168,60,.35)",
    accentText: "rgba(240,196,120,.95)",
  },
  press: {
    bg: "rgb(26,26,28)",
    panel: "rgba(32,32,34,.95)",
    panel2: "rgba(22,22,24,.96)",
    bd: "rgba(217,169,66,.16)",
    bd2: "rgba(217,169,66,.30)",
    text: "rgba(240,232,214,.96)",
    muted: "rgba(198,188,168,.65)",
    accentBg: "rgba(217,169,66,.14)",
    accentRing: "rgba(217,169,66,.32)",
    accentText: "rgba(230,190,110,.95)",
  },
};

export function applyWeeredTheme(name: WeeredThemeName) {
  if (typeof document === "undefined") return;
  const t = WEERED_THEMES[name] || WEERED_THEMES.press;
  const root = document.documentElement;
  Object.entries({
    "--weered-bg": t.bg,
    "--weered-panel": t.panel,
    "--weered-panel2": t.panel2,
    "--weered-bd": t.bd,
    "--weered-bd2": t.bd2,
    "--weered-text": t.text,
    "--weered-muted": t.muted,
    "--weered-accent-bg": t.accentBg,
    "--weered-accent-ring": t.accentRing,
    "--weered-accent-text": t.accentText,
  }).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute("data-weered-theme", name);
}

export function __id() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
export function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}
export function normRole(v: any): string {
  const s = String(v || "").trim();
  return s ? s.toUpperCase() : "";
}

export const ROLE_DISPLAY_DOCK: Record<string, string> = {
  GOD: "GODFATHER",
  ADMIN: "LIEUTENANT",
  STAFF: "ENFORCER",
  SUPPORT: "LOOKOUT",
  MOD: "CAPTAIN",
  OWNER: "FOUNDER",
};
export const ROLE_DISPLAY_DOCK_WINDROSE: Record<string, string> = {
  GOD: "ADMIRAL",
  ADMIN: "FIRST MATE",
  STAFF: "BOATSWAIN",
  SUPPORT: "LOOKOUT",
  MOD: "QUARTERMASTER",
  OWNER: "CAPTAIN",
};
export function roleDisplayDock(dbRole: string, lobbyTheme?: string | null): string {
  if (lobbyTheme === "windrose" && ROLE_DISPLAY_DOCK_WINDROSE[dbRole])
    return ROLE_DISPLAY_DOCK_WINDROSE[dbRole];
  return ROLE_DISPLAY_DOCK[dbRole] || dbRole;
}

export function b64UrlDecode(input: string): string {
  try {
    const s = String(input || "")
      .replaceAll(/-/g, "+")
      .replaceAll(/_/g, "/");
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const raw = atob(s + pad);
    return decodeURIComponent(
      Array.prototype.map
        .call(raw, (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
  } catch {
    try {
      return atob(String(input || ""));
    } catch {
      return "";
    }
  }
}
export function decodeJwtClaims(token?: string | null): any {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const j = b64UrlDecode(parts[1]);
    return j ? JSON.parse(j) : null;
  } catch {
    return null;
  }
}

export function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export function fmtRelative(iso: string): string {
  try {
    const now = Date.now();
    const d = new Date(iso).getTime();
    const diff = now - d;
    if (diff < 60_000) return "now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d >= yesterday.getTime() && d < today.getTime()) return "Yesterday";
    if (diff < 604_800_000) return new Date(d).toLocaleDateString("en-US", { weekday: "short" });
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function fmtDateSep(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const t = d.getTime();
    if (t >= today.getTime()) return "Today";
    if (t >= yesterday.getTime()) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export function Avatar({
  name,
  size = 32,
  color,
  isMe,
  chosenColor,
  src,
}: {
  name: string;
  size?: number;
  color?: string;
  isMe?: boolean;
  chosenColor?: string;
  src?: string | null;
}) {
  const bg = color || avatarBg(name, isMe, chosenColor);
  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    userSelect: "none" as const,
    overflow: "hidden",
  };
  if (src) {
    return (
      <div style={{ ...common, background: bg }}>
        <img
          src={src}
          alt={name + " avatar"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>
    );
  }
  return (
    <div
      style={{ ...common, background: bg, fontSize: size * 0.38, fontWeight: 700, color: "#fff" }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: online ? "#22c55e" : "rgba(255,255,255,.2)",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

export function GroupAvatarStack({
  members,
}: {
  members: { id: string; name: string; avatar?: string | null }[];
}) {
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;
  return (
    <div style={{ position: "relative", width: 42, height: 42, flexShrink: 0 }}>
      {shown.map((m, i) => (
        <div
          key={m.id}
          style={{
            position: "absolute",
            left: i * 10,
            top: i * 6,
            width: 26,
            height: 26,
            borderRadius: "50%",
            overflow: "hidden",
            border: "2px solid var(--weered-panel2, #15121d)",
            background: m.avatar ? `url(${m.avatar}) center/cover` : avatarBg(m.name || "?"),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 800,
            color: "#fff",
            zIndex: shown.length - i,
          }}
        >
          {!m.avatar && (m.name || "?").charAt(0).toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <div
          style={{
            position: "absolute",
            left: shown.length * 10,
            top: shown.length * 6,
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "2px solid var(--weered-panel2, #15121d)",
            background: "var(--weered-accent-bg)",
            color: "var(--weered-accent-text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 800,
            zIndex: 0,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

export function UnreadBadge({
  count,
  floating,
  tone,
}: {
  count: number;
  floating?: boolean;
  tone?: "red" | "blue";
}) {
  if (!count) return null;
  const bg = tone === "blue" ? "#3b82f6" : "#ef4444";
  if (floating) {
    return (
      <span
        style={{
          position: "absolute",
          top: -6,
          right: -6,
          minWidth: 16,
          height: 16,
          borderRadius: 999,
          background: bg,
          color: "#fff",
          fontSize: 9,
          fontWeight: 800,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 4px",
          boxShadow: "0 0 0 3px var(--weered-panel, #0f0f15)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        {count > 99 ? "99+" : count}
      </span>
    );
  }
  return (
    <span
      style={{
        minWidth: 18,
        height: 18,
        borderRadius: 999,
        background: bg,
        color: "#fff",
        fontSize: 10,
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 5px",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SegmentedControl({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; badge?: number; tone?: "red" | "blue" }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      className="weered-dock-tabs"
      style={{
        display: "flex",
        background: "rgba(255,255,255,.06)",
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`weered-dock-tab${active === t.id ? " weered-dock-tab-active" : ""}`}
          onClick={() => onChange(t.id)}
          style={{
            position: "relative",
            flex: 1,
            minWidth: 0,
            padding: "6px 8px",
            borderRadius: 8,
            border: "none",
            background:
              active === t.id ? "var(--weered-accent-bg, rgba(124,157,255,.18))" : "transparent",
            color:
              active === t.id
                ? "var(--weered-accent-text, var(--weered-text))"
                : "var(--weered-muted)",
            boxShadow:
              active === t.id
                ? "inset 0 0 0 1px var(--weered-accent-ring, rgba(124,157,255,.35))"
                : "none",
            fontSize: 12,
            fontWeight: active === t.id ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all .15s",
          }}
        >
          {t.label}
          {!!t.badge && <UnreadBadge count={t.badge} floating tone={t.tone || "red"} />}
        </button>
      ))}
    </div>
  );
}
