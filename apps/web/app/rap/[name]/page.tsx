import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RapSheetView from "./RapSheetView";
import { rapLink, STATUS, type RapSheet } from "../../../lib/rapSheet";

// weered.ca/rap/<name>: a player's rap sheet, the page a shared link opens
// (2026-11-01). Read from the API on this machine, like the middleware does.
const API_INTERNAL = process.env.WEERED_API_INTERNAL || "http://127.0.0.1:4000";

async function fetchSheet(name: string): Promise<RapSheet | null> {
  try {
    const r = await fetch(`${API_INTERNAL}/rapsheet/${encodeURIComponent(name)}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.ok ? (j.sheet as RapSheet) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(props: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await props.params;
  const s = await fetchSheet(name);
  if (!s) return { title: "Rap sheet | Weered", robots: { index: false } };
  const title = `${s.name}'s rap sheet | Weered`;
  const description = [
    `${s.rank.title}, ${STATUS[s.tier] || "Innocent"}.`,
    s.crew ? `Rides with ${s.crew.tag ? `[${s.crew.tag}] ` : ""}${s.crew.name}.` : "",
    s.playstyles.length ? `Into ${s.playstyles.slice(0, 3).join(", ").toLowerCase()}.` : "",
    s.lookingForLabel ? `Wants: ${s.lookingForLabel.toLowerCase()}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  // The card as a picture (app/og/rap/[name]/route.tsx), by its full address.
  const image = {
    url: `https://weered.ca/og/rap/${encodeURIComponent(s.username)}`,
    width: 1200,
    height: 630,
    alt: `${s.name}'s rap sheet`,
  };
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: rapLink(s),
      type: "profile",
      siteName: "Weered",
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
    alternates: { canonical: rapLink(s) },
  };
}

export default async function RapSheetPage(props: { params: Promise<{ name: string }> }) {
  const { name } = await props.params;
  const s = await fetchSheet(name);
  if (!s) notFound();
  return <RapSheetView sheet={s} />;
}
