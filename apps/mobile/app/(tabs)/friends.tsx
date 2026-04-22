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
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: "#0c0b0a" }}>
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", backgroundColor: "#000" }}>
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
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: 2,
        borderBottomColor: active ? "#5800E5" : "transparent",
      }}
    >
      <Text
        style={{
          fontFamily: "monospace",
          fontSize: 12,
          fontWeight: "900",
          letterSpacing: 1.4,
          color: active ? "#ffffff" : "rgba(180,180,190,0.7)",
        }}
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
      style={{ backgroundColor: "#0c0b0a" }}
      contentContainerStyle={{ backgroundColor: "#0c0b0a" }}
      keyExtractor={(item: any, i) => item.header ? `h-${item.header}` : item.id}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#5800E5" />
      }
      renderItem={({ item }: any) => {
        if (item.header) {
          return (
            <Text style={{ color: "rgba(203,213,225,0.72)", fontFamily: "monospace", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
              {item.header}
            </Text>
          );
        }
        return <FriendRow friend={item} />;
      }}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: 32, paddingVertical: 64, alignItems: "center" }}>
          <Text style={{ color: "rgba(203,213,225,0.72)", fontSize: 13 }}>No friends yet.</Text>
          <Text style={{ color: "rgba(203,213,225,0.5)", fontSize: 11, marginTop: 8, textAlign: "center" }}>
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
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}
    >
      <View style={{ marginRight: 12 }}>
        <Avatar name={friend.name} url={friend.avatar} size={40} away={friend.isAway} online={friend.online} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: "rgba(243,244,246,0.96)", fontFamily: "monospace", fontWeight: "800", fontSize: 14, letterSpacing: 0.3 }}>
          {friend.name}
        </Text>
        {friend.online ? (
          friend.isAway ? (
            <Text style={{ color: "#fbbf24", fontSize: 11 }}>Lying low{friend.roomName ? ` · ${friend.roomName}` : ""}</Text>
          ) : friend.roomName ? (
            <Text numberOfLines={1} style={{ color: "#22c55e", fontSize: 11 }}>In {friend.roomName}</Text>
          ) : (
            <Text style={{ color: "#22c55e", fontSize: 11 }}>Online</Text>
          )
        ) : (
          <Text style={{ color: "rgba(203,213,225,0.6)", fontSize: 11 }}>Offline</Text>
        )}
        {friend.livePresence && (
          <Text numberOfLines={1} style={{ fontSize: 11, marginTop: 2, color: presenceColor(friend.livePresence.source) }}>
            {friend.livePresence.activity}
          </Text>
        )}
      </View>
      {friend.online && friend.roomId && (
        <Pressable
          onPress={(e) => { e.stopPropagation(); router.push((friend as any).roomIsLobby ? `/lobby/${friend.roomId}` : `/room/${friend.roomId}`); }}
          style={{ backgroundColor: "#5800E5", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, marginLeft: 8 }}
        >
          <Text style={{ color: "#fff", fontFamily: "monospace", fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>JOIN</Text>
        </Pressable>
      )}
      {friend.online && !friend.roomId && (
        <Pressable
          onPress={(e) => { e.stopPropagation(); router.push(`/dm/${friend.id}`); }}
          style={{ backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, marginLeft: 8 }}
        >
          <Text style={{ color: "rgba(203,213,225,0.85)", fontFamily: "monospace", fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>DM</Text>
        </Pressable>
      )}
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
      style={{ backgroundColor: "#0c0b0a" }}
      contentContainerStyle={{ backgroundColor: "#0c0b0a" }}
      keyExtractor={(r) => r.id}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#5800E5" />
      }
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginHorizontal: 16 }} />}
      renderItem={({ item }) => (
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
          <View style={{ marginRight: 12 }}>
            <Avatar name={item.fromName} url={item.fromAvatar} size={40} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: "rgba(243,244,246,0.96)", fontFamily: "monospace", fontWeight: "800", fontSize: 14 }}>
              {item.fromName}
            </Text>
            <Text style={{ color: "rgba(203,213,225,0.6)", fontSize: 11 }}>wants to be friends</Text>
          </View>
          <Pressable
            onPress={() => accept.mutate(item.id)}
            disabled={accept.isPending}
            style={{ backgroundColor: "#5800E5", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4, marginRight: 8 }}
          >
            <Text style={{ color: "#fff", fontFamily: "monospace", fontWeight: "900", fontSize: 11, letterSpacing: 1 }}>ACCEPT</Text>
          </Pressable>
          <Pressable
            onPress={() => decline.mutate(item.id)}
            disabled={decline.isPending}
            style={{ backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4 }}
          >
            <Text style={{ color: "rgba(203,213,225,0.85)", fontFamily: "monospace", fontWeight: "900", fontSize: 11, letterSpacing: 1 }}>DECLINE</Text>
          </Pressable>
        </View>
      )}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: 32, paddingVertical: 64, alignItems: "center" }}>
          <Text style={{ color: "rgba(203,213,225,0.72)", fontSize: 13 }}>No pending requests.</Text>
        </View>
      }
    />
  );
}
