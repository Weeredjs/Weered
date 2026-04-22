import { Metadata } from "next";
import HunterDossierView from "./HunterDossierView";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

async function fetchDossier(userId: string) {
  try {
    const r = await fetch(`${API}/windrose/hunter/${encodeURIComponent(userId)}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.ok ? j : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { userId: string } }): Promise<Metadata> {
  const d = await fetchDossier(decodeURIComponent(params.userId));
  const name = d?.user?.name || "Hunter";
  const kills = d?.hunter?.kills ?? 0;
  const earned = d?.hunter?.totalEarned ?? 0;
  const rank = d?.hunter?.rank ? `#${d.hunter.rank}` : "unranked";
  const title = `${name} · Windrose Bounty Hunter Dossier`;
  const description = d
    ? `${kills} confirmed kill${kills === 1 ? "" : "s"} · ${earned.toLocaleString()} Paper earned · rank ${rank}. Live hunter record on Weered.`
    : `Bounty hunter dossier on Weered.`;
  return {
    title,
    description,
    openGraph: { title, description, url: `https://weered.ca/windrose/hunter/${params.userId}`, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: `https://weered.ca/windrose/hunter/${params.userId}` },
  };
}

export default async function HunterPage({ params }: { params: { userId: string } }) {
  const d = await fetchDossier(decodeURIComponent(params.userId));
  return <HunterDossierView userId={params.userId} initial={d} />;
}
