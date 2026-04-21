import { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";

type Preview = {
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  lastMessage: string;
  lastTs: string;
  unread: boolean;
  isFromMe: boolean;
};

type PreviewsResponse = { ok: boolean; previews: Preview[] };

export default function DMs() {
  const q = useQuery({
    queryKey: ["dm-previews"],
    queryFn: () => api<PreviewsResponse>("/dm/previews"),
    refetchInterval: 15_000,
  });

  const onRefresh = useCallback(() => q.refetch(), [q]);

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Inbox" }} />
      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : q.error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-400 text-sm text-center">Couldn't load conversations.</Text>
        </View>
      ) : (
        <FlatList
          data={q.data?.previews ?? []}
          keyExtractor={(p) => p.peerId}
          refreshControl={
            <RefreshControl refreshing={q.isRefetching} onRefresh={onRefresh} tintColor="#5800E5" />
          }
          ItemSeparatorComponent={() => <View className="h-px bg-border/30 mx-4" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/dm/${item.peerId}`)}
              className="px-4 py-3 flex-row items-center active:bg-panel"
              style={{ backgroundColor: item.unread ? "rgba(88,0,229,0.06)" : "transparent" }}
            >
              <View className="mr-3">
                <Avatar name={item.peerName} url={item.peerAvatar} size={44} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-weered-text font-bold text-base flex-1" numberOfLines={1}>
                    {item.peerName}
                  </Text>
                  <Text className="text-weered-muted text-xs ml-2">{formatRelative(item.lastTs)}</Text>
                </View>
                <View className="flex-row items-center mt-0.5">
                  <Text
                    className={`text-sm flex-1 ${item.unread ? "text-weered-text font-semibold" : "text-weered-muted"}`}
                    numberOfLines={1}
                  >
                    {item.isFromMe ? "You: " : ""}{item.lastMessage}
                  </Text>
                  {item.unread && (
                    <View
                      className="ml-2"
                      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#5800E5" }}
                    />
                  )}
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="px-8 py-16 items-center">
              <Text className="text-weered-muted text-sm">No conversations yet.</Text>
              <Text className="text-weered-muted/70 text-xs mt-2 text-center">
                Tap Message on a friend's profile to start one.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(iso).toLocaleDateString();
  } catch { return ""; }
}
