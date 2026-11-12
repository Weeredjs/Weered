"use client";

// The left sidebar folded away, the way the panel folds to its quick buttons
// (James 2026-11-05: "we are making the left rail collapsible. Same as the
// right. Use icons accordingly"). One icon per section the viewer keeps
// there, in their order: the navigation links go straight to their page,
// Home's ways in do their thing, and the rest open the sidebar at that
// section. Wide screens only (styles/51-start.css): narrower ones already
// fold the sidebar into the icon strip.
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWeered, useRoomUsers } from "../WeeredProvider";
import { useOfficeSkin } from "../useOfficeSkin";
import { isScopedRailLobby } from "../../lib/lobbyChrome";
import { startDesign, useShellDesign } from "../../lib/shellDesign";
import { avatarBg } from "../../lib/avatarColor";
import {
  CORE_META,
  SHELL_BLOCKS,
  isCore,
  keyOf,
  stockShell,
  type CoreId,
  type ShellItem,
} from "../../lib/shellLayout";

const svg = (children: React.ReactNode, fill = false) => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 24 24"
    fill={fill ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);

const ICONS: Partial<Record<CoreId | "lobby" | "home" | "forum", React.ReactNode>> = {
  lobby: svg(
    <>
      <path d="M4 21V9l8-5 8 5v12" />
      <path d="M10 21v-6h4v6" />
    </>,
  ),
  home: svg(
    <>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </>,
  ),
  forum: svg(
    <>
      <path d="M4 5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M19 9h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1v3l-3-3h-5" />
    </>,
  ),
  nav: svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>,
  ),
  presence: svg(
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 21v-1.5A5 5 0 0 1 10.5 14h3a5 5 0 0 1 5 5.5V21" />
    </>,
  ),
  favs: svg(
    <polygon points="12 2.5 14.9 8.5 21.5 9.3 16.7 13.9 17.8 20.5 12 17.3 6.2 20.5 7.3 13.9 2.5 9.3 9.1 8.5 12 2.5" />,
    true,
  ),
  recent: svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  ),
  whoshere: svg(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
      <path d="M17 4.5a3 3 0 0 1 0 6M21 20v-1a5 5 0 0 0-3-4.6" />
    </>,
  ),
  rooms: svg(
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>,
  ),
  friends: svg(
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c.5-3.5 2.5-5 5.5-5s5 1.5 5.5 5" />
      <circle cx="16.5" cy="9" r="2.4" />
      <path d="M15 20.5c.5-3 2-4 4-4 1.3 0 2.3.6 2.7 1.5" />
    </>,
  ),
  crew: svg(
    <>
      <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z" />
      <path d="m9 11 2 2 4-4" />
    </>,
  ),
  discover: svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6M11 8v6M8 11h6" />
    </>,
  ),
  search: svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </>,
  ),
  browse: svg(
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>,
  ),
  create: svg(<path d="M12 5v14M5 12h14" />),
  change: svg(
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>,
  ),
  homechat: svg(
    <>
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M8 10h8M8 13h5" />
    </>,
  ),
};

/** The emoji a section or block wears in Design mode, when it has no drawn icon. */
function glyphOf(it: ShellItem): React.ReactNode {
  if (isCore(it))
    return ICONS[it] ?? <span className="weered-lstack-glyph">{CORE_META[it]?.icon}</span>;
  const meta = SHELL_BLOCKS.find((b) => b.type === it.type);
  return <span className="weered-lstack-glyph">{meta?.icon || "▦"}</span>;
}

function nameOf(it: ShellItem): string {
  if (isCore(it)) return CORE_META[it]?.name || it;
  const title = String(it.props?.title || "").trim();
  return title || SHELL_BLOCKS.find((b) => b.type === it.type)?.name || "Block";
}

export default function LeftRailStack({ onOpen }: { onOpen: (at?: string) => void }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { me, activeRoomId, currentLobbyId, leave } = useWeered() as any;
  const here = useRoomUsers(activeRoomId) as any[];
  const office = useOfficeSkin();
  const design = useShellDesign();
  const layout = office ? stockShell() : design.saved;

  const lobbyId = String(currentLobbyId || "");
  const inCommunity = pathname.startsWith("/lobby") || pathname.startsWith("/room");
  // A branded lobby's sidebar lists its own sections, and the office keeps its
  // desk: there the navigation is one icon that opens the sidebar.
  const platformNav = !office && !(isScopedRailLobby(lobbyId) && inCommunity);
  const lobbyHref =
    lobbyId && lobbyId !== "lobby" ? `/lobby/${encodeURIComponent(lobbyId)}` : "/lobby";

  const name = String(me?.name || me?.username || "");
  const avatar = typeof me?.avatar === "string" && me.avatar ? me.avatar : "";
  const hereCount = (here || []).filter((u: any) => u?.id && u.id !== "operator").length;

  const navLinks = [
    {
      key: "lobby",
      // Outside a lobby the link is the Town Square, so it says so.
      label: lobbyId && lobbyId !== "lobby" ? "Lobby" : "Town Square",
      href: lobbyHref,
      active: pathname.startsWith("/lobby") && !pathname.startsWith("/lobby/create"),
    },
    {
      key: "home",
      label: "Home",
      href: "/home",
      active: pathname === "/home" || pathname === "/",
      // Home leaves the room you're in, the same as the sidebar's link.
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        try {
          leave?.();
        } catch {}
        router.push("/home");
      },
    },
    { key: "forum", label: "Forum", href: "/forum", active: pathname.startsWith("/forum") },
  ] as const;

  const act = (it: ShellItem) => {
    if (it === "browse") window.dispatchEvent(new CustomEvent("weered:lobby:browse"));
    else if (it === "create") router.push("/lobby/create");
    else if (it === "change") {
      // Design lives on Home (ShellDesigner); from anywhere else, go there with it open.
      if (window.location.pathname === "/home") startDesign();
      else router.push("/home?design=1");
    } else onOpen(keyOf(it));
  };

  return (
    <nav className="weered-rail-stack weered-rail-stack-left" aria-label="Sidebar, folded">
      <button
        type="button"
        className="weered-lstack-me"
        title={name ? `${name}: open the sidebar` : "Open the sidebar"}
        onClick={() => onOpen("card")}
        style={
          avatar
            ? { backgroundImage: `url("${avatar.replace(/["\\]/g, "")}")` }
            : { background: avatarBg(name || "?", true) }
        }
      >
        {avatar ? null : (name || "?").slice(0, 1).toUpperCase()}
      </button>

      {layout.left.map((it) => {
        if (it === "card") return null;
        if (it === "nav" && platformNav)
          return (
            <React.Fragment key="nav">
              {navLinks.map((l) => (
                <Link
                  key={l.key}
                  href={l.href}
                  title={l.label}
                  aria-label={l.label}
                  onClick={"onClick" in l ? l.onClick : undefined}
                  className={`weered-lstack-btn${l.active ? " is-active" : ""}`}
                >
                  {ICONS[l.key]}
                </Link>
              ))}
              <span className="weered-lstack-sep" aria-hidden />
            </React.Fragment>
          );
        const label = nameOf(it);
        return (
          <button
            key={keyOf(it)}
            type="button"
            title={label}
            aria-label={label}
            onClick={() => act(it)}
            className="weered-lstack-btn"
          >
            {glyphOf(it)}
            {it === "presence" && hereCount > 0 && (
              <span className="weered-lstack-badge">{hereCount > 99 ? "99+" : hereCount}</span>
            )}
          </button>
        );
      })}

      <button
        type="button"
        title="Open the sidebar"
        onClick={() => onOpen()}
        className="weered-rail-tab weered-rail-tab-glow"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M9 3v18" />
          <polyline points="14 8 17 12 14 16" />
        </svg>
        <span className="weered-rail-tab-label">Menu</span>
      </button>
    </nav>
  );
}
