import { View, Text, ScrollView, Pressable, Image, Alert, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

type Objective = { id: string; target: number; description?: string };
type Definition = {
  id: string; title: string; description: string; iconUrl: string | null;
  category: string; difficulty: number;
  objectives: Objective[]; requireAll: boolean; requireCount: number | null;
};
type Instance = {
  id: string; definitionId: string; startsAt: string; endsAt: string | null;
  status: string; definition: Definition; _count?: { enrollments: number };
};
type Enrollment = {
  id: string; status: string;
  progress: Record<string, { current: number; target: number; completed: boolean }>;
};
type DetailResp = { ok: boolean; challenge: Instance; enrollment: Enrollment | null };

type Leader = { userId: string; userName: string; completedAt: string | null; progress: Record<string, any> };
type LeaderResp = { ok: boolean; leaderboard: Leader[] };

export default function ChallengeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const instanceId = String(id || "");
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["challenge", instanceId],
    queryFn: () => api<DetailResp>(`/challenges/${instanceId}`),
    enabled: !!instanceId,
    refetchInterval: 30_000,
  });
  const ldrQ = useQuery({
    queryKey: ["challenge-leaderboard", instanceId],
    queryFn: () => api<LeaderResp>(`/challenges/${instanceId}/leaderboard`),
    enabled: !!instanceId,
  });

  const enroll = useMutation({
    mutationFn: () => api<{ ok: boolean; error?: string }>(`/challenges/${instanceId}/enroll`, { method: "POST" }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["challenge", instanceId] });
      qc.invalidateQueries({ queryKey: ["challenges-mine"] });
      if (r.error === "bungie_not_linked") {
        Alert.alert("Link Bungie first", "This challenge tracks Destiny 2 activity. Link your Bungie account on the web to enroll.");
      }
    },
    onError: (e: any) => Alert.alert("Couldn't enroll", e?.message || "Unknown error"),
  });
  const abandon = useMutation({
    mutationFn: () => api(`/challenges/${instanceId}/enroll`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challenge", instanceId] });
      qc.invalidateQueries({ queryKey: ["challenges-mine"] });
    },
    onError: (e: any) => Alert.alert("Couldn't abandon", e?.message || "Unknown error"),
  });

  if (q.isLoading) return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg items-center justify-center">
      <Stack.Screen options={{ title: "Challenge" }} />
      <ActivityIndicator color="#5800E5" />
    </SafeAreaView>
  );
  if (!q.data?.ok) return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg items-center justify-center px-8">
      <Stack.Screen options={{ title: "Challenge" }} />
      <Text className="text-red-400 text-sm text-center">Couldn't load challenge.</Text>
    </SafeAreaView>
  );

  const i = q.data.challenge;
  const d = i.definition;
  const enrollment = q.data.enrollment;
  const active = enrollment?.status === "ACTIVE";
  const completed = enrollment?.status === "COMPLETED";
  const objectives = d.objectives || [];
  const ends = i.endsAt ? new Date(i.endsAt) : null;
  const daysLeft = ends ? Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 86400000)) : null;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: d.title }} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor="#5800E5" />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="px-4 py-4 border-b border-border/30 flex-row items-start">
          {d.iconUrl ? (
            <Image source={{ uri: d.iconUrl }} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: "#1a1a1a" }} />
          ) : (
            <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: "#5800E533", alignItems: "center", justifyContent: "center" }}>
              <Text className="text-weered font-black text-sm">{d.category?.slice(0, 3).toUpperCase() || "CHL"}</Text>
            </View>
          )}
          <View className="flex-1 ml-3">
            <Text className="text-weered-text font-black text-lg">{d.title}</Text>
            <View className="flex-row items-center mt-1 flex-wrap">
              <Text className="text-amber-400 text-xs mr-2">{"★".repeat(d.difficulty)}</Text>
              {!!d.category && (
                <Text className="text-weered-muted text-xs uppercase mr-2">{d.category}</Text>
              )}
              {daysLeft !== null && (
                <Text className="text-weered-muted text-xs">· {daysLeft}d left</Text>
              )}
            </View>
          </View>
        </View>

        {!!d.description && (
          <View className="px-4 py-3 border-b border-border/20">
            <Text className="text-weered-text text-sm">{d.description}</Text>
          </View>
        )}

        {me && (
          <View className="px-4 py-3 border-b border-border/20">
            {completed ? (
              <View className="bg-green-500/20 border border-green-500/40 px-4 py-3 rounded-lg">
                <Text className="text-green-400 text-center font-bold">✓ Completed</Text>
              </View>
            ) : active ? (
              <Pressable
                onPress={() => Alert.alert("Abandon challenge?", "Progress will be wiped.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Abandon", style: "destructive", onPress: () => abandon.mutate() },
                ])}
                className="bg-panel border border-red-500/40 px-4 py-3 rounded-lg active:opacity-70"
              >
                <Text className="text-red-400 text-center font-bold">Abandon</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => enroll.mutate()}
                disabled={enroll.isPending}
                className="bg-weered px-4 py-3 rounded-lg active:opacity-80"
              >
                <Text className="text-white text-center font-bold">{enroll.isPending ? "Enrolling…" : "Enroll"}</Text>
              </Pressable>
            )}
          </View>
        )}

        <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-4 pb-2">Objectives · {d.requireAll ? "all" : d.requireCount ? `${d.requireCount} of ${objectives.length}` : "any"}</Text>
        {objectives.map((obj) => {
          const p = enrollment?.progress?.[obj.id];
          const current = p?.current ?? 0;
          const pct = Math.min(100, Math.round((current / obj.target) * 100));
          const done = p?.completed;
          return (
            <View key={obj.id} className="px-4 py-2.5 border-b border-border/20">
              <View className="flex-row items-center mb-1">
                {done && <Text className="text-green-400 text-xs font-bold mr-2">✓</Text>}
                <Text className="text-weered-text text-sm flex-1" numberOfLines={2}>{obj.description || obj.id}</Text>
                <Text className="text-weered-muted text-xs">{current}/{obj.target}</Text>
              </View>
              <View className="h-1.5 bg-panel rounded-full overflow-hidden">
                <View style={{ width: `${pct}%` }} className={`h-1.5 rounded-full ${done ? "bg-green-500" : "bg-weered"}`} />
              </View>
            </View>
          );
        })}

        <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-5 pb-2">Leaderboard</Text>
        {(ldrQ.data?.leaderboard ?? []).length === 0 && (
          <Text className="text-weered-muted text-sm text-center py-6">No finishers yet.</Text>
        )}
        {(ldrQ.data?.leaderboard ?? []).slice(0, 25).map((row, idx) => (
          <Pressable
            key={row.userId}
            onPress={() => router.push(`/user/${row.userId}`)}
            className="flex-row items-center px-4 py-2 border-b border-border/20 active:bg-panel"
          >
            <Text className="text-weered-muted text-xs w-8">#{idx + 1}</Text>
            <Text className="text-weered-text font-semibold flex-1" numberOfLines={1}>{row.userName}</Text>
            {row.completedAt && (
              <Text className="text-green-400 text-xs">✓ {new Date(row.completedAt).toLocaleDateString()}</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
