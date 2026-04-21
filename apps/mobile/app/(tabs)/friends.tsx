import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";

type LivePresence = {
  source: "STEAM" | "TWITCH" | "XBOX";
  activity: string;
  detail?: string | null;
} | null;

type Friend = {
  id: string;
  name: string;
  avatar?: string | null;
  avatarColor?: string | null;
  globalRole?: string | null;
  tier?: string | null;
  online: boolean;
  isAway?: boolean;
  roomId?: string | null;
  roomName?: string | null;
  roomIsLobby?: boolean;
  livePresence?: LivePresence;
};

type FriendRequest = {
  id: string;
  fromId: string;
  fromName: string;
  fromAvatar?: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
};

type FriendsResponse = { ok?: boolean; friends: Friend[] };
type RequestsResponse = { ok?: boolean; requests: FriendRequest[] };

const PRESENCE_COLORS: Record<string, string> = {
  STEAM: "#66c0f4",
  TWITCH: "#a970ff",
  XBOX: "#52b043",
};
function presenceColor(source?: string): string {
  return (source && PRESENCE_COLORS[source]) || "#94a3b8";
}

type Tab = "friends" | "requests";

export default function Friends() {
  const [tab, setTab] = useState<Tab>("friends");

  return (
    <SafeAreaView edges={[]} className="flex-1 bg-weered-bg">
      <View className="flex-row border-b border-border/40">
        <TabButton label="Friends" active={tab === "friends"} onPress={() => setTab("friends")} />
        <TabButton label="Requests" active={tab === "requests"} onPress={() => setTab("requests")} />
      </View>
      {tab === "friends" ? <FriendsList /> : <RequestsList />}
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-3"
      style={{ borderBottomWidth: 2, borderBottomColor: active ? "#5800E5" : "transparent" }}
    >
      <Text
        className="text-sm font-bold tracking-wide"
        style={{ color: active ? "#ffffff" : "rgba(180,180,190,0.7)" }}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

function FriendsList() {
  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["friends"],
    queryFn: () => api<FriendsResponse>("/friends"),
    refetchInterval: 30_000,
  });

  const { online, offline } = useMemo(() => {
    const friends = data?.friends ?? [];
    return {
      online: friends.filter((f) => f.online).sort((a, b) => a.name.localeCompare(b.name)),
      offline: friends.filter((f) => !f.online).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [data]);

  const sections: { title: string; rows: Friend[] }[] = [];
  if (online.length) sections.push({ title: `Online · ${online.length}`, rows: online });
  if (offline.length) sections.push({ title: `Offline · ${offline.length}`, rows: offline });
  const flat = sections.flatMap((s) => [{ header: s.title } as any, ...s.rows]);

  if (isLoading) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#5800E5" /></View>;
  }
  if (error) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-red-400 text-sm text-center">Couldn't load friends.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={flat}
      keyExtractor={(item: any, i) => item.header ? `h-${item.header}` : item.id}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#5800E5" />
      }
      renderItem={({ item }: any) => {
        if (item.header) {
          return (
            <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-4 pb-1">
              {item.header}
            </Text>
          );
        }
        return <FriendRow friend={item} />;
      }}
      ListEmptyComponent={
        <View className="px-8 py-16 items-center">
          <Text className="text-weered-muted text-sm">No friends yet.</Text>
          <Text className="text-weered-muted/70 text-xs mt-2 text-center">
            Tap someone in a room to send a friend request.
          </Text>
        </View>
      }
    />
  );
}

function FriendRow({ friend }: { friend: Friend }) {
  return (
    <Pressable
      onPress={() => router.push(`/user/${friend.id}`)}
      className="flex-row items-center px-4 py-3 active:bg-panel"
    >
      <View className="mr-3">
        <Avatar name={friend.name} url={friend.avatar} size={40} away={friend.isAway} online={friend.online} />
      </View>
      <View className="flex-1">
        <Text className="text-weered-text font-semibold text-base" numberOfLines={1}>
          {friend.name}
        </Text>
        {friend.online ? (
          friend.isAway ? (
            <Text className="text-amber-400 text-xs">Lying low{friend.roomName ? ` · ${friend.roomName}` : ""}</Text>
          ) : friend.roomName ? (
            <Text className="text-green-400 text-xs" numberOfLines={1}>In {friend.roomName}</Text>
          ) : (
            <Text className="text-green-400 text-xs">Online</Text>
          )
        ) : (
          <Text className="text-weered-muted text-xs">Offline</Text>
        )}
        {friend.livePresence && (
          <Text className="text-xs mt-0.5" numberOfLines={1} style={{ color: presenceColor(friend.livePresence.source) }}>
            {friend.livePresence.activity}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function RequestsList() {
  const qc = useQueryClient();
  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["friend-requests"],
    queryFn: () => api<RequestsResponse>("/friends/requests"),
  });

  const accept = useMutation({
    mutationFn: (id: string) => api(`/friends/accept/${id}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friend-requests"] });
      qc.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (e: any) => Alert.alert("Accept failed", e?.message || "Unknown error"),
  });

  const decline = useMutation({
    mutationFn: (id: string) => api(`/friends/decline/${id}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friend-requests"] }),
    onError: (e: any) => Alert.alert("Decline failed", e?.message || "Unknown error"),
  });

  const requests = (data?.requests ?? []).filter((r) => r.status === "PENDING");

  if (isLoading) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#5800E5" /></View>;
  }
  if (error) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-red-400 text-sm text-center">Couldn't load requests.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={requests}
      keyExtractor={(r) => r.id}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#5800E5" />
      }
      ItemSeparatorComponent={() => <View className="h-px bg-border/40 mx-4" />}
      renderItem={({ item }) => (
        <View className="flex-row items-center px-4 py-3">
          <View className="mr-3">
            <Avatar name={item.fromName} url={item.fromAvatar} size={40} />
          </View>
          <View className="flex-1">
            <Text className="text-weered-text font-semibold" numberOfLines={1}>
              {item.fromName}
            </Text>
            <Text className="text-weered-muted text-xs">wants to be friends</Text>
          </View>
          <Pressable
            onPress={() => accept.mutate(item.id)}
            disabled={accept.isPending}
            className="bg-weered px-4 py-2 rounded-lg active:opacity-80 mr-2"
          >
            <Text className="text-white font-bold text-xs">Accept</Text>
          </Pressable>
          <Pressable
            onPress={() => decline.mutate(item.id)}
            disabled={decline.isPending}
            className="bg-panel border border-border px-3 py-2 rounded-lg active:opacity-80"
          >
            <Text className="text-weered-muted font-bold text-xs">Decline</Text>
          </Pressable>
        </View>
      )}
      ListEmptyComponent={
        <View className="px-8 py-16 items-center">
          <Text className="text-weered-muted text-sm">No pending requests.</Text>
        </View>
      }
    />
  );
}
