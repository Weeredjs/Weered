import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, Image, Linking } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LfgPanel } from "@/components/LfgPanel";

type Tab = "streams" | "stats" | "lfg";

type Stream = { userLogin: string; userName: string; title: string; viewerCount: number; thumbnailUrl: string };
type StreamsResp = { ok: boolean; streams?: Stream[] };

type ModeStats = {
  wins: number; kills: number; rounds: number; top10s: number;
  kd: number; avgDmg: number; longestKill: number; winRate: number;
};
type StatsResp = {
  ok: boolean;
  error?: string;
  account?: { id: string; name: string; platform: string };
  stats?: {
    season: Record<string, ModeStats | null>;
    lifetime: Record<string, ModeStats | null>;
  };
  weapons?: { weapon: string; kills: number; damage: number; headshots: number; level: number }[];
};

export function PubgPanel({ lobbyId }: { lobbyId: string }) {
  const [tab, setTab] = useState<Tab>("streams");
  return (
    <View className="border-t border-border/40 pt-3">
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">PUBG</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
        <TabBtn label="📺 Streams" active={tab === "streams"} onPress={() => setTab("streams")} />
        <TabBtn label="🔍 Stats" active={tab === "stats"} onPress={() => setTab("stats")} />
        <TabBtn label="🤝 LFG" active={tab === "lfg"} onPress={() => setTab("lfg")} />
      </ScrollView>
      <View className="min-h-[160px]">
        {tab === "streams" && <StreamsTab game="PUBG: BATTLEGROUNDS" />}
        {tab === "stats" && <StatsTab />}
        {tab === "lfg" && <LfgPanel lobbyId={lobbyId} />}
      </View>
    </View>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="px-3 py-2.5 active:opacity-70">
      <Text className={`text-xs font-bold ${active ? "text-weered" : "text-weered-muted"}`}>{label}</Text>
    </Pressable>
  );
}

function StreamsTab({ game }: { game: string }) {
  const q = useQuery({
    queryKey: ["twitch-streams", game],
    queryFn: () => api<StreamsResp>(`/twitch/streams?game=${encodeURIComponent(game)}&first=20`),
    staleTime: 5 * 60 * 1000,
  });
  if (q.isLoading) return <View className="py-8 items-center"><ActivityIndicator color="#5800E5" /></View>;
  if (!q.data?.ok || !q.data.streams?.length) {
    return <Text className="text-weered-muted text-sm text-center py-6">No live streams.</Text>;
  }
  return (
    <View className="py-2">
      {q.data.streams.slice(0, 10).map((s) => (
        <Pressable
          key={s.userLogin}
          onPress={() => Linking.openURL(`https://twitch.tv/${s.userLogin}`).catch(() => {})}
          className="flex-row items-center px-4 py-2.5 active:bg-panel"
        >
          <Image
            source={{ uri: s.thumbnailUrl.replace("{width}", "160").replace("{height}", "90") }}
            style={{ width: 80, height: 45, borderRadius: 4, backgroundColor: "#111" }}
          />
          <View className="flex-1 ml-3">
            <Text className="text-weered-text font-semibold text-sm" numberOfLines={1}>{s.userName}</Text>
            <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={1}>{s.title}</Text>
            <Text className="text-red-400 text-xs mt-0.5">● {s.viewerCount.toLocaleString()} viewers</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function StatsTab() {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("steam");
  const [submitted, setSubmitted] = useState<{ name: string; platform: string } | null>(null);

  const q = useQuery({
    queryKey: ["pubg-stats", submitted?.platform, submitted?.name],
    queryFn: () => api<StatsResp>(`/pubg/stats/${encodeURIComponent(submitted!.name)}?platform=${submitted!.platform}`),
    enabled: !!submitted,
  });

  const MODES: { id: string; label: string }[] = [
    { id: "solo", label: "Solo" },
    { id: "duo", label: "Duo" },
    { id: "squad", label: "Squad" },
  ];

  return (
    <View className="py-3">
      <View className="px-4 mb-3">
        <View className="flex-row mb-2">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="PUBG nickname"
            placeholderTextColor="rgba(160,160,170,0.6)"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => name.trim() && setSubmitted({ name: name.trim(), platform })}
            returnKeyType="search"
            className="bg-panel border border-border text-weered-text px-3 py-2 rounded-lg flex-1"
            style={{ fontSize: 14 }}
          />
          <Pressable
            onPress={() => name.trim() && setSubmitted({ name: name.trim(), platform })}
            className="bg-weered px-4 py-2 rounded-lg ml-2 active:opacity-80 justify-center"
          >
            <Text className="text-white font-bold text-sm">Go</Text>
          </Pressable>
        </View>
        <View className="flex-row">
          {(["steam", "kakao", "psn", "xbox"] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPlatform(p)}
              className={`mr-2 px-3 py-1.5 rounded-md border ${platform === p ? "bg-weered border-weered" : "bg-panel border-border"}`}
            >
              <Text className={`text-xs font-bold uppercase ${platform === p ? "text-white" : "text-weered-muted"}`}>{p}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {submitted && q.isLoading && (
        <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>
      )}
      {q.data && !q.data.ok && (
        <Text className="text-red-400 text-sm text-center px-4 pb-3">{q.data.error || "Player not found."}</Text>
      )}
      {q.data?.ok && q.data.account && (
        <View className="px-4 pb-4">
          <Text className="text-weered-text font-bold text-lg mb-2">{q.data.account.name}</Text>

          <Text className="text-weered-muted text-xs uppercase tracking-wide mt-2 mb-1">Lifetime</Text>
          {MODES.map((m) => {
            const s = q.data?.stats?.lifetime?.[m.id];
            if (!s) return null;
            return (
              <View key={m.id} className="bg-panel border border-border rounded-lg px-3 py-2 mb-2">
                <Text className="text-weered-text font-bold text-sm mb-1">{m.label}</Text>
                <View className="flex-row flex-wrap">
                  <Stat label="Wins" value={s.wins} />
                  <Stat label="K/D" value={s.kd} />
                  <Stat label="Kills" value={s.kills} />
                  <Stat label="Avg dmg" value={s.avgDmg} />
                  <Stat label="Top 10s" value={s.top10s} />
                  <Stat label="Longest kill" value={`${s.longestKill}m`} />
                </View>
              </View>
            );
          })}

          {(q.data.weapons?.length ?? 0) > 0 && (
            <>
              <Text className="text-weered-muted text-xs uppercase tracking-wide mt-3 mb-1">Top weapons</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {q.data.weapons!.slice(0, 10).map((w) => (
                  <View key={w.weapon} className="bg-panel border border-border rounded-lg px-3 py-2 mr-2 min-w-[120px]">
                    <Text className="text-weered-text font-bold text-sm" numberOfLines={1}>{w.weapon}</Text>
                    <Text className="text-weered-muted text-xs">Lv {w.level}</Text>
                    <Text className="text-weered-muted text-xs">{w.kills.toLocaleString()} kills</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="w-1/3 pr-2 mb-1">
      <Text className="text-weered-muted text-[10px] uppercase">{label}</Text>
      <Text className="text-weered-text font-bold text-sm">{value}</Text>
    </View>
  );
}
