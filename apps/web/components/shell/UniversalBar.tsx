"use client";

// The bar at the top of every page (James 2026-11-06: "Combine them. Just have
// that universal bar the same everywhere. Use the formatting from the lobby
// version. Just a search field. No people or rooms. Just search that taps into
// everything"). Where you are, one search for everything, then Browse and
// Invite, and Report where there's a lobby to report. It is the lobby header's
// look, kept: a lobby's theme still dresses .weered-lobby-header-row. ShellGate
// puts it over every page in the frame; a page names its place with
// useShellPlace (lib/shellPlace.ts). Styled in styles/42-bar.css.

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import InviteModal from "../InviteModal";
import SteamLobbyHeader from "../SteamLobbyHeader";
import WeeredGuide from "../guide/WeeredGuide";
import UniversalSearch, { GUIDE_EVENT } from "../search/UniversalSearch";
import { useWeered } from "../WeeredProvider";
import { useOverlay } from "../overlays/OverlayProvider";
import { ui } from "../weeredUi";
import { onActivate } from "@/lib/a11y";
import { weeredReport } from "../../lib/report";
import { weeredToast } from "../../lib/toast";
import { startDesign } from "../../lib/shellDesign";
import { useBarPlace, type ShellPlace } from "../../lib/shellPlace";

// Lobbies whose logo replays their intro.
const HAS_SPLASH = new Set(["windrose", "destiny2"]);

// On a phone Browse and Invite go to icons, so the search keeps its room.
const ICO_BROWSE = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinejoin="round"
  >
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </svg>
);
const ICO_INVITE = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9.5" cy="8" r="3.5" />
    <path d="M3 20v-1a5 5 0 015-5h3a5 5 0 015 5v1M19 8v6M16 11h6" />
  </svg>
);

export default function UniversalBar() {
  const pathname = usePathname() || "";
  const place = useBarPlace(pathname);
  const router = useRouter();
  const { openSheet } = useOverlay() as any;
  const w = useWeered() as any;
  const [inviting, setInviting] = React.useState(false);
  const [guide, setGuide] = React.useState(false);

  React.useEffect(() => {
    const open = () => setGuide(true);
    window.addEventListener(GUIDE_EVENT, open);
    return () => window.removeEventListener(GUIDE_EVENT, open);
  }, []);

  const accent = place.accentColor || undefined;
  // The Lobby is everyone's: an invite there is to Weered, and nobody reports it.
  const lobbyId = place.lobbyId && place.lobbyId !== "lobby" ? place.lobbyId : undefined;
  const invite =
    place.kind === "room" && place.roomId
      ? { type: "ROOM" as const, targetId: place.roomId, targetName: place.roomName || place.title }
      : place.kind === "crew" && place.crewId
        ? { type: "CREW" as const, targetId: place.crewId, targetName: place.title }
        : place.kind === "lobby" && lobbyId
          ? { type: "LOBBY" as const, targetId: lobbyId, targetName: place.title }
          : { type: "PLATFORM" as const };

  return (
    <header className={`${ui.panel} weered-ubar`} data-place={place.kind}>
      {accent && (
        <div
          className="weered-ubar-accent"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}66 30%, ${accent} 50%, ${accent}66 70%, transparent)`,
          }}
        />
      )}
      <div className="weered-lobby-header-row weered-ubar-row">
        <PlaceMark place={place} />

        <div className="weered-ubar-search" data-guest-hide>
          <UniversalSearch />
        </div>

        <div className="weered-ubar-actions">
          <button
            type="button"
            className="weered-btn"
            data-guest-hide
            aria-label="Browse"
            onClick={() => window.dispatchEvent(new CustomEvent("weered:lobby:browse"))}
          >
            <span className="weered-ubar-ico" aria-hidden>
              {ICO_BROWSE}
            </span>
            <span className="weered-ubar-label">Browse</span>
          </button>
          <button
            type="button"
            className="weered-btn"
            data-guest-hide
            aria-label="Invite"
            onClick={() => setInviting(true)}
          >
            <span className="weered-ubar-ico" aria-hidden>
              {ICO_INVITE}
            </span>
            <span className="weered-ubar-label">Invite</span>
          </button>
          {/* A guest has no account menu: this is their way out. */}
          <button
            type="button"
            className="weered-btn"
            data-guest-only
            title="You're a guest here. Leave and end the visit."
            onClick={async () => {
              // The session ends first, then a fresh page: nothing of the visit
              // (its socket, its voice) carries on.
              await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca"}/auth/logout`,
                { method: "POST", credentials: "include" },
              ).catch(() => {});
              try {
                localStorage.removeItem("weered_user");
              } catch {}
              window.location.assign("/");
            }}
          >
            Leave
          </button>
          {place.kind === "lobby" && lobbyId && (
            <button
              type="button"
              className="weered-btn weered-ubar-report"
              data-guest-hide
              title="Report this lobby"
              aria-label="Report this lobby"
              onClick={async () => {
                const res = await weeredReport({ targetType: "LOBBY", targetId: lobbyId });
                if (res?.ok) weeredToast.success("Report submitted. Staff will review.");
                else if (res && !res.ok)
                  weeredToast.error(
                    res.error === "report_rate_limit"
                      ? "You're reporting too fast. Try again shortly."
                      : "Report failed.",
                  );
              }}
            >
              ⚐
            </button>
          )}
        </div>
      </div>

      {inviting && <InviteModal {...invite} onClose={() => setInviting(false)} />}

      <WeeredGuide
        open={guide}
        onClose={() => setGuide(false)}
        actions={{
          design: w?.me?.id
            ? () => (pathname === "/home" ? startDesign() : router.push("/home?design=1"))
            : undefined,
          look: () => openSheet?.("settings", { tab: "appearance" }),
          build: () => router.push("/lobby/create"),
          href: (path) => router.push(path),
        }}
      />
    </header>
  );
}

/** Where you are: the lobby's logo and name, or Weered's mark and the page's. */
function PlaceMark({ place }: { place: ShellPlace }) {
  const accent = place.accentColor || undefined;
  // A logo that won't load gives way to the initial.
  const [broken, setBroken] = React.useState<string | null>(null);
  const logo = place.logoUrl && place.logoUrl !== broken ? place.logoUrl : null;
  const splash = place.kind === "lobby" && HAS_SPLASH.has(place.lobbyId || "");
  const replay = () => {
    try {
      window.dispatchEvent(
        new CustomEvent("weered:splash:open", { detail: { lobbyId: place.lobbyId } }),
      );
    } catch {}
  };
  const press = splash
    ? {
        onClick: replay,
        onKeyDown: onActivate(replay),
        tabIndex: 0,
        role: "button",
        title: "Replay the intro · click to open",
      }
    : {};
  const verified = place.verified && (
    <span
      className="weered-ubar-verified"
      style={{
        background: accent ? `${accent}20` : undefined,
        borderColor: accent ? `${accent}35` : undefined,
        color: accent,
      }}
    >
      VERIFIED
    </span>
  );

  if (place.kind === "lobby" && place.lobbyId === "windrose")
    return (
      <div className={`weered-ubar-place${splash ? " weered-tier2-logo" : ""}`} {...press}>
        <img
          className="weered-ubar-wordmark"
          src="/brand/lobbies/windrose-wordmark-official.png"
          alt="Windrose"
          style={{ filter: `drop-shadow(0 1px 3px ${accent || "#c9a066"}55)` }}
        />
        {verified}
      </div>
    );

  // Weered's own: Home, its pages and The Lobby wear its mark.
  const own = place.kind === "home" || place.kind === "page" || place.lobbyId === "lobby";
  const mark = own ? (
    <span className="weered-ubar-mark is-weered">
      <img src="/brand/logo/weered-logo-128.png" alt="" />
    </span>
  ) : (
    <span
      className={`weered-ubar-mark${splash ? " weered-tier2-logo" : ""}`}
      style={
        logo
          ? { borderColor: accent ? `${accent}33` : undefined }
          : {
              background: accent ? `${accent}15` : undefined,
              borderColor: accent ? `${accent}22` : undefined,
              color: accent,
            }
      }
      {...press}
    >
      {logo ? (
        <img src={logo} alt={`${place.title} logo`} onError={() => setBroken(logo)} />
      ) : (
        (place.title || "W").charAt(0).toUpperCase()
      )}
    </span>
  );
  const name = <span className="weered-ubar-name">{place.title}</span>;

  return (
    <div className="weered-ubar-place">
      {place.href ? (
        <Link href={place.href} className="weered-ubar-link" title={`Back to ${place.title}`}>
          {mark}
          {name}
        </Link>
      ) : (
        <>
          {mark}
          {name}
        </>
      )}
      {verified}
      {place.steamAppId ? (
        <SteamLobbyHeader appId={String(place.steamAppId)} accentColor={accent} />
      ) : null}
    </div>
  );
}
