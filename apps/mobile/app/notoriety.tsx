import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";

type Me = {
  ok: boolean;
  score: number;
  rank: string;
  rankMin: number;
  nextRank: { title: string; min: number; pointsNeeded: number } | null;
  recentEvents: { action: string; points: number; createdAt: string }[];
  ranks: { title: string; min: number }[];
};
type Leader = {
  position: number; id: string; name: string; score: number; rank: string; tier: string; avatar: string | null; avatarColor: string | null;
};
type LeadersResp = { ok: boolean; leaders: Leader[] };

export default function Notoriety() {
  const [tab, setTab] = useState<"me" | "leaderboard">("me");

  const meQ = useQuery({
    queryKey: ["notoriety-me"],
    queryFn: () => api<Me>("/notoriety/me"),
  });

  const ldrQ = useQuery({
    queryKey: ["notoriety-leaderboard"],
    queryFn: () => api<LeadersResp>("/notoriety/leaderboard?limit=25"),
    enabled: tab === "leaderboard",
  });

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Notoriety" }} />

      <View className="flex-row border-b border-border/40">
        <TabBtn label="You" active={tab === "me"} onPress={() => setTab("me")} />
        <TabBtn label="Leaderboard" active={tab === "leaderboard"} onPress={() => setTab("leaderboard")} />
      </View>

      {tab === "me" ? (
        meQ.isLoading ? (
          <View className="flex-1 items-center justify-center"><ActivityIndicator color="#5800E5" /></View>
        ) : !meQ.data?.ok ? (
          <Text className="text-red-400 text-center py-8">Couldn't load.</Text>
        ) : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={meQ.isRefetching} onRefresh={() => meQ.refetch()} tintColor="#5800E5" />}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <View className="items-center py-8 border-b border-border/30">
              <Text className="text-weered-muted text-xs uppercase tracking-widest">Current rank</Text>
              <Text className="text-weered-text text-3xl font-black mt-1">{meQ.data.rank}</Text>
              <Text className="text-weered text-4xl font-black mt-3">{meQ.data.score.toLocaleString()}</Text>
              <Text className="text-weered-muted text-xs mt-1">notoriety points</Text>
              {meQ.data.nextRank && (
                <View className="mt-5 w-64 items-center">
                  <Text className="text-weered-muted text-xs">
                    {meQ.data.nextRank.pointsNeeded} points to <Text className="text-weered-text font-bold">{meQ.data.nextRank.title}</Text>
                  </Text>
                  <View className="w-full h-2 bg-panel rounded-full mt-2 overflow-hidden">
                    <View
                      className="h-2 bg-weered rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round((meQ.data.score - meQ.data.rankMin) / (meQ.data.nextRank.min - meQ.data.rankMin) * 100))}%`,
                      }}
                    />
                  </View>
                </View>
              )}
            </View>

            <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-5 pb-2">Recent events</Text>
            {meQ.data.recentEvents.length === 0 && (
              <Text className="text-weered-muted text-sm text-center py-4">No events yet.</Text>
            )}
            {meQ.data.recentEvents.map((e, i) => (
              <View key={i} className="px-4 py-2.5 border-b border-border/20 flex-row items-center">
                <Text className={`font-bold text-sm w-14 ${e.points >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {e.points >= 0 ? "+" : ""}{e.points}
                </Text>
                <Text className="text-weered-text text-sm flex-1">{e.action.replace(/_/g, " ")}</Text>
                <Text className="text-weered-muted text-xs">{formatRel(e.createdAt)}</Text>
              </View>
            ))}

            <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-5 pb-2">All ranks</Text>
            {meQ.data.ranks.map((r) => {
              const isCurrent = r.title === meQ.data!.rank;
              return (
                <View
                  key={r.title}
                  className="px-4 py-2.5 border-b border-border/20 flex-row items-center"
                  style={{ backgroundColor: isCurrent ? "rgba(88,0,229,0.08)" : "transparent" }}
                >
                  <Text className={`flex-1 font-semibold text-sm ${isCurrent ? "text-weered" : "text-weered-text"}`}>
                    {r.title}
                  </Text>
                  <Text className="text-weered-muted text-xs">{r.min.toLocaleString()}+</Text>
                </View>
              );
            })}
          </ScrollView>
        )
      ) : (
        ldrQ.isLoading ? (
          <View className="flex-1 items-center justify-center"><ActivityIndicator color="#5800E5" /></View>
        ) : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={ldrQ.isRefetching} onRefresh={() => ldrQ.refetch()} tintColor="#5800E5" />}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {(ldrQ.data?.leaders ?? []).map((l) => (
              <Pressable
                key={l.id}
                onPress={() => router.push(`/user/${l.id}`)}
                className="flex-row items-center px-4 py-3 border-b border-border/20 active:bg-panel"
              >
                <Text className="text-weered-muted text-sm font-bold w-8">#{l.position}</Text>
                {l.avatar ? (
                  <Image source={{ uri: l.avatar }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: "#1a1a1a" }} />
                ) : (
                  <View style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: l.avatarColor || "#5800E5", alignItems: "center", justifyContent: "center" }}>
                    <Text className="text-white font-bold">{l.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-weered-text font-semibold" numberOfLines={1}>{l.name}</Text>
                  <Text className="text-weered-muted text-xs">{l.rank}</Text>
                </View>
                <Text className="text-weered font-black text-sm">{l.score.toLocaleString()}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )
      )}
    </SafeAreaView>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 py-3 items-center active:opacity-70" style={{ borderBottomWidth: 2, borderBottomColor: active ? "#5800E5" : "transparent" }}>
      <Text className={`text-sm font-bold ${active ? "text-weered" : "text-weered-muted"}`}>{label}</Text>
    </Pressable>
  );
}

function formatRel(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  } catch { return ""; }
}
