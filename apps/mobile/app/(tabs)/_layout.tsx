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
          fontFamily: "BarlowCondensed_800ExtraBold",
          fontSize: 13,
          letterSpacing: 1.6,
          color: focused ? "#ffffff" : "rgba(180,180,190,0.6)",
        }}
      >
        {label.toUpperCase()}
      </Text>
      <View
        style={{
          width: focused ? 20 : 0,
          height: 2,
          backgroundColor: "#5800E5",
          marginTop: 4,
          shadowColor: "#5800E5",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: focused ? 0.8 : 0,
          shadowRadius: 4,
          elevation: focused ? 2 : 0,
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
            backgroundColor: "#ef4444",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: "#0c0b0a",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10, fontFamily: "BarlowCondensed_800ExtraBold" }}>
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
  const inboxBadge = dmCount + (notifQ.data?.count ?? 0);

  return (
    <Tabs
      sceneContainerStyle={{ backgroundColor: "#0c0b0a" }}
      screenOptions={{
        headerStyle: { backgroundColor: "#000", shadowColor: "transparent", elevation: 0, borderBottomWidth: 1.5, borderBottomColor: "rgba(245,183,0,0.35)" },
        headerTintColor: "rgba(243,244,246,.96)",
        headerTitleStyle: { fontFamily: "BarlowCondensed_800ExtraBold", letterSpacing: 1.5, fontSize: 20 },
        headerRight: () => <HeaderActions />,
        tabBarStyle: {
          backgroundColor: "#000",
          borderTopColor: "rgba(245,183,0,0.3)",
          borderTopWidth: 1.5,
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
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ focused }) => <TabItem label="Inbox" focused={focused} badge={inboxBadge} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabItem label="Me" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
