import { Metadata } from "next";
import PrivacyContent from "./PrivacyContent";

export const metadata: Metadata = {
  title: "Privacy Policy | Weered",
  description: "Weered Privacy Policy. How we collect, use, store, and protect your personal information in compliance with Canadian privacy law (PIPEDA).",
  openGraph: {
    title: "Privacy Policy | Weered",
    description: "How Weered handles your data, third-party integrations, cookies, and your privacy rights under Canadian law.",
    url: "https://weered.ca/privacy",
  },
  twitter: {
    title: "Privacy Policy | Weered",
    description: "How Weered handles your data and privacy.",
  },
  alternates: { canonical: "https://weered.ca/privacy" },
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
