import { Metadata } from "next";
import TermsContent from "./TermsContent";

export const metadata: Metadata = {
  title: "Terms of Service | Weered",
  description:
    "Terms of Service for Weered. By using weered.ca you agree to these terms governing account usage, content, video/screen sharing, and third-party integrations.",
  openGraph: {
    title: "Terms of Service | Weered",
    description:
      "Terms governing your use of the Weered platform, including content, video chat, screen sharing, and community features.",
    url: "https://weered.ca/terms",
  },
  twitter: {
    title: "Terms of Service | Weered",
    description: "Terms governing your use of the Weered platform.",
  },
  alternates: { canonical: "https://weered.ca/terms" },
};

export default function TermsPage() {
  return <TermsContent />;
}
