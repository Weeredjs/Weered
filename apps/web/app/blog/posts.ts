export type Post = {
  slug: string;
  title: string;
  date: string;
  dateLabel: string;
  excerpt: string;
};

export const POSTS: Post[] = [
  {
    slug: "build-notes-poe-tree-screened-media-friends",
    title: "Build notes: the PoE skill tree, screened media, and a friends layer",
    date: "2026-06-13",
    dateLabel: "June 13, 2026",
    excerpt: "We ship most days and don't usually stop to write it down. This week earned an exception.",
  },
];
