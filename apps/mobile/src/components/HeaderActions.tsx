import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { wsClient } from "@/lib/ws";

function IconButton({
  icon,
  count,
  accent,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  accent: string;
  onPress: () => void;
}) {
  const active = count > 0;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 36,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 4,
        position: "relative",
      }}
    >
      <Ionicons name={icon} size={22} color={active ? accent : "rgba(220,220,230,0.9)"} />
      {count > 0 && (
        <View
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 3,
            borderRadius: 8,
            backgroundColor: accent,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: "#0c0b0a",
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 9,
              fontWeight: "800",
            }}
          >
            {count > 99 ? "99+" : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function HeaderActions() {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();

  const dmsQ = useQuery({
    queryKey: ["dm-unread"],
    queryFn: () => api<{ counts: Record<string, number> }>("/dm/unread"),
    refetchInterval: 30_000,
    enabled: !!token,
  });
  const notifQ = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => api<{ ok: boolean; count: number }>("/notifications/unread-count"),
    refetchInterval: 30_000,
    enabled: !!token,
  });

  useEffect(() => {
    if (!token) return;
    const off = wsClient.on((msg) => {
      if (msg?.type === "dm:message") {
        qc.invalidateQueries({ queryKey: ["dm-unread"] });
        qc.invalidateQueries({ queryKey: ["dm-previews"] });
      }
    });
    return off;
  }, [token, qc]);

  if (!token) return null;

  const dmCount = Object.values(dmsQ.data?.counts ?? {}).reduce((a, b) => a + b, 0);
  const notifCount = notifQ.data?.count ?? 0;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}>
      <IconButton
        icon="search-outline"
        count={0}
        accent="#5800E5"
        onPress={() => router.push("/search")}
      />
      <IconButton
        icon="chatbubble-outline"
        count={dmCount}
        accent="#5800E5"
        onPress={() => router.push("/dms")}
      />
      <IconButton
        icon="notifications-outline"
        count={notifCount}
        accent="#ef4444"
        onPress={() => router.push("/notifications")}
      />
    </View>
  );
}
