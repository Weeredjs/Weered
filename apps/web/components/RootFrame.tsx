"use client";

// Splits the app frame so the white-label /foyer route bypasses ALL Weered chrome,
// JSON-LD, providers, the titlebar, theme, and the service worker. App Router layouts
// NEST, so a nested foyer/layout cannot escape the root chrome — this pathname switch
// is the escape hatch. The JSON-LD lives here as module consts (NOT props) so it is
// never serialized into the /foyer RSC payload. Non-foyer routes render the exact same
// tree as before (zero behavior change).
import React from "react";
import { usePathname } from "next/navigation";
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

export default function RootFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/foyer" || (pathname && pathname.startsWith("/foyer/"))) {
    // White-label: no Weered providers, chrome, footer, JSON-LD, titlebar, or service worker.
    return <>{children}</>;
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
