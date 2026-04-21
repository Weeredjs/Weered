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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  actorId: string | null;
  actorName: string | null;
  actorAvatar?: string | null;
  read: boolean;
  createdAt: string;
  meta?: any;
};

type NotificationsResponse = { ok: boolean; notifications: Notification[]; unreadCount: number };

export default function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<NotificationsResponse>("/notifications?limit=50"),
  });

  const markAll = useMutation({
    mutationFn: () => api("/notifications/read", { method: "PATCH", body: { all: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api("/notifications/read", { method: "PATCH", body: { ids: [id] } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const onRefresh = useCallback(() => q.refetch(), [q]);

  const unreadCount = q.data?.unreadCount ?? 0;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen
        options={{
          title: "Notifications",
          headerRight: () =>
            unreadCount > 0 ? (
              <Pressable onPress={() => markAll.mutate()} hitSlop={8}>
                <Text className="text-weered-muted text-sm">Mark all read</Text>
              </Pressable>
            ) : null,
        }}
      />

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : q.error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-400 text-sm text-center">Couldn't load notifications.</Text>
        </View>
      ) : (
        <FlatList
          data={q.data?.notifications ?? []}
          keyExtractor={(n) => n.id}
          refreshControl={
            <RefreshControl refreshing={q.isRefetching} onRefresh={onRefresh} tintColor="#5800E5" />
          }
          ItemSeparatorComponent={() => <View className="h-px bg-border/30 mx-4" />}
          renderItem={({ item }) => (
            <NotificationRow
              n={item}
              onPress={() => {
                if (!item.read) markRead.mutate(item.id);
                if (item.actionUrl) {
                  // expo-router accepts paths; strip leading origin if any.
                  const path = item.actionUrl.startsWith("http") ? new URL(item.actionUrl).pathname : item.actionUrl;
                  router.push(path as any);
                }
              }}
            />
          )}
          ListEmptyComponent={
            <View className="px-8 py-16 items-center">
              <Text className="text-weered-muted text-sm">No notifications yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function NotificationRow({ n, onPress }: { n: Notification; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-start px-4 py-3 active:bg-panel"
      style={{ backgroundColor: n.read ? "transparent" : "rgba(88,0,229,0.06)" }}
    >
      <View className="mr-3 mt-0.5">
        <Avatar name={n.actorName || n.title || "?"} url={n.actorAvatar} size={36} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center">
          {!n.read && (
            <View
              style={{
                width: 6, height: 6, borderRadius: 3, backgroundColor: "#5800E5", marginRight: 6,
              }}
            />
          )}
          <Text className="text-weered-text font-semibold text-sm flex-1" numberOfLines={2}>
            {n.title}
          </Text>
        </View>
        {!!n.body && (
          <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={2}>
            {n.body}
          </Text>
        )}
        <Text className="text-weered-muted/70 text-xs mt-1">{formatRelative(n.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

function formatRelative(iso: string): string {
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch { return iso; }
}
