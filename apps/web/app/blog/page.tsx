import { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "../../components/MarketingHeader";
import { POSTS } from "./posts";

const TITLE = "Weered blog: build notes and dispatches";
const DESC = "What's shipping on Weered: build notes, feature launches, and the occasional story from the lobbies.";
const URL = "https://weered.ca/blog";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, type: "website", siteName: "Weered" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export default function BlogIndex() {
  return (
    <>
      <MarketingHeader ctaHref="/lobby" ctaLabel="Open Weered" />
      <main className="mkt">
        <section className="mkt-hero">
          <div className="mkt-wrap">
            <span className="mkt-eyebrow">Blog</span>
            <h1 className="mkt-h1">Build notes &amp; dispatches</h1>
            <p className="mkt-sub">
              What&apos;s shipping, what&apos;s coming, and the occasional story from the lobbies.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            {POSTS.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="mkt-card"
                style={{ display: "block", marginBottom: 16, textDecoration: "none" }}
              >
                <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 6 }}>{p.dateLabel}</div>
                <h3>{p.title}</h3>
                <p>{p.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
