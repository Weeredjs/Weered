import { Metadata } from "next";
import PremiumContent from "./PremiumContent";

export const metadata: Metadata = {
  title: "Weered Premium | Innocent, Indicted, Felon, Kingpin",
  description: "Choose your access level on Weered. Free lobbies and rooms for everyone, or unlock branded lobbies, custom styling, verified badges, and more starting at $6/month.",
  openGraph: {
    title: "Weered Premium | Choose Your Status",
    description: "Free lobbies for everyone. Branded lobbies, custom styling, and verified badges for those who want more.",
    url: "https://weered.ca/premium",
    images: [{ url: "https://weered.ca/brand/og-image.png", width: 1200, height: 630, alt: "Weered Premium" }],
  },
  twitter: {
    title: "Weered Premium",
    description: "Innocent. Indicted. Felon. Kingpin. Choose your status.",
  },
  alternates: { canonical: "https://weered.ca/premium" },
};

export default function PremiumPage() {
  return <PremiumContent />;
}
