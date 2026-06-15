import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LfgPanel } from "@/components/LfgPanel";

type Tab = "leaderboard" | "schedule" | "news" | "lfg";

type LeaderRow = {
  position: string;
  playerName: string;
  country: string;
  score: string;
  today: string;
  thru: string;
};
type LbResp = { ok: boolean; tournament?: string; leaderboard?: LeaderRow[] };

type SchedRow = {
  name: string;
  startDate: string;
  endDate: string;
  purse?: string;
  course?: string;
  city?: string;
  status?: string;
};
type SchedResp = { ok: boolean; schedule?: SchedRow[] };

type NewsItem = { title: string; url: string; publishedAt?: string; description?: string };
type NewsResp = { ok: boolean; news?: NewsItem[] };

export function PgaPanel({ lobbyId }: { lobbyId: string }) {
  const [tab, setTab] = useState<Tab>("leaderboard");
  return (
    <View className="border-t border-border/40 pt-3">
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">PGA</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12 }}
      >
        <TabBtn
          label="🏆 Leaderboard"
          active={tab === "leaderboard"}
          onPress={() => setTab("leaderboard")}
        />
        <TabBtn
          label="🗓 Schedule"
          active={tab === "schedule"}
          onPress={() => setTab("schedule")}
        />
        <TabBtn label="📰 News" active={tab === "news"} onPress={() => setTab("news")} />
        <TabBtn label="🤝 LFG" active={tab === "lfg"} onPress={() => setTab("lfg")} />
      </ScrollView>
      <View className="min-h-[160px]">
        {tab === "leaderboard" && <LeaderboardTab />}
        {tab === "schedule" && <ScheduleTab />}
        {tab === "news" && <NewsTab />}
        {tab === "lfg" && <LfgPanel lobbyId={lobbyId} />}
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

function LeaderboardTab() {
  const q = useQuery({
    queryKey: ["pga-leaderboard"],
    queryFn: () => api<LbResp>("/pga/leaderboard"),
    refetchInterval: 120_000,
  });
  if (q.isLoading)
    return (
      <View className="py-6 items-center">
        <ActivityIndicator color="#5800E5" />
      </View>
    );
  const rows = q.data?.leaderboard ?? [];
  if (rows.length === 0)
    return (
      <Text className="text-weered-muted text-sm text-center py-6">No active tournament.</Text>
    );
  return (
    <View className="py-2">
      {q.data?.tournament && (
        <Text className="text-weered-text font-bold text-sm px-4 pb-2">{q.data.tournament}</Text>
      )}
      {rows.slice(0, 30).map((r, i) => (
        <View
          key={`${r.playerName}-${i}`}
          className="flex-row items-center px-4 py-1.5 border-b border-border/20"
        >
          <Text className="text-weered-muted text-xs w-10">{r.position}</Text>
          <Text className="text-weered-text font-semibold flex-1" numberOfLines={1}>
            {r.playerName}
          </Text>
          <Text className="text-weered-muted text-xs mr-3">{r.country}</Text>
          <Text
            className={`w-10 text-right font-bold ${r.score?.startsWith("-") ? "text-green-400" : r.score === "E" ? "text-weered-muted" : "text-red-400"}`}
          >
            {r.score}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ScheduleTab() {
  const q = useQuery({
    queryKey: ["pga-schedule"],
    queryFn: () => api<SchedResp>("/pga/schedule"),
  });
  if (q.isLoading)
    return (
      <View className="py-6 items-center">
        <ActivityIndicator color="#5800E5" />
      </View>
    );
  const rows = q.data?.schedule ?? [];
  if (rows.length === 0)
    return (
      <Text className="text-weered-muted text-sm text-center py-6">No schedule available.</Text>
    );
  return (
    <View className="py-2">
      {rows.slice(0, 20).map((r, i) => (
        <View key={`${r.name}-${i}`} className="px-4 py-2 border-b border-border/20">
          <Text className="text-weered-text font-semibold" numberOfLines={1}>
            {r.name}
          </Text>
          <Text className="text-weered-muted text-xs mt-0.5">
            {new Date(r.startDate).toLocaleDateString()} →{" "}
            {new Date(r.endDate).toLocaleDateString()}
            {r.course ? ` · ${r.course}` : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

function NewsTab() {
  const q = useQuery({
    queryKey: ["pga-news"],
    queryFn: () => api<NewsResp>("/pga/news"),
  });
  if (q.isLoading)
    return (
      <View className="py-6 items-center">
        <ActivityIndicator color="#5800E5" />
      </View>
    );
  const rows = q.data?.news ?? [];
  if (rows.length === 0)
    return <Text className="text-weered-muted text-sm text-center py-6">No news.</Text>;
  return (
    <View className="py-2">
      {rows.slice(0, 10).map((n, i) => (
        <View key={`${n.title}-${i}`} className="px-4 py-2.5 border-b border-border/20">
          <Text className="text-weered-text font-semibold text-sm" numberOfLines={2}>
            {n.title}
          </Text>
          {!!n.description && (
            <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={2}>
              {n.description}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
