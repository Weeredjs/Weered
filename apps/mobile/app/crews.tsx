import { useState } from "react";
import { View, Text, FlatList, Pressable, Modal, TextInput, Alert, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Member = { userId: string; name: string; role: string; online: boolean; roomName?: string | null; avatar?: string | null; avatarColor?: string | null };
type Crew = {
  id: string; name: string; tag: string; description: string; ownerId: string;
  myRole: "LEADER" | "OFFICER" | "MEMBER";
  members: Member[];
};
type CrewsResp = { crews: Crew[] };
type LeaderRow = { position: number; id: string; name: string; tag: string; memberCount: number; totalScore: number; rank: string };
type LeaderResp = { ok: boolean; leaders: LeaderRow[] };

export default function Crews() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [tab, setTab] = useState<"mine" | "leaderboard">("mine");

  const q = useQuery({
    queryKey: ["my-crews"],
    queryFn: () => api<CrewsResp>("/crews/mine"),
    enabled: tab === "mine",
  });
  const ldrQ = useQuery({
    queryKey: ["crews-leaderboard"],
    queryFn: () => api<LeaderResp>("/crews/leaderboard?limit=25"),
    enabled: tab === "leaderboard",
  });

  const crews = q.data?.crews ?? [];
  const leaders = ldrQ.data?.leaders ?? [];

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen
        options={{
          title: "Crews",
          headerRight: () => (
            <Pressable onPress={() => setFormOpen(true)} hitSlop={8} className="active:opacity-70 mr-2">
              <Text className="text-weered font-semibold">+ New</Text>
            </Pressable>
          ),
        }}
      />

      <View className="flex-row border-b border-border/40">
        <Pressable onPress={() => setTab("mine")} className="flex-1 py-3 items-center active:opacity-70" style={{ borderBottomWidth: 2, borderBottomColor: tab === "mine" ? "#5800E5" : "transparent" }}>
          <Text className={`text-sm font-bold ${tab === "mine" ? "text-weered" : "text-weered-muted"}`}>My crews</Text>
        </Pressable>
        <Pressable onPress={() => setTab("leaderboard")} className="flex-1 py-3 items-center active:opacity-70" style={{ borderBottomWidth: 2, borderBottomColor: tab === "leaderboard" ? "#5800E5" : "transparent" }}>
          <Text className={`text-sm font-bold ${tab === "leaderboard" ? "text-weered" : "text-weered-muted"}`}>Top crews</Text>
        </Pressable>
      </View>

      {tab === "mine" ? (
        q.isLoading ? (
          <View className="flex-1 items-center justify-center"><ActivityIndicator color="#5800E5" /></View>
        ) : (
          <FlatList
            data={crews}
            keyExtractor={(c) => c.id}
            refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor="#5800E5" />}
            contentContainerStyle={{ paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View className="h-px bg-border/30 mx-4" />}
            renderItem={({ item }) => <CrewRow crew={item} />}
            ListEmptyComponent={
              <View className="px-8 py-16 items-center">
                <Text className="text-weered-muted text-sm">No crews yet. Tap + New to start one.</Text>
              </View>
            }
          />
        )
      ) : (
        ldrQ.isLoading ? (
          <View className="flex-1 items-center justify-center"><ActivityIndicator color="#5800E5" /></View>
        ) : (
          <FlatList
            data={leaders}
            keyExtractor={(c) => c.id}
            refreshControl={<RefreshControl refreshing={ldrQ.isRefetching} onRefresh={() => ldrQ.refetch()} tintColor="#5800E5" />}
            contentContainerStyle={{ paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View className="h-px bg-border/30 mx-4" />}
            renderItem={({ item }) => (
              <View className="flex-row items-center px-4 py-3">
                <Text className="text-weered-muted text-xs font-bold w-7">#{item.position}</Text>
                {!!item.tag && (
                  <View className="bg-panel border border-border px-2 py-0.5 rounded mr-2">
                    <Text className="text-weered-text text-xs font-black">{item.tag}</Text>
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-weered-text font-bold" numberOfLines={1}>{item.name}</Text>
                  <Text className="text-weered-muted text-xs">{item.rank} · {item.memberCount} members</Text>
                </View>
                <Text className="text-weered font-black text-sm">{item.totalScore.toLocaleString()}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View className="px-8 py-16 items-center">
                <Text className="text-weered-muted text-sm">No ranked crews yet.</Text>
              </View>
            }
          />
        )
      )}

      {formOpen && (
        <CreateCrew
          onClose={() => setFormOpen(false)}
          onCreated={(id) => {
            setFormOpen(false);
            qc.invalidateQueries({ queryKey: ["my-crews"] });
            router.push(`/crew/${id}`);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function CrewRow({ crew }: { crew: Crew }) {
  const online = crew.members.filter((m) => m.online).length;
  return (
    <Pressable
      onPress={() => router.push(`/crew/${crew.id}`)}
      className="px-4 py-3 active:bg-panel"
    >
      <View className="flex-row items-center">
        {!!crew.tag && (
          <View className="bg-panel border border-border px-2 py-0.5 rounded mr-2">
            <Text className="text-weered-text text-xs font-black">{crew.tag}</Text>
          </View>
        )}
        <Text className="text-weered-text font-bold text-base flex-1" numberOfLines={1}>{crew.name}</Text>
        <Text className="text-weered-muted text-xs">{crew.myRole}</Text>
      </View>
      {!!crew.description && (
        <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={1}>{crew.description}</Text>
      )}
      <Text className="text-weered-muted text-xs mt-1">
        <Text className="text-green-400">●</Text> {online} online · {crew.members.length} members
      </Text>
    </Pressable>
  );
}

function CreateCrew({ onClose, onCreated }: { onClose: () => void; onCreated: (crewId: string) => void }) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () => api<{ ok: boolean; crew: { id: string } }>("/crews", {
      method: "POST",
      body: { name: name.trim(), tag: tag.trim().toUpperCase(), description: description.trim() },
    }),
    onSuccess: (res) => onCreated(res.crew.id),
    onError: (e: any) => Alert.alert("Couldn't create", e?.message || "Unknown error"),
  });

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-center px-5">
        <View className="bg-weered-bg border border-border rounded-2xl p-5">
          <Text className="text-weered-text font-bold text-lg mb-4">New crew</Text>

          <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={40}
            placeholderTextColor="rgba(160,160,170,0.6)"
            placeholder="Your crew name"
            className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-3"
            style={{ fontSize: 14 }}
          />

          <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Tag (up to 6 chars)</Text>
          <TextInput
            value={tag}
            onChangeText={(t) => setTag(t.toUpperCase().slice(0, 6))}
            maxLength={6}
            autoCapitalize="characters"
            placeholderTextColor="rgba(160,160,170,0.6)"
            placeholder="WEE"
            className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-3"
            style={{ fontSize: 14 }}
          />

          <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            maxLength={200}
            multiline
            placeholderTextColor="rgba(160,160,170,0.6)"
            className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-4"
            style={{ fontSize: 14, minHeight: 70, textAlignVertical: "top" }}
          />

          <View className="flex-row">
            <Pressable onPress={onClose} className="flex-1 mr-2 px-3 py-3 rounded-lg bg-panel border border-border active:opacity-70">
              <Text className="text-weered-muted text-center font-bold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => name.trim() && create.mutate()}
              disabled={create.isPending || !name.trim()}
              className="flex-1 px-3 py-3 rounded-lg bg-weered active:opacity-80"
            >
              <Text className="text-white text-center font-bold">{create.isPending ? "Creating…" : "Create"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
