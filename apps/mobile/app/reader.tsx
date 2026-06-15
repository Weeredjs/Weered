import { View, Text, ScrollView, Image, Pressable, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type ReaderResp = {
  ok?: boolean;
  title: string;
  image: string | null;
  description: string;
  siteName: string;
  author: string | null;
  publishedAt: string | null;
  body: string;
  url: string;
  error?: string;
};

const MD_IMAGE = /!\[([^\]]*)\]\(([^)]+)\)/;

export default function Reader() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const targetUrl = String(url || "");

  const q = useQuery({
    queryKey: ["reader", targetUrl],
    queryFn: () => api<ReaderResp>(`/news/reader?url=${encodeURIComponent(targetUrl)}`),
    enabled: !!targetUrl,
    staleTime: 30 * 60 * 1000,
  });

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen
        options={{
          title: "Reader",
          headerRight: () => (
            <Pressable
              onPress={() => targetUrl && Linking.openURL(targetUrl).catch(() => {})}
              hitSlop={8}
              className="mr-2 active:opacity-70"
            >
              <Text className="text-weered font-semibold">Open ↗</Text>
            </Pressable>
          ),
        }}
      />

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : q.error || !q.data?.title ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-400 text-sm text-center mb-3">Couldn't extract article.</Text>
          <Pressable
            onPress={() => Linking.openURL(targetUrl).catch(() => {})}
            className="bg-weered px-4 py-2.5 rounded-lg active:opacity-80"
          >
            <Text className="text-white font-bold">Open in browser</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {q.data.image && (
            <Image
              source={{ uri: q.data.image }}
              style={{ width: "100%", height: 220, backgroundColor: "#1a1a1a" }}
              resizeMode="cover"
            />
          )}
          <View className="px-4 pt-4">
            <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">
              {q.data.siteName}
              {q.data.author ? ` · ${q.data.author}` : ""}
              {q.data.publishedAt ? ` · ${new Date(q.data.publishedAt).toLocaleDateString()}` : ""}
            </Text>
            <Text className="text-weered-text font-black text-2xl mb-4">{q.data.title}</Text>
            <ArticleBody body={q.data.body} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ArticleBody({ body }: { body: string }) {
  const blocks = body.split(/\n\n+/);
  return (
    <View>
      {blocks.map((block, i) => {
        const m = block.match(MD_IMAGE);
        if (m) {
          return (
            <Image
              key={i}
              source={{ uri: m[2] }}
              style={{
                width: "100%",
                aspectRatio: 16 / 9,
                borderRadius: 8,
                marginVertical: 12,
                backgroundColor: "#1a1a1a",
              }}
              resizeMode="cover"
            />
          );
        }
        return (
          <Text
            key={i}
            className="text-weered-text mb-4"
            style={{ fontSize: 16, lineHeight: 24 }}
            selectable
          >
            {block}
          </Text>
        );
      })}
    </View>
  );
}
