import { Metadata } from "next";
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
  return <ForumPage />;
}
