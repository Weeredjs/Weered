import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";

const SITE = "https://weered.ca";

type Competitor = {
  id: string;
  name: string;
  url: string;
  tagline: string;
  summary: string;
  use_them_if: string[];
  use_weered_if: string[];
  feature_table: [string, string, string][];
  bottom_line: string;
};

const DATA_PATH = path.join(process.cwd(), "data", "competitors.json");
const COMPETITORS: Competitor[] = (() => {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const list = parsed?.competitors;
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("competitors.json had no competitors array");
    }
    return list as Competitor[];
  } catch (e: any) {
    throw new Error(`Failed to load competitors from ${DATA_PATH}: ${e.message}`);
  }
})();

function findCompetitor(id: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.id === id);
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return COMPETITORS.map((c) => ({ id: c.id }));
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const c = findCompetitor(params.id);
  if (!c) return { title: "Comparison not found · Weered" };
  const title = `Weered vs ${c.name} | Honest comparison`;
  const description = `${c.tagline} Side-by-side comparison with Weered: when to use each, feature breakdown, and a fair bottom line.`;
  const url = `${SITE}/compare/weered-vs/${c.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article" },
    robots: { index: true, follow: true },
  };
}

export default async function CompareWeeredVsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const c = findCompetitor(params.id);
  if (!c) notFound();

  const pageUrl = `${SITE}/compare/weered-vs/${c.id}`;
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Compare", item: `${SITE}/compare` },
      { "@type": "ListItem", position: 3, name: `Weered vs ${c.name}`, item: pageUrl },
    ],
  };
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `Weered vs ${c.name} | Honest comparison`,
    description: c.tagline,
    url: pageUrl,
    publisher: { "@type": "Organization", name: "Weered", url: SITE },
    dateModified: new Date().toISOString(),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    dateModified: new Date().toISOString(),
    mainEntity: [
      {
        "@type": "Question",
        name: `When should I use ${c.name} instead of Weered?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Use ${c.name} if: ${c.use_them_if.join("; ")}.`,
        },
      },
      {
        "@type": "Question",
        name: `When should I use Weered instead of ${c.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Use Weered if: ${c.use_weered_if.join("; ")}.`,
        },
      },
      {
        "@type": "Question",
        name: `What is the bottom line comparing Weered and ${c.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: c.bottom_line,
        },
      },
      {
        "@type": "Question",
        name: `Is Weered a direct ${c.name} alternative?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Weered and ${c.name} overlap on some features but optimize for different priorities. ${c.summary}`,
        },
      },
    ],
  };

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <nav aria-label="Breadcrumb" style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
        <Link href="/" style={{ color: "#7c9dff" }}>
          Weered
        </Link>
        {" / "}
        <Link href="/compare" style={{ color: "#7c9dff" }}>
          Compare
        </Link>
        {" / "}
        {`Weered vs ${c.name}`}
      </nav>

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
          Honest comparison
        </p>
        <h1 style={{ fontSize: 32, margin: "0 0 12px", lineHeight: 1.15 }}>Weered vs {c.name}</h1>
        <p style={{ fontSize: 17, opacity: 0.92, fontStyle: "italic", marginBottom: 16 }}>
          {c.tagline}
        </p>
        <p style={{ fontSize: 16 }}>{c.summary}</p>
      </header>

      <section
        style={{ marginBottom: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
      >
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 10 }}>Use {c.name} if</h2>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {c.use_them_if.map((point, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: "rgba(124,157,255,0.08)",
            border: "1px solid rgba(124,157,255,0.25)",
          }}
        >
          <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 10 }}>Use Weered if</h2>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {c.use_weered_if.map((point, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>Feature comparison</h2>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                <th
                  style={{
                    padding: 10,
                    textAlign: "left",
                    borderBottom: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  Feature
                </th>
                <th
                  style={{
                    padding: 10,
                    textAlign: "left",
                    borderBottom: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {c.name}
                </th>
                <th
                  style={{
                    padding: 10,
                    textAlign: "left",
                    borderBottom: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  Weered
                </th>
              </tr>
            </thead>
            <tbody>
              {c.feature_table.map(([feature, them, us], i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <td style={{ padding: 10, fontWeight: 600 }}>{feature}</td>
                  <td style={{ padding: 10, opacity: 0.9 }}>{them}</td>
                  <td style={{ padding: 10, opacity: 0.9 }}>{us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        style={{
          marginBottom: 28,
          padding: 20,
          borderRadius: 8,
          background: "rgba(255,235,200,0.04)",
          border: "1px solid rgba(156,124,63,0.35)",
        }}
      >
        <h2 style={{ fontSize: 22, marginTop: 0, marginBottom: 10 }}>Bottom line</h2>
        <p style={{ margin: 0, fontSize: 16 }}>{c.bottom_line}</p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 14, opacity: 0.7 }}>
          Want to learn more about either?{" "}
          <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: "#7c9dff" }}>
            Visit {c.name}
          </a>
          {" · "}
          <Link href="/" style={{ color: "#7c9dff" }}>
            Visit Weered
          </Link>
        </p>
      </section>

      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingTop: 16,
          marginTop: 32,
          fontSize: 14,
          opacity: 0.75,
        }}
      >
        <p style={{ marginBottom: 8 }}>
          <Link href="/compare" style={{ color: "#7c9dff", fontWeight: 600 }}>
            ← See all Weered comparisons
          </Link>
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
