import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { wsClient } from "@/lib/ws";

export function InboxButton() {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["dm-unread"],
    queryFn: () => api<{ counts: Record<string, number> }>("/dm/unread"),
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

  const count = Object.values(q.data?.counts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <Pressable
      onPress={() => router.push("/dms")}
      hitSlop={10}
      className="mr-3 active:opacity-70"
      style={{ height: 32, alignItems: "center", justifyContent: "center" }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: "#f0f0f5", fontSize: 12, fontWeight: "700", letterSpacing: 0.6 }}>
          INBOX
        </Text>
        {count > 0 && (
          <View
            style={{
              marginLeft: 6,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 4,
              borderRadius: 9,
              backgroundColor: "#5800E5",
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
