import "./globals.css";
import React from "react";
import { WeeredProvider } from "../components/WeeredProvider";
import OverlayProvider from "../components/overlays/OverlayProvider";
import OverlayHost from "../components/overlays/OverlayHost";
import LeftRail from "../components/LeftRail";
import RightRailSwitch from "../components/RightRailSwitch";
import DockDrawer from "../components/DockDrawer";

export const metadata = {
  title: "Weered",
  description: "communities | presence | rooms",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <OverlayProvider>
          <WeeredProvider>
            <div className="weered-shell">
              <aside className="weered-left">
                <LeftRail />
              </aside>
              <main className="weered-center">
                {children}
              </main>
              <aside className="weered-right">
                <RightRailSwitch />
              </aside>
            </div>
            <DockDrawer />
          </WeeredProvider>
          <OverlayHost />
        </OverlayProvider>
      </body>
    </html>
  );
}
