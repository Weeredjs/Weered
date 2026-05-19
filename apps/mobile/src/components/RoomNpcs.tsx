import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput, Alert, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Npc = {
  id: string;
  roomId: string;
  name: string;
  portrait: string;
  config: any;
  createdAt: string;
};
type NpcListResp = { ok: boolean; npcs: Npc[] };
type NpcMsg = { id: string; role: "user" | "assistant"; content: string; userName: string; userId?: string | null; createdAt: string };
type NpcMsgsResp = { ok: boolean; messages: NpcMsg[] };

type RoomMeta = { ok: boolean; room?: { lobbyModuleType?: string | null } };

export function RoomNpcsButton({ roomId }: { roomId: string }) {
  // Only DND rooms get the NPCs panel. The button used to appear in every room
  // header regardless of lobby type — moved the gate here so the surface is
  // game-appropriate. If the room lookup fails or moduleType isn't DND,
  // render nothing.
  const meta = useQuery({
    queryKey: ["room-meta", roomId],
    queryFn: () => api<RoomMeta>(`/rooms/${roomId}`),
    enabled: !!roomId,
    staleTime: 5 * 60 * 1000,
  });
  if (meta.data?.room?.lobbyModuleType !== "DND") return null;

  const [open, setOpen] = useState(false);
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const q = useQuery({
    queryKey: ["room-npcs", roomId],
    queryFn: () => api<NpcListResp>(`/rooms/${roomId}/npcs`),
    enabled: open,
  });

  const npcs = q.data?.npcs ?? [];

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} className="active:opacity-70 mr-3">
        <Text className="text-weered font-semibold">NPCs</Text>
      </Pressable>

      {open && (
        <Modal transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View className="flex-1 bg-black/70 justify-end">
            <View className="bg-weered-bg border-t border-border rounded-t-2xl" style={{ height: "70%" }}>
              <View className="px-4 pt-4 pb-2 flex-row items-center">
                <Text className="text-weered-text font-bold text-lg flex-1">NPCs · {npcs.length}</Text>
                <Pressable onPress={() => setCreateOpen(true)} hitSlop={6} className="mr-4 active:opacity-70">
                  <Text className="text-weered font-bold">+ New</Text>
                </Pressable>
                <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                  <Text className="text-weered-muted font-bold text-base">✕</Text>
                </Pressable>
              </View>

              {q.isLoading ? (
                <View className="py-8 items-center"><ActivityIndicator color="#5800E5" /></View>
              ) : npcs.length === 0 ? (
                <Text className="text-weered-muted text-sm text-center py-8 px-4">No NPCs yet. Create one to bring AI characters into this room.</Text>
              ) : (
                <ScrollView>
                  {npcs.map((n) => (
                    <Pressable
                      key={n.id}
                      onPress={() => { setOpen(false); setActiveNpc(n); }}
                      className="flex-row items-center px-4 py-3 border-b border-border/20 active:bg-panel"
                    >
                      <Text className="text-3xl mr-3">{n.portrait || "🧙"}</Text>
                      <View className="flex-1">
                        <Text className="text-weered-text font-semibold">{n.name}</Text>
                        {!!n.config?.persona && (
                          <Text className="text-weered-muted text-xs" numberOfLines={2}>{n.config.persona}</Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}

      {activeNpc && (
        <NpcChat
          npc={activeNpc}
          roomId={roomId}
          onClose={() => { setActiveNpc(null); setOpen(true); }}
        />
      )}

      {createOpen && (
        <CreateNpc
          roomId={roomId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); q.refetch(); }}
        />
      )}
    </>
  );
}

function NpcChat({ npc, roomId, onClose }: { npc: Npc; roomId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<NpcMsg>>(null);

  const msgsQ = useQuery({
    queryKey: ["npc-msgs", npc.id],
    queryFn: () => api<NpcMsgsResp>(`/rooms/${roomId}/npcs/${npc.id}/messages`),
  });

  const send = useMutation({
    mutationFn: (content: string) => api<{ ok: boolean; message: NpcMsg; error?: string }>(`/rooms/${roomId}/npcs/${npc.id}/messages`, {
      method: "POST",
      body: { content },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["npc-msgs", npc.id] }),
    onError: (e: any) => {
      if (e?.message?.includes("slow_down")) Alert.alert("Easy now", "Wait 3 seconds between messages.");
      else Alert.alert("Couldn't send", e?.message || "Unknown error");
    },
  });

  const messages = msgsQ.data?.messages ?? [];

  useEffect(() => {
    if (messages.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-weered-bg">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View className="px-4 py-3 border-b border-border/40 flex-row items-center">
            <Text className="text-3xl mr-2">{npc.portrait || "🧙"}</Text>
            <View className="flex-1">
              <Text className="text-weered-text font-bold">{npc.name}</Text>
              <Text className="text-weered-muted text-xs">AI character</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text className="text-weered-muted font-bold">✕</Text>
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingVertical: 12 }}
            renderItem={({ item }) => (
              <View className="px-4 py-2">
                {item.role === "user" ? (
                  <View className="items-end">
                    <View className="bg-weered px-3 py-2 rounded-2xl max-w-[80%]">
                      <Text className="text-white text-sm">{item.content}</Text>
                    </View>
                    <Text className="text-weered-muted text-[10px] mt-0.5">{item.userName || "You"}</Text>
                  </View>
                ) : (
                  <View className="items-start">
                    <View className="bg-panel border border-border px-3 py-2 rounded-2xl max-w-[80%]">
                      <Text className="text-weered-text text-sm">{item.content}</Text>
                    </View>
                    <Text className="text-weered-muted text-[10px] mt-0.5">{npc.name}</Text>
                  </View>
                )}
              </View>
            )}
            ListEmptyComponent={
              msgsQ.isLoading ? (
                <View className="py-8 items-center"><ActivityIndicator color="#5800E5" /></View>
              ) : (
                <Text className="text-weered-muted text-sm text-center py-8">Start the conversation.</Text>
              )
            }
          />

          <View className="px-3 py-2 border-t border-border/40 flex-row items-end bg-panel">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={`Talk to ${npc.name}`}
              placeholderTextColor="rgba(160,160,170,0.6)"
              multiline
              className="flex-1 text-weered-text text-base px-3 py-2"
              style={{ maxHeight: 120, minHeight: 40 }}
              maxLength={1000}
            />
            <Pressable
              onPress={() => {
                const b = draft.trim();
                if (!b) return;
                setDraft("");
                send.mutate(b);
              }}
              disabled={!draft.trim() || send.isPending}
              className="bg-weered px-4 py-2.5 rounded-xl ml-2 active:opacity-80"
              style={{ opacity: !draft.trim() || send.isPending ? 0.4 : 1 }}
            >
              <Text className="text-white font-bold">{send.isPending ? "…" : "Send"}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function CreateNpc({ roomId, onClose, onCreated }: { roomId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [portrait, setPortrait] = useState("🧙");
  const [persona, setPersona] = useState("");
  const [greeting, setGreeting] = useState("");

  const create = useMutation({
    mutationFn: () => api(`/rooms/${roomId}/npcs`, {
      method: "POST",
      body: {
        name: name.trim(),
        portrait,
        config: {
          persona: persona.trim(),
          greeting: greeting.trim(),
        },
      },
    }),
    onSuccess: onCreated,
    onError: (e: any) => Alert.alert("Couldn't create", e?.message || "Unknown error"),
  });

  const EMOJIS = ["🧙", "🧝", "🧛", "🧟", "🤖", "👻", "🦹", "🦸", "🧜", "🐉", "👺", "🧞", "🕵", "🥷"];

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-center px-5">
        <View className="bg-weered-bg border border-border rounded-2xl p-5 max-h-[90%]">
          <ScrollView>
            <Text className="text-weered-text font-bold text-lg mb-4">New NPC</Text>

            <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Portrait</Text>
            <View className="flex-row flex-wrap mb-3">
              {EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setPortrait(e)}
                  className={`px-3 py-2 rounded-lg mr-1.5 mb-1.5 ${portrait === e ? "bg-weered" : "bg-panel border border-border"}`}
                >
                  <Text className="text-2xl">{e}</Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Gandalf the Grey"
              placeholderTextColor="rgba(160,160,170,0.6)"
              className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-3"
              style={{ fontSize: 14 }}
              maxLength={64}
            />

            <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Persona / system prompt</Text>
            <TextInput
              value={persona}
              onChangeText={setPersona}
              placeholder="A wise old wizard who speaks in riddles. Kind but cryptic."
              placeholderTextColor="rgba(160,160,170,0.6)"
              multiline
              className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-3"
              style={{ fontSize: 14, minHeight: 80, textAlignVertical: "top" }}
            />

            <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Greeting (optional)</Text>
            <TextInput
              value={greeting}
              onChangeText={setGreeting}
              placeholder="*peers at you from under his hat* You seek wisdom, I presume?"
              placeholderTextColor="rgba(160,160,170,0.6)"
              multiline
              className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-4"
              style={{ fontSize: 14, minHeight: 60, textAlignVertical: "top" }}
            />

            <View className="flex-row">
              <Pressable onPress={onClose} className="flex-1 mr-2 px-3 py-3 rounded-lg bg-panel border border-border active:opacity-70">
                <Text className="text-weered-muted text-center font-bold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => name.trim() && create.mutate()}
                disabled={!name.trim() || create.isPending}
                className="flex-1 px-3 py-3 rounded-lg bg-weered active:opacity-80"
              >
                <Text className="text-white text-center font-bold">{create.isPending ? "Creating…" : "Create NPC"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
