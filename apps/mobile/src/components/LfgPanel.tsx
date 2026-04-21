import { useState } from "react";
import { View, Text, Pressable, Modal, TextInput, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

type Post = {
  id: string;
  userId: string;
  userName: string;
  activity: string;
  description: string;
  maxPlayers: number;
  platform: string;
  gameMode: string | null;
  rankTier: string | null;
  region: string | null;
  tags: string[];
  players: string[];
  playerNames: string[];
  status: "OPEN" | "FULL" | "CLOSED";
  createdAt: string;
};

type PostsResp = { ok: boolean; posts: Post[] };

export function LfgPanel({ lobbyId }: { lobbyId: string }) {
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const q = useQuery({
    queryKey: ["lfg", lobbyId],
    queryFn: () => api<PostsResp>(`/lfg/${lobbyId}`),
    refetchInterval: 30_000,
  });

  const join = useMutation({
    mutationFn: (postId: string) => api(`/lfg/${postId}/join`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lfg", lobbyId] }),
    onError: (e: any) => Alert.alert("Couldn't join", e?.message || "Unknown error"),
  });
  const leave = useMutation({
    mutationFn: (postId: string) => api(`/lfg/${postId}/leave`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lfg", lobbyId] }),
    onError: (e: any) => Alert.alert("Couldn't leave", e?.message || "Unknown error"),
  });

  const posts = q.data?.posts ?? [];

  return (
    <View className="py-3">
      <View className="flex-row items-center px-4 pb-2">
        <Text className="text-weered-muted text-xs uppercase tracking-wide flex-1">Looking for group</Text>
        {me && (
          <Pressable onPress={() => setFormOpen(true)} hitSlop={6} className="active:opacity-70">
            <Text className="text-weered text-xs font-bold">+ New post</Text>
          </Pressable>
        )}
      </View>

      {q.isLoading && <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>}

      {posts.length === 0 && !q.isLoading && (
        <Text className="text-weered-muted text-sm text-center py-6">No open posts. Start one!</Text>
      )}

      {posts.map((p) => {
        const inIt = me && p.players.includes(me.id);
        return (
          <View key={p.id} className="px-4 py-3 border-b border-border/30">
            <View className="flex-row items-center mb-1">
              <Text className="text-weered-text font-bold flex-1" numberOfLines={1}>{p.activity || "(unspecified)"}</Text>
              <Text className={`text-xs font-bold ${p.status === "OPEN" ? "text-green-400" : p.status === "FULL" ? "text-amber-400" : "text-weered-muted"}`}>
                {p.players.length}/{p.maxPlayers}
              </Text>
            </View>
            {!!p.description && (
              <Text className="text-weered-muted text-xs mb-1" numberOfLines={2}>{p.description}</Text>
            )}
            <View className="flex-row flex-wrap mb-1.5">
              {p.platform && <Tag>{p.platform}</Tag>}
              {p.gameMode && <Tag>{p.gameMode}</Tag>}
              {p.rankTier && <Tag>{p.rankTier}</Tag>}
              {p.region && <Tag>{p.region}</Tag>}
              {p.tags.map((t) => <Tag key={t}>{t}</Tag>)}
            </View>
            <View className="flex-row items-center">
              <Text className="text-weered-muted text-xs flex-1" numberOfLines={1}>
                by {p.userName} · {p.playerNames.join(", ")}
              </Text>
              {me && (
                inIt ? (
                  <Pressable
                    onPress={() => leave.mutate(p.id)}
                    className="bg-panel border border-border px-3 py-1 rounded-md active:opacity-70"
                  >
                    <Text className="text-weered-muted text-xs font-bold">Leave</Text>
                  </Pressable>
                ) : p.status === "OPEN" ? (
                  <Pressable
                    onPress={() => join.mutate(p.id)}
                    className="bg-weered px-3 py-1 rounded-md active:opacity-80"
                  >
                    <Text className="text-white text-xs font-bold">Join</Text>
                  </Pressable>
                ) : null
              )}
            </View>
          </View>
        );
      })}

      {formOpen && (
        <LfgForm
          lobbyId={lobbyId}
          onClose={() => setFormOpen(false)}
          onCreated={() => { setFormOpen(false); qc.invalidateQueries({ queryKey: ["lfg", lobbyId] }); }}
        />
      )}
    </View>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-panel border border-border px-2 py-0.5 rounded mr-1 mb-1">
      <Text className="text-weered-muted text-[10px] font-semibold">{children}</Text>
    </View>
  );
}

function LfgForm({ lobbyId, onClose, onCreated }: { lobbyId: string; onClose: () => void; onCreated: () => void }) {
  const [activity, setActivity] = useState("");
  const [description, setDescription] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [platform, setPlatform] = useState("crossplay");
  const [gameMode, setGameMode] = useState("");
  const [region, setRegion] = useState("");

  const create = useMutation({
    mutationFn: () => api(`/lfg/${lobbyId}`, {
      method: "POST",
      body: {
        activity: activity.trim(),
        description: description.trim(),
        maxPlayers: Number(maxPlayers) || 4,
        platform,
        gameMode: gameMode.trim() || undefined,
        region: region.trim() || undefined,
      },
    }),
    onSuccess: onCreated,
    onError: (e: any) => Alert.alert("Couldn't create", e?.message || "Unknown error"),
  });

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-center px-5">
        <View className="bg-weered-bg border border-border rounded-2xl p-5 max-h-[80%]">
          <ScrollView>
            <Text className="text-weered-text font-bold text-lg mb-4">New LFG post</Text>

            <Field label="Activity">
              <Input value={activity} onChangeText={setActivity} placeholder="Ranked Trios, Raid, Trials…" />
            </Field>
            <Field label="Description">
              <Input value={description} onChangeText={setDescription} multiline />
            </Field>
            <View className="flex-row">
              <View className="flex-1 mr-2">
                <Field label="Max players">
                  <Input value={maxPlayers} onChangeText={setMaxPlayers} keyboardType="number-pad" />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="Region">
                  <Input value={region} onChangeText={setRegion} placeholder="NA, EU…" autoCapitalize="characters" />
                </Field>
              </View>
            </View>
            <Field label="Platform">
              <View className="flex-row flex-wrap">
                {["crossplay", "pc", "ps", "xbox"].map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setPlatform(p)}
                    className={`mr-2 mb-2 px-3 py-1.5 rounded-md border ${platform === p ? "bg-weered border-weered" : "bg-panel border-border"}`}
                  >
                    <Text className={`text-xs font-bold ${platform === p ? "text-white" : "text-weered-muted"}`}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label="Game mode (optional)">
              <Input value={gameMode} onChangeText={setGameMode} placeholder="Ranked, Casual, Custom…" />
            </Field>

            <View className="flex-row mt-4">
              <Pressable onPress={onClose} className="flex-1 mr-2 px-3 py-3 rounded-lg bg-panel border border-border active:opacity-70">
                <Text className="text-weered-muted text-center font-bold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => activity.trim() && create.mutate()}
                disabled={create.isPending || !activity.trim()}
                className="flex-1 px-3 py-3 rounded-lg bg-weered active:opacity-80"
              >
                <Text className="text-white text-center font-bold">{create.isPending ? "Posting…" : "Post"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">{label}</Text>
      {children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="rgba(160,160,170,0.6)"
      className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg"
      style={[{ fontSize: 14, minHeight: 42 }, props.multiline ? { minHeight: 64, textAlignVertical: "top" } : null]}
    />
  );
}
