"use client";

// Splits the app frame so the white-label /foyer route bypasses ALL Weered chrome,
// JSON-LD, providers, the titlebar, theme, and the service worker. App Router layouts
// NEST, so a nested foyer/layout cannot escape the root chrome — this pathname switch
// is the escape hatch. The JSON-LD lives here as module consts (NOT props) so it is
// never serialized into the /foyer RSC payload. Non-foyer routes render the exact same
// tree as before (zero behavior change).
import React, { useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { WeeredProvider } from "./WeeredProvider";
import OverlayProvider from "./overlays/OverlayProvider";
import OverlayHost from "./overlays/OverlayHost";
import LeftRail from "./LeftRail";
import RightRailSwitch from "./RightRailSwitch";
import DockDrawer from "./DockDrawer";
import ShellGate from "./ShellGate";
import ThemeRestore from "./ThemeRestore";
import DesktopTitleBar from "./DesktopTitleBar";
import LobbyBrowser from "./LobbyBrowser";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import PushPrompt from "./PushPrompt";
import UnreadIndicator from "./UnreadIndicator";
import InstallPrompt from "./InstallPrompt";
import KeyboardShortcuts from "./KeyboardShortcuts";
import CookieConsent from "./CookieConsent";
import BugReportButton from "./BugReportButton";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Weered",
  url: "https://weered.ca",
  description:
    "Real-time community platform with lobbies, rooms, presence, and gaming integrations.",
  applicationCategory: "SocialNetworkingApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "0",
    highPrice: "14",
    priceCurrency: "USD",
    offerCount: 3,
  },
  creator: {
    "@type": "Organization",
    name: "Weered",
    url: "https://weered.ca",
    logo: "https://weered.ca/brand/logo/weered-logo-512.png",
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Weered",
  url: "https://weered.ca",
  logo: "https://weered.ca/brand/logo/weered-logo-512.png",
  description:
    "Weered is a real-time community platform for gaming and beyond: lobbies, rooms, presence, and modules.",
  foundingDate: "2024",
  sameAs: ["https://twitter.com/weered", "https://www.reddit.com/r/weered"],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@weered.ca",
    url: "https://weered.ca/contact",
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Weered",
  url: "https://weered.ca",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://weered.ca/lobby?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

// The ECEB office room. Hitting the meeting host root (or /home) should drop the
// operator straight into the room, not the Weered home page.
const OFFICE_ROOM_PATH = "/room/mtg-eceb-office";

// Swaps the Weered mark for the chrome ECEB anchor wherever the office skin is on
// (both the ECEB host and any mtg-* meeting room). Gated by [data-office-skin] so
// normal Weered is never touched.
const OFFICE_LOGO_STYLE = (
  <style>{`[data-office-skin] .weered-rail-logo img { content: url("/brand/eceb-anchor-chrome.svg"); object-fit: contain; }`}</style>
);

// The de-purple override, injected as the LAST node in <body> (see the effect) so it
// beats component <style> blocks + the lobby theme. Brass over every purple source:
// the accent vars, the rail section-title banners + their ::before/::after, inline
// rgba purple, and Tailwind violet utilities/gradients.
const OFFICE_SKIN_CSS = `
html[data-office-skin]{
  --weered-accent-1:#d9a942!important;--weered-accent-2:#b78a28!important;
  --weered-accent-bg:rgba(217,169,66,.14)!important;--weered-accent-ring:rgba(217,169,66,.32)!important;
  --weered-accent-grad:linear-gradient(180deg,#e6bd6e,#d9a942 55%,#a87a1c)!important;
  --weered-accent-text:rgba(230,190,110,.95)!important;
}
html[data-office-skin] .weered-left-title,
html[data-office-skin] .weered-presence-title,
html[data-office-skin] .weered-rr-section-title,
html[data-office-skin] .weered-rr-create-title,
html[data-office-skin] .weered-dock-title{
  background:transparent!important;color:#e0be6a!important;
  border-color:rgba(217,169,66,.30)!important;box-shadow:none!important;
}
html[data-office-skin] .weered-left-title::before,html[data-office-skin] .weered-left-title::after,
html[data-office-skin] .weered-presence-title::before,html[data-office-skin] .weered-presence-title::after,
html[data-office-skin] .weered-rr-section-title::before,html[data-office-skin] .weered-rr-section-title::after{
  background:#d9a942!important;border-color:#d9a942!important;box-shadow:none!important;
}
html[data-office-skin] [style*="124,58,237"],
html[data-office-skin] [style*="124 58 237"],
html[data-office-skin] [style*="167,139,250"],
html[data-office-skin] [style*="167 139 250"],
html[data-office-skin] [style*="88,0,229"],
html[data-office-skin] [style*="139,92,246"],
html[data-office-skin] [style*="216,180,254"],
html[data-office-skin] [style*="7c3aed"],html[data-office-skin] [style*="7C3AED"],
html[data-office-skin] [style*="5800e5"],html[data-office-skin] [style*="5800E5"],
html[data-office-skin] [style*="8b5cf6"],html[data-office-skin] [style*="8B5CF6"],
html[data-office-skin] [style*="a78bfa"],html[data-office-skin] [style*="A78BFA"],
html[data-office-skin] [style*="6d28d9"],html[data-office-skin] [style*="5b21b6"],
html[data-office-skin] [style*="4c1d95"],html[data-office-skin] [style*="c4b5fd"]{
  background-image:none!important;background-color:rgba(217,169,66,.12)!important;
  border-color:rgba(217,169,66,.34)!important;box-shadow:none!important;
}
/* solid purple buttons (e.g. Join voice = #7c3aed): give them a proper brass fill */
html[data-office-skin] button[style*="#7c3aed"],
html[data-office-skin] button[style*="#5800e5"],
html[data-office-skin] button[style*="background:#7c3aed"],
html[data-office-skin] button[style*="background: #7c3aed"]{
  background:linear-gradient(180deg,#e0be6a,#c39a2e)!important;color:#1a1a1c!important;box-shadow:none!important;
}
html[data-office-skin] [class*="bg-violet"],html[data-office-skin] [class*="bg-purple"],html[data-office-skin] [class*="bg-indigo"],html[data-office-skin] [class*="bg-fuchsia"]{background-color:rgba(217,169,66,.75)!important;background-image:none!important;}
html[data-office-skin] [class*="text-violet"],html[data-office-skin] [class*="text-purple"],html[data-office-skin] [class*="text-indigo"]{color:rgba(235,205,140,.96)!important;}
html[data-office-skin] [class*="border-violet"],html[data-office-skin] [class*="border-purple"],html[data-office-skin] [class*="border-indigo"]{border-color:rgba(217,169,66,.34)!important;}
html[data-office-skin] [class*="from-violet"],html[data-office-skin] [class*="via-violet"],html[data-office-skin] [class*="to-violet"],
html[data-office-skin] [class*="from-purple"],html[data-office-skin] [class*="via-purple"],html[data-office-skin] [class*="to-purple"],
html[data-office-skin] [class*="from-indigo"],html[data-office-skin] [class*="via-indigo"],html[data-office-skin] [class*="to-indigo"]{
  --tw-gradient-from:rgba(217,169,66,.28)!important;--tw-gradient-to:rgba(217,169,66,.04)!important;
  --tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)!important;
}
/* shadow-[...purple...] glow utilities */
html[data-office-skin] [class*="shadow-"][class*="violet"],
html[data-office-skin] [class*="shadow-"][class*="124,58,237"]{box-shadow:none!important;}
`;

export default function RootFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [proHost, setProHost] = useState(false);
  useEffect(() => {
    try {
      if (document.documentElement.hasAttribute("data-pro-host")) setProHost(true);
    } catch {}
  }, []);

  // On the ECEB meeting host, the bare domain (or /home) routes into the office room.
  useEffect(() => {
    if (proHost && (pathname === "/" || pathname === "/home")) {
      router.replace(OFFICE_ROOM_PATH);
    }
  }, [proHost, pathname, router]);

  // The office skin (professional "press" theme + chrome anchor) applies whenever the
  // operator is viewing the office — the ECEB host OR any mtg-* meeting room on any
  // host (so entering from a weered.ca favourite/desktop still de-purples). This only
  // toggles <html> attributes (no provider remount); the full navy ProfessionalFrame
  // stays host-scoped below. On leave, the operator's own theme is restored.
  const inOfficeRoom = !!pathname && pathname.startsWith("/room/mtg-");
  const officeSkin = proHost || inOfficeRoom;
  useLayoutEffect(() => {
    if (typeof document === "undefined" || !officeSkin) return;
    const de = document.documentElement;
    const prevTheme = de.getAttribute("data-weered-theme");
    const prevLobby = de.getAttribute("data-weered-lobby");
    de.setAttribute("data-weered-theme", "press");
    de.setAttribute("data-office-skin", "1");
    de.removeAttribute("data-weered-lobby"); // kill the lobby theme (a source of forced purple)
    // Inject the de-purple override as the LAST node in <body> so it wins the cascade
    // over component <style> blocks (which render deeper/later than a React-rendered
    // <style> at the root). Removed on leave.
    let styleEl = document.getElementById("office-skin-css") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "office-skin-css";
      document.body.appendChild(styleEl);
    } else {
      document.body.appendChild(styleEl); // move to last
    }
    styleEl.textContent = OFFICE_SKIN_CSS;
    return () => {
      de.removeAttribute("data-office-skin");
      if (prevTheme) de.setAttribute("data-weered-theme", prevTheme);
      if (prevLobby) de.setAttribute("data-weered-lobby", prevLobby);
      document.getElementById("office-skin-css")?.remove();
    };
  }, [officeSkin, pathname]);

  // TEMP DEBUG — live attribute readout in office rooms; remove after diagnosis.
  const [dbg, setDbg] = useState("");
  useEffect(() => {
    const read = () => {
      try {
        const de = document.documentElement;
        setDbg(
          `theme=${de.getAttribute("data-weered-theme")} pro=${de.hasAttribute("data-pro-host")} skin=${de.hasAttribute("data-office-skin")} v2=${localStorage.getItem("weered_theme_v2")} inRoom=${inOfficeRoom} host=${location.hostname}`,
        );
      } catch {}
    };
    read();
    const iv = setInterval(read, 800);
    return () => clearInterval(iv);
  }, [inOfficeRoom, pathname]);
  const DEBUG_BADGE =
    inOfficeRoom || proHost ? (
      <div
        style={{
          position: "fixed",
          bottom: 4,
          left: 4,
          zIndex: 999999,
          background: "rgba(0,0,0,0.92)",
          color: "#7CFC00",
          font: "10px/1.3 monospace",
          padding: "4px 7px",
          borderRadius: 4,
          pointerEvents: "none",
          maxWidth: "92vw",
        }}
      >
        DBG {dbg}
      </div>
    ) : null;

  if (pathname === "/foyer" || (pathname && pathname.startsWith("/foyer/"))) {
    // White-label: no Weered providers, chrome, footer, JSON-LD, titlebar, or service worker.
    return <>{children}</>;
  }
  // Full Weered chrome everywhere (no branch swap → no remount → the office recolor
  // stays put). The office room is recolored in place via the injected stylesheet.
  return (
    <>
      {OFFICE_LOGO_STYLE}
      {DEBUG_BADGE}
      <DesktopTitleBar />
      <ThemeRestore />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <OverlayProvider>
        <WeeredProvider>
          <ShellGate left={<LeftRail />} right={<RightRailSwitch />}>
            {children}
          </ShellGate>
          <DockDrawer />
          <LobbyBrowser />
          <OverlayHost />
          <ServiceWorkerRegister />
          <PushPrompt />
          <UnreadIndicator />
          <InstallPrompt />
          <KeyboardShortcuts />
          <CookieConsent />
          <BugReportButton />
          <div className="weered-trademark-footer">
            Game names, logos, and trademarks are the property of their respective owners. Weered is
            not affiliated with or endorsed by any game publisher or platform.
          </div>
        </WeeredProvider>
      </OverlayProvider>
    </>
  );
}
