import { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Linking, Image } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LfgPanel } from "@/components/LfgPanel";

type Tab = "live" | "streams" | "servers" | "news" | "lfg";

type Stream = { userLogin: string; userName: string; title: string; viewerCount: number; thumbnailUrl: string };
type StreamsResp = { ok: boolean; streams?: Stream[] };

type LiveResp = { ok: boolean; players?: number; checkedAt?: string };
type Server = {
  id: string; name: string; host: string; region: string; description: string;
  tags: string[]; maxSlots: number; framework: string; status: string;
  owner: { id: string; name: string };
};
type ServersResp = { ok: boolean; servers?: Server[] };
type News = { id: string; title: string; url: string; date: string | null; feedlabel: string; contents: string };
type NewsResp = { ok: boolean; news?: News[] };

export function WindrosePanel({ lobbyId }: { lobbyId: string }) {
  const [tab, setTab] = useState<Tab>("live");
  return (
    <View className="border-t border-border/40 pt-3">
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">Windrose</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
        <TabBtn label="🎮 Live" active={tab === "live"} onPress={() => setTab("live")} />
        <TabBtn label="📺 Streams" active={tab === "streams"} onPress={() => setTab("streams")} />
        <TabBtn label="🖥 Servers" active={tab === "servers"} onPress={() => setTab("servers")} />
        <TabBtn label="📰 News" active={tab === "news"} onPress={() => setTab("news")} />
        <TabBtn label="🤝 LFG" active={tab === "lfg"} onPress={() => setTab("lfg")} />
      </ScrollView>
      <View className="min-h-[160px]">
        {tab === "live" && <LiveTab />}
        {tab === "streams" && <StreamsTab />}
        {tab === "servers" && <ServersTab />}
        {tab === "news" && <NewsTab />}
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

function LiveTab() {
  const liveQ = useQuery({
    queryKey: ["windrose-live"],
    queryFn: () => api<LiveResp>("/windrose/live-players"),
    refetchInterval: 60_000,
  });
  const launchQ = useQuery({
    queryKey: ["windrose-launch"],
    queryFn: () => api<any>("/windrose/launch"),
  });

  return (
    <View className="py-4 px-4">
      <View className="bg-panel border border-border rounded-xl p-4 items-center mb-3">
        <Text className="text-weered-muted text-xs uppercase tracking-widest">Live players (Steam)</Text>
        <Text className="text-weered-text font-black text-3xl mt-1">
          {liveQ.isLoading ? "…" : (liveQ.data?.players ?? 0).toLocaleString()}
        </Text>
        <Text className="text-weered-muted text-[10px] mt-1">
          {liveQ.data?.checkedAt ? `checked ${new Date(liveQ.data.checkedAt).toLocaleTimeString()}` : ""}
        </Text>
      </View>

      {launchQ.data?.ok && (
        <>
          <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Launch snapshot</Text>
          {(launchQ.data.milestones || []).map((m: any) => (
            <View key={m.label} className="bg-panel border border-border rounded-lg px-3 py-2 mb-1.5 flex-row items-center">
              <View className="flex-1">
                <Text className="text-weered-muted text-xs">{m.label}</Text>
                <Text className="text-weered-text font-bold">{m.value}</Text>
              </View>
              {!!m.sub && <Text className="text-weered-muted text-[10px]">{m.sub}</Text>}
            </View>
          ))}
          {launchQ.data.platform?.steam && (
            <Pressable
              onPress={() => Linking.openURL(launchQ.data.platform.steam).catch(() => {})}
              className="bg-weered px-4 py-2.5 rounded-lg mt-2 active:opacity-80"
            >
              <Text className="text-white text-center font-bold">Open on Steam ↗</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

function ServersTab() {
  const q = useQuery({
    queryKey: ["windrose-servers"],
    queryFn: () => api<ServersResp>("/windrose/servers"),
    staleTime: 60_000,
  });
  if (q.isLoading) return <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>;
  const rows = q.data?.servers ?? [];
  if (rows.length === 0) return <Text className="text-weered-muted text-sm text-center py-6">No community servers registered.</Text>;
  return (
    <View className="py-2">
      {rows.map((s) => (
        <View key={s.id} className="px-4 py-2.5 border-b border-border/20">
          <View className="flex-row items-center mb-1">
            <View
              style={{
                width: 8, height: 8, borderRadius: 4, marginRight: 6,
                backgroundColor: s.status === "ACTIVE" ? "#22c55e" : "#94a3b8",
              }}
            />
            <Text className="text-weered-text font-bold flex-1" numberOfLines={1}>{s.name}</Text>
            <Text className="text-weered-muted text-xs">{s.region}</Text>
          </View>
          <Text className="text-weered-muted text-xs mb-1" numberOfLines={2}>{s.description}</Text>
          <View className="flex-row items-center flex-wrap">
            <Text className="text-weered-muted text-[10px] uppercase mr-2">{s.framework}</Text>
            <Text className="text-weered-muted text-[10px]">by {s.owner?.name || "?"} · {s.maxSlots} slots</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function StreamsTab() {
  const q = useQuery({
    queryKey: ["twitch-streams", "Windrose"],
    queryFn: () => api<StreamsResp>(`/twitch/streams?game=${encodeURIComponent("Windrose")}&first=20`),
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

function NewsTab() {
  const q = useQuery({
    queryKey: ["windrose-news"],
    queryFn: () => api<NewsResp>("/windrose/news"),
    staleTime: 10 * 60_000,
  });
  if (q.isLoading) return <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>;
  const rows = q.data?.news ?? [];
  if (rows.length === 0) return <Text className="text-weered-muted text-sm text-center py-6">No news.</Text>;
  return (
    <View className="py-2">
      {rows.map((n) => (
        <Pressable
          key={n.id}
          onPress={() => Linking.openURL(n.url).catch(() => {})}
          className="px-4 py-2.5 border-b border-border/20 active:bg-panel"
        >
          <Text className="text-weered-text font-semibold text-sm" numberOfLines={2}>{n.title}</Text>
          <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={2}>{n.contents}</Text>
          <Text className="text-weered-muted/70 text-[10px] mt-0.5">{n.feedlabel}{n.date ? ` · ${new Date(n.date).toLocaleDateString()}` : ""}</Text>
        </Pressable>
      ))}
    </View>
  );
}
