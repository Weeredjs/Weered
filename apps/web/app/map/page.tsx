import { Metadata } from "next";
import MapContent from "./MapContent";

export const metadata: Metadata = {
  title: "Locator | Weered",
  description:
    "See where Weered users are active around the world. Opt-in GPS location map with privacy-first design.",
  openGraph: {
    title: "Locator | Weered",
    description: "Real-time map of Weered user activity worldwide.",
    url: "https://weered.ca/map",
  },
  alternates: { canonical: "https://weered.ca/map" },
};

export default function MapPage() {
  return <MapContent />;
}
