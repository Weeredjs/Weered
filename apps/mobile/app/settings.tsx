import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { Avatar } from "@/components/Avatar";

type Block = {
  id: string;
  userId: string;
  name: string;
  avatar?: string | null;
  avatarColor?: string | null;
  reason?: string | null;
  createdAt: string;
};

export default function Settings() {
  const qc = useQueryClient();
  const signOut = useAuth((s) => s.signOut);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const q = useQuery({
    queryKey: ["blocks"],
    queryFn: () => api<{ blocks: Block[] }>("/blocks"),
  });

  const unblock = useMutation({
    mutationFn: (userId: string) => api(`/users/${userId}/block`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocks"] }),
    onError: (e: any) => Alert.alert("Couldn't unblock", e?.message || "Unknown error"),
  });

  const wipe = useMutation({
    mutationFn: () =>
      api("/profile/me/delete", {
        method: "POST",
        body: { confirm: "DELETE" },
      }),
    onSuccess: () => {
      Alert.alert("Account deleted", "All PII has been wiped. You're being signed out.");
      signOut();
      router.replace("/login");
    },
    onError: (e: any) => Alert.alert("Couldn't delete", e?.message || "Unknown error"),
  });

  const testPush = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; error?: string; webSubs: number; expoTokens: number }>("/push/test", {
        method: "POST",
      }),
    onSuccess: (j) => {
      if (j.ok) {
        Alert.alert(
          "Test push sent",
          `Should arrive in a few seconds.\n\nWeb subs: ${j.webSubs}\nExpo tokens: ${j.expoTokens}`,
        );
      } else if (j.error === "no_tokens") {
        Alert.alert(
          "No push tokens registered",
          "This device hasn't registered for push yet. Sign out and back in, or grant notification permission if you denied earlier.",
        );
      } else {
        Alert.alert("Test failed", j.error || "Unknown error");
      }
    },
    onError: (e: any) => Alert.alert("Test failed", e?.message || "Unknown error"),
  });

  const blocks = q.data?.blocks ?? [];

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Settings" }} />

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => q.refetch()}
            tintColor="#5800E5"
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <Text className="text-weered-muted text-xs uppercase tracking-widest px-4 pt-4 pb-1">
          Blocked users · {blocks.length}
        </Text>
        {q.isLoading && (
          <View className="py-8 items-center">
            <ActivityIndicator color="#5800E5" />
          </View>
        )}
        {blocks.length === 0 && !q.isLoading && (
          <Text className="text-weered-muted text-sm px-8 py-4">You haven't blocked anyone.</Text>
        )}
        {blocks.map((b, i) => (
          <View key={b.id}>
            {i > 0 && <View className="h-px bg-border/30 mx-4" />}
            <View className="flex-row items-center px-4 py-3">
              <Pressable
                onPress={() => router.push(`/user/${b.userId}`)}
                className="flex-1 flex-row items-center active:opacity-70"
              >
                <View className="mr-3">
                  <Avatar name={b.name} url={b.avatar} size={36} />
                </View>
                <View className="flex-1">
                  <Text className="text-weered-text font-semibold" numberOfLines={1}>
                    {b.name}
                  </Text>
                  {!!b.reason && (
                    <Text className="text-weered-muted text-xs" numberOfLines={1}>
                      {b.reason}
                    </Text>
                  )}
                </View>
              </Pressable>
              <Pressable
                onPress={() => unblock.mutate(b.userId)}
                disabled={unblock.isPending}
                className="bg-panel border border-border px-3 py-1.5 rounded-lg active:opacity-80"
              >
                <Text className="text-weered-muted text-xs font-bold">Unblock</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Text className="text-weered-muted text-xs uppercase tracking-widest px-4 pt-8 pb-1">
          Notifications
        </Text>
        <View className="mx-4 mt-2 mb-2 p-4 bg-panel border border-border rounded-xl">
          <Text className="text-weered-text font-bold mb-1">Test push notification</Text>
          <Text className="text-weered-muted text-xs mb-3">
            Sends a push to this device. If you don't see one, push isn't wired correctly — sign out
            and back in, or check notification permissions.
          </Text>
          <Pressable
            onPress={() => testPush.mutate()}
            disabled={testPush.isPending}
            className="bg-weered px-4 py-2.5 rounded-lg active:opacity-80"
          >
            <Text className="text-white text-center font-bold">
              {testPush.isPending ? "Sending…" : "Send test push"}
            </Text>
          </Pressable>
        </View>

        <Text className="text-red-400 text-xs uppercase tracking-widest px-4 pt-8 pb-1">
          Danger zone
        </Text>
        <View className="mx-4 mt-2 mb-4 p-4 bg-red-500/5 border border-red-500/30 rounded-xl">
          <Text className="text-weered-text font-bold mb-1">Delete account</Text>
          <Text className="text-weered-muted text-xs mb-3">
            Wipes your profile, bio, email, linked game accounts, push tokens. Messages and activity
            are anonymized, not deleted. This can't be undone. Type{" "}
            <Text className="text-red-400 font-bold">DELETE</Text> to confirm.
          </Text>
          <TextInput
            value={deleteConfirm}
            onChangeText={setDeleteConfirm}
            placeholder="Type DELETE"
            placeholderTextColor="rgba(160,160,170,0.6)"
            autoCapitalize="characters"
            className="bg-panel border border-red-500/30 text-weered-text px-3 py-2 rounded-lg mb-2"
            style={{ fontSize: 14 }}
          />
          <Pressable
            onPress={() => {
              if (deleteConfirm.trim().toUpperCase() !== "DELETE") return;
              Alert.alert(
                "Delete account?",
                "This can't be undone. Your profile, email, and linked accounts will be wiped.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete forever", style: "destructive", onPress: () => wipe.mutate() },
                ],
              );
            }}
            disabled={deleteConfirm.trim().toUpperCase() !== "DELETE" || wipe.isPending}
            className="bg-red-500 px-4 py-2.5 rounded-lg active:opacity-80"
            style={{ opacity: deleteConfirm.trim().toUpperCase() === "DELETE" ? 1 : 0.4 }}
          >
            <Text className="text-white text-center font-bold">
              {wipe.isPending ? "Deleting…" : "Delete account"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
