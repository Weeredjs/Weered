import { Metadata } from "next";
import WhyNotDiscordContent from "./WhyNotDiscordContent";

export const metadata: Metadata = {
  title: "Why Weered Isn't Discord",
  description:
    "Discord won, and gaming communities lost their tools. A manifesto from the builder of Weered.",
  openGraph: {
    title: "Why Weered Isn't Discord",
    description: "Lobby-first, not server-first. Built for crews, not the everything-app.",
    url: "https://weered.ca/why-not-discord",
  },
  twitter: {
    title: "Why Weered Isn't Discord",
    description: "Lobby-first, not server-first. Built for crews, not the everything-app.",
  },
  alternates: { canonical: "https://weered.ca/why-not-discord" },
};

export default function WhyNotDiscordPage() {
  return <WhyNotDiscordContent />;
}
