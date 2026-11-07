"use client";

// The bar at the top of every page: Home's own header, with the search
// (James 2026-11-06: "Combine them. Just have that universal bar the same
// everywhere... Just search that taps into everything", then "Other way
// around. I meant the home bar. But with the search. Keep the Hi <Username>").
// The time of day over "Hey, you", one search for everything, Downtown (every
// lobby; James 2026-11-07), and the two buttons Home's header always had. ShellGate puts it over every page in the
// frame. A lobby's own Invite and Report sit in the lobby, by Design and Admin.
// Styled in styles/42-bar.css.

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import InviteModal from "../InviteModal";
import WeeredGuide from "../guide/WeeredGuide";
import UniversalSearch, { GUIDE_EVENT, INVITE_EVENT } from "../search/UniversalSearch";
import { useWeered } from "../WeeredProvider";
import { useOverlay } from "../overlays/OverlayProvider";
import { startDesign } from "../../lib/shellDesign";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late night";
}

export default function UniversalBar() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { openSheet } = useOverlay() as any;
  const w = useWeered() as any;
  const name = String(w?.me?.name || w?.me?.username || "").trim() || "there";
  // The time of day is the viewer's own, so it's read in their browser.
  const [hello, setHello] = React.useState("");
  React.useEffect(() => setHello(greeting()), [pathname]);
  const [guide, setGuide] = React.useState(false);
  const [inviting, setInviting] = React.useState(false);

  React.useEffect(() => {
    const openGuide = () => setGuide(true);
    const openInvite = () => setInviting(true);
    window.addEventListener(GUIDE_EVENT, openGuide);
    window.addEventListener(INVITE_EVENT, openInvite);
    return () => {
      window.removeEventListener(GUIDE_EVENT, openGuide);
      window.removeEventListener(INVITE_EVENT, openInvite);
    };
  }, []);

  return (
    <header className="home-topbar weered-ubar">
      <div className="home-topbar-greet weered-ubar-greet">
        <div className="weered-ubar-hello">{hello}</div>
        <div className="weered-ubar-hey">
          Hey, <span>{name}</span>
        </div>
      </div>

      <div className="weered-ubar-search" data-guest-hide>
        <UniversalSearch />
      </div>

      <div className="home-topbar-actions weered-ubar-actions">
        <button
          type="button"
          className="home-topbar-secondary weered-ubar-downtown"
          data-guest-hide
          aria-label="Downtown"
          title="Every lobby on Weered"
          onClick={() => window.dispatchEvent(new CustomEvent("weered:lobby:browse"))}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 21h18M5 21V10h4v11M9 21V4h6v17M15 21v-8h4v8M12 8v.01M12 12v.01M12 16v.01" />
          </svg>
          <span className="weered-ubar-label">Downtown</span>
        </button>
        <Link href="/desktop" className="home-topbar-secondary weered-ubar-desktop" data-guest-hide>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Desktop app
        </Link>
        <button
          type="button"
          className="home-topbar-secondary weered-ubar-guide"
          data-guest-hide
          onClick={() => setGuide(true)}
        >
          What can you do here?
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
      </div>

      {inviting && <InviteModal type="PLATFORM" onClose={() => setInviting(false)} />}

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
