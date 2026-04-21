import { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LfgPanel } from "@/components/LfgPanel";

type Tab = "scores" | "standings" | "leaders" | "lfg";

type Game = {
  gameId: number; status: string; startTime: string;
  away: { abbr: string; score: number | null; wins: number; losses: number };
  home: { abbr: string; score: number | null; wins: number; losses: number };
  linescore?: { currentInning?: number; inningHalf?: string } | null;
};
type ScoresResp = { ok: boolean; games: Game[] };
type StandingsResp = { ok: boolean; divisions?: { name: string; teams: { name: string; wins: number; losses: number; gamesBack: string }[] }[] };
type LeadersResp = {
  ok: boolean;
  leaders?: { category: string; stat: string; players: { name: string; team: string; value: string }[] }[];
};

export function MlbPanel({ lobbyId }: { lobbyId: string }) {
  const [tab, setTab] = useState<Tab>("scores");
  return (
    <View className="border-t border-border/40 pt-3">
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">MLB</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
        <TabBtn label="⚾ Scores" active={tab === "scores"} onPress={() => setTab("scores")} />
        <TabBtn label="📊 Standings" active={tab === "standings"} onPress={() => setTab("standings")} />
        <TabBtn label="🏆 Leaders" active={tab === "leaders"} onPress={() => setTab("leaders")} />
        <TabBtn label="🤝 LFG" active={tab === "lfg"} onPress={() => setTab("lfg")} />
      </ScrollView>
      <View className="min-h-[160px]">
        {tab === "scores" && <ScoresTab />}
        {tab === "standings" && <StandingsTab />}
        {tab === "leaders" && <LeadersTab />}
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

function ScoresTab() {
  const q = useQuery({
    queryKey: ["mlb-scoreboard"],
    queryFn: () => api<ScoresResp>("/mlb/scoreboard"),
    refetchInterval: 60_000,
  });
  if (q.isLoading) return <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>;
  const games = q.data?.games ?? [];
  if (games.length === 0) return <Text className="text-weered-muted text-sm text-center py-6">No games today.</Text>;
  return (
    <View className="py-2">
      {games.map((g) => {
        const live = /in progress|live/i.test(g.status);
        return (
          <View key={g.gameId} className="px-4 py-2.5 border-b border-border/20">
            <View className="flex-row items-center mb-0.5">
              <Text className={`text-[10px] font-bold uppercase mr-2 ${live ? "text-red-400" : "text-weered-muted"}`}>{g.status}</Text>
              {g.linescore?.currentInning && (
                <Text className="text-weered-muted text-[10px]">{g.linescore.inningHalf} {g.linescore.currentInning}</Text>
              )}
            </View>
            <View className="flex-row items-center">
              <Text className="text-weered-text font-bold flex-1">{g.away.abbr}</Text>
              <Text className="text-weered-text font-black text-lg w-8 text-right">{g.away.score ?? "-"}</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-weered-text font-bold flex-1">{g.home.abbr}</Text>
              <Text className="text-weered-text font-black text-lg w-8 text-right">{g.home.score ?? "-"}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function StandingsTab() {
  const q = useQuery({
    queryKey: ["mlb-standings"],
    queryFn: () => api<StandingsResp>("/mlb/standings"),
  });
  if (q.isLoading) return <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>;
  const divisions = q.data?.divisions ?? [];
  return (
    <View className="py-2">
      {divisions.map((div) => (
        <View key={div.name} className="mb-3">
          <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-1 pb-1">{div.name}</Text>
          {div.teams.map((t) => (
            <View key={t.name} className="flex-row items-center px-4 py-1.5 border-b border-border/20">
              <Text className="text-weered-text font-semibold flex-1" numberOfLines={1}>{t.name}</Text>
              <Text className="text-weered-text text-xs mr-3">{t.wins}-{t.losses}</Text>
              <Text className="text-weered-muted text-xs">{t.gamesBack === "-" ? "—" : `${t.gamesBack} GB`}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function LeadersTab() {
  const q = useQuery({
    queryKey: ["mlb-leaders"],
    queryFn: () => api<LeadersResp>("/mlb/leaders"),
  });
  if (q.isLoading) return <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>;
  const leaders = q.data?.leaders ?? [];
  return (
    <View className="py-2">
      {leaders.map((l) => (
        <View key={l.category} className="mb-3 px-4">
          <Text className="text-weered-muted text-xs uppercase tracking-wide pb-1">{l.category} · {l.stat}</Text>
          {l.players.slice(0, 5).map((p, i) => (
            <View key={`${l.category}-${i}`} className="flex-row items-center py-1">
              <Text className="text-weered-muted text-xs w-6">#{i + 1}</Text>
              <Text className="text-weered-text font-semibold flex-1" numberOfLines={1}>{p.name}</Text>
              <Text className="text-weered-muted text-xs mr-3">{p.team}</Text>
              <Text className="text-weered font-bold">{p.value}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
