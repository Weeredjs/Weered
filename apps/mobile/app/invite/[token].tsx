import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

type Invite = {
  token: string;
  type: "PLATFORM" | "LOBBY" | "ROOM" | "CREW";
  targetId: string | null;
  targetName?: string;
  creatorName?: string;
  maxUses: number;
  uses: number;
  expiresAt: string | null;
  note: string | null;
};
type ResolveResp = { ok: boolean; invite?: Invite; error?: string };
type AcceptResp = { ok: boolean; redirect?: string; type?: string; targetId?: string | null; error?: string };

export default function InviteAccept() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const t = String(token || "");
  const me = useAuth((s) => s.user);

  const q = useQuery({
    queryKey: ["invite", t],
    queryFn: () => api<ResolveResp>(`/invites/${encodeURIComponent(t)}`),
    enabled: !!t,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api<AcceptResp>(`/invites/${encodeURIComponent(t)}/accept`, { method: "POST" }),
    onSuccess: (r) => {
      if (!r.ok) {
        Alert.alert("Couldn't accept", r.error || "Unknown error");
        return;
      }
      if (r.type === "LOBBY" && r.targetId) router.replace(`/lobby/${r.targetId}`);
      else if (r.type === "ROOM" && r.targetId) router.replace(`/room/${r.targetId}`);
      else if (r.type === "CREW" && r.targetId) router.replace(`/crew/${r.targetId}`);
      else router.replace("/(tabs)/lobbies");
    },
    onError: (e: any) => Alert.alert("Couldn't accept", e?.message || "Unknown error"),
  });

  if (!me) {
    return (
      <SafeAreaView className="flex-1 bg-weered-bg items-center justify-center px-8">
        <Stack.Screen options={{ title: "Invite" }} />
        <Text className="text-weered-text font-bold text-lg mb-2">Sign in to accept</Text>
        <Text className="text-weered-muted text-sm text-center mb-4">
          You need a Weered account to use this invite.
        </Text>
        <Pressable onPress={() => router.replace("/login")} className="bg-weered px-6 py-3 rounded-lg active:opacity-80">
          <Text className="text-white font-bold">Sign in</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (q.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-weered-bg items-center justify-center">
        <Stack.Screen options={{ title: "Invite" }} />
        <ActivityIndicator color="#5800E5" />
      </SafeAreaView>
    );
  }

  if (!q.data?.ok || !q.data.invite) {
    return (
      <SafeAreaView className="flex-1 bg-weered-bg items-center justify-center px-8">
        <Stack.Screen options={{ title: "Invite" }} />
        <Text className="text-red-400 text-sm text-center mb-4">
          {q.data?.error === "expired" ? "This invite has expired."
            : q.data?.error === "exhausted" ? "This invite has been used up."
            : "Invite not found."}
        </Text>
        <Pressable onPress={() => router.replace("/(tabs)/lobbies")} className="bg-panel border border-border px-4 py-2 rounded-lg active:opacity-70">
          <Text className="text-weered-muted font-bold">Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const inv = q.data.invite;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Invite" }} />
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-weered text-xs uppercase tracking-widest mb-2">You've been invited to</Text>
        <Text className="text-weered-text text-3xl font-black mb-1 text-center">
          {inv.type === "PLATFORM" ? "Weered" : inv.targetName || inv.type.toLowerCase()}
        </Text>
        {!!inv.creatorName && (
          <Text className="text-weered-muted text-sm mb-4">from {inv.creatorName}</Text>
        )}
        {!!inv.note && (
          <View className="bg-panel border border-border rounded-lg px-4 py-3 mb-4 max-w-sm">
            <Text className="text-weered-text text-sm italic text-center">"{inv.note}"</Text>
          </View>
        )}
        <Text className="text-weered-muted text-xs mb-6">
          {inv.uses}/{inv.maxUses} used
          {inv.expiresAt ? ` · expires ${new Date(inv.expiresAt).toLocaleDateString()}` : ""}
        </Text>
        <Pressable
          onPress={() => accept.mutate()}
          disabled={accept.isPending}
          className="bg-weered px-8 py-4 rounded-xl active:opacity-80 w-full max-w-sm"
        >
          <Text className="text-white font-bold text-center text-base">
            {accept.isPending ? "Accepting…" : inv.type === "PLATFORM" ? "Accept invite" : `Join ${inv.type.toLowerCase()}`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
