import type { Metadata } from "next";

// Neutral favicon (rounded blue square + dot) so the tab carries no Weered logo.
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%231f6feb'/%3E%3Ccircle cx='16' cy='16' r='6' fill='white'/%3E%3C/svg%3E";

// White-label + private: title.absolute bypasses the root "%s | Weered" template,
// OG/twitter are overridden so a shared link previews neutral, robots = noindex.
export const metadata: Metadata = {
  title: { absolute: "Secure Meeting Room" },
  description: "Join your secure meeting.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  icons: { icon: FAVICON, shortcut: FAVICON, apple: FAVICON },
  manifest: null, // drop the Weered PWA manifest
  appleWebApp: { title: "Secure Meeting Room", capable: true, statusBarStyle: "default" },
  alternates: { canonical: null }, // drop the weered.ca canonical
  openGraph: {
    title: "Secure Meeting Room",
    description: "Join your secure meeting.",
    siteName: "Secure Meeting Room",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "Secure Meeting Room",
    description: "Join your secure meeting.",
  },
};

export default function FoyerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
