import { Metadata } from "next";
import MapContent from "./MapContent";

export const metadata: Metadata = {
  title: "Live Map — Weered",
  description: "See where Weered users are active around the world. Opt-in GPS location map with privacy-first design.",
  openGraph: {
    title: "Live Map — Weered",
    description: "Real-time map of Weered user activity worldwide.",
    url: "https://weered.ca/map",
  },
  alternates: { canonical: "https://weered.ca/map" },
};

export default function MapPage() {
  return <MapContent />;
}
