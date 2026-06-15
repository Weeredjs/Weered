import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { NewsArticle as Article, NewsFeedResponse as FeedResp } from "@weered/shared";

const CATEGORIES = ["top", "gaming", "tech", "world", "sports", "finance"];

export default function News() {
  const [cat, setCat] = useState("top");

  const q = useQuery({
    queryKey: ["news-feed", cat],
    queryFn: () => api<FeedResp>(`/news/feed?category=${encodeURIComponent(cat)}`),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: "#0c0b0a" }}>
      <Stack.Screen options={{ title: "News" }} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{
          flexGrow: 0,
          backgroundColor: "#000",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(245,183,0,0.25)",
        }}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCat(c)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderBottomWidth: 2,
              borderBottomColor: cat === c ? "#5800E5" : "transparent",
            }}
          >
            <Text
              style={{
                color: cat === c ? "#ffffff" : "rgba(180,180,190,0.65)",
                fontFamily: "monospace",
                fontSize: 11,
                fontWeight: "900",
                letterSpacing: 1.4,
                textTransform: "uppercase",
              }}
            >
              {c}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {q.isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : (
        <ScrollView
          style={{ backgroundColor: "#0c0b0a" }}
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => q.refetch()}
              tintColor="#5800E5"
            />
          }
          contentContainerStyle={{ paddingBottom: 32, backgroundColor: "#0c0b0a" }}
        >
          {(q.data?.articles ?? []).length === 0 && (
            <Text
              style={{
                color: "rgba(203,213,225,0.6)",
                fontSize: 13,
                textAlign: "center",
                paddingVertical: 48,
              }}
            >
              No articles in {cat}.
            </Text>
          )}
          {q.data?.articles?.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => router.push(`/reader?url=${encodeURIComponent(a.url)}`)}
              style={{
                flexDirection: "row",
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255,255,255,0.05)",
              }}
            >
              {a.imageUrl ? (
                <Image
                  source={{ uri: a.imageUrl }}
                  style={{ width: 88, height: 88, borderRadius: 4, backgroundColor: "#1a1a1a" }}
                />
              ) : null}
              <View style={{ flex: 1, marginLeft: a.imageUrl ? 12 : 0, minWidth: 0 }}>
                <Text
                  numberOfLines={a.imageUrl ? 3 : 4}
                  style={{
                    color: "rgba(243,244,246,0.96)",
                    fontSize: 14,
                    fontWeight: "700",
                    lineHeight: 18,
                  }}
                >
                  {a.title}
                </Text>
                {!a.imageUrl && !!a.description && (
                  <Text
                    numberOfLines={2}
                    style={{
                      color: "rgba(203,213,225,0.65)",
                      fontSize: 12,
                      marginTop: 4,
                      lineHeight: 16,
                    }}
                  >
                    {a.description}
                  </Text>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                  {a.sourceIcon && (
                    <Image
                      source={{ uri: a.sourceIcon }}
                      style={{ width: 12, height: 12, borderRadius: 2, marginRight: 6 }}
                    />
                  )}
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: "rgba(203,213,225,0.6)",
                      fontFamily: "monospace",
                      fontSize: 10,
                      fontWeight: "700",
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
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
  } catch {
    return "";
  }
}
