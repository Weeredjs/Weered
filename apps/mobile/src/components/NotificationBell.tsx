import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

export function NotificationBell() {
  const token = useAuth((s) => s.token);
  const q = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => api<{ ok: boolean; count: number }>("/notifications/unread-count"),
    refetchInterval: 30_000,
    enabled: !!token,
  });

  const count = q.data?.count ?? 0;

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      hitSlop={10}
      className="mr-3 active:opacity-70"
      style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
    >
      <View style={{ position: "relative", flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: "#f0f0f5", fontSize: 12, fontWeight: "700", letterSpacing: 0.6 }}>
          ALERTS
        </Text>
        {count > 0 && (
          <View
            style={{
              marginLeft: 6,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 4,
              borderRadius: 9,
              backgroundColor: "#ef4444",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
              {count > 99 ? "99+" : count}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
