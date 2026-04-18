import "./globals.css";
import React from "react";
import { WeeredProvider } from "../components/WeeredProvider";
import OverlayProvider from "../components/overlays/OverlayProvider";
import OverlayHost from "../components/overlays/OverlayHost";
import LeftRail from "../components/LeftRail";
import RightRailSwitch from "../components/RightRailSwitch";
import DockDrawer from "../components/DockDrawer";
import ShellGate from "../components/ShellGate";
import LobbyBrowser from "../components/LobbyBrowser";
import WelcomeModal from "../components/WelcomeModal";
import ServiceWorkerRegister from "../components/ServiceWorkerRegister";
import PushPrompt from "../components/PushPrompt";
import InstallPrompt from "../components/InstallPrompt";
import KeyboardShortcuts from "../components/KeyboardShortcuts";

export const metadata = {
  title: {
    default: "Weered — Real-Time Community Platform",
    template: "%s | Weered",
  },
  description: "Weered is a real-time community platform. Lobbies, rooms, presence, and modules — built for gaming communities and beyond.",
  metadataBase: new URL("https://weered.ca"),
  icons: {
    icon: [
      { url: "/brand/logo/weered-logo-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/brand/logo/weered-logo-128.png",
    shortcut: "/brand/logo/weered-logo-32.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Weered — Real-Time Community Platform",
    description: "Lobbies, rooms, presence, and modules. A community platform that feels like a place, not a product.",
    url: "https://weered.ca",
    siteName: "Weered",
    images: [
      {
        url: "https://weered.ca/brand/og-image.png",
        width: 1200,
        height: 630,
        alt: "Weered — Real-Time Community Platform",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Weered — Real-Time Community Platform",
    description: "Lobbies, rooms, presence, and modules. Built for gaming communities.",
    images: ["https://weered.ca/brand/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Weered",
  },
  alternates: {
    canonical: "https://weered.ca",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport = {
  themeColor: "#5800E5",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Weered",
  url: "https://weered.ca",
  description: "Real-time community platform with lobbies, rooms, presence, and gaming integrations.",
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

const themeBootScript = `
try {
  var d = document.documentElement;
  var v2 = localStorage.getItem('weered_theme_v2');
  var sraw = localStorage.getItem('weered:settings:v0');
  var s = sraw ? JSON.parse(sraw) : null;
  var valid = ['slate','zinc','stone','gray','ishimura','broadcast','press'];
  var theme = (v2 && valid.indexOf(v2) >= 0) ? v2
            : (s && s.theme && valid.indexOf(s.theme) >= 0) ? s.theme
            : 'ishimura';
  d.setAttribute('data-weered-theme', theme);
  if (s && s.density) d.setAttribute('data-weered-density', s.density);
  if (s && s.reduceMotion) d.setAttribute('data-weered-reduce-motion', '1');
} catch(e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <OverlayProvider>
          <WeeredProvider>
            <ShellGate
              left={<LeftRail />}
              right={<RightRailSwitch />}
            >
              {children}
            </ShellGate>
            <DockDrawer />
            <LobbyBrowser />
            <OverlayHost />
            <WelcomeModal />
            <ServiceWorkerRegister />
            <PushPrompt />
            <InstallPrompt />
            <KeyboardShortcuts />
            <div className="weered-trademark-footer">
              Game names, logos, and trademarks are the property of their respective owners. Weered is not affiliated with or endorsed by any game publisher or platform.
            </div>
          </WeeredProvider>
        </OverlayProvider>
      </body>
    </html>
  );
}
