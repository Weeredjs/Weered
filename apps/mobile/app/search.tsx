import { useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { LobbyLogo } from "@/components/LobbyLogo";

type Lobby = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  verified: boolean;
  _count?: { members: number; rooms: number };
};
type Room = {
  id: string;
  name: string;
  locked: boolean;
  lobby: { id: string; name: string; logoUrl: string | null; accentColor: string | null };
  _count: { members: number };
};
type User = {
  id: string;
  name: string;
  usernameKey: string;
  avatar: string | null;
  avatarColor: string | null;
  tier: string;
  notoriety: number;
};

type LobbiesResp = { ok: boolean; pinned: Lobby[]; rooms: Room[] };
type UsersResp = { ok: boolean; users: User[] };
type AiResp = { ok: boolean; answer: string | null; lobbies: Lobby[]; action: string | null };

export default function Search() {
  const [q, setQ] = useState("");
  const trimmed = q.trim();
  const enabled = trimmed.length >= 2;

  const lobbiesQ = useQuery({
    queryKey: ["search-lobbies", trimmed],
    queryFn: () => api<LobbiesResp>(`/lobbies/search?q=${encodeURIComponent(trimmed)}`),
    enabled,
  });

  const usersQ = useQuery({
    queryKey: ["search-users", trimmed],
    queryFn: () => api<UsersResp>(`/users/search?q=${encodeURIComponent(trimmed)}`),
    enabled,
  });

  const aiQ = useQuery({
    queryKey: ["search-ai", trimmed],
    queryFn: () => api<AiResp>(`/ai/search?q=${encodeURIComponent(trimmed)}`),
    enabled,
    staleTime: 60_000,
  });

  const lobbies = lobbiesQ.data?.pinned ?? [];
  const rooms = lobbiesQ.data?.rooms ?? [];
  const users = usersQ.data?.users ?? [];
  const loading = enabled && (lobbiesQ.isLoading || usersQ.isLoading);
  const empty =
    enabled && !loading && lobbies.length === 0 && rooms.length === 0 && users.length === 0;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Search" }} />

      <View className="px-4 py-3 border-b border-border/40">
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search lobbies, rooms, users…"
          placeholderTextColor="rgba(160,160,170,0.6)"
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus
          className="bg-panel text-weered-text px-3 py-2.5 rounded-lg"
          style={{ fontSize: 15 }}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {!enabled && (
          <Text className="text-weered-muted text-sm text-center py-12">
            Type at least 2 characters.
          </Text>
        )}

        {loading && (
          <View className="py-8 items-center">
            <ActivityIndicator color="#5800E5" />
          </View>
        )}

        {aiQ.data?.answer ? (
          <View className="mx-4 mt-4 p-3 bg-weered/10 border border-weered/30 rounded-xl">
            <Text className="text-weered text-[10px] uppercase font-bold tracking-wider mb-1">
              🤖 The Operator
            </Text>
            <Text className="text-weered-text text-sm">{aiQ.data.answer}</Text>
            {aiQ.data.lobbies.length > 0 && (
              <View className="flex-row flex-wrap mt-2">
                {aiQ.data.lobbies.slice(0, 4).map((l) => (
                  <Pressable
                    key={l.id}
                    onPress={() => router.push(`/lobby/${l.id}`)}
                    className="bg-weered px-3 py-1 rounded-md mr-1.5 mb-1 active:opacity-80"
                  >
                    <Text className="text-white text-xs font-bold">{l.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : aiQ.isFetching && enabled ? (
          <View className="mx-4 mt-4 p-3 bg-panel border border-border rounded-xl flex-row items-center">
            <Text className="text-weered-muted text-[10px] uppercase font-bold mr-2">🤖</Text>
            <ActivityIndicator color="#5800E5" size="small" />
            <Text className="text-weered-muted text-xs ml-2">Operator thinking…</Text>
          </View>
        ) : null}

        {empty && (
          <Text className="text-weered-muted text-sm text-center py-12">
            Nothing matched "{trimmed}".
          </Text>
        )}

        {users.length > 0 && (
          <View>
            <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-4 pb-2">
              Users · {users.length}
            </Text>
            {users.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => router.push(`/user/${u.id}`)}
                className="flex-row items-center px-4 py-2.5 border-b border-border/20 active:bg-panel"
              >
                <View className="mr-3">
                  <Avatar name={u.name} url={u.avatar} size={36} />
                </View>
                <View className="flex-1">
                  <Text className="text-weered-text font-semibold" numberOfLines={1}>
                    {u.name}
                  </Text>
                  <Text className="text-weered-muted text-xs">
                    @{u.usernameKey} · {u.tier}
                  </Text>
                </View>
                <Text className="text-weered text-xs font-bold">
                  {u.notoriety.toLocaleString()}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {lobbies.length > 0 && (
          <View>
            <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-4 pb-2">
              Lobbies · {lobbies.length}
            </Text>
            {lobbies.map((l) => (
              <Pressable
                key={l.id}
                onPress={() => router.push(`/lobby/${l.id}`)}
                className="flex-row items-center px-4 py-2.5 border-b border-border/20 active:bg-panel"
              >
                <View className="mr-3">
                  <LobbyLogo name={l.name} url={l.logoUrl} accent={l.accentColor} size={40} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-weered-text font-semibold flex-1" numberOfLines={1}>
                      {l.name}
                    </Text>
                    {l.verified && <Text className="text-weered text-xs font-bold">✓</Text>}
                  </View>
                  {!!l.description && (
                    <Text className="text-weered-muted text-xs" numberOfLines={1}>
                      {l.description}
                    </Text>
                  )}
                  {l._count && (
                    <Text className="text-weered-muted text-xs mt-0.5">
                      {l._count.rooms} rooms · {l._count.members} members
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {rooms.length > 0 && (
          <View>
            <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-4 pb-2">
              Rooms · {rooms.length}
            </Text>
            {rooms.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/room/${r.id}`)}
                className="flex-row items-center px-4 py-2.5 border-b border-border/20 active:bg-panel"
              >
                <View className="mr-3">
                  <LobbyLogo
                    name={r.lobby?.name || "?"}
                    url={r.lobby?.logoUrl}
                    accent={r.lobby?.accentColor}
                    size={36}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-weered-text font-semibold" numberOfLines={1}>
                    {r.locked ? "🔒 " : ""}
                    {r.name}
                  </Text>
                  <Text className="text-weered-muted text-xs">
                    in {r.lobby?.name || "?"} · {r._count?.members ?? 0} members
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
