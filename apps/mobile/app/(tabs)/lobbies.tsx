import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { LobbyLogo } from "@/components/LobbyLogo";
import { ModuleBadge } from "@/components/ModuleBadge";
import { SiteBanner } from "@/components/SiteBanner";
import { StampHeader, StreetCard, Tag } from "@/components/Brand";
import { resolveImageUrl } from "@/lib/config";
import { Ionicons } from "@expo/vector-icons";
import type { Lobby, LobbiesResponse, LobbySearchResponse as SearchResponse } from "@weered/shared";

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
    queryFn: () =>
      api<{
        ok: boolean;
        recents: {
          lobbyId: string | null;
          roomId: string | null;
          lobbyName?: string | null;
          name: string;
          logoUrl: string | null;
          accentColor: string | null;
          visitedAt: string;
        }[];
      }>("/recents"),
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
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: "#0c0b0a" }}>
      <SiteBanner />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: "#000",
          borderBottomWidth: 1.5,
          borderBottomColor: "rgba(88,0,229,0.4)",
        }}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="SEARCH LOBBIES · ROOMS"
          placeholderTextColor="rgba(160,160,170,0.5)"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          style={{
            flex: 1,
            fontSize: 13,
            fontFamily: "monospace",
            fontWeight: "700",
            letterSpacing: 1,
            color: "rgba(243,244,246,0.96)",
            backgroundColor: "rgba(255,255,255,0.04)",
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        />
        <Pressable
          onPress={() => router.push("/lobby/new")}
          style={{
            marginLeft: 8,
            backgroundColor: "#5800E5",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 4,
            shadowColor: "#5800E5",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
            elevation: 3,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontFamily: "monospace",
              fontWeight: "900",
              fontSize: 12,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            + New
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-400 text-sm text-center">Couldn't load. Pull to retry.</Text>
        </View>
      ) : (
        <FlatList
          data={discoverLobbies}
          keyExtractor={(l) => l.id}
          style={{ backgroundColor: "#0b0a0f" }}
          contentContainerStyle={{ paddingVertical: 8, backgroundColor: "#0b0a0f" }}
          ItemSeparatorComponent={() => <View className="h-0" />}
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
                <Pressable
                  onPress={() => router.push(`/room/lobby`)}
                  className="active:opacity-90"
                  style={{
                    marginHorizontal: 12,
                    marginTop: 12,
                    marginBottom: 8,
                    overflow: "hidden",
                    borderRadius: 4,
                    borderWidth: 1.5,
                    borderColor: "rgba(88,0,229,0.5)",
                    backgroundColor: "#120A22",
                    shadowColor: "#5800E5",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.35,
                    shadowRadius: 10,
                    elevation: 4,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", padding: 12 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 4,
                        backgroundColor: "#5800E5",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="home" size={22} color="#fff" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                      <Text
                        style={{
                          color: "#5800E5",
                          fontFamily: "monospace",
                          fontWeight: "900",
                          fontSize: 10,
                          letterSpacing: 1.5,
                          textTransform: "uppercase",
                        }}
                      >
                        Home Lobby
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: "rgba(243,244,246,0.96)",
                          fontFamily: "monospace",
                          fontWeight: "900",
                          fontSize: 15,
                          letterSpacing: 0.5,
                          marginTop: 2,
                        }}
                      >
                        The Streets
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ color: "rgba(160,160,170,0.85)", fontSize: 11, marginTop: 2 }}
                      >
                        Global chat + presence · everyone's here.
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="rgba(160,160,170,0.7)"
                      style={{ marginLeft: 6 }}
                    />
                  </View>
                </Pressable>
                {featuredQ.data?.lobby &&
                  (() => {
                    const banner = resolveImageUrl(featuredQ.data.lobby.bannerUrl);
                    const lob = featuredQ.data.lobby;
                    const count = (lob as any)._count;
                    return (
                      <Pressable
                        onPress={() => router.push(`/lobby/${lob.id}`)}
                        className="active:opacity-90"
                        style={{
                          marginHorizontal: 12,
                          marginTop: 12,
                          marginBottom: 8,
                          overflow: "hidden",
                          backgroundColor: "#1a1408",
                          borderWidth: 1.5,
                          borderColor: "#f5b700",
                          borderRadius: 4,
                          shadowColor: "#f5b700",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 10,
                          elevation: 4,
                        }}
                      >
                        {!!banner && (
                          <View style={{ position: "relative" }}>
                            <Image
                              source={{ uri: banner }}
                              style={{ width: "100%", height: 130 }}
                              resizeMode="cover"
                            />
                            <View style={{ position: "absolute", top: 10, left: 10 }}>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  backgroundColor: "#1a1408",
                                  borderWidth: 1.5,
                                  borderColor: "#f5b700",
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  borderRadius: 3,
                                  shadowColor: "#000",
                                  shadowOffset: { width: 0, height: 2 },
                                  shadowOpacity: 0.6,
                                  shadowRadius: 4,
                                  elevation: 3,
                                }}
                              >
                                <Text
                                  style={{
                                    color: "#f5b700",
                                    fontFamily: "monospace",
                                    fontWeight: "900",
                                    fontSize: 11,
                                    letterSpacing: 1.4,
                                  }}
                                >
                                  ★ FEATURED
                                </Text>
                              </View>
                            </View>
                          </View>
                        )}
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            padding: 12,
                            backgroundColor: "#1a1408",
                          }}
                        >
                          <LobbyLogo
                            name={lob.name}
                            url={lob.logoUrl}
                            accent={lob.accentColor}
                            size={52}
                          />
                          <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                            {!banner && (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  marginBottom: 3,
                                }}
                              >
                                <Tag tone="gold">★ FEATURED</Tag>
                              </View>
                            )}
                            <Text
                              numberOfLines={1}
                              style={{
                                color: "rgba(243,244,246,0.96)",
                                fontFamily: "monospace",
                                fontWeight: "900",
                                fontSize: 17,
                                letterSpacing: 0.5,
                              }}
                            >
                              {lob.name}
                            </Text>
                            {!!lob.description && (
                              <Text
                                numberOfLines={2}
                                style={{
                                  color: "rgba(160,160,170,0.85)",
                                  fontSize: 11,
                                  marginTop: 2,
                                }}
                              >
                                {lob.description}
                              </Text>
                            )}
                            {count && (
                              <Text
                                numberOfLines={1}
                                style={{
                                  color: "rgba(245,183,0,0.7)",
                                  fontFamily: "monospace",
                                  fontSize: 10,
                                  fontWeight: "700",
                                  letterSpacing: 1,
                                  marginTop: 4,
                                }}
                              >
                                {count.rooms} ROOMS · {count.members} MEMBERS
                              </Text>
                            )}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })()}
                {(recentsQ.data?.recents?.length ?? 0) > 0 && (
                  <>
                    <StampHeader tone="gold">Recent</StampHeader>
                    <View className="flex-row flex-wrap px-2 pb-2">
                      {recentsQ.data!.recents!.slice(0, 6).map((r) => (
                        <Pressable
                          key={`${r.lobbyId || ""}-${r.roomId || ""}`}
                          onPress={() => {
                            if (r.roomId) router.push(`/room/${r.roomId}`);
                            else if (r.lobbyId) router.push(`/lobby/${r.lobbyId}`);
                          }}
                          className="m-1 active:opacity-70 flex-row items-center"
                          style={{
                            backgroundColor: "rgba(255,255,255,0.04)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.12)",
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 3,
                          }}
                        >
                          {r.roomId ? (
                            <Text
                              className="text-weered-muted text-xs mr-1"
                              style={{ fontFamily: "monospace" }}
                            >
                              #
                            </Text>
                          ) : null}
                          <Text
                            className="text-weered-text text-xs"
                            style={{
                              fontFamily: "monospace",
                              fontWeight: "700",
                              letterSpacing: 0.5,
                            }}
                            numberOfLines={1}
                          >
                            {r.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
                {myLobbies.length > 0 && (
                  <>
                    <StampHeader tone="purple">My Lobbies · {myLobbies.length}</StampHeader>
                    {myLobbies.map((l) => (
                      <LobbyRow key={l.id} lobby={l} />
                    ))}
                    <StampHeader tone="purple">Discover</StampHeader>
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
                        <LobbyLogo
                          name={parentName}
                          url={parent?.logoUrl}
                          accent={parent?.accentColor}
                          size={36}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-weered-text font-semibold" numberOfLines={1}>
                          {r.locked ? "🔒 " : ""}
                          {r.name}
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
  const banner = resolveImageUrl(lobby.bannerUrl);
  const accent = lobby.accentColor || "#5800E5";
  const rooms = lobby._count?.rooms ?? 0;
  const members = lobby._count?.members ?? 0;
  const notch = lobby.pinned ? "#f5b700" : lobby.verified ? "#5800E5" : null;
  return (
    <Pressable
      onPress={() => router.push(`/lobby/${lobby.id}`)}
      className="active:opacity-90"
      style={{
        marginHorizontal: 12,
        marginVertical: 6,
        overflow: "hidden",
        borderRadius: 4,
        borderWidth: 1,
        borderColor: notch || "rgba(255,255,255,0.08)",
        backgroundColor: "#15131a",
        minHeight: 78,
      }}
    >
      {!!notch && (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            borderTopWidth: 14,
            borderLeftWidth: 14,
            borderTopColor: notch,
            borderLeftColor: "transparent",
            zIndex: 2,
          }}
        />
      )}
      {!!banner && (
        <Image
          source={{ uri: banner }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.7 }}
          resizeMode="cover"
        />
      )}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(8,7,12,0.55)",
        }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}
      >
        <View style={{ marginRight: 12 }}>
          <LobbyLogo name={lobby.name} url={lobby.logoUrl} accent={accent} size={44} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
            <Text
              numberOfLines={1}
              style={{
                color: "rgba(243,244,246,0.98)",
                fontFamily: "monospace",
                fontWeight: "900",
                fontSize: 14,
                letterSpacing: 0.3,
                maxWidth: "75%",
              }}
            >
              {lobby.name}
            </Text>
            {lobby.verified && (
              <Text style={{ color: "#5800E5", marginLeft: 6, fontSize: 11, fontWeight: "900" }}>
                ✓
              </Text>
            )}
            {lobby.pinned && (
              <Text style={{ color: "#f5b700", marginLeft: 6, fontSize: 11 }}>★</Text>
            )}
            {lobby.moduleType && lobby.moduleType !== "NONE" && lobby.moduleType !== "FEED" && (
              <ModuleBadge type={lobby.moduleType} accent={lobby.accentColor} />
            )}
          </View>
          {!!lobby.description && (
            <Text
              numberOfLines={1}
              style={{ color: "rgba(210,210,220,0.75)", fontSize: 11, marginTop: 2 }}
            >
              {lobby.description}
            </Text>
          )}
          <Text
            numberOfLines={1}
            style={{
              color: "rgba(180,180,190,0.8)",
              fontSize: 10,
              fontFamily: "monospace",
              letterSpacing: 0.5,
              marginTop: 3,
            }}
          >
            <Text style={{ color: "#22c55e" }}>●</Text>
            {` ${lobby.onlineCount ?? 0} ONLINE  ·  ${rooms} ROOM${rooms === 1 ? "" : "S"}  ·  ${members} MEMBER${members === 1 ? "" : "S"}`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
