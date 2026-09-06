import { Metadata } from "next";
import { Suspense } from "react";
import ForumPage from "../../components/forum/ForumPage";

export const metadata: Metadata = {
  title: "Forum | Weered",
  description: "Bug reports, feature requests, and community discussion on Weered.",
  openGraph: {
    title: "Weered Forum",
    description: "Community discussion, bug reports, and feature requests.",
    url: "https://weered.ca/forum",
  },
  alternates: { canonical: "https://weered.ca/forum" },
};

export default function Forum() {
  // ForumPage reads `?post=` so a thread can open inside a lobby instead of
  // navigating out of it. useSearchParams opts a component out of prerendering,
  // and this page is statically exported, so it needs a boundary or the build
  // fails on /forum. The lobby embeds it inside an already-dynamic route and
  // needs none.
  return (
    <Suspense fallback={null}>
      <ForumPage />
    </Suspense>
  );
}
