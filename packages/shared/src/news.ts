// News article types — what /news/feed returns.

export type NewsCategory = "top" | "gaming" | "tech" | "world" | "sports" | "finance" | "canada";

export interface NewsArticle {
  id: string;
  guid?: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  source: string;
  sourceIcon: string | null;
  category: NewsCategory | string;
  publishedAt: string;
  heat?: number;
}

export interface NewsFeedResponse {
  ok: boolean;
  articles: NewsArticle[];
  updatedAt: string;
}
