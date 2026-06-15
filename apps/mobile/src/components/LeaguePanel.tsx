import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  ScrollView,
  Linking,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LfgPanel } from "@/components/LfgPanel";

type Tab = "streams" | "lfg" | "leaderboard" | "rotation" | "summoner";

type SummonerResp = {
  ok: boolean;
  error?: string;
  summoner?: { gameName: string; tagLine: string; summonerLevel: number; profileIconUrl: string };
  ranked?: {
    solo: {
      tier: string;
      rank: string;
      lp: number;
      wins: number;
      losses: number;
      winRate: number;
    } | null;
    flex: {
      tier: string;
      rank: string;
      lp: number;
      wins: number;
      losses: number;
      winRate: number;
    } | null;
  };
  recentMatches?: {
    matchId: string;
    championName: string;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    win: boolean;
    gameDuration: number;
    queueId: number;
  }[];
};

type RotationResp = { ok: boolean; freeChampionIds?: number[]; error?: string };
type ChampionsResp = {
  ok: boolean;
  champions?: { id: string; key: number; name: string; image: string }[];
};
type LeaderboardResp = {
  ok: boolean;
  entries?: {
    rank: number;
    gameName: string;
    tagLine: string;
    lp: number;
    wins: number;
    losses: number;
    winRate: number;
  }[];
  error?: string;
};
type StreamsResp = {
  ok: boolean;
  streams?: {
    userLogin: string;
    userName: string;
    title: string;
    viewerCount: number;
    thumbnailUrl: string;
  }[];
};

export function LeaguePanel({ lobbyId }: { lobbyId: string }) {
  const [tab, setTab] = useState<Tab>("streams");

  return (
    <View className="border-t border-border/40 pt-3">
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">
        League of Legends
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12 }}
      >
        <TabBtn label="📺 Streams" active={tab === "streams"} onPress={() => setTab("streams")} />
        <TabBtn label="🤝 LFG" active={tab === "lfg"} onPress={() => setTab("lfg")} />
        <TabBtn
          label="🏆 Leaderboard"
          active={tab === "leaderboard"}
          onPress={() => setTab("leaderboard")}
        />
        <TabBtn
          label="🔄 Rotation"
          active={tab === "rotation"}
          onPress={() => setTab("rotation")}
        />
        <TabBtn
          label="🔍 Summoner"
          active={tab === "summoner"}
          onPress={() => setTab("summoner")}
        />
      </ScrollView>

      <View className="min-h-[160px]">
        {tab === "streams" && <StreamsTab />}
        {tab === "lfg" && <LfgPanel lobbyId={lobbyId} />}
        {tab === "leaderboard" && <LeaderboardTab />}
        {tab === "rotation" && <RotationTab />}
        {tab === "summoner" && <SummonerTab />}
      </View>
    </View>
  );
}

function TabBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="px-3 py-2.5 active:opacity-70">
      <Text className={`text-xs font-bold ${active ? "text-weered" : "text-weered-muted"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function StreamsTab() {
  const q = useQuery({
    queryKey: ["twitch-streams", "League of Legends"],
    queryFn: () =>
      api<StreamsResp>(`/twitch/streams?game=${encodeURIComponent("League of Legends")}&first=20`),
    staleTime: 5 * 60 * 1000,
  });

  if (q.isLoading)
    return (
      <View className="py-8 items-center">
        <ActivityIndicator color="#5800E5" />
      </View>
    );
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
            <Text className="text-weered-text font-semibold text-sm" numberOfLines={1}>
              {s.userName}
            </Text>
            <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={1}>
              {s.title}
            </Text>
            <Text className="text-red-400 text-xs mt-0.5">
              ● {s.viewerCount.toLocaleString()} viewers
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function LeaderboardTab() {
  const q = useQuery({
    queryKey: ["league-leaderboard"],
    queryFn: () => api<LeaderboardResp>(`/league/leaderboard`),
    staleTime: 15 * 60 * 1000,
  });

  if (q.isLoading)
    return (
      <View className="py-8 items-center">
        <ActivityIndicator color="#5800E5" />
      </View>
    );
  if (!q.data?.ok || !q.data.entries?.length) {
    return (
      <Text className="text-weered-muted text-sm text-center py-6">Leaderboard unavailable.</Text>
    );
  }
  return (
    <View className="py-2">
      {q.data.entries.slice(0, 25).map((e) => (
        <View key={e.rank} className="flex-row items-center px-4 py-2 border-b border-border/20">
          <Text className="text-weered-muted text-xs w-8">#{e.rank}</Text>
          <Text className="text-weered-text font-semibold text-sm flex-1" numberOfLines={1}>
            {e.gameName}
            {!!e.tagLine && <Text className="text-weered-muted font-normal">#{e.tagLine}</Text>}
          </Text>
          <Text className="text-weered text-xs font-bold mr-3">{e.lp} LP</Text>
          <Text className="text-weered-muted text-xs">{e.winRate}%</Text>
        </View>
      ))}
    </View>
  );
}

function RotationTab() {
  const champsQ = useQuery({
    queryKey: ["league-champions"],
    queryFn: () => api<ChampionsResp>(`/league/champions`),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const rotationQ = useQuery({
    queryKey: ["league-rotation"],
    queryFn: () => api<RotationResp>(`/league/rotation`),
    staleTime: 60 * 60 * 1000,
  });

  if (rotationQ.isLoading || champsQ.isLoading)
    return (
      <View className="py-8 items-center">
        <ActivityIndicator color="#5800E5" />
      </View>
    );
  if (!rotationQ.data?.ok || !rotationQ.data.freeChampionIds?.length) {
    return (
      <Text className="text-weered-muted text-sm text-center py-6">
        Rotation unavailable
        {rotationQ.data?.error === "riot_not_configured" ? " (Riot API key expired)" : ""}.
      </Text>
    );
  }
  const champByKey = new Map<number, { id: string; name: string; image: string }>();
  for (const c of champsQ.data?.champions || []) champByKey.set(c.key, c);

  return (
    <View className="flex-row flex-wrap px-3 py-3">
      {rotationQ.data.freeChampionIds.map((key) => {
        const c = champByKey.get(key);
        if (!c) return null;
        return (
          <View
            key={key}
            className="items-center w-[22%] mb-3"
            style={{ marginHorizontal: "1.5%" }}
          >
            <Image source={{ uri: c.image }} style={{ width: 52, height: 52, borderRadius: 6 }} />
            <Text className="text-weered-text text-xs mt-1" numberOfLines={1}>
              {c.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function SummonerTab() {
  const [riotId, setRiotId] = useState("");
  const [submitted, setSubmitted] = useState<{ gameName: string; tagLine: string } | null>(null);

  const summonerQ = useQuery({
    queryKey: ["league-summoner", submitted?.gameName, submitted?.tagLine],
    queryFn: () =>
      api<SummonerResp>(
        `/league/summoner/${encodeURIComponent(submitted!.gameName)}/${encodeURIComponent(submitted!.tagLine)}`,
      ),
    enabled: !!submitted,
  });

  const onSearch = () => {
    const parts = riotId.split("#");
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return;
    setSubmitted({ gameName: parts[0].trim(), tagLine: parts[1].trim() });
  };

  return (
    <View className="py-3">
      <View className="px-4 mb-3 flex-row">
        <TextInput
          value={riotId}
          onChangeText={setRiotId}
          placeholder="RiotID#TAG (e.g. Faker#KR1)"
          placeholderTextColor="rgba(160,160,170,0.6)"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={onSearch}
          returnKeyType="search"
          className="bg-panel border border-border text-weered-text px-3 py-2 rounded-lg flex-1"
          style={{ fontSize: 14 }}
        />
        <Pressable
          onPress={onSearch}
          className="bg-weered px-4 py-2 rounded-lg ml-2 active:opacity-80 justify-center"
        >
          <Text className="text-white font-bold text-sm">Go</Text>
        </Pressable>
      </View>

      {submitted && summonerQ.isLoading && (
        <View className="py-6 items-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      )}
      {summonerQ.data && !summonerQ.data.ok && (
        <Text className="text-red-400 text-sm px-4 pb-3">
          {summonerQ.data.error === "player_not_found"
            ? "Player not found."
            : summonerQ.data.error === "riot_not_configured"
              ? "Riot API key not configured (dev key may have expired)."
              : `Error: ${summonerQ.data.error}`}
        </Text>
      )}
      {summonerQ.data?.ok && summonerQ.data.summoner && (
        <View className="px-4 pb-4">
          <View className="flex-row items-center mb-3">
            <Image
              source={{ uri: summonerQ.data.summoner.profileIconUrl }}
              style={{ width: 48, height: 48, borderRadius: 8 }}
            />
            <View className="flex-1 ml-3">
              <Text className="text-weered-text font-bold">
                {summonerQ.data.summoner.gameName}
                <Text className="text-weered-muted font-normal">
                  #{summonerQ.data.summoner.tagLine}
                </Text>
              </Text>
              <Text className="text-weered-muted text-xs mt-0.5">
                Level {summonerQ.data.summoner.summonerLevel}
              </Text>
            </View>
          </View>

          {summonerQ.data.ranked?.solo && (
            <RankRow label="Solo/Duo" r={summonerQ.data.ranked.solo} />
          )}
          {summonerQ.data.ranked?.flex && <RankRow label="Flex" r={summonerQ.data.ranked.flex} />}
          {!summonerQ.data.ranked?.solo && !summonerQ.data.ranked?.flex && (
            <Text className="text-weered-muted text-xs mb-2">Unranked this season.</Text>
          )}

          {(summonerQ.data.recentMatches?.length ?? 0) > 0 && (
            <>
              <Text className="text-weered-muted text-xs uppercase tracking-wide mt-3 mb-1.5">
                Recent matches
              </Text>
              {summonerQ.data.recentMatches!.map((m) => (
                <View
                  key={m.matchId}
                  className={`flex-row items-center px-3 py-2 mb-1.5 rounded-lg ${m.win ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}
                >
                  <Text className="text-weered-text font-semibold text-sm flex-1" numberOfLines={1}>
                    {m.championName}
                  </Text>
                  <Text className="text-weered-text text-sm mr-3">
                    {m.kills}/{m.deaths}/{m.assists}
                  </Text>
                  <Text className="text-weered-muted text-xs">
                    {Math.floor(m.gameDuration / 60)}m
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function RankRow({
  label,
  r,
}: {
  label: string;
  r: { tier: string; rank: string; lp: number; wins: number; losses: number; winRate: number };
}) {
  return (
    <View className="flex-row items-center bg-panel border border-border rounded-lg px-3 py-2 mb-2">
      <Text className="text-weered-muted text-xs flex-1">{label}</Text>
      <Text className="text-weered-text font-bold text-sm">
        {r.tier} {r.rank} · {r.lp} LP
      </Text>
      <Text className="text-weered-muted text-xs ml-3">
        {r.wins}W {r.losses}L ({r.winRate}%)
      </Text>
    </View>
  );
}
