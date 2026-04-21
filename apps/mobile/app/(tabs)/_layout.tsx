import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { HeaderActions } from "@/components/HeaderActions";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

function TabItem({ label, focused, badge }: { label: string; focused: boolean; badge?: number }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: 80, position: "relative" }}>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.4,
          color: focused ? "#ffffff" : "rgba(180,180,190,0.7)",
        }}
      >
        {label.toUpperCase()}
      </Text>
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: focused ? "#5800E5" : "transparent",
          marginTop: 3,
        }}
      />
      {!!badge && badge > 0 && (
        <View
          style={{
            position: "absolute",
            top: -2,
            right: 6,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 4,
            borderRadius: 8,
            backgroundColor: "#ef4444",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: "#0c0b0a",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>
            {badge > 9 ? "9+" : badge}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(8, insets.bottom);
  const token = useAuth((s) => s.token);

  const friendReqQ = useQuery({
    queryKey: ["friend-requests"],
    queryFn: () => api<{ requests: { status: string; toId?: string }[] }>("/friends/requests"),
    refetchInterval: 60_000,
    enabled: !!token,
  });
  const me = useAuth((s) => s.user);
  const pendingFriendCount = (friendReqQ.data?.requests ?? []).filter(
    (r) => r.status === "PENDING" && (!r.toId || r.toId === me?.id)
  ).length;

  const dmsQ = useQuery({
    queryKey: ["dm-unread"],
    queryFn: () => api<{ counts: Record<string, number> }>("/dm/unread"),
    refetchInterval: 60_000,
    enabled: !!token,
  });
  const notifQ = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => api<{ ok: boolean; count: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
    enabled: !!token,
  });
  const dmCount = Object.values(dmsQ.data?.counts ?? {}).reduce((a, b) => a + b, 0);
  const meBadge = dmCount + (notifQ.data?.count ?? 0);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0c0b0a" },
        headerTintColor: "rgba(243,244,246,.96)",
        headerTitleStyle: { fontWeight: "800" },
        headerRight: () => <HeaderActions />,
        tabBarStyle: {
          backgroundColor: "#0c0b0a",
          borderTopColor: "rgba(70,70,80,0.4)",
          height: 56 + bottomPad,
          paddingTop: 8,
          paddingBottom: bottomPad,
        },
        tabBarShowLabel: false,
        tabBarItemStyle: { paddingVertical: 0 },
      }}
    >
      <Tabs.Screen
        name="lobbies"
        options={{
          title: "Lobbies",
          tabBarIcon: ({ focused }) => <TabItem label="Lobbies" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ focused }) => <TabItem label="Friends" focused={focused} badge={pendingFriendCount} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabItem label="Me" focused={focused} badge={meBadge} />,
        }}
      />
    </Tabs>
  );
}
