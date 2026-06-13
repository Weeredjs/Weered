import { Metadata } from "next";
import BookmarksPage from "../../../components/forum/BookmarksPage";

export const metadata: Metadata = {
  title: "Saved posts | Weered Forum",
  description: "Your saved posts on Weered.",
  robots: { index: false, follow: false },
};

export default function ForumBookmarks() {
  return <BookmarksPage />;
}
