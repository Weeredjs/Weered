"use client";
import Link from "next/link";

// The footer's links, at the foot of the Menu on a phone. The site footer sits
// under the 56px tab bar there, its links running 230px off the screen, so a
// phone had no way to reach terms, privacy or contact (James 2026-11-09, "the
// phone app has various visual issues"). Hidden on wider screens, where the
// footer shows.
const LINKS: [string, string][] = [
  ["/explore", "explore"],
  ["/about", "about"],
  ["/pricing", "pricing"],
  ["/terms", "terms"],
  ["/privacy", "privacy"],
  ["/guidelines", "guidelines"],
  ["/contact", "contact"],
];

export default function MobileLegalLinks() {
  return (
    <nav className="weered-mobile-legal" aria-label="About Weered">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
