import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Post = {
  id: string;
  title: string;
  body: string;
  authorName: string;
  score: number;
  commentCount: number;
  pinned: boolean;
  locked: boolean;
  createdAt: string;
};
type ListResp = { ok: boolean; posts: Post[] };

export function LobbyForum({ lobbyId }: { lobbyId: string }) {
  const q = useQuery({
    queryKey: ["lobby-forum", lobbyId],
    queryFn: () =>
      api<ListResp>(`/forum/posts?lobbyId=${encodeURIComponent(lobbyId)}&sort=hot&limit=5`),
    enabled: !!lobbyId,
  });

  const posts = q.data?.posts ?? [];

  return (
    <View className="border-t border-border/40 pt-3 pb-1">
      <View className="flex-row items-center px-4 pb-2">
        <Text className="text-weered-muted text-xs uppercase tracking-wide flex-1">Forum</Text>
        <Pressable
          onPress={() => router.push(`/forum?lobbyId=${lobbyId}`)}
          hitSlop={6}
          className="active:opacity-70"
        >
          <Text className="text-weered text-xs font-bold">View all →</Text>
        </Pressable>
      </View>

      {q.isLoading && (
        <View className="py-4 items-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      )}

      {!q.isLoading && posts.length === 0 && (
        <Text className="text-weered-muted text-sm px-4 pb-3">No forum posts yet.</Text>
      )}

      {posts.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => router.push(`/forum/${p.id}`)}
          className="px-4 py-2.5 border-b border-border/20 active:bg-panel"
        >
          <View className="flex-row items-center mb-1">
            {p.pinned && <Text className="text-amber-400 text-xs font-bold mr-2">★</Text>}
            {p.locked && <Text className="text-weered-muted text-xs mr-2">🔒</Text>}
            <Text className="text-weered-muted text-xs">by {p.authorName}</Text>
          </View>
          <Text className="text-weered-text font-semibold text-sm" numberOfLines={2}>
            {p.title}
          </Text>
          <View className="flex-row items-center mt-1">
            <Text className="text-weered text-xs font-bold mr-3">▲ {p.score}</Text>
            <Text className="text-weered-muted text-xs">💬 {p.commentCount}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
