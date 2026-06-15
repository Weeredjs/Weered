import { Metadata } from "next";
import CrewView from "./CrewView";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

async function fetchCrew(crewId: string) {
  try {
    const r = await fetch(`${API}/crews/${encodeURIComponent(crewId)}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.ok ? j.crew : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(props: {
  params: Promise<{ crewId: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const c = await fetchCrew(params.crewId);
  if (!c) return { title: "Crew | Weered", description: "A crew on Weered." };
  const recruitStatus = c.recruiting ? "Recruiting now" : "Closed ranks";
  const tag = c.tag ? ` [${c.tag}]` : "";
  const title = `${c.name}${tag} | Weered Crew`;
  const description = c.description
    ? `${c.description.slice(0, 140)}${c.description.length > 140 ? "…" : ""}`
    : `${c.memberCount} member${c.memberCount === 1 ? "" : "s"} · ${recruitStatus}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://weered.ca/crew/${params.crewId}`,
      type: "profile",
      images: c.bannerUrl ? [{ url: c.bannerUrl, alt: c.name }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: `https://weered.ca/crew/${params.crewId}` },
  };
}

export default async function CrewPage(props: { params: Promise<{ crewId: string }> }) {
  const params = await props.params;
  const c = await fetchCrew(params.crewId);
  return <CrewView crewId={params.crewId} initial={c} />;
}
