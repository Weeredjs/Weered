import { useState } from "react";
import { View, Text, Pressable, Alert, TextInput, Modal, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Ev = {
  id: string;
  title: string;
  description: string;
  category: string;
  coverImageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: string;
};

type EventsResp = { ok: boolean; events: Ev[] };

export function LobbyEvents({ lobbyId, isOwner }: { lobbyId: string; isOwner: boolean }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const q = useQuery({
    queryKey: ["lobby-events", lobbyId],
    queryFn: () => api<EventsResp>(`/lobbies/${lobbyId}/events`),
    enabled: !!lobbyId,
  });

  const del = useMutation({
    mutationFn: (eventId: string) =>
      api(`/lobbies/${lobbyId}/events/${eventId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lobby-events", lobbyId] }),
    onError: (e: any) => Alert.alert("Couldn't delete", e?.message || "Unknown error"),
  });

  const upcoming = (q.data?.events ?? []).filter(
    (e) => new Date(e.startsAt).getTime() >= Date.now() - 2 * 60 * 60 * 1000,
  );
  if (upcoming.length === 0 && !isOwner) return null;

  return (
    <View className="border-t border-border/40 pt-3 pb-1">
      <View className="flex-row items-center px-4 pb-2">
        <Text className="text-weered-muted text-xs uppercase tracking-wide flex-1">Events</Text>
        {isOwner && (
          <Pressable onPress={() => setFormOpen(true)} hitSlop={6} className="active:opacity-70">
            <Text className="text-weered text-xs font-bold">+ New event</Text>
          </Pressable>
        )}
      </View>
      {upcoming.length === 0 ? (
        <Text className="text-weered-muted text-sm px-4 pb-3">No upcoming events.</Text>
      ) : (
        upcoming.map((e) => (
          <View key={e.id} className="px-4 py-2.5 border-b border-border/20">
            <View className="flex-row items-start">
              <View className="flex-1">
                <View className="flex-row items-center">
                  {e.status === "DRAFT" && (
                    <Text className="text-amber-400 text-xs font-bold mr-2">DRAFT</Text>
                  )}
                  <Text className="text-weered-text font-semibold flex-1" numberOfLines={1}>
                    {e.title}
                  </Text>
                </View>
                {!!e.description && (
                  <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={2}>
                    {e.description}
                  </Text>
                )}
                <Text className="text-weered text-xs mt-1">
                  {new Date(e.startsAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </Text>
              </View>
              {isOwner && (
                <Pressable
                  onPress={() =>
                    Alert.alert("Delete event?", e.title, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => del.mutate(e.id) },
                    ])
                  }
                  hitSlop={8}
                  className="ml-2 px-2 active:opacity-70"
                >
                  <Text className="text-red-400 text-xs font-bold">✕</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))
      )}

      {formOpen && (
        <EventForm
          lobbyId={lobbyId}
          onClose={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false);
            qc.invalidateQueries({ queryKey: ["lobby-events", lobbyId] });
          }}
        />
      )}
    </View>
  );
}

function EventForm({
  lobbyId,
  onClose,
  onCreated,
}: {
  lobbyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    return d.toISOString().slice(0, 16).replace("T", " ");
  });
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("PUBLISHED");

  const create = useMutation({
    mutationFn: () => {
      const parsed = new Date(startsAt.replace(" ", "T"));
      if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date — use YYYY-MM-DD HH:MM");
      return api(`/lobbies/${lobbyId}/events`, {
        method: "POST",
        body: {
          title,
          description,
          category,
          startsAt: parsed.toISOString(),
          status,
          timezone: "UTC",
        },
      });
    },
    onSuccess: onCreated,
    onError: (e: any) => Alert.alert("Couldn't create", e?.message || "Unknown error"),
  });

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-center px-5">
        <View className="bg-weered-bg border border-border rounded-2xl p-5 max-h-[80%]">
          <ScrollView>
            <Text className="text-weered-text font-bold text-lg mb-4">New event</Text>
            <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Title</Text>
            <Input value={title} onChangeText={setTitle} />
            <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1 mt-3">
              Description
            </Text>
            <Input value={description} onChangeText={setDescription} multiline />
            <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1 mt-3">
              Category
            </Text>
            <Input
              value={category}
              onChangeText={setCategory}
              placeholder="tournament, raid, meetup…"
            />
            <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1 mt-3">
              Starts (UTC, YYYY-MM-DD HH:MM)
            </Text>
            <Input value={startsAt} onChangeText={setStartsAt} autoCapitalize="none" />
            <View className="flex-row mt-4">
              <Pressable
                onPress={() => setStatus("PUBLISHED")}
                className={`flex-1 mr-2 px-3 py-2.5 rounded-lg border ${status === "PUBLISHED" ? "bg-weered border-weered" : "bg-panel border-border"}`}
              >
                <Text
                  className={`text-xs font-bold text-center ${status === "PUBLISHED" ? "text-white" : "text-weered-muted"}`}
                >
                  Publish
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setStatus("DRAFT")}
                className={`flex-1 px-3 py-2.5 rounded-lg border ${status === "DRAFT" ? "bg-amber-500 border-amber-500" : "bg-panel border-border"}`}
              >
                <Text
                  className={`text-xs font-bold text-center ${status === "DRAFT" ? "text-white" : "text-weered-muted"}`}
                >
                  Save draft
                </Text>
              </Pressable>
            </View>

            <View className="flex-row mt-5">
              <Pressable
                onPress={onClose}
                className="flex-1 mr-2 px-3 py-3 rounded-lg bg-panel border border-border active:opacity-70"
              >
                <Text className="text-weered-muted text-center font-bold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => title.trim() && create.mutate()}
                disabled={create.isPending || !title.trim()}
                className="flex-1 px-3 py-3 rounded-lg bg-weered active:opacity-80"
              >
                <Text className="text-white text-center font-bold">
                  {create.isPending ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="rgba(160,160,170,0.6)"
      className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg"
      style={[
        { fontSize: 14, minHeight: 42 },
        props.multiline ? { minHeight: 64, textAlignVertical: "top" } : null,
      ]}
    />
  );
}
