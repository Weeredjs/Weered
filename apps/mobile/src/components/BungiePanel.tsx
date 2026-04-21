import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Image, ScrollView, Linking } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LfgPanel } from "@/components/LfgPanel";

type Tab = "streams" | "weekly" | "xur" | "lookup" | "lfg";

type Stream = { userLogin: string; userName: string; title: string; viewerCount: number; thumbnailUrl: string };
type StreamsResp = { ok: boolean; streams?: Stream[] };

type Milestone = {
  hash: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  activities?: any[];
  startDate?: string;
  endDate?: string;
};
type WeeklyResp = { ok: boolean; milestones: Milestone[]; error?: string };

type XurItem = {
  hash: string;
  name: string;
  tierType?: string;
  itemType?: string;
  iconUrl?: string;
  cost?: { name: string; quantity: number } | null;
};
type XurResp = { ok: boolean; available: boolean; items: XurItem[] | null; message?: string; error?: string };

export function BungiePanel({ lobbyId }: { lobbyId: string }) {
  const [tab, setTab] = useState<Tab>("streams");

  return (
    <View className="border-t border-border/40 pt-3">
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">Destiny 2</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
        <TabBtn label="📺 Streams" active={tab === "streams"} onPress={() => setTab("streams")} />
        <TabBtn label="🗓 Weekly" active={tab === "weekly"} onPress={() => setTab("weekly")} />
        <TabBtn label="🧑‍🚀 Xur" active={tab === "xur"} onPress={() => setTab("xur")} />
        <TabBtn label="🔍 Player" active={tab === "lookup"} onPress={() => setTab("lookup")} />
        <TabBtn label="🤝 LFG" active={tab === "lfg"} onPress={() => setTab("lfg")} />
      </ScrollView>

      <View className="min-h-[160px]">
        {tab === "streams" && <StreamsTab />}
        {tab === "weekly" && <WeeklyTab />}
        {tab === "xur" && <XurTab />}
        {tab === "lookup" && <LookupTab />}
        {tab === "lfg" && <LfgPanel lobbyId={lobbyId} />}
      </View>
    </View>
  );
}

function StreamsTab() {
  const q = useQuery({
    queryKey: ["twitch-streams", "Destiny 2"],
    queryFn: () => api<StreamsResp>(`/twitch/streams?game=${encodeURIComponent("Destiny 2")}&first=20`),
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

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="px-3 py-2.5 active:opacity-70">
      <Text className={`text-xs font-bold ${active ? "text-weered" : "text-weered-muted"}`}>{label}</Text>
    </Pressable>
  );
}

function WeeklyTab() {
  const q = useQuery({
    queryKey: ["bungie-weekly"],
    queryFn: () => api<WeeklyResp>("/bungie/weekly"),
    staleTime: 15 * 60 * 1000,
  });

  if (q.isLoading) return <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>;
  const milestones = q.data?.milestones || [];
  if (milestones.length === 0) return <Text className="text-weered-muted text-sm text-center py-6">No weekly milestones available.</Text>;

  return (
    <View className="py-2">
      {milestones.slice(0, 20).map((m) => (
        <View key={m.hash} className="flex-row px-4 py-2.5 border-b border-border/20">
          {m.imageUrl ? (
            <Image source={{ uri: m.imageUrl }} style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: "#1a1a1a" }} />
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: "#5800E533" }} />
          )}
          <View className="flex-1 ml-3">
            <Text className="text-weered-text font-semibold" numberOfLines={1}>{m.name}</Text>
            {!!m.description && (
              <Text className="text-weered-muted text-xs" numberOfLines={2}>{m.description}</Text>
            )}
            {m.endDate && (
              <Text className="text-weered-muted/70 text-[10px] mt-0.5">Resets {new Date(m.endDate).toLocaleDateString()}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function XurTab() {
  const q = useQuery({
    queryKey: ["bungie-xur"],
    queryFn: () => api<XurResp>("/bungie/xur"),
    staleTime: 30 * 60 * 1000,
  });

  if (q.isLoading) return <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>;
  if (!q.data?.available) {
    return <Text className="text-weered-muted text-sm text-center py-6">Xur is not in town this week.</Text>;
  }
  if (q.data.error === "bungie_not_configured") {
    return <Text className="text-amber-400 text-sm text-center py-6">Bungie API not configured on server.</Text>;
  }
  if (!q.data.items) {
    return (
      <Text className="text-weered-muted text-sm text-center py-6">
        {q.data.message || "Link your Bungie account from Me tab to see Xur's inventory."}
      </Text>
    );
  }

  return (
    <View className="py-2">
      {q.data.items.map((it) => (
        <View key={it.hash} className="flex-row px-4 py-2.5 border-b border-border/20 items-center">
          {it.iconUrl ? (
            <Image source={{ uri: it.iconUrl }} style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: "#1a1a1a" }} />
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: "#1a1a1a" }} />
          )}
          <View className="flex-1 ml-3">
            <Text className="text-weered-text font-semibold">{it.name}</Text>
            <Text className="text-weered-muted text-xs">{it.tierType} · {it.itemType}</Text>
          </View>
          {it.cost && (
            <Text className="text-amber-400 text-xs font-bold">{it.cost.quantity} {it.cost.name}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function LookupTab() {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["bungie-player", submitted],
    queryFn: () => api<any>(`/bungie/player/${encodeURIComponent(submitted!)}`),
    enabled: !!submitted,
  });

  return (
    <View className="py-3">
      <View className="px-4 mb-3 flex-row">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Bungie Name#1234"
          placeholderTextColor="rgba(160,160,170,0.6)"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => name.trim() && setSubmitted(name.trim())}
          returnKeyType="search"
          className="bg-panel border border-border text-weered-text px-3 py-2 rounded-lg flex-1"
          style={{ fontSize: 14 }}
        />
        <Pressable
          onPress={() => name.trim() && setSubmitted(name.trim())}
          className="bg-weered px-4 py-2 rounded-lg ml-2 active:opacity-80 justify-center"
        >
          <Text className="text-white font-bold text-sm">Go</Text>
        </Pressable>
      </View>
      {submitted && q.isLoading && (
        <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>
      )}
      {q.data && !q.data.ok && (
        <Text className="text-red-400 text-sm text-center px-4 pb-3">
          {q.data.error || "Not found."}
        </Text>
      )}
      {q.data?.ok && q.data.guardian && (
        <View className="px-4 pb-4">
          <Text className="text-weered-text font-bold text-base">{q.data.guardian.displayName}</Text>
          {q.data.guardian.emblemUrl && (
            <Image source={{ uri: q.data.guardian.emblemUrl }} style={{ width: "100%", height: 96, borderRadius: 6, marginVertical: 8 }} />
          )}
          {Array.isArray(q.data.guardian.characters) && q.data.guardian.characters.map((c: any) => (
            <View key={c.characterId} className="bg-panel border border-border rounded-lg px-3 py-2 mb-2">
              <Text className="text-weered-text font-bold">{c.className} · Light {c.light}</Text>
              <Text className="text-weered-muted text-xs">Last played {new Date(c.dateLastPlayed).toLocaleDateString()}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
