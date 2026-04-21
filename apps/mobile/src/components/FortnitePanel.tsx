import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Image, ScrollView, Alert, FlatList } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LfgPanel } from "@/components/LfgPanel";
import { Linking } from "react-native";

type StatsResp = {
  ok: boolean;
  error?: string;
  account?: { name: string };
  battlePass?: { level?: number; progress?: number };
  image?: string;
  stats?: {
    all: { wins: number; kd: number; matches: number; kills: number; winRate: number } | null;
    solo: any; duo: any; squad: any;
  };
};

type ShopResp = {
  ok: boolean;
  sections?: {
    id: string; name: string; type: string; rarity: string; rarityColor: string;
    price: number; image: string;
  }[];
};

type NewsResp = {
  ok: boolean;
  news?: { id: string; title: string; body: string; image?: string; tileImage?: string }[];
};

export function FortnitePanel({ lobbyId }: { lobbyId: string }) {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  const statsQ = useQuery({
    queryKey: ["fortnite-stats", submitted],
    queryFn: () => api<StatsResp>(`/fortnite/stats/${encodeURIComponent(submitted!)}`),
    enabled: !!submitted,
  });

  const shopQ = useQuery({
    queryKey: ["fortnite-shop"],
    queryFn: () => api<ShopResp>(`/fortnite/shop`),
    staleTime: 15 * 60 * 1000,
  });

  const newsQ = useQuery({
    queryKey: ["fortnite-news"],
    queryFn: () => api<NewsResp>(`/fortnite/news`),
    staleTime: 30 * 60 * 1000,
  });

  return (
    <View className="border-t border-border/40 pt-4 pb-2">
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">Fortnite</Text>

      <View className="px-4 mb-4 flex-row">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Epic username"
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
          <Text className="text-white font-bold text-sm">Stats</Text>
        </Pressable>
      </View>

      {submitted && statsQ.isLoading && (
        <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>
      )}
      {statsQ.data && !statsQ.data.ok && (
        <Text className="text-red-400 text-sm px-4 pb-3">
          {statsQ.data.error === "player_not_found" ? "Player not found." : "Stats unavailable."}
        </Text>
      )}
      {statsQ.data?.ok && statsQ.data.stats?.all && (
        <View className="px-4 pb-4">
          <View className="flex-row items-center mb-3">
            {statsQ.data.image && (
              <Image source={{ uri: statsQ.data.image }} style={{ width: 48, height: 48, borderRadius: 8 }} />
            )}
            <View className="flex-1 ml-3">
              <Text className="text-weered-text font-bold">{statsQ.data.account?.name}</Text>
              {statsQ.data.battlePass?.level != null && (
                <Text className="text-weered-muted text-xs mt-0.5">
                  Battle Pass Lv.{statsQ.data.battlePass.level}
                </Text>
              )}
            </View>
          </View>
          <StatRow label="Wins" value={String(statsQ.data.stats.all.wins ?? 0)} />
          <StatRow label="Kills" value={String(statsQ.data.stats.all.kills ?? 0)} />
          <StatRow label="K/D" value={String((statsQ.data.stats.all.kd ?? 0).toFixed(2))} />
          <StatRow label="Matches" value={String(statsQ.data.stats.all.matches ?? 0)} />
          <StatRow label="Win rate" value={`${statsQ.data.stats.all.winRate ?? 0}%`} />
        </View>
      )}

      {(shopQ.data?.sections?.length ?? 0) > 0 && (
        <View className="border-t border-border/30 pt-3 pb-2">
          <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 mb-2">Item shop</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
            {shopQ.data!.sections!.slice(0, 20).map((s) => (
              <View key={s.id} className="mx-1.5 w-28">
                {s.image && (
                  <Image source={{ uri: s.image }} style={{ width: 112, height: 112, borderRadius: 6 }} />
                )}
                <Text className="text-weered-text text-xs font-bold mt-1.5" numberOfLines={1}>{s.name}</Text>
                <Text className="text-weered-muted text-xs" numberOfLines={1}>{s.rarity} · {s.price} vb</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View className="border-t border-border/30 pt-3 pb-2">
        <FortniteStreams />
      </View>

      {(newsQ.data?.news?.length ?? 0) > 0 && (
        <View className="border-t border-border/30 pt-3 pb-4 px-4">
          <Text className="text-weered-muted text-xs uppercase tracking-wide mb-2">News</Text>
          {newsQ.data!.news!.slice(0, 3).map((n) => (
            <View key={n.id} className="bg-panel border border-border rounded-lg p-3 mb-2">
              <Text className="text-weered-text font-bold text-sm" numberOfLines={2}>{n.title}</Text>
              {!!n.body && (
                <Text className="text-weered-muted text-xs mt-1" numberOfLines={3}>{n.body}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View className="border-t border-border/30">
        <WishlistSection />
      </View>

      <View className="border-t border-border/30">
        <LfgPanel lobbyId={lobbyId} />
      </View>
    </View>
  );
}

type Cosmetic = {
  id: string; name: string; description?: string; type?: string; rarity?: string;
  rarityColor?: string; image?: string;
};

function WishlistSection() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const trimmed = search.trim();

  const mineQ = useQuery({
    queryKey: ["fn-wishlist"],
    queryFn: () => api<{ ok: boolean; items: (Cosmetic & { cosmeticId: string })[] }>("/fortnite/wishlist"),
  });
  const searchQ = useQuery({
    queryKey: ["fn-cosmetics-search", trimmed],
    queryFn: () => api<{ ok: boolean; items: Cosmetic[] }>(`/fortnite/cosmetics/search?query=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length >= 2,
  });

  const add = useMutation({
    mutationFn: (c: Cosmetic) => api("/fortnite/wishlist", {
      method: "POST",
      body: { cosmeticId: c.id, name: c.name, type: c.type || "", rarity: c.rarity || "", image: c.image },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fn-wishlist"] }),
    onError: (e: any) => Alert.alert("Couldn't add", e?.message || "Unknown error"),
  });
  const remove = useMutation({
    mutationFn: (cosmeticId: string) => api(`/fortnite/wishlist/${encodeURIComponent(cosmeticId)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fn-wishlist"] }),
    onError: (e: any) => Alert.alert("Couldn't remove", e?.message || "Unknown error"),
  });

  const mine = mineQ.data?.items ?? [];
  const mineIds = new Set(mine.map((i) => i.cosmeticId));

  return (
    <View className="pt-3 pb-2">
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">Wishlist · {mine.length}/50</Text>

      {mine.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
          {mine.map((i) => (
            <Pressable
              key={i.cosmeticId}
              onLongPress={() => Alert.alert("Remove?", i.name, [
                { text: "Cancel", style: "cancel" },
                { text: "Remove", style: "destructive", onPress: () => remove.mutate(i.cosmeticId) },
              ])}
              className="mx-1 w-24 items-center"
            >
              {i.image ? (
                <Image source={{ uri: i.image }} style={{ width: 88, height: 88, borderRadius: 6, backgroundColor: "#1a1a1a" }} />
              ) : (
                <View style={{ width: 88, height: 88, borderRadius: 6, backgroundColor: "#1a1a1a" }} />
              )}
              <Text className="text-weered-text text-[11px] font-bold mt-1" numberOfLines={1}>{i.name}</Text>
              <Text className="text-weered-muted text-[10px]" numberOfLines={1}>{i.rarity || i.type}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View className="px-4 mt-2">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search cosmetics to wishlist"
          placeholderTextColor="rgba(160,160,170,0.6)"
          autoCapitalize="none"
          autoCorrect={false}
          className="bg-panel border border-border text-weered-text px-3 py-2 rounded-lg"
          style={{ fontSize: 14 }}
        />
      </View>

      {trimmed.length >= 2 && (
        searchQ.isLoading ? (
          <View className="py-4 items-center"><ActivityIndicator color="#5800E5" /></View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8 }}>
            {(searchQ.data?.items ?? []).slice(0, 15).map((c) => {
              const already = mineIds.has(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => already ? remove.mutate(c.id) : add.mutate(c)}
                  className="mx-1 w-24 items-center active:opacity-70"
                >
                  {c.image ? (
                    <Image source={{ uri: c.image }} style={{ width: 88, height: 88, borderRadius: 6, backgroundColor: "#1a1a1a" }} />
                  ) : (
                    <View style={{ width: 88, height: 88, borderRadius: 6, backgroundColor: "#1a1a1a" }} />
                  )}
                  <Text className="text-weered-text text-[11px] font-bold mt-1" numberOfLines={1}>{c.name}</Text>
                  <Text className={`text-[10px] font-bold mt-0.5 ${already ? "text-red-400" : "text-weered"}`}>
                    {already ? "Remove" : "+ Add"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )
      )}
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between bg-panel border border-border rounded-lg px-3 py-2 mb-1.5">
      <Text className="text-weered-muted text-sm">{label}</Text>
      <Text className="text-weered-text text-sm font-bold">{value}</Text>
    </View>
  );
}

type TwitchStream = { userLogin: string; userName: string; title: string; viewerCount: number; thumbnailUrl: string };
type TwitchStreamsResp = { ok: boolean; streams?: TwitchStream[] };

function FortniteStreams() {
  const q = useQuery({
    queryKey: ["twitch-streams", "Fortnite"],
    queryFn: () => api<TwitchStreamsResp>(`/twitch/streams?game=${encodeURIComponent("Fortnite")}&first=20`),
    staleTime: 5 * 60 * 1000,
  });
  if (q.isLoading || !q.data?.streams?.length) return null;
  return (
    <>
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">📺 Live streams</Text>
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
    </>
  );
}
