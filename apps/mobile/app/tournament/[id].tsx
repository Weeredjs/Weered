import { View, Text, ScrollView, Pressable, Image, Alert, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

type Entry = {
  id: string; userId: string; displayName: string;
  score: number; rank: number | null;
  submittedAt: string | null;
};
type Tournament = {
  id: string; title: string; description: string; iconUrl: string | null;
  format: string; entryType: string; status: string;
  registrationOpensAt: string; startsAt: string; endsAt: string;
  maxEntries: number; minEntries: number;
  rewards: any;
  entries: Entry[];
  _count: { entries: number };
};
type DetailResp = { ok: boolean; tournament: Tournament };
type LeaderResp = { ok: boolean; entries: Entry[] };

export default function TournamentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tid = String(id || "");
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["tournament", tid],
    queryFn: () => api<DetailResp>(`/tournaments/${tid}`),
    enabled: !!tid,
  });
  const ldrQ = useQuery({
    queryKey: ["tournament-leaderboard", tid],
    queryFn: () => api<LeaderResp>(`/tournaments/${tid}/leaderboard`),
    enabled: !!tid,
    refetchInterval: 30_000,
  });

  const register = useMutation({
    mutationFn: () => api<{ ok: boolean; error?: string }>(`/tournaments/${tid}/register`, { method: "POST" }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["tournament", tid] });
      qc.invalidateQueries({ queryKey: ["tournament-leaderboard", tid] });
      if (r.error === "bungie_not_linked") Alert.alert("Link Bungie first", "This tournament tracks Destiny 2. Link your Bungie account on the web.");
      else if (r.error === "already_registered") Alert.alert("Already in", "You're already registered.");
      else if (r.error === "tournament_full") Alert.alert("Full", "No open entries left.");
    },
    onError: (e: any) => Alert.alert("Couldn't register", e?.message || "Unknown error"),
  });
  const unregister = useMutation({
    mutationFn: () => api(`/tournaments/${tid}/register`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournament", tid] });
      qc.invalidateQueries({ queryKey: ["tournament-leaderboard", tid] });
    },
    onError: (e: any) => Alert.alert("Couldn't withdraw", e?.message || "Unknown error"),
  });

  if (q.isLoading) return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg items-center justify-center">
      <Stack.Screen options={{ title: "Tournament" }} />
      <ActivityIndicator color="#5800E5" />
    </SafeAreaView>
  );
  if (!q.data?.ok) return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg items-center justify-center px-8">
      <Stack.Screen options={{ title: "Tournament" }} />
      <Text className="text-red-400 text-sm text-center">Couldn't load.</Text>
    </SafeAreaView>
  );

  const t = q.data.tournament;
  const myEntry = (ldrQ.data?.entries ?? t.entries)?.find((e) => me && e.userId === me.id) || null;
  const entries = ldrQ.data?.entries ?? t.entries ?? [];
  const canRegister = (t.status === "REGISTRATION" || t.status === "ACTIVE") && t._count.entries < t.maxEntries;
  const starts = new Date(t.startsAt);
  const endsAt = new Date(t.endsAt);

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: t.title }} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor="#5800E5" />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="px-4 py-4 border-b border-border/30 flex-row items-start">
          {t.iconUrl ? (
            <Image source={{ uri: t.iconUrl }} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: "#1a1a1a" }} />
          ) : (
            <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: "#5800E533", alignItems: "center", justifyContent: "center" }}>
              <Text className="text-weered font-black">🏆</Text>
            </View>
          )}
          <View className="flex-1 ml-3">
            <Text className="text-weered-text font-black text-lg">{t.title}</Text>
            <Text className="text-weered-muted text-xs uppercase mt-1">
              {t.format} · {t.entryType} · {t.status}
            </Text>
            <Text className="text-weered-muted text-xs mt-1">
              {starts.toLocaleDateString()} → {endsAt.toLocaleDateString()}
            </Text>
            <Text className="text-weered-muted text-xs mt-0.5">
              {t._count.entries}/{t.maxEntries} entries
            </Text>
          </View>
        </View>

        {!!t.description && (
          <View className="px-4 py-3 border-b border-border/20">
            <Text className="text-weered-text text-sm">{t.description}</Text>
          </View>
        )}

        {me && (
          <View className="px-4 py-3 border-b border-border/20">
            {myEntry ? (
              t.status === "REGISTRATION" ? (
                <Pressable
                  onPress={() => Alert.alert("Withdraw?", "Your entry will be removed.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Withdraw", style: "destructive", onPress: () => unregister.mutate() },
                  ])}
                  className="bg-panel border border-red-500/40 px-4 py-3 rounded-lg active:opacity-70"
                >
                  <Text className="text-red-400 text-center font-bold">Withdraw</Text>
                </Pressable>
              ) : (
                <View className="bg-green-500/10 border border-green-500/30 px-4 py-3 rounded-lg">
                  <Text className="text-green-400 text-center font-bold">✓ Registered</Text>
                  {myEntry.rank && (
                    <Text className="text-weered-muted text-xs text-center mt-0.5">Rank #{myEntry.rank} · {myEntry.score.toLocaleString()} pts</Text>
                  )}
                </View>
              )
            ) : canRegister ? (
              <Pressable
                onPress={() => register.mutate()}
                disabled={register.isPending}
                className="bg-weered px-4 py-3 rounded-lg active:opacity-80"
              >
                <Text className="text-white text-center font-bold">{register.isPending ? "Registering…" : "Register"}</Text>
              </Pressable>
            ) : (
              <View className="bg-panel border border-border px-4 py-3 rounded-lg">
                <Text className="text-weered-muted text-center text-sm">
                  {t.status === "COMPLETED" ? "Tournament ended" : t._count.entries >= t.maxEntries ? "Tournament full" : "Registration closed"}
                </Text>
              </View>
            )}
          </View>
        )}

        <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-4 pb-2">Leaderboard · {entries.length}</Text>
        {entries.length === 0 && (
          <Text className="text-weered-muted text-sm text-center py-6">No entries yet.</Text>
        )}
        {entries.slice(0, 50).map((e, idx) => {
          const isMe = me && e.userId === me.id;
          return (
            <Pressable
              key={e.id}
              onPress={() => router.push(`/user/${e.userId}`)}
              className="flex-row items-center px-4 py-2 border-b border-border/20 active:bg-panel"
              style={isMe ? { backgroundColor: "rgba(88,0,229,0.1)" } : undefined}
            >
              <Text className="text-weered-muted text-xs w-8">#{e.rank ?? idx + 1}</Text>
              <Text className={`font-semibold flex-1 ${isMe ? "text-weered" : "text-weered-text"}`} numberOfLines={1}>{e.displayName}</Text>
              <Text className="text-weered font-black text-sm">{e.score.toLocaleString()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
