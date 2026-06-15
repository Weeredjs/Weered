import { Metadata } from "next";
import DesktopContent from "./DesktopContent";

export const metadata: Metadata = {
  title: "Weered Desktop | Native app for Mac, Windows, and Linux",
  description:
    "Weered for the desktop. Built on Rust + Tauri. ~5MB installer, ~80MB RAM. System tray, global hotkeys, native notifications, deep links.",
  openGraph: {
    title: "Weered Desktop | Native app for Mac, Windows, Linux",
    description:
      "Built on Rust + Tauri. 30x smaller than Discord. System tray, global hotkeys, native notifications.",
    url: "https://weered.ca/desktop",
  },
  twitter: {
    title: "Weered Desktop",
    description: "Built on Rust + Tauri. 30x smaller than Discord.",
  },
  alternates: { canonical: "https://weered.ca/desktop" },
};

export default function DesktopPage() {
  return <DesktopContent />;
}
