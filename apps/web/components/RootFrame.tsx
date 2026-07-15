"use client";

// Splits the app frame so the white-label /foyer route bypasses ALL Weered chrome,
// JSON-LD, providers, the titlebar, theme, and the service worker. App Router layouts
// NEST, so a nested foyer/layout cannot escape the root chrome â€” this pathname switch
// is the escape hatch. The JSON-LD lives here as module consts (NOT props) so it is
// never serialized into the /foyer RSC payload. Non-foyer routes render the exact same
// tree as before (zero behavior change).
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { OFFICE_SKIN_CSS } from "./officeSkinCss";

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

// The office skin stylesheet (the Fathom Review Room design tokens + de-purple
// mechanics) lives in ./officeSkinCss and is injected as the LAST node in <body>
// (see the effect below) so it wins the cascade over component <style> blocks.

export default function RootFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [proHost, setProHost] = useState(false);
  useEffect(() => {
    try {
      if (document.documentElement.hasAttribute("data-pro-host")) setProHost(true);
    } catch {}
  }, []);

  // On the ECEB meeting host, the bare domain (or /home) routes the operator into the
  // office room â€” but ONCE only (a ref, not a loop): an unauthed visitor gets bounced by
  // the room, and without this guard the redirect would re-fire forever (the true/false
  // flashing James caught). Unauthed â†’ the guest foyer instead of the room.
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (!proHost || redirectedRef.current) return;
    if (pathname === "/" || pathname === "/home") {
      redirectedRef.current = true;
      let authed = false;
      try {
        authed = !!localStorage.getItem("weered_user");
      } catch {}
      router.replace(authed ? OFFICE_ROOM_PATH : "/foyer");
    }
  }, [proHost, pathname, router]);

  // The office skin (professional "press" theme + chrome anchor) applies whenever the
  // operator is viewing the office â€” the ECEB host OR any mtg-* meeting room on any
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

    // Keep the de-purple stylesheet the LAST node in <body> so it wins the cascade
    // over component <style> blocks (which mount deeper/later than a root <style>).
    const ensureStyle = () => {
      let s = document.getElementById("office-skin-css") as HTMLStyleElement | null;
      if (!s) {
        s = document.createElement("style");
        s.id = "office-skin-css";
        s.textContent = OFFICE_SKIN_CSS;
        document.body.appendChild(s);
      } else if (document.body.lastElementChild !== s) {
        document.body.appendChild(s);
      }
    };
    // ENFORCE the office skin. The room re-applies the purple lobby theme when its
    // WebSocket/lobby data loads (after this effect's one-shot run) â€” that was the
    // flash. A MutationObserver snaps it back the instant anything re-purples: theme
    // flipped off "press", the lobby theme re-added, or data-office-skin cleared.
    // Each fix only writes when the value is wrong, so it converges (no loop).
    const enforce = () => {
      if (de.getAttribute("data-weered-theme") !== "press")
        de.setAttribute("data-weered-theme", "press");
      if (de.hasAttribute("data-weered-lobby")) de.removeAttribute("data-weered-lobby");
      if (!de.hasAttribute("data-office-skin")) de.setAttribute("data-office-skin", "1");
      ensureStyle();
    };
    enforce();
    const attrObs = new MutationObserver(enforce);
    attrObs.observe(de, {
      attributes: true,
      attributeFilter: ["data-weered-theme", "data-weered-lobby", "data-office-skin"],
    });
    const bodyObs = new MutationObserver(() => {
      const s = document.getElementById("office-skin-css");
      if (s && document.body.lastElementChild !== s) document.body.appendChild(s);
    });
    bodyObs.observe(document.body, { childList: true });

    return () => {
      attrObs.disconnect();
      bodyObs.disconnect();
      de.removeAttribute("data-office-skin");
      if (prevTheme) de.setAttribute("data-weered-theme", prevTheme);
      if (prevLobby) de.setAttribute("data-weered-lobby", prevLobby);
      document.getElementById("office-skin-css")?.remove();
    };
  }, [officeSkin, pathname]);

  if (pathname === "/foyer" || (pathname && pathname.startsWith("/foyer/"))) {
    // White-label: no Weered providers, chrome, footer, JSON-LD, titlebar, or service worker.
    return <>{children}</>;
  }
  // Full Weered chrome everywhere (no branch swap â†’ no remount â†’ the office recolor
  // stays put). The office room is recolored in place via the injected stylesheet.
  return (
    <>
      {OFFICE_LOGO_STYLE}
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
