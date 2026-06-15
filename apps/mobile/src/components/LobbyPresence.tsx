import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";

type LobbyUser = {
  id: string;
  name: string;
  role: string;
  globalRole: string;
  tier: string;
  avatarColor: string | null;
  avatar: string | null;
  isAway: boolean;
  livePresence: { source: string; activity: string } | null;
  roomId: string;
  roomName: string;
};
type PresenceResp = { ok: boolean; users: LobbyUser[] };

const PRESENCE_COLOR: Record<string, string> = {
  STEAM: "#66c0f4",
  TWITCH: "#a970ff",
  XBOX: "#52b043",
};

export function LobbyPresence({ lobbyId }: { lobbyId: string }) {
  const q = useQuery({
    queryKey: ["lobby-presence", lobbyId],
    queryFn: () => api<PresenceResp>(`/lobbies/${lobbyId}/presence`),
    refetchInterval: 30_000,
  });

  const users = q.data?.users ?? [];
  if (q.isLoading && users.length === 0) {
    return (
      <View className="border-t border-border/40 py-3 items-center">
        <ActivityIndicator size="small" color="#5800E5" />
      </View>
    );
  }
  if (users.length === 0) {
    return (
      <View className="border-t border-border/40 pt-3 pb-2">
        <View className="flex-row items-center px-4 pb-2">
          <Text className="text-weered-muted text-xs uppercase tracking-wide flex-1">Online</Text>
        </View>
        <Text className="text-weered-muted text-sm px-4 pb-2">
          No one in the lobby's rooms right now.
        </Text>
      </View>
    );
  }

  // Group by room
  const byRoom = new Map<string, { roomId: string; roomName: string; users: LobbyUser[] }>();
  for (const u of users) {
    if (!byRoom.has(u.roomId))
      byRoom.set(u.roomId, { roomId: u.roomId, roomName: u.roomName, users: [] });
    byRoom.get(u.roomId)!.users.push(u);
  }

  return (
    <View className="border-t border-border/40 pt-3">
      <View className="flex-row items-center px-4 pb-2">
        <Text className="text-weered-muted text-xs uppercase tracking-wide flex-1">
          Online · {users.length}
        </Text>
        <Text className="text-green-400 text-xs">● live</Text>
      </View>

      {Array.from(byRoom.values()).map((group) => (
        <View key={group.roomId} className="pb-2">
          <Pressable
            onPress={() => router.push(`/room/${group.roomId}`)}
            className="px-4 py-1 active:opacity-70"
          >
            <Text className="text-weered text-[11px] font-bold uppercase">
              in {group.roomName} · {group.users.length}
            </Text>
          </Pressable>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12 }}
          >
            {group.users.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => router.push(`/user/${u.id}`)}
                className="mx-1.5 items-center active:opacity-70 w-16"
              >
                <View>
                  <Avatar name={u.name} url={u.avatar} size={44} />
                  {u.isAway ? (
                    <View
                      style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: "#94a3b8",
                        borderWidth: 2,
                        borderColor: "#0c0b0a",
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: "#22c55e",
                        borderWidth: 2,
                        borderColor: "#0c0b0a",
                      }}
                    />
                  )}
                </View>
                <Text
                  className="text-weered-text text-[10px] font-semibold mt-1"
                  numberOfLines={1}
                  style={{ width: 64, textAlign: "center" }}
                >
                  {u.name}
                </Text>
                {u.livePresence && (
                  <Text
                    className="text-[9px]"
                    numberOfLines={1}
                    style={{
                      width: 64,
                      textAlign: "center",
                      color: PRESENCE_COLOR[u.livePresence.source] || "#94a3b8",
                    }}
                  >
                    {u.livePresence.activity}
                  </Text>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}
