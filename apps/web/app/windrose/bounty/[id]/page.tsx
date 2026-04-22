import { Metadata } from "next";
import BountyView from "./BountyView";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

async function fetchBounty(id: string) {
  try {
    const r = await fetch(`${API}/windrose/bounties/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.ok ? j.bounty : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const b = await fetchBounty(params.id);
  if (!b) {
    return { title: "Bounty — Weered", description: "A Windrose bounty on Weered." };
  }
  const status = b.status === "OPEN" ? "OPEN"
    : b.status === "CLAIMED" ? "AWAITING SETTLE"
    : b.status === "SETTLED" ? "SETTLED"
    : "CANCELLED";
  const title = `${b.amount.toLocaleString()} Paper on ${b.targetHandle} · Windrose Bounty`;
  const description = b.status === "SETTLED"
    ? `${b.claimantName || "A hunter"} delivered on ${b.targetHandle} for ${b.amount.toLocaleString()} Paper. Posted by ${b.posterName}.`
    : b.status === "OPEN"
    ? `${b.amount.toLocaleString()} Paper on ${b.targetHandle}. Posted by ${b.posterName}. [${status}]`
    : `Bounty on ${b.targetHandle} — ${b.amount.toLocaleString()} Paper. [${status}]`;
  return {
    title,
    description,
    openGraph: { title, description, url: `https://weered.ca/windrose/bounty/${params.id}`, type: "article" },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: `https://weered.ca/windrose/bounty/${params.id}` },
  };
}

export default async function BountyPage({ params }: { params: { id: string } }) {
  const b = await fetchBounty(params.id);
  return <BountyView id={params.id} initial={b} />;
}
