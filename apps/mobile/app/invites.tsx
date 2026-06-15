import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { WEB_BASE } from "@/lib/config";

type Invite = {
  token: string;
  type: "PLATFORM" | "LOBBY" | "ROOM" | "CREW";
  targetId: string | null;
  note: string | null;
  maxUses: number;
  uses: number;
  expiresAt: string | null;
  createdAt: string;
  url: string;
};
type ListResp = { ok: boolean; invites: Invite[] };

export default function Invites() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["invites-mine"],
    queryFn: () => api<ListResp>("/invites/mine"),
  });

  const [note, setNote] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [ttlHours, setTtlHours] = useState("24");

  const create = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; invite: Invite }>("/invites", {
        method: "POST",
        body: {
          type: "PLATFORM",
          note: note.trim() || undefined,
          maxUses: Number(maxUses) || 1,
          ttlHours: Number(ttlHours) || 0,
        },
      }),
    onSuccess: (r) => {
      const url = `${WEB_BASE}/invite/${r.invite.token}`;
      setNote("");
      qc.invalidateQueries({ queryKey: ["invites-mine"] });
      Share.share({ message: `Join me on Weered — ${url}`, url }).catch(() => {});
    },
    onError: (e: any) => Alert.alert("Couldn't create", e?.message || "Unknown error"),
  });

  const invites = q.data?.invites ?? [];

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Invites" }} />

      <View className="px-4 py-4 border-b border-border/30">
        <Text className="text-weered-muted text-xs uppercase tracking-wide mb-2">
          Create platform invite
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Optional note (for your records)"
          placeholderTextColor="rgba(160,160,170,0.6)"
          className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-3"
          style={{ fontSize: 14 }}
          maxLength={200}
        />
        <View className="flex-row mb-3">
          <View className="flex-1 mr-2">
            <Text className="text-weered-muted text-[10px] uppercase mb-1">Max uses</Text>
            <TextInput
              value={maxUses}
              onChangeText={setMaxUses}
              keyboardType="number-pad"
              className="bg-panel border border-border text-weered-text px-3 py-2 rounded-lg"
              style={{ fontSize: 14 }}
            />
          </View>
          <View className="flex-1">
            <Text className="text-weered-muted text-[10px] uppercase mb-1">
              TTL hours (0=never)
            </Text>
            <TextInput
              value={ttlHours}
              onChangeText={setTtlHours}
              keyboardType="number-pad"
              className="bg-panel border border-border text-weered-text px-3 py-2 rounded-lg"
              style={{ fontSize: 14 }}
            />
          </View>
        </View>
        <Pressable
          onPress={() => create.mutate()}
          disabled={create.isPending}
          className="bg-weered px-4 py-3 rounded-lg active:opacity-80"
        >
          <Text className="text-white text-center font-bold">
            {create.isPending ? "Creating…" : "Create + share"}
          </Text>
        </Pressable>
      </View>

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : (
        <FlatList
          data={invites}
          keyExtractor={(i) => i.token}
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => q.refetch()}
              tintColor="#5800E5"
            />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-px bg-border/30" />}
          ListHeaderComponent={
            <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-4 pb-2">
              My invites · {invites.length}
            </Text>
          }
          renderItem={({ item }) => <InviteRow invite={item} />}
          ListEmptyComponent={
            <Text className="text-weered-muted text-sm text-center py-12">
              No invites created yet.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

function InviteRow({ invite }: { invite: Invite }) {
  const exhausted = invite.uses >= invite.maxUses;
  const expired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
  const dead = exhausted || expired;

  return (
    <Pressable
      onPress={() =>
        Share.share({ message: `Join me on Weered — ${invite.url}`, url: invite.url }).catch(
          () => {},
        )
      }
      className="px-4 py-3 active:bg-panel"
      disabled={!!dead}
      style={{ opacity: dead ? 0.4 : 1 }}
    >
      <View className="flex-row items-center mb-1">
        <Text className="text-weered text-[10px] font-bold uppercase mr-2">{invite.type}</Text>
        {!!invite.targetId && (
          <Text className="text-weered-muted text-[10px]" numberOfLines={1}>
            {invite.targetId}
          </Text>
        )}
        <View className="flex-1" />
        <Text className="text-weered-muted text-xs">
          {invite.uses}/{invite.maxUses} used
        </Text>
      </View>
      {!!invite.note && <Text className="text-weered-muted text-xs mb-1">{invite.note}</Text>}
      <Text className="text-weered-text text-xs" numberOfLines={1}>
        {invite.url}
      </Text>
      <View className="flex-row mt-1">
        {expired && <Text className="text-red-400 text-[10px] font-bold">EXPIRED</Text>}
        {!expired && exhausted && (
          <Text className="text-amber-400 text-[10px] font-bold">EXHAUSTED</Text>
        )}
        {!dead && (
          <Text className="text-weered-muted/70 text-[10px]">
            created {new Date(invite.createdAt).toLocaleDateString()}
            {invite.expiresAt
              ? ` · expires ${new Date(invite.expiresAt).toLocaleDateString()}`
              : ""}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
