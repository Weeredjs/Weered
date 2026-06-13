
import type { Metadata } from "next";
import { redirect } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

async function fetchBuild(slug: string) {
  try {
    const r = await fetch(`${API_BASE}/windrose/builds/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.ok) return null;
    return j.build as any;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const build = await fetchBuild(slug);
  if (!build) {
    return {
      title: "Build not found · Weered",
      description: "This Windrose build could not be found.",
    };
  }
  const images = Array.isArray(build.images) ? build.images : [];
  const primaryUrl = images[0]?.url || build.thumbnailUrl || null;
  const desc = (build.description || "").slice(0, 200) || `Filed by ${build.author?.name || "a Captain"}`;
  const title = `${build.title} | Windrose build by ${build.author?.name || "?"}`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type: "article",
      siteName: "Weered",
      images: primaryUrl ? [{ url: primaryUrl, alt: build.title }] : undefined,
    },
    twitter: {
      card: primaryUrl ? "summary_large_image" : "summary",
      title,
      description: desc,
      images: primaryUrl ? [primaryUrl] : undefined,
    },
  };
}

export default async function BuildSharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/lobby/windrose?build=${encodeURIComponent(slug)}`);
}
