import { useState } from "react";
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type FeedItem = {
  id: string;
  url: string;
  title: string;
  thumbnail: string | null;
  domain: string;
  sourceName: string;
  category: string;
  heat: number;
  usersInRoom: number;
  postedAt: string;
};
type FeedResp = { items: FeedItem[]; updatedAt: string };

const CATEGORIES = ["all", "gaming", "tech", "entertainment", "sports"];

export default function Hot() {
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<"hot" | "new">("hot");

  const q = useQuery({
    queryKey: ["feed-hot", cat, sort],
    queryFn: () => api<FeedResp>(`/feed/hot?category=${encodeURIComponent(cat)}&sort=${sort}`),
    staleTime: 2 * 60 * 1000,
  });

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Hot" }} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-b border-border/40"
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        {CATEGORIES.map((c) => (
          <Pressable key={c} onPress={() => setCat(c)} className="px-3 py-3 active:opacity-70">
            <Text className={`text-xs uppercase tracking-wide font-bold ${cat === c ? "text-weered" : "text-weered-muted"}`}>{c}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setSort(sort === "hot" ? "new" : "hot")} className="px-3 py-3 active:opacity-70">
          <Text className="text-weered-muted text-xs uppercase tracking-wide font-bold">{sort === "hot" ? "🔥 Hot" : "🕒 New"}</Text>
        </Pressable>
      </ScrollView>

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#5800E5" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor="#5800E5" />}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {(q.data?.items ?? []).length === 0 && (
            <Text className="text-weered-muted text-sm text-center py-12">Nothing hot here yet.</Text>
          )}
          {q.data?.items?.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => router.push(`/reader?url=${encodeURIComponent(it.url)}`)}
              className="px-4 py-3 border-b border-border/30 active:bg-panel"
            >
              <View className="flex-row">
                {it.thumbnail ? (
                  <Image source={{ uri: it.thumbnail }} style={{ width: 100, height: 75, borderRadius: 8, backgroundColor: "#1a1a1a" }} />
                ) : (
                  <View style={{ width: 100, height: 75, borderRadius: 8, backgroundColor: "#1a1a1a" }} />
                )}
                <View className="flex-1 ml-3">
                  <Text className="text-weered-text font-semibold text-sm" numberOfLines={3}>{it.title}</Text>
                  <View className="flex-row items-center mt-1 flex-wrap">
                    <Text className="text-weered-muted text-xs">{it.sourceName || it.domain}</Text>
                    <Text className="text-weered-muted text-xs mx-1">·</Text>
                    <Text className="text-weered-muted text-xs">{it.category}</Text>
                    <Text className="text-weered-muted text-xs mx-1">·</Text>
                    <Text className="text-weered text-xs font-bold">🔥 {it.heat}</Text>
                    {it.usersInRoom > 0 && (
                      <>
                        <Text className="text-weered-muted text-xs mx-1">·</Text>
                        <Text className="text-green-400 text-xs">{it.usersInRoom} in rooms</Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
