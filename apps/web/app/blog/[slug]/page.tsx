import { Metadata } from "next";
import { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingHeader from "../../../components/MarketingHeader";
import { POSTS } from "../posts";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) return {};
  const url = `https://weered.ca/blog/${post.slug}`;
  return {
    title: { absolute: `${post.title} — Weered` },
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: { title: post.title, description: post.excerpt, url, type: "article", siteName: "Weered" },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt },
  };
}

const BODIES: Record<string, ReactNode> = {
  "build-notes-poe-tree-screened-media-friends": (
    <>
      <p className="mkt-p">
        We ship most days and don&apos;t usually stop to write it down. This week earned an exception. Three things landed that change what Weered can actually do, so here&apos;s the rundown.
      </p>

      <h2 className="mkt-h2">The Path of Exile tree, painted and live</h2>
      <p className="mkt-p">
        The <Link href="/play/path-of-exile">Path of Exile</Link> lobby now renders the real passive tree, painted node art and all, pulled straight from Grinding Gear&apos;s own data. Link your account and it lights up your actual build, ascendancy and all. The economy tab went live on the official Currency Exchange at the same time, so the prices you see are real and current, not scraped off a third party that shut its doors. One divine in chaos, updated every hour, with the orb art next to it.
      </p>

      <h2 className="mkt-h2">Images in chat that can&apos;t ambush you</h2>
      <p className="mkt-p">
        You can post images in chat now. Every one gets screened on your own device before it even uploads, checked again on our servers, and re-encoded to strip the hidden data like the GPS coordinates baked into a photo. If the poster hasn&apos;t earned a track record yet, their image shows up blurred until you choose to look. Throwaway accounts can&apos;t post at all. The full posture is on the <Link href="/safety">safety page</Link>, and it&apos;s the part we&apos;re proudest of this week.
      </p>

      <h2 className="mkt-h2">Friends, and the right to be left alone</h2>
      <p className="mkt-p">
        Add a friend from anyone&apos;s profile or straight off the hover card. Pull a friend into your room with an invite, or jump into theirs. And you decide who&apos;s allowed to do either, all the way down to nobody. Lying low without going dark is a setting now, not a workaround.
      </p>

      <h2 className="mkt-h2">The part you won&apos;t see</h2>
      <p className="mkt-p">
        We also moved the whole platform onto the current framework versions and cut the lobby page&apos;s load weight nearly in half. You won&apos;t notice that one looking at it. You&apos;ll feel it when the page snaps open.
      </p>

      <p className="mkt-p">
        More next week. There&apos;s always more.
      </p>
    </>
  ),
};

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) notFound();
  const body = BODIES[slug];

  return (
    <>
      <MarketingHeader ctaHref="/lobby" ctaLabel="Open Weered" />
      <main className="mkt">
        <article className="mkt-section">
          <div className="mkt-wrap" style={{ maxWidth: 760 }}>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>{post.dateLabel}</div>
            <h1 className="mkt-h1" style={{ fontSize: "2.2rem", lineHeight: 1.15 }}>{post.title}</h1>
            <div style={{ marginTop: 24 }}>{body}</div>
            <p className="mkt-p" style={{ marginTop: 36 }}>
              <Link href="/blog">← All posts</Link>
            </p>
          </div>
        </article>
      </main>
    </>
  );
}
