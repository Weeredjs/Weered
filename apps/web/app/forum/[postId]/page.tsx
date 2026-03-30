import { Metadata } from "next";
import PostDetail from "../../../components/forum/PostDetail";

export async function generateMetadata({ params }: { params: { postId: string } }): Promise<Metadata> {
  return {
    title: "Post — Weered Forum",
    alternates: { canonical: `https://weered.ca/forum/${params.postId}` },
  };
}

export default function ForumPostPage({ params }: { params: { postId: string } }) {
  return <PostDetail postId={params.postId} />;
}
