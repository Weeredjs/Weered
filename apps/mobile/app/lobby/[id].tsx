import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { resolveImageUrl, WEB_BASE } from "@/lib/config";
import { LobbyLogo } from "@/components/LobbyLogo";
import { ModuleBadge } from "@/components/ModuleBadge";
import { LeaguePanel } from "@/components/LeaguePanel";
import { FortnitePanel } from "@/components/FortnitePanel";
import { LobbyEvents } from "@/components/LobbyEvents";
import { LobbyForum } from "@/components/LobbyForum";
import { TradingPanel } from "@/components/TradingPanel";
import { LobbyTiers } from "@/components/LobbyTiers";
import { BungiePanel } from "@/components/BungiePanel";
import { PubgPanel } from "@/components/PubgPanel";
import { MlbPanel } from "@/components/MlbPanel";
import { PgaPanel } from "@/components/PgaPanel";
import { WindrosePanel } from "@/components/WindrosePanel";
import { GenericGamePanel } from "@/components/GenericGamePanel";
import { PokerPanel } from "@/components/PokerPanel";
import { LobbyPresence } from "@/components/LobbyPresence";
import type {
  Lobby,
  Room,
  LobbyMembership,
  JoinRequest,
  LobbyDetailResponse as LobbyDetail,
  RoomsResponse,
} from "@weered/shared";

type Membership = LobbyMembership | null;

export default function LobbyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lobbyId = String(id || "");
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();

  const lobbyQ = useQuery({
    queryKey: ["lobby", lobbyId],
    queryFn: () => api<LobbyDetail>(`/lobbies/${lobbyId}`),
    enabled: !!lobbyId,
  });

  useEffect(() => {
    if (lobbyId && me) {
      api("/recents", { method: "POST", body: { lobbyId } }).catch(() => {});
    }
  }, [lobbyId, me]);

  const join = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; pending?: boolean; error?: string }>(`/lobbies/${lobbyId}/join`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["lobby", lobbyId] });
      if (data?.pending) Alert.alert("Request sent", "A moderator will review your request.");
    },
    onError: (e: any) => Alert.alert("Couldn't join", e?.message || "Unknown error"),
  });

  const leave = useMutation({
    mutationFn: () => api(`/lobbies/${lobbyId}/leave`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lobby", lobbyId] }),
    onError: (e: any) => Alert.alert("Couldn't leave", e?.message || "Unknown error"),
  });

  const roomsQ = useQuery({
    queryKey: ["lobby-rooms", lobbyId],
    queryFn: () => api<RoomsResponse>(`/lobbies/${lobbyId}/rooms`),
    enabled: !!lobbyId,
    refetchInterval: 15000,
  });

  const onRefresh = useCallback(() => {
    lobbyQ.refetch();
    roomsQ.refetch();
  }, [lobbyQ, roomsQ]);

  const lobby = lobbyQ.data?.lobby;
  const membership = lobbyQ.data?.membership ?? null;
  const joinRequest = lobbyQ.data?.joinRequest ?? null;
  const rooms = roomsQ.data?.rooms ?? [];
  const accent = lobby?.accentColor || "#5800E5";
  const isOwner = (membership?.roleLevel ?? 0) >= 5;
  const staffRoles = new Set(["GOD", "STAFF", "ADMIN", "SUPPORT"]);
  const isGlobalStaff = staffRoles.has(String(me?.globalRole || ""));
  const isMod = (membership?.roleLevel ?? 0) >= 2 || isGlobalStaff;

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: "#0c0b0a" }}>
      <Stack.Screen
        options={{
          title: lobby?.name || "Lobby",
          headerRight: () => (
            <View className="flex-row items-center mr-2">
              {!!membership && (
                <Pressable
                  onPress={() => router.push(`/room/${lobbyId}`)}
                  hitSlop={8}
                  className="mr-3 active:opacity-70"
                >
                  <Text className="text-weered font-semibold">💬 Chat</Text>
                </Pressable>
              )}
              {isMod && (
                <Pressable
                  onPress={() => router.push(`/admin/${lobbyId}`)}
                  hitSlop={8}
                  className="mr-3 active:opacity-70"
                >
                  <Text className="text-weered font-semibold">Admin</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() =>
                  Share.share({
                    url: `${WEB_BASE}/lobby/${lobbyId}`,
                    message: lobby
                      ? `Join ${lobby.name} on Weered — ${WEB_BASE}/lobby/${lobbyId}`
                      : `${WEB_BASE}/lobby/${lobbyId}`,
                  }).catch(() => {})
                }
                hitSlop={8}
                className="active:opacity-70"
              >
                <Text className="text-weered font-semibold">Share</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      {lobbyQ.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : lobbyQ.error || !lobby ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-400 text-sm text-center">Couldn't load this lobby.</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id}
          style={{ backgroundColor: "#0c0b0a" }}
          contentContainerStyle={{ paddingBottom: 24, backgroundColor: "#0c0b0a" }}
          refreshControl={
            <RefreshControl
              refreshing={lobbyQ.isRefetching || roomsQ.isRefetching}
              onRefresh={onRefresh}
              tintColor="#5800E5"
            />
          }
          ListHeaderComponent={
            <View>
              <LobbyBanner url={lobby.bannerUrl} accent={accent} />

              <View
                style={{
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  paddingBottom: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.06)",
                  backgroundColor: "#0c0b0a",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ marginRight: 12 }}>
                    <LobbyLogo name={lobby.name} url={lobby.logoUrl} accent={accent} size={56} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: "rgba(243,244,246,0.96)",
                          fontFamily: "monospace",
                          fontWeight: "900",
                          fontSize: 18,
                          letterSpacing: 0.3,
                        }}
                      >
                        {lobby.name}
                      </Text>
                      {lobby.verified && (
                        <Text
                          style={{
                            color: "#5800E5",
                            marginLeft: 6,
                            fontSize: 13,
                            fontWeight: "900",
                          }}
                        >
                          ✓
                        </Text>
                      )}
                      {lobby.moduleType &&
                        lobby.moduleType !== "NONE" &&
                        lobby.moduleType !== "FEED" && (
                          <ModuleBadge type={lobby.moduleType} accent={lobby.accentColor} />
                        )}
                    </View>
                    {!!lobby.description && (
                      <Text
                        numberOfLines={2}
                        style={{ color: "rgba(203,213,225,0.75)", fontSize: 12, marginTop: 3 }}
                      >
                        {lobby.description}
                      </Text>
                    )}
                  </View>
                </View>

                {me && (
                  <View className="mt-3">
                    <JoinButton
                      membership={membership}
                      joinRequest={joinRequest}
                      isOwner={isOwner}
                      joinMode={lobby.joinMode}
                      pending={join.isPending || leave.isPending}
                      onJoin={() => join.mutate()}
                      onLeave={() =>
                        Alert.alert("Leave lobby?", `You'll lose access to member-only rooms.`, [
                          { text: "Cancel", style: "cancel" },
                          { text: "Leave", style: "destructive", onPress: () => leave.mutate() },
                        ])
                      }
                    />
                  </View>
                )}
              </View>

              <LobbyPresence lobbyId={lobbyId} />

              {lobby.moduleType === "RIOT" && <LeaguePanel lobbyId={lobbyId} />}
              {lobby.moduleType === "FORTNITE" && <FortnitePanel lobbyId={lobbyId} />}
              {lobby.moduleType === "TRADING" && <TradingPanel lobbyId={lobbyId} />}
              {lobby.moduleType === "BUNGIE" && <BungiePanel lobbyId={lobbyId} />}
              {lobby.moduleType === "PUBG" && <PubgPanel lobbyId={lobbyId} />}
              {lobby.moduleType === "MLB" && <MlbPanel lobbyId={lobbyId} />}
              {lobby.moduleType === "PGA" && <PgaPanel lobbyId={lobbyId} />}
              {lobby.moduleType === "WINDROSE" && <WindrosePanel lobbyId={lobbyId} />}
              {lobby.moduleType === "POKER" && <PokerPanel lobbyId={lobbyId} />}
              {lobby.moduleType === "CS2" && (
                <GenericGamePanel
                  lobbyId={lobbyId}
                  label="Counter-Strike 2"
                  twitchGame="Counter-Strike"
                />
              )}
              {lobby.moduleType === "DOTA2" && (
                <GenericGamePanel lobbyId={lobbyId} label="Dota 2" twitchGame="Dota 2" />
              )}
              {lobby.moduleType === "POE" && (
                <GenericGamePanel
                  lobbyId={lobbyId}
                  label="Path of Exile"
                  twitchGame="Path of Exile"
                />
              )}
              {lobby.moduleType === "MARATHON" && (
                <GenericGamePanel lobbyId={lobbyId} label="Marathon" twitchGame="Marathon" />
              )}
              {lobby.moduleType === "DND" && (
                <GenericGamePanel
                  lobbyId={lobbyId}
                  label="Dungeons & Dragons"
                  twitchGame="Dungeons & Dragons"
                />
              )}
              {lobby.moduleType === "STUDY" && (
                <GenericGamePanel lobbyId={lobbyId} label="Study" twitchGame={null} />
              )}
              {lobby.moduleType === "HEADQUARTERS" && (
                <GenericGamePanel lobbyId={lobbyId} label="Headquarters" twitchGame={null} />
              )}
              {lobby.moduleType === "CUSTOM" && (
                <GenericGamePanel lobbyId={lobbyId} label="Custom" twitchGame={null} />
              )}

              <LobbyEvents lobbyId={lobbyId} isOwner={isOwner} />
              <LobbyTiers lobbyId={lobbyId} />
              {!!membership && <LobbyForum lobbyId={lobbyId} />}

              <View className="flex-row items-center px-4 pt-4 pb-1">
                <Text className="text-weered-muted text-xs uppercase tracking-wide flex-1">
                  Rooms
                </Text>
                {me && (
                  <Pressable
                    onPress={() => router.push(`/room/new?lobbyId=${lobbyId}`)}
                    hitSlop={6}
                    className="active:opacity-70"
                  >
                    <Text className="text-weered text-xs font-bold">+ New room</Text>
                  </Pressable>
                )}
              </View>
            </View>
          }
          ItemSeparatorComponent={() => <View className="h-px bg-border/30 mx-4" />}
          renderItem={({ item }) => <RoomRow room={item} lobbyId={lobbyId} accent={accent} />}
          ListEmptyComponent={
            !roomsQ.isLoading ? (
              <View className="px-8 py-12 items-center">
                <Text className="text-weered-muted text-sm">No rooms yet.</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function JoinButton({
  membership,
  joinRequest,
  isOwner,
  joinMode,
  pending,
  onJoin,
  onLeave,
}: {
  membership: Membership;
  joinRequest: JoinRequest | null;
  isOwner: boolean;
  joinMode?: string;
  pending: boolean;
  onJoin: () => void;
  onLeave: () => void;
}) {
  if (isOwner) {
    return (
      <View className="bg-panel border border-border px-4 py-2 rounded-lg">
        <Text className="text-weered-muted text-center text-sm font-semibold">Owner</Text>
      </View>
    );
  }
  if (membership) {
    return (
      <Pressable
        onPress={onLeave}
        disabled={pending}
        className="bg-panel border border-border px-4 py-2 rounded-lg active:opacity-80"
      >
        <Text className="text-weered-muted text-center text-sm font-semibold">
          Member · tap to leave
        </Text>
      </Pressable>
    );
  }
  if (joinRequest?.status === "PENDING") {
    return (
      <View className="bg-panel border border-border px-4 py-2 rounded-lg">
        <Text className="text-weered-muted text-center text-sm">Request pending review</Text>
      </View>
    );
  }
  if (joinRequest?.status === "DENIED") {
    return (
      <View className="bg-panel border border-red-500/30 px-4 py-2 rounded-lg">
        <Text className="text-red-400 text-center text-sm">
          Request denied{joinRequest.denyReason ? ` — ${joinRequest.denyReason}` : ""}
        </Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={onJoin}
      disabled={pending}
      className="bg-weered px-4 py-2 rounded-lg active:opacity-80"
    >
      <Text className="text-white text-center font-bold text-sm">
        {joinMode === "APPROVAL" ? "Request to join" : "Join lobby"}
      </Text>
    </Pressable>
  );
}

function UserAvatar({ name, url }: { name: string; url?: string }) {
  const [failed, setFailed] = useState(false);
  const show = url && !failed;
  return (
    <View className="w-7 h-7 rounded-full bg-panel border border-border items-center justify-center overflow-hidden">
      {show ? (
        <Image
          source={{ uri: url }}
          style={{ width: 28, height: 28 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text className="text-weered-text text-xs font-bold">{name.slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}

function LobbyBanner({ url, accent }: { url: string | null; accent: string }) {
  const resolved = resolveImageUrl(url);
  const [failed, setFailed] = useState(false);
  if (!resolved || failed) {
    return <View style={{ height: 80, backgroundColor: accent + "22" }} />;
  }
  return (
    <Image
      source={{ uri: resolved }}
      style={{ width: "100%", height: 120 }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

function RoomRow({ room, lobbyId, accent }: { room: Room; lobbyId: string; accent: string }) {
  return (
    <Pressable
      onPress={() => router.push(`/room/${room.id}`)}
      className="flex-row items-center px-4 py-3 active:bg-panel"
    >
      <View className="flex-1">
        <View className="flex-row items-center">
          {room.isEvent && (
            <Text className="mr-1.5 text-xs" style={{ color: accent }}>
              EVENT
            </Text>
          )}
          {room.pinned && <Text className="text-amber-400 text-xs mr-1.5">★</Text>}
          {room.locked && <Text className="text-weered-muted text-xs mr-1.5">🔒</Text>}
          <Text className="text-weered-text font-semibold text-base" numberOfLines={1}>
            {room.name}
          </Text>
        </View>
        {!!room.description && (
          <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={1}>
            {room.description}
          </Text>
        )}
        <Text className="text-weered-muted text-xs mt-1">
          <Text className="text-green-400">●</Text> {room.onlineCount} online
        </Text>
      </View>

      <View className="flex-row -space-x-2 ml-2">
        {room.onlineUsers.slice(0, 3).map((u) => (
          <UserAvatar key={u.id} name={u.name} url={u.avatar} />
        ))}
      </View>
    </Pressable>
  );
}
