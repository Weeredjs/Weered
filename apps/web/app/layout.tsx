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

export const metadata = {
  title: "Weered",
  description: "communities | presence | rooms",
  icons: { icon: "/favicon.svg" },
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
          </WeeredProvider>
        </OverlayProvider>
      </body>
    </html>
  );
}
