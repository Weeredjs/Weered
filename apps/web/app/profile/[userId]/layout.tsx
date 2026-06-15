import { Metadata } from "next";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export async function generateMetadata(props: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const userId = decodeURIComponent(params.userId);
  let name = userId;
  let description = `View ${userId}'s profile on Weered.`;

  try {
    const res = await fetch(`${API}/profile/${encodeURIComponent(userId)}`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.name) {
        name = data.name;
        description = data.bio
          ? `${data.name} on Weered — ${data.bio}`
          : `${data.name}'s profile on Weered. ${data.tier || "Innocent"} tier.`;
      }
    }
  } catch {}

  return {
    title: `${name} — Weered Profile`,
    description,
    openGraph: {
      title: `${name} — Weered`,
      description,
      url: `https://weered.ca/profile/${encodeURIComponent(userId)}`,
    },
    alternates: { canonical: `https://weered.ca/profile/${encodeURIComponent(userId)}` },
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
