import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { wsClient } from "@/lib/ws";
import { Avatar } from "@/components/Avatar";
import { RichText } from "@/components/RichText";

type Member = { id: string; name: string; avatar?: string | null; usernameKey?: string | null };
type Thread = {
  id: string;
  name: string | null;
  createdById: string;
  createdAt: string;
  lastMessageAt: string;
  role: string;
  unread: number;
  members: Member[];
};
type Message = {
  id: string;
  threadId: string;
  senderId: string;
  senderName?: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToId?: string | null;
  replyToUserId?: string | null;
  replyToUserName?: string | null;
  replyToBody?: string | null;
};
type MessagesResponse = { ok: boolean; messages: Message[] };
type ThreadsResponse = { ok: boolean; threads: Thread[] };

export default function GroupChat() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = String(rawId || "");
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();

  // Pull just THIS thread from the list query (cheaper than a dedicated
  // /groups/:id endpoint we don't have).
  const threadsQ = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<ThreadsResponse>("/groups"),
  });
  const thread = threadsQ.data?.threads.find((t) => t.id === id);

  const msgQ = useQuery({
    queryKey: ["group", id, "messages"],
    queryFn: () => api<MessagesResponse>(`/groups/${id}/messages`),
    enabled: !!id,
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (msgQ.data?.messages) setMessages(msgQ.data.messages);
  }, [msgQ.data]);

  // Subscribe to group:message events for this thread.
  useEffect(() => {
    if (!id) return;
    wsClient.connect();
    const off = wsClient.on((m) => {
      if (!m) return;
      if (m.type === "group:message" && m.message?.threadId === id) {
        const msg: Message = m.message;
        setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
        qc.invalidateQueries({ queryKey: ["groups"] });
      } else if (m.type === "group:edited" && m.threadId === id) {
        setMessages((prev) =>
          prev.map((x) => (x.id === m.msgId ? { ...x, body: m.body, editedAt: m.editedAt } : x)),
        );
      } else if (m.type === "group:deleted" && m.threadId === id) {
        setMessages((prev) =>
          prev.map((x) => (x.id === m.msgId ? { ...x, deletedAt: m.deletedAt, body: "" } : x)),
        );
      }
    });
    return off;
  }, [id, qc]);

  // Refresh on app foreground.
  useEffect(() => {
    if (!id) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") msgQ.refetch();
    });
    return () => sub.remove();
  }, [id, msgQ]);

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  // Mark-read on enter + on each new message arrival.
  useEffect(() => {
    if (!id || messages.length === 0) return;
    api(`/groups/${id}/read`, { method: "PATCH" }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["groups"] });
  }, [id, messages.length, qc]);

  const sendMut = useMutation({
    mutationFn: (vars: { body: string; replyToId?: string }) =>
      api<{ ok: boolean; message: Message }>(`/groups/${id}/messages`, {
        method: "POST",
        body: vars,
      }),
    onSuccess: (res) => {
      if (res.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message],
        );
      }
    },
    onError: (e: any) => Alert.alert("Couldn't send", e?.message || "Unknown error"),
  });

  function send() {
    const body = draft.trim();
    if (!body) return;
    sendMut.mutate({ body, replyToId: replyTo?.id });
    setReplyTo(null);
    setDraft("");
  }

  const title = thread?.name || othersList(thread?.members || [], me?.id || "");

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        {msgQ.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#5800E5" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item, index }) => {
              const mine = me?.id === item.senderId;
              const prev = messages[index - 1];
              const showSender = !mine && (!prev || prev.senderId !== item.senderId);
              const sender = thread?.members.find((mm) => mm.id === item.senderId);
              return (
                <GroupRow
                  msg={item}
                  mine={mine}
                  showSender={showSender}
                  senderName={sender?.name || item.senderName || "?"}
                  senderAvatar={sender?.avatar}
                  onLongPress={() => setReplyTo(item)}
                />
              );
            }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View className="px-8 py-16 items-center">
                <Text className="text-weered-muted text-sm">No messages yet.</Text>
              </View>
            }
          />
        )}

        {replyTo && (
          <View className="px-3 py-2 border-t border-border/40 bg-panel/60 flex-row items-center">
            <Text className="text-weered text-xs font-bold mr-2">REPLY</Text>
            <View className="flex-1">
              <Text className="text-weered-text text-xs font-semibold">
                {replyTo.senderId === me?.id
                  ? "You"
                  : thread?.members.find((m) => m.id === replyTo.senderId)?.name || "…"}
              </Text>
              <Text className="text-weered-muted text-xs" numberOfLines={1}>
                {replyTo.body}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8} className="ml-2">
              <Text className="text-weered-muted text-xs">Cancel</Text>
            </Pressable>
          </View>
        )}

        <View className="flex-row items-end px-3 py-2 border-t border-border/40 bg-panel/40">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor="#6b7280"
            multiline
            maxLength={2000}
            className="flex-1 text-weered-text text-base px-3 py-2 mr-2 rounded-2xl bg-bg/60 border border-border/50"
            style={{ maxHeight: 120 }}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() || sendMut.isPending}
            className="px-4 py-2 rounded-2xl"
            style={{
              backgroundColor: draft.trim() ? "#5800E5" : "#3a3a45",
              opacity: sendMut.isPending ? 0.6 : 1,
            }}
          >
            <Text className="text-white font-bold text-sm">Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GroupRow({
  msg,
  mine,
  showSender,
  senderName,
  senderAvatar,
  onLongPress,
}: {
  msg: Message;
  mine: boolean;
  showSender: boolean;
  senderName: string;
  senderAvatar?: string | null;
  onLongPress: () => void;
}) {
  if (msg.deletedAt) {
    return (
      <View className={`px-3 py-1 ${mine ? "items-end" : "items-start"}`}>
        <Text className="text-weered-muted text-xs italic">Message deleted</Text>
      </View>
    );
  }
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      className={`px-3 py-1 flex-row ${mine ? "justify-end" : "justify-start"}`}
    >
      {!mine && (
        <View className="mr-2" style={{ width: 28 }}>
          {showSender && <Avatar name={senderName} url={senderAvatar} size={28} />}
        </View>
      )}
      <View className="max-w-[80%]">
        {!mine && showSender && (
          <Text className="text-weered-muted text-xs font-semibold mb-0.5 ml-1">{senderName}</Text>
        )}
        {msg.replyToId && (
          <View className="px-2 py-1 mb-1 rounded-lg bg-bg/40 border-l-2 border-weered">
            <Text className="text-weered text-xs font-bold">{msg.replyToUserName || "…"}</Text>
            <Text className="text-weered-muted text-xs" numberOfLines={2}>
              {msg.replyToBody}
            </Text>
          </View>
        )}
        <View
          className="px-3 py-2 rounded-2xl"
          style={{ backgroundColor: mine ? "#5800E5" : "#1f2030" }}
        >
          <RichText body={msg.body} style={{ color: mine ? "#ffffff" : "#e5e7eb", fontSize: 15 }} />
        </View>
      </View>
    </Pressable>
  );
}

function othersList(members: Member[], meId: string): string {
  const others = members.filter((m) => m.id !== meId).map((m) => m.name);
  if (others.length === 0) return "Group";
  if (others.length === 1) return others[0];
  if (others.length === 2) return `${others[0]} & ${others[1]}`;
  return `${others[0]}, ${others[1]} +${others.length - 2}`;
}
