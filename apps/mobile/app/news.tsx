import { useState } from "react";
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Article = {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  source: string;
  sourceIcon: string | null;
  category: string;
  publishedAt: string;
};
type FeedResp = { ok: boolean; articles: Article[]; updatedAt: string };

const CATEGORIES = ["top", "gaming", "tech", "world", "sports", "finance"];

export default function News() {
  const [cat, setCat] = useState("top");

  const q = useQuery({
    queryKey: ["news-feed", cat],
    queryFn: () => api<FeedResp>(`/news/feed?category=${encodeURIComponent(cat)}`),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "News" }} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-b border-border/40"
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        {CATEGORIES.map((c) => (
          <Pressable key={c} onPress={() => setCat(c)} className="px-3 py-3 active:opacity-70">
            <Text className={`text-xs uppercase tracking-wide font-bold ${cat === c ? "text-weered" : "text-weered-muted"}`}>
              {c}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#5800E5" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor="#5800E5" />}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {(q.data?.articles ?? []).length === 0 && (
            <Text className="text-weered-muted text-sm text-center py-12">No articles in {cat}.</Text>
          )}
          {q.data?.articles?.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => router.push(`/reader?url=${encodeURIComponent(a.url)}`)}
              className="px-4 py-3 border-b border-border/30 flex-row active:bg-panel"
            >
              {a.imageUrl ? (
                <Image source={{ uri: a.imageUrl }} style={{ width: 84, height: 84, borderRadius: 8, backgroundColor: "#1a1a1a" }} />
              ) : (
                <View style={{ width: 84, height: 84, borderRadius: 8, backgroundColor: "#1a1a1a" }} />
              )}
              <View className="flex-1 ml-3">
                <Text className="text-weered-text font-semibold text-sm" numberOfLines={3}>{a.title}</Text>
                <View className="flex-row items-center mt-1">
                  {a.sourceIcon && (
                    <Image source={{ uri: a.sourceIcon }} style={{ width: 12, height: 12, borderRadius: 2, marginRight: 6 }} />
                  )}
                  <Text className="text-weered-muted text-xs flex-1" numberOfLines={1}>
                    {a.source} · {formatRel(a.publishedAt)}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function formatRel(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  } catch { return ""; }
}
