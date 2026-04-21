import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Image, Linking, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LfgPanel } from "@/components/LfgPanel";

type Tab = "streams" | "lfg";
type Stream = { userLogin: string; userName: string; title: string; viewerCount: number; thumbnailUrl: string };
type StreamsResp = { ok: boolean; streams?: Stream[] };

/**
 * Lightweight module panel: Twitch streams + LFG. Used for game module types
 * that don't have a dedicated stats/API integration on the backend yet
 * (CS2, DOTA2, POE, MARATHON, DND, STUDY, HEADQUARTERS, CUSTOM).
 */
export function GenericGamePanel({
  lobbyId,
  label,
  twitchGame,
}: {
  lobbyId: string;
  label: string;
  twitchGame?: string | null;
}) {
  const [tab, setTab] = useState<Tab>(twitchGame ? "streams" : "lfg");

  return (
    <View className="border-t border-border/40 pt-3">
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {twitchGame && (
          <TabBtn label="📺 Streams" active={tab === "streams"} onPress={() => setTab("streams")} />
        )}
        <TabBtn label="🤝 LFG" active={tab === "lfg"} onPress={() => setTab("lfg")} />
      </ScrollView>
      <View className="min-h-[160px]">
        {tab === "streams" && twitchGame && <StreamsTab game={twitchGame} />}
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
