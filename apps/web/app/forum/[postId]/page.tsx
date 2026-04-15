import { Metadata } from "next";
import PostDetail from "../../../components/forum/PostDetail";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export async function generateMetadata({ params }: { params: { postId: string } }): Promise<Metadata> {
  let title = "Post — Weered Forum";
  let description = "A discussion on the Weered community forum.";
  try {
    const res = await fetch(`${API}/forum/posts/${params.postId}`, { next: { revalidate: 300 } });
    if (res.ok) {
      const data = await res.json();
      const post = data.post || data;
      if (post.title) title = post.title;
      if (post.body) description = post.body.slice(0, 160).replace(/\n/g, " ");
    }
  } catch {}
  return {
    title,
    description,
    openGraph: {
      title: `${title} — Weered Forum`,
      description,
      url: `https://weered.ca/forum/${params.postId}`,
    },
    twitter: {
      card: "summary",
      title: `${title} — Weered Forum`,
      description,
    },
    alternates: { canonical: `https://weered.ca/forum/${params.postId}` },
  };
}

export default function ForumPostPage({ params }: { params: { postId: string } }) {
  return <PostDetail postId={params.postId} />;
}
