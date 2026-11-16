import type { Metadata } from "next";

// The booking page's own name in the tab and in a shared link's preview.
export const metadata: Metadata = {
  title: { absolute: "Book time with James Stirling · East Coast Employee Benefits" },
  description: "Pick 30 minutes with James Stirling in his online office. No app, no sign-in.",
  openGraph: {
    title: "Book time with James Stirling",
    description: "Pick 30 minutes with James Stirling in his online office. No app, no sign-in.",
    siteName: "East Coast Employee Benefits",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "Book time with James Stirling",
    description: "Pick 30 minutes with James Stirling in his online office.",
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
