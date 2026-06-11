import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";

const SITE = "https://weered.ca";

type ActivityType = {
  name: string;
  examples: string;
  size: string;
  typical_filters: string;
};

type FAQ = { q: string; a: string };

type Guide = {
  lobby_id: string;
  game_name: string;
  noun_singular: string;
  noun_plural: string;
  search_intent: string;
  tldr: string;
  native_lfg: { name: string; honest_take: string };
  activity_types: ActivityType[];
  weered_advantage: string;
  faq: FAQ[];
};

const DATA_PATH = path.join(process.cwd(), "data", "lfg-guides.json");
const GUIDES: Guide[] = (() => {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const list = parsed?.guides;
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("lfg-guides.json had no guides array");
    }
    return list as Guide[];
  } catch (e: any) {
    throw new Error(`Failed to load lfg-guides from ${DATA_PATH}: ${e.message}`);
  }
})();

function findGuide(id: string): Guide | undefined {
  return GUIDES.find((g) => g.lobby_id === id);
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return GUIDES.map((g) => ({ id: g.lobby_id }));
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const g = findGuide(params.id);
  if (!g) return { title: "LFG guide not found · Weered" };
  const title = `How to find a ${g.game_name} ${g.noun_singular} on Weered`;
  const description = g.tldr.length > 300 ? g.tldr.slice(0, 297) + "..." : g.tldr;
  const url = `${SITE}/lfg/${g.lobby_id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article" },
    robots: { index: true, follow: true },
  };
}

export default async function LfgGuidePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const g = findGuide(params.id);
  if (!g) notFound();

  const pageUrl = `${SITE}/lfg/${g.lobby_id}`;
  const lobbyUrl = `${SITE}/lobby/${g.lobby_id}`;
  const aboutUrl = `${SITE}/about/lobby/${g.lobby_id}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "LFG guides", item: `${SITE}/lfg` },
      { "@type": "ListItem", position: 3, name: `${g.game_name} ${g.noun_singular} finder`, item: pageUrl },
    ],
  };

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    dateModified: new Date().toISOString(),
    name: `How to find a ${g.game_name} ${g.noun_singular} on Weered`,
    description: g.tldr,
    url: pageUrl,
    step: [
      { "@type": "HowToStep", position: 1, name: `Open the ${g.game_name} lobby`, text: `Visit ${lobbyUrl} and join the lobby with any Weered account (Steam, Xbox, PSN, or email).` },
      { "@type": "HowToStep", position: 2, name: `Pick a room matched to your activity`, text: `Each room targets a specific ${g.game_name} activity type (${g.activity_types.slice(0, 3).map(a => a.name).join(", ")}, etc.).` },
      { "@type": "HowToStep", position: 3, name: `Post your LFG`, text: `Include the details that matter for ${g.game_name}: ${g.activity_types[0]?.typical_filters || "experience level, schedule, and platform"}.` },
      { "@type": "HowToStep", position: 4, name: `Connect and play`, text: `Reply to ${g.noun_plural} that match your fit, jump into the room's voice chat, and play.` },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    dateModified: new Date().toISOString(),
    mainEntity: g.faq.map(f => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main style={{
      padding: "32px 20px",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      maxWidth: 820,
      margin: "0 auto",
      lineHeight: 1.6,
      color: "#e8e8ea",
    }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <nav aria-label="Breadcrumb" style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
        <Link href="/" style={{ color: "#7c9dff" }}>Weered</Link>
        {" / "}
        <Link href="/lfg" style={{ color: "#7c9dff" }}>LFG guides</Link>
        {" / "}{g.game_name}
      </nav>

      <header style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>LFG guide</p>
        <h1 style={{ fontSize: 32, margin: "0 0 12px", lineHeight: 1.15 }}>
          How to find a {g.game_name} {g.noun_singular} on Weered
        </h1>
        <p style={{ fontSize: 17, opacity: 0.92 }}>{g.tldr}</p>
        <p style={{ marginTop: 16 }}>
          <Link href={`/lobby/${g.lobby_id}`} style={{
            display: "inline-block",
            padding: "10px 18px",
            background: "#7c9dff",
            color: "#0b0b10",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}>Open the {g.game_name} lobby →</Link>
        </p>
      </header>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>Activity types covered</h2>
        <p style={{ opacity: 0.85, marginBottom: 12 }}>
          The {g.game_name} lobby on Weered has dedicated rooms or post categories for each common LFG type:
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {g.activity_types.map((a, i) => (
            <div key={i} style={{
              padding: 14,
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ fontSize: 16, margin: 0 }}>{a.name}</h3>
                <span style={{ fontSize: 12, opacity: 0.6 }}>Typical size: {a.size}</span>
              </div>
              <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 6 }}>Examples: {a.examples}</p>
              <p style={{ fontSize: 13, opacity: 0.65, margin: 0 }}>Common filters: {a.typical_filters}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{
        marginBottom: 28,
        padding: 20,
        borderRadius: 8,
        background: "rgba(124,157,255,0.08)",
        border: "1px solid rgba(124,157,255,0.25)",
      }}>
        <h2 style={{ fontSize: 22, marginTop: 0, marginBottom: 10 }}>What Weered adds beyond {g.native_lfg.name}</h2>
        <p style={{ fontSize: 15, opacity: 0.95, marginBottom: 10 }}>{g.native_lfg.honest_take}</p>
        <p style={{ fontSize: 15, opacity: 0.95, margin: 0 }}><strong>Weered's edge:</strong> {g.weered_advantage}</p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>Common questions</h2>
        <div style={{ display: "grid", gap: 14 }}>
          {g.faq.map((f, i) => (
            <div key={i}>
              <h3 style={{ fontSize: 16, marginTop: 0, marginBottom: 6 }}>{f.q}</h3>
              <p style={{ fontSize: 15, opacity: 0.88, margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.1)",
        paddingTop: 16,
        marginTop: 32,
        fontSize: 14,
        opacity: 0.8,
      }}>
        <p style={{ marginBottom: 8 }}>
          <Link href={`/lobby/${g.lobby_id}`} style={{ color: "#7c9dff", fontWeight: 600 }}>→ Open the {g.game_name} lobby</Link>
        </p>
        <p style={{ marginBottom: 8 }}>
          <Link href={`/about/lobby/${g.lobby_id}`} style={{ color: "#7c9dff" }}>About the {g.game_name} lobby on Weered</Link>
        </p>
        <p style={{ marginBottom: 0 }}>
          <Link href="/lfg" style={{ color: "#7c9dff" }}>← All LFG guides</Link>
        </p>
      </footer>
    </main>
  );
}

export const revalidate = 3600;
