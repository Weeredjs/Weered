import type { Metadata } from "next";
import Link from "next/link";
import competitorsData from "../../data/competitors.json";

const SITE = "https://weered.ca";

type Competitor = {
  id: string;
  name: string;
  tagline: string;
};

const COMPETITORS: Competitor[] = (competitorsData as any).competitors;

export const metadata: Metadata = {
  title: "Compare Weered | Honest side-by-side comparisons",
  description:
    "Side-by-side comparisons of Weered against other community platforms. When to use each, feature breakdown, honest bottom line.",
  alternates: { canonical: `${SITE}/compare` },
  openGraph: {
    title: "Compare Weered: honest comparisons",
    description:
      "Side-by-side comparisons of Weered against Discord, Guilded, TeamSpeak, Element, Revolt, Steam Chat, and more.",
    url: `${SITE}/compare`,
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function CompareIndexPage() {
  return (
    <main
      style={{
        padding: "32px 20px",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        maxWidth: 860,
        margin: "0 auto",
        lineHeight: 1.55,
        color: "#e8e8ea",
      }}
    >
      <header style={{ marginBottom: 28 }}>
        <p
          style={{
            fontSize: 12,
            opacity: 0.6,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 4,
          }}
        >
          Comparisons
        </p>
        <h1 style={{ fontSize: 32, margin: "0 0 12px", lineHeight: 1.15 }}>Compare Weered</h1>
        <p style={{ fontSize: 17, opacity: 0.92 }}>
          Picking a community platform is a real decision and there's no one right answer. Below are
          honest comparisons against the platforms Weered most often gets compared to, including
          when you should pick the other one.
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {COMPETITORS.map((c) => (
          <Link
            key={c.id}
            href={`/compare/weered-vs/${c.id}`}
            style={{
              display: "block",
              padding: 16,
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 6, color: "#7c9dff" }}>
              Weered vs {c.name}
            </h2>
            <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 0 }}>{c.tagline}</p>
          </Link>
        ))}
      </section>

      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingTop: 16,
          marginTop: 40,
          fontSize: 14,
          opacity: 0.75,
        }}
      >
        <p style={{ marginBottom: 8 }}>
          Don't see a platform you're comparing? Email us at{" "}
          <a href="mailto:james@weered.ca" style={{ color: "#7c9dff" }}>
            james@weered.ca
          </a>
          .
        </p>
        <p style={{ marginBottom: 0 }}>
          Open the Weered platform:{" "}
          <Link href="/" style={{ color: "#7c9dff" }}>
            {SITE}
          </Link>
        </p>
      </footer>
    </main>
  );
}

export const revalidate = 3600;
