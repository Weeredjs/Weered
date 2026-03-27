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

export const metadata = {
  title: "Weered",
  description: "Enter the portal",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/logo/weered-logo-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/logo/weered-logo-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/brand/logo/weered-logo-128.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Weered",
    description: "Enter the portal",
    url: "https://weered.ca",
    siteName: "Weered",
    images: [
      {
        url: "https://weered.ca/brand/og-image.png",
        width: 1200,
        height: 630,
        alt: "Weered — Enter the portal",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Weered",
    description: "Enter the portal",
    images: ["https://weered.ca/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Weered",
  },
};

export const viewport = {
  themeColor: "#5800E5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
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
            <div className="weered-trademark-footer">
              Game names, logos, and trademarks are the property of their respective owners. Weered is not affiliated with or endorsed by any game publisher or platform.
            </div>
          </WeeredProvider>
        </OverlayProvider>
      </body>
    </html>
  );
}
