import { Metadata } from "next";
import AboutContent from "./AboutContent";

export const metadata: Metadata = {
  title: "About Weered | Real-Time Community Platform",
  description:
    "Weered is one town of communities: describe a place and it's built, every lobby sits on the same street, and the Town Square is where everyone talks. Lobbies, not servers. Rooms, not channels.",
  openGraph: {
    title: "About Weered | Real-Time Community Platform",
    description:
      "One town of communities. Describe a place and it's built; walk from one lobby into the next.",
    url: "https://weered.ca/about",
  },
  twitter: {
    title: "About Weered",
    description:
      "Lobbies, rooms, presence, and modules. A community platform that feels like a place.",
  },
  alternates: { canonical: "https://weered.ca/about" },
};

export default function AboutPage() {
  return <AboutContent />;
}
