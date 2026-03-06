import "./globals.css";
import React from "react";
import { WeeredProvider } from "../components/WeeredProvider";
import OverlayProvider from "../components/overlays/OverlayProvider";
import OverlayHost from "../components/overlays/OverlayHost";
import LeftRail from "../components/LeftRail";
import RightRailSwitch from "../components/RightRailSwitch";
import DockDrawer from "../components/DockDrawer";
import ShellGate from "../components/ShellGate";

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
            <ShellGate
              shell={
                <>
                  <aside className="weered-left">
                    <LeftRail />
                  </aside>
                  <aside className="weered-right">
                    <RightRailSwitch />
                  </aside>
                </>
              }
            >
              {children}
            </ShellGate>
            <DockDrawer />
          </WeeredProvider>
          <OverlayHost />
        </OverlayProvider>
      </body>
    </html>
  );
}
