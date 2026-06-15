import { Metadata } from "next";
import GuidelinesContent from "./GuidelinesContent";

export const metadata: Metadata = {
  title: "Community Guidelines | Weered",
  description:
    "Weered Community Guidelines. Rules for chat, video, screen sharing, forums, and all community interactions on the platform.",
  openGraph: {
    title: "Community Guidelines | Weered",
    description:
      "What flies and what doesn't on Weered. Rules for chat, video, screen sharing, and community conduct.",
    url: "https://weered.ca/guidelines",
  },
  twitter: {
    title: "Community Guidelines | Weered",
    description: "Community rules for the Weered platform.",
  },
  alternates: { canonical: "https://weered.ca/guidelines" },
};

export default function GuidelinesPage() {
  return <GuidelinesContent />;
}
