import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { LobbyLogo } from "@/components/LobbyLogo";
import { ModuleBadge } from "@/components/ModuleBadge";
import { SiteBanner } from "@/components/SiteBanner";

type Lobby = {
  id: string;
  name: string;
  description: string | null;
  verified: boolean;
  pinned: boolean;
  moduleType: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  onlineCount: number;
  _count: { rooms: number; members: number };
};

type LobbiesResponse = { ok: boolean; lobbies: Lobby[] };
type SearchResponse = {
  ok: boolean;
  pinned: (Lobby & { websiteUrl?: string | null })[];
  rooms: {
    id: string;
    name: string;
    locked: boolean;
    lobbyId: string;
    lobby: { id: string; name: string; accentColor: string | null; logoUrl: string | null };
    _count: { members: number };
  }[];
};

export default function Lobbies() {
  const [query, setQuery] = useState("");
  const token = useAuth((s) => s.token);
  const q = query.trim();
  const searching = q.length >= 2;

  const myLobbiesQ = useQuery({
    queryKey: ["my-lobbies"],
    queryFn: () => api<LobbiesResponse>("/me/lobbies"),
    enabled: !!token && !searching,
  });

  const recentsQ = useQuery({
    queryKey: ["recents"],
    queryFn: () => api<{ ok: boolean; recents: { lobbyId: string | null; roomId: string | null; lobbyName?: string | null; name: string; logoUrl: string | null; accentColor: string | null; visitedAt: string }[] }>("/recents"),
    enabled: !!token && !searching,
  });

  const featuredQ = useQuery({
    queryKey: ["featured"],
    queryFn: () => api<{ ok: boolean; lobby: Lobby | null }>("/featured"),
    enabled: !searching,
    staleTime: 10 * 60_000,
  });

  const listQ = useQuery({
    queryKey: ["lobbies"],
    queryFn: () => api<LobbiesResponse>("/lobbies"),
    enabled: !searching,
  });

  const searchQ = useQuery({
    queryKey: ["lobbies-search", q],
    queryFn: () => api<SearchResponse>(`/lobbies/search?q=${encodeURIComponent(q)}`),
    enabled: searching,
    placeholderData: keepPreviousData,
  });

  const onRefresh = useCallback(() => {
    if (searching) searchQ.refetch();
    else listQ.refetch();
  }, [searching, listQ, searchQ]);

  const allLobbies = searching ? (searchQ.data?.pinned ?? []) : (listQ.data?.lobbies ?? []);
  const myLobbies = !searching ? (myLobbiesQ.data?.lobbies ?? []) : [];
  const myIds = new Set(myLobbies.map((l) => l.id));
  const discoverLobbies = allLobbies.filter((l) => !myIds.has(l.id));
  const roomHits = searching ? (searchQ.data?.rooms ?? []) : [];
  const isLoading = searching ? searchQ.isLoading : listQ.isLoading;
  const isRefetching = searching ? searchQ.isRefetching : listQ.isRefetching;
  const error = searching ? searchQ.error : listQ.error;

  return (
    <SafeAreaView edges={[]} className="flex-1 bg-weered-bg">
      <SiteBanner />
      <View className="px-3 py-2 border-b border-border/40 flex-row items-center">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search lobbies or rooms"
          placeholderTextColor="rgba(160,160,170,0.6)"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          className="bg-panel text-weered-text px-3 py-2 rounded-lg flex-1"
          style={{ fontSize: 15 }}
        />
        <Pressable
          onPress={() => router.push("/lobby/new")}
          className="bg-weered px-3 py-2 rounded-lg ml-2 active:opacity-80"
        >
          <Text className="text-white font-bold">+ New</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-400 text-sm text-center">
            Couldn't load. Pull to retry.
          </Text>
        </View>
      ) : (
        <FlatList
          data={discoverLobbies}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          ItemSeparatorComponent={() => <View className="h-px bg-border/40 mx-4" />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor="#5800E5"
              colors={["#5800E5"]}
            />
          }
          ListHeaderComponent={
            !searching ? (
              <View>
                {featuredQ.data?.lobby && (
                  <Pressable
                    onPress={() => router.push(`/lobby/${featuredQ.data!.lobby!.id}`)}
                    className="mx-3 mt-3 mb-2 rounded-xl overflow-hidden active:opacity-90"
                    style={{ backgroundColor: (featuredQ.data.lobby.accentColor || "#5800E5") + "15", borderWidth: 1, borderColor: (featuredQ.data.lobby.accentColor || "#5800E5") + "55" }}
                  >
                    <View className="p-3 flex-row items-center">
                      <LobbyLogo name={featuredQ.data.lobby.name} url={featuredQ.data.lobby.logoUrl} accent={featuredQ.data.lobby.accentColor} size={56} />
                      <View className="flex-1 ml-3">
                        <Text className="text-weered text-[10px] font-bold uppercase tracking-wider">★ Featured</Text>
                        <Text className="text-weered-text font-bold text-base" numberOfLines={1}>{featuredQ.data.lobby.name}</Text>
                        {!!featuredQ.data.lobby.description && (
                          <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={2}>{featuredQ.data.lobby.description}</Text>
                        )}
                        {(featuredQ.data.lobby as any)._count && (
                          <Text className="text-weered-muted text-xs mt-1">
                            {(featuredQ.data.lobby as any)._count.rooms} rooms · {(featuredQ.data.lobby as any)._count.members} members
                          </Text>
                        )}
                      </View>
                    </View>
                  </Pressable>
                )}
                {(recentsQ.data?.recents?.length ?? 0) > 0 && (
                  <>
                    <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-2 pb-1">
                      Recent
                    </Text>
                    <View className="flex-row flex-wrap px-2 pb-2">
                      {recentsQ.data!.recents!.slice(0, 6).map((r) => (
                        <Pressable
                          key={`${r.lobbyId || ""}-${r.roomId || ""}`}
                          onPress={() => {
                            if (r.roomId) router.push(`/room/${r.roomId}`);
                            else if (r.lobbyId) router.push(`/lobby/${r.lobbyId}`);
                          }}
                          className="bg-panel border border-border px-3 py-1.5 rounded-full m-1 active:opacity-70 flex-row items-center"
                        >
                          {r.roomId ? <Text className="text-weered-muted text-xs mr-1">#</Text> : null}
                          <Text className="text-weered-text text-xs font-semibold" numberOfLines={1}>
                            {r.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
                {myLobbies.length > 0 && (
                  <>
                    <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-2 pb-1">
                      My lobbies · {myLobbies.length}
                    </Text>
                    {myLobbies.map((l, i) => (
                      <View key={l.id}>
                        {i > 0 && <View className="h-px bg-border/40 mx-4" />}
                        <LobbyRow lobby={l} />
                      </View>
                    ))}
                    <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-5 pb-1">
                      Discover
                    </Text>
                  </>
                )}
              </View>
            ) : null
          }
          renderItem={({ item }) => <LobbyRow lobby={item} />}
          ListFooterComponent={
            searching && roomHits.length > 0 ? (
              <View className="mt-6">
                <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">
                  Rooms
                </Text>
                {roomHits.map((r) => {
                  const parent = r.lobby;
                  const parentName = parent?.name || "unknown lobby";
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => router.push(`/room/${r.id}`)}
                      className="px-4 py-3 active:bg-panel flex-row items-center"
                    >
                      <View className="mr-3">
                        <LobbyLogo name={parentName} url={parent?.logoUrl} accent={parent?.accentColor} size={36} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-weered-text font-semibold" numberOfLines={1}>
                          {r.locked ? "🔒 " : ""}{r.name}
                        </Text>
                        <Text className="text-weered-muted text-xs" numberOfLines={1}>
                          in {parentName} · {r._count?.members ?? 0} members
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="px-8 py-16 items-center">
              <Text className="text-weered-muted text-sm">
                {searching ? "No lobbies match." : "No lobbies yet."}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function LobbyRow({ lobby }: { lobby: Lobby }) {
  return (
    <Pressable
      onPress={() => router.push(`/lobby/${lobby.id}`)}
      className="flex-row items-center px-4 py-3 active:bg-panel"
    >
      <View className="mr-3">
        <LobbyLogo name={lobby.name} url={lobby.logoUrl} accent={lobby.accentColor} size={48} />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center flex-wrap">
          <Text className="text-weered-text font-bold text-base" numberOfLines={1}>
            {lobby.name}
          </Text>
          {lobby.verified && <Text className="text-weered ml-1.5 text-xs font-bold">✓</Text>}
          {lobby.pinned && <Text className="text-amber-400 ml-1.5 text-xs">★</Text>}
          {lobby.moduleType && lobby.moduleType !== "NONE" && lobby.moduleType !== "FEED" && (
            <ModuleBadge type={lobby.moduleType} accent={lobby.accentColor} />
          )}
        </View>
        {!!lobby.description && (
          <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={1}>
            {lobby.description}
          </Text>
        )}
        <View className="flex-row mt-1">
          <Text className="text-weered-muted text-xs">
            <Text className="text-green-400">●</Text> {lobby.onlineCount ?? 0} online
          </Text>
          {lobby._count && (
            <>
              <Text className="text-weered-muted text-xs ml-3">
                {lobby._count.rooms} {lobby._count.rooms === 1 ? "room" : "rooms"}
              </Text>
              <Text className="text-weered-muted text-xs ml-3">
                {lobby._count.members} {lobby._count.members === 1 ? "member" : "members"}
              </Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}
