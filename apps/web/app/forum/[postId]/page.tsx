import { Metadata } from "next";
import PostDetail from "../../../components/forum/PostDetail";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
const SITE = "https://weered.ca";

async function fetchPost(postId: string): Promise<any | null> {
  try {
    const res = await fetch(`${API}/forum/posts/${postId}`, { next: { revalidate: 300 } });
    if (res.ok) {
      const data = await res.json();
      return data.post || data;
    }
  } catch {}
  return null;
}

export async function generateMetadata(props: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const post = await fetchPost(params.postId);
  const title = post?.title || "Post | Weered Forum";
  const description = post?.body
    ? String(post.body).slice(0, 160).replaceAll(/\n/g, " ")
    : "A discussion on the Weered community forum.";
  return {
    title,
    description,
    openGraph: {
      title: `${title} | Weered Forum`,
      description,
      url: `${SITE}/forum/${params.postId}`,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${title} | Weered Forum`,
      description,
    },
    alternates: { canonical: `${SITE}/forum/${params.postId}` },
  };
}

export default async function ForumPostPage(props: { params: Promise<{ postId: string }> }) {
  const params = await props.params;
  const post = await fetchPost(params.postId);
  const url = `${SITE}/forum/${params.postId}`;
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Forum", item: `${SITE}/forum` },
      { "@type": "ListItem", position: 3, name: post?.title || "Post", item: url },
    ],
  };
  const posting = post
    ? {
        "@context": "https://schema.org",
        "@type": "DiscussionForumPosting",
        headline: post.title || "Forum post",
        articleBody: post.body || "",
        url,
        datePublished: post.createdAt || undefined,
        dateModified: post.updatedAt || post.createdAt || undefined,
        author: post.author?.usernameKey
          ? {
              "@type": "Person",
              name: post.author.usernameKey,
              url: `${SITE}/u/${post.author.usernameKey}`,
            }
          : undefined,
        interactionStatistic: [
          {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/LikeAction",
            userInteractionCount: Number(post.score || 0),
          },
          {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/CommentAction",
            userInteractionCount: Number(post.commentCount || 0),
          },
        ],
      }
    : null;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      {posting && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(posting) }}
        />
      )}
      <PostDetail postId={params.postId} />
    </>
  );
}
