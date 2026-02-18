import React from "react";
import { WeeredProvider } from "../components/WeeredProvider";
import DockShell from "../components/DockShell";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WeeredProvider>
          {children}
          <DockShell />
        </WeeredProvider>
      </body>
    </html>
  );
}
