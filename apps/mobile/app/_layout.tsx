import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "@/stores/auth";
import { attachPresenceIdle } from "@/lib/presence";
import { attachNotificationTapHandler } from "@/lib/push";
import { HeaderActions } from "@/components/HeaderActions";
import { ImageLightboxProvider } from "@/components/ImageLightbox";
import { ActionSheetProvider } from "@/components/ActionSheet";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const hydrate = useAuth((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => attachPresenceIdle(), []);
  useEffect(() => { attachNotificationTapHandler(); }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ImageLightboxProvider>
          <ActionSheetProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "#0c0b0a" },
              headerTintColor: "rgba(243,244,246,.96)",
              headerTitleStyle: { fontWeight: "700" },
              contentStyle: { backgroundColor: "#0c0b0a" },
              animation: "slide_from_right",
              headerRight: () => <HeaderActions />,
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ title: "Sign in" }} />
            <Stack.Screen name="onboarding" options={{ title: "Pick a username", headerBackVisible: false, gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="lobby/[id]" options={{ title: "" }} />
            <Stack.Screen name="room/[id]" options={{ title: "" }} />
            <Stack.Screen name="user/[id]" options={{ title: "" }} />
            <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
            <Stack.Screen name="dms" options={{ title: "Inbox" }} />
            <Stack.Screen name="dm/[peerId]" options={{ title: "" }} />
            <Stack.Screen name="activity" options={{ title: "Activity" }} />
            <Stack.Screen name="settings" options={{ title: "Settings" }} />
            <Stack.Screen name="lobby/new" options={{ title: "New lobby" }} />
            <Stack.Screen name="room/new" options={{ title: "New room" }} />
            <Stack.Screen name="admin/[id]" options={{ title: "Admin" }} />
            <Stack.Screen name="store" options={{ title: "Store" }} />
            <Stack.Screen name="inventory" options={{ title: "Inventory" }} />
            <Stack.Screen name="news" options={{ title: "News" }} />
            <Stack.Screen name="hot" options={{ title: "Hot" }} />
            <Stack.Screen name="notoriety" options={{ title: "Notoriety" }} />
            <Stack.Screen name="crews" options={{ title: "Crews" }} />
            <Stack.Screen name="crew/[id]" options={{ title: "Crew" }} />
            <Stack.Screen name="forum/index" options={{ title: "Forum" }} />
            <Stack.Screen name="forum/[postId]" options={{ title: "Post" }} />
            <Stack.Screen name="market" options={{ title: "Marketplace" }} />
            <Stack.Screen name="challenges" options={{ title: "Challenges" }} />
            <Stack.Screen name="challenge/[id]" options={{ title: "Challenge" }} />
            <Stack.Screen name="tournaments" options={{ title: "Tournaments" }} />
            <Stack.Screen name="tournament/[id]" options={{ title: "Tournament" }} />
            <Stack.Screen name="staff" options={{ title: "Staff console" }} />
            <Stack.Screen name="invites" options={{ title: "Invites" }} />
            <Stack.Screen name="invite/[token]" options={{ title: "Invite" }} />
            <Stack.Screen name="subscribe" options={{ title: "Subscribe" }} />
            <Stack.Screen name="reader" options={{ title: "Reader" }} />
            <Stack.Screen name="search" options={{ title: "Search" }} />
          </Stack>
          </ActionSheetProvider>
          </ImageLightboxProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
