"use client";

// Splits the app frame so the white-label /foyer route bypasses ALL Weered chrome,
// JSON-LD, providers, the titlebar, theme, and the service worker. App Router layouts
// NEST, so a nested foyer/layout cannot escape the root chrome — this pathname switch
// is the escape hatch. The JSON-LD lives here as module consts (NOT props) so it is
// never serialized into the /foyer RSC payload. Non-foyer routes render the exact same
// tree as before (zero behavior change).
import React, { useEffect, useState } from "react";
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

// PROFESSIONAL SKIN — on the ECEB meeting host (office./meet.eastcoastemployeebenefits.com)
// we add a navy ECEB brand bar and drop the Weered trademark footer + JSON-LD, but KEEP
// the full shell (left + right rails, dock) — James uses the rails to navigate; they're
// still important. Only the branding wrapper changes. weered.ca is byte-identical (the
// pre-hydration script in app/layout.tsx only sets data-pro-host on the ECEB host).
function ProfessionalFrame({ children }: { children: React.ReactNode }) {
  return (
    <OverlayProvider>
      <WeeredProvider>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            background: "#0b1a2e",
          }}
        >
          <header
            style={{
              height: 32,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 14px",
              background: "#0d2340",
              borderBottom: "2px solid #e0b341",
              fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif",
            }}
          >
            <span
              style={{ color: "#fff", fontWeight: 800, fontSize: 12.5, letterSpacing: ".02em" }}
            >
              East Coast Employee Benefits
            </span>
            <span
              style={{
                color: "rgba(224,179,65,0.92)",
                fontWeight: 700,
                fontSize: 10.5,
                letterSpacing: ".12em",
                textTransform: "uppercase",
              }}
            >
              Private meeting room
            </span>
          </header>
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <ShellGate left={<LeftRail />} right={<RightRailSwitch />}>
              {children}
            </ShellGate>
          </div>
        </div>
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
      </WeeredProvider>
    </OverlayProvider>
  );
}

// The ECEB office room. Hitting the meeting host root (or /home) should drop the
// operator straight into the room, not the Weered home page.
const OFFICE_ROOM_PATH = "/room/mtg-eceb-office";

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

  if (pathname === "/foyer" || (pathname && pathname.startsWith("/foyer/"))) {
    // White-label: no Weered providers, chrome, footer, JSON-LD, titlebar, or service worker.
    return <>{children}</>;
  }
  // ECEB meeting host: the professional frame (room + preserved providers, no gaming chrome).
  if (proHost) {
    return <ProfessionalFrame>{children}</ProfessionalFrame>;
  }
  return (
    <>
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
