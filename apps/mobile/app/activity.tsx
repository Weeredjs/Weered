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
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import type { ActivityFeedItem as FeedItem, ActivityFeedResponse as FeedResponse } from "@weered/shared";

type IconName = keyof typeof Ionicons.glyphMap;

type Visual = { icon: IconName; color: string; label: string; describe?: (item: any) => string };

// Per-notoriety-action visuals
const NOTORIETY_VISUALS: Record<string, Visual> = {
  DAILY_ACTIVE:        { icon: "calendar",            color: "#22c55e", label: "Daily check-in",     describe: () => "Logged in today" },
  CHAT_MESSAGE:        { icon: "chatbubble",          color: "#a78bfa", label: "Posted a message",   describe: () => "Spoke up in a room" },
  ROOM_JOINED:         { icon: "log-in",              color: "#60a5fa", label: "Joined a room",      describe: () => "Stepped into a room" },
  VOICE_JOINED:        { icon: "mic",                 color: "#06b6d4", label: "Joined voice",       describe: () => "Hopped into voice chat" },
  BIO_COMPLETE:        { icon: "person-circle",       color: "#f5b700", label: "Bio completed",      describe: () => "Filled out your profile bio" },
  AVATAR_SET:          { icon: "image",               color: "#f5b700", label: "Avatar updated",     describe: () => "Set a custom avatar" },
  FIRST_ROOM_HOSTED:   { icon: "home",                color: "#f5b700", label: "First room hosted",  describe: () => "Created your very first room" },
  ROOM_25_USERS:       { icon: "people",              color: "#f97316", label: "Hot room",           describe: () => "Your room hit 25 members" },
  CHALLENGE_COMPLETED: { icon: "ribbon",              color: "#f5b700", label: "Challenge cleared",  describe: () => "Completed a challenge" },
  FIRST_CHALLENGE:     { icon: "trophy",              color: "#f5b700", label: "First challenge",    describe: () => "Cleared your first challenge ever" },
  CREW_CREATED:        { icon: "shield",              color: "#ef4444", label: "Crew founded",       describe: () => "Started your own crew" },
  CREW_JOINED:         { icon: "people-circle",       color: "#a78bfa", label: "Joined a crew",      describe: () => "Linked up with a crew" },
  FRIEND_ADDED:        { icon: "person-add",          color: "#06b6d4", label: "New friend",         describe: () => "Added a friend" },
  LOBBY_CREATED:       { icon: "globe",               color: "#5800E5", label: "Lobby created",      describe: () => "Spun up a new lobby" },
  BUNGIE_LINKED:       { icon: "game-controller",     color: "#f97316", label: "Bungie linked",      describe: () => "Connected your Destiny 2 profile" },
  SUBREDDIT_LINKED:    { icon: "link",                color: "#f97316", label: "Subreddit linked",   describe: () => "Connected a subreddit" },
  FIRST_FAKEOUT_TRADE: { icon: "trending-up",         color: "#22c55e", label: "First trade",        describe: () => "Made your first FakeOut trade" },
  FAKEOUT_TRADE:       { icon: "swap-horizontal",     color: "#a78bfa", label: "FakeOut trade",      describe: () => "Closed a FakeOut position" },
  FAKEOUT_PROFIT:      { icon: "cash",                color: "#22c55e", label: "FakeOut profit",     describe: () => "Closed a profitable trade" },
};

const TYPE_VISUALS: Record<string, Visual> = {
  dm:           { icon: "mail",            color: "#5800E5", label: "Direct message" },
  notification: { icon: "notifications",   color: "#f59e0b", label: "Notification" },
  friend:       { icon: "people-circle",   color: "#06b6d4", label: "Friend" },
};

function visualFor(item: FeedItem): Visual {
  if (item.type === "notoriety" && item.action && NOTORIETY_VISUALS[item.action]) {
    return NOTORIETY_VISUALS[item.action];
  }
  if (item.type === "notoriety") {
    return { icon: "star", color: "#22c55e", label: "Notoriety", describe: () => "Earned XP" };
  }
  return TYPE_VISUALS[item.type] || { icon: "ellipse", color: "#94a3b8", label: "Event" };
}

export default function Activity() {
  const q = useQuery({
    queryKey: ["activity-feed"],
    queryFn: () => api<FeedResponse>("/activity-feed"),
    refetchInterval: 60_000,
  });

  const onRefresh = useCallback(() => q.refetch(), [q]);

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: "#0c0b0a" }}>
      <Stack.Screen options={{ title: "Activity" }} />
      {q.isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : q.error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ color: "#f87171", fontSize: 13, textAlign: "center" }}>Couldn't load activity.</Text>
        </View>
      ) : (
        <FlatList
          data={q.data?.feed ?? []}
          style={{ backgroundColor: "#0c0b0a" }}
          contentContainerStyle={{ backgroundColor: "#0c0b0a", paddingVertical: 4 }}
          keyExtractor={(item, i) => `${item.type}-${item.id}-${i}`}
          refreshControl={
            <RefreshControl refreshing={q.isRefetching} onRefresh={onRefresh} tintColor="#5800E5" />
          }
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginHorizontal: 16 }} />}
          renderItem={({ item }) => <ActivityRow item={item} />}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 32, paddingVertical: 64, alignItems: "center" }}>
              <Ionicons name="time-outline" size={32} color="rgba(203,213,225,0.3)" />
              <Text style={{ color: "rgba(203,213,225,0.6)", fontSize: 13, marginTop: 12 }}>Nothing in the last 3 days.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function ActivityRow({ item }: { item: FeedItem }) {
  const v = visualFor(item);

  const onPress = () => {
    if (item.type === "dm") router.push(`/dm/${item.fromId}`);
    else if (item.type === "notification" && item.actionUrl) {
      const path = item.actionUrl.startsWith("http") ? new URL(item.actionUrl).pathname : item.actionUrl;
      router.push(path as any);
    } else if (item.type === "friend") router.push("/(tabs)/friends");
  };

  // Build the title + sub-text per item type.
  let title: string;
  let subtitle: string | null = null;
  if (item.type === "dm") {
    title = item.fromName ? `${item.fromName}` : "Direct message";
    subtitle = item.preview || "Sent you a message";
  } else if (item.type === "notification") {
    title = item.text || "Notification";
    subtitle = item.body || (item.actorName ? `From ${item.actorName}` : null);
  } else if (item.type === "notoriety") {
    title = v.label;
    subtitle = v.describe ? v.describe(item) : null;
  } else if (item.type === "friend") {
    title = item.friendName ? `Friends with ${item.friendName}` : "New friend";
    subtitle = "You added each other";
  } else {
    title = (item as any).text || "Event";
  }

  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}
    >
      <View
        style={{
          width: 38, height: 38, borderRadius: 4,
          backgroundColor: v.color + "1a",
          borderWidth: 1,
          borderColor: v.color + "55",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name={v.icon} size={20} color={v.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text numberOfLines={1} style={{ flex: 1, color: "rgba(243,244,246,0.96)", fontFamily: "monospace", fontWeight: "800", fontSize: 13, letterSpacing: 0.3 }}>
            {title}
          </Text>
          {item.type === "notoriety" && (
            <Text style={{ color: v.color, fontFamily: "monospace", fontWeight: "900", fontSize: 12, letterSpacing: 0.6, marginLeft: 8 }}>
              +{item.points} XP
            </Text>
          )}
          {item.type === "notification" && !item.read && (
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: v.color, marginLeft: 8 }} />
          )}
        </View>
        {subtitle && (
          <Text numberOfLines={2} style={{ color: "rgba(203,213,225,0.65)", fontSize: 11, marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
        <Text style={{ color: "rgba(203,213,225,0.45)", fontFamily: "monospace", fontSize: 10, letterSpacing: 0.5, marginTop: 4 }}>
          {formatRelative(item.ts)}
        </Text>
      </View>
    </Pressable>
  );
}

function formatRelative(ts: number | string): string {
  try {
    const t = typeof ts === "number" ? ts : new Date(ts).getTime();
    if (!Number.isFinite(t)) return "";
    const diff = Date.now() - t;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch { return ""; }
}
