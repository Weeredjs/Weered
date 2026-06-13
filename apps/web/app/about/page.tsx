import { Metadata } from "next";
import AboutContent from "./AboutContent";

export const metadata: Metadata = {
  title: "About Weered | Real-Time Community Platform",
  description: "Weered is a real-time community platform built around lobbies, rooms, and presence. Think lobbies, not servers. Rooms, not channels. Presence, not status dots.",
  openGraph: {
    title: "About Weered | Real-Time Community Platform",
    description: "Lobbies, rooms, presence, and modules. A dark, cinematic community platform that feels like a place, not a product.",
    url: "https://weered.ca/about",
  },
  twitter: {
    title: "About Weered",
    description: "Lobbies, rooms, presence, and modules. A community platform that feels like a place.",
  },
  alternates: { canonical: "https://weered.ca/about" },
};

export default function AboutPage() {
  return <AboutContent />;
}
