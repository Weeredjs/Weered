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

type FeedItem =
  | { type: "dm"; id: string; text: string; preview?: string; fromId: string; fromName: string; ts: number }
  | { type: "notification"; id: string; subType?: string; text: string; body?: string; actionUrl?: string | null; actorName?: string; read: boolean; ts: number }
  | { type: "notoriety"; id: string; text: string; points: number; action?: string; ts: number }
  | { type: "friend"; id: string; text: string; friendName?: string; ts: number };

type FeedResponse = { ok: boolean; feed: FeedItem[] };

const TYPE_COLOR: Record<string, string> = {
  dm: "#5800E5",
  notification: "#f59e0b",
  notoriety: "#22c55e",
  friend: "#06b6d4",
};

const TYPE_LABEL: Record<string, string> = {
  dm: "DM",
  notification: "Alert",
  notoriety: "XP",
  friend: "Friend",
};

export default function Activity() {
  const q = useQuery({
    queryKey: ["activity-feed"],
    queryFn: () => api<FeedResponse>("/activity-feed"),
    refetchInterval: 60_000,
  });

  const onRefresh = useCallback(() => q.refetch(), [q]);

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Activity" }} />
      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : q.error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-400 text-sm text-center">Couldn't load activity.</Text>
        </View>
      ) : (
        <FlatList
          data={q.data?.feed ?? []}
          keyExtractor={(item, i) => `${item.type}-${item.id}-${i}`}
          refreshControl={
            <RefreshControl refreshing={q.isRefetching} onRefresh={onRefresh} tintColor="#5800E5" />
          }
          ItemSeparatorComponent={() => <View className="h-px bg-border/30 mx-4" />}
          renderItem={({ item }) => <ActivityRow item={item} />}
          ListEmptyComponent={
            <View className="px-8 py-16 items-center">
              <Text className="text-weered-muted text-sm">No activity in the last 3 days.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function ActivityRow({ item }: { item: FeedItem }) {
  const color = TYPE_COLOR[item.type] || "#94a3b8";
  const label = TYPE_LABEL[item.type] || "Event";

  const onPress = () => {
    if (item.type === "dm") router.push(`/dm/${item.fromId}`);
    else if (item.type === "notification" && item.actionUrl) {
      const path = item.actionUrl.startsWith("http") ? new URL(item.actionUrl).pathname : item.actionUrl;
      router.push(path as any);
    } else if (item.type === "friend") router.push("/(tabs)/friends");
  };

  return (
    <Pressable onPress={onPress} className="px-4 py-3 flex-row items-start active:bg-panel">
      <View
        style={{
          minWidth: 44,
          alignItems: "center",
          paddingTop: 2,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: color + "22",
          borderWidth: 1,
          borderColor: color + "66",
          marginRight: 10,
        }}
      >
        <Text style={{ color, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }}>
          {label.toUpperCase()}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-weered-text text-sm font-semibold" numberOfLines={2}>
          {item.text}
        </Text>
        {item.type === "dm" && item.preview && (
          <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={2}>
            {item.preview}
          </Text>
        )}
        {item.type === "notification" && item.body && (
          <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={2}>
            {item.body}
          </Text>
        )}
        {item.type === "notoriety" && (
          <Text className="text-green-400 text-xs mt-0.5">+{item.points} notoriety</Text>
        )}
        <Text className="text-weered-muted/70 text-xs mt-1">{formatRelative(item.ts)}</Text>
      </View>
    </Pressable>
  );
}

function formatRelative(ts: number): string {
  try {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch { return ""; }
}
