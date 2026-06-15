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
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { wsClient } from "@/lib/ws";
import { Avatar } from "@/components/Avatar";
import { RichText } from "@/components/RichText";
import { GifPicker } from "@/components/GifPicker";
import { useActionSheet } from "@/components/ActionSheet";
import { ReportModal } from "@/components/ReportModal";

const QUICK_REACTS = ["👍", "❤️", "😂", "🔥", "🎉", "😮", "😢", "👀"];

type Reaction = { emoji: string; count: number; users: string[] };

type DM = {
  id: string;
  fromId: string;
  toId: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToId?: string | null;
  replyToUserId?: string | null;
  replyToUserName?: string | null;
  replyToBody?: string | null;
  reactions?: Reaction[];
};

type DMResponse = { messages: DM[] };
type PeerProfile = { id: string; name: string; avatar?: string | null };

export default function DMConversation() {
  const { peerId: rawPeerId } = useLocalSearchParams<{ peerId: string }>();
  const peerId = String(rawPeerId || "");
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();

  const peerQ = useQuery({
    queryKey: ["profile", peerId],
    queryFn: () => api<PeerProfile>(`/profile/${peerId}`),
    enabled: !!peerId,
  });

  const dmQ = useQuery({
    queryKey: ["dm", peerId],
    queryFn: () => api<DMResponse>(`/dm/${peerId}`),
    enabled: !!peerId,
  });

  const [messages, setMessages] = useState<DM[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<DM | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const listRef = useRef<FlatList<DM>>(null);
  const sheet = useActionSheet();
  const [reportTarget, setReportTarget] = useState<{ type: "MESSAGE" | "USER"; id: string } | null>(
    null,
  );

  useEffect(() => {
    if (dmQ.data?.messages) setMessages(dmQ.data.messages);
  }, [dmQ.data]);

  useEffect(() => {
    wsClient.connect();
    const off = wsClient.on((msg) => {
      if (!msg) return;
      if (msg.type === "dm:message" && msg.message) {
        const dm: DM = msg.message;
        if (dm.fromId === peerId || dm.toId === peerId) {
          setMessages((prev) => (prev.some((m) => m.id === dm.id) ? prev : [...prev, dm]));
          qc.invalidateQueries({ queryKey: ["dm-previews"] });
          qc.invalidateQueries({ queryKey: ["dm-unread"] });
        }
      } else if (msg.type === "dm:edited") {
        if (msg.fromId === peerId || msg.toId === peerId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.msgId ? { ...m, body: msg.body, editedAt: msg.editedAt } : m,
            ),
          );
        }
      } else if (msg.type === "dm:deleted") {
        if (msg.fromId === peerId || msg.toId === peerId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.msgId ? { ...m, deletedAt: msg.deletedAt, body: "" } : m,
            ),
          );
        }
      } else if (msg.type === "dm:reaction") {
        if (msg.fromId === peerId || msg.toId === peerId) {
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.msgId ? { ...m, reactions: msg.reactions } : m)),
          );
        }
      }
    });
    return off;
  }, [peerId, qc]);

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["dm-previews"] });
    qc.invalidateQueries({ queryKey: ["dm-unread"] });
  }, [peerId, qc]);

  const sendMut = useMutation({
    mutationFn: (vars: { body: string; replyToId?: string }) =>
      api<{ ok: boolean; message: DM }>(`/dm/${peerId}`, { method: "POST", body: vars }),
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
    if (editingId) {
      wsClient.send({ type: "dm:edit", msgId: editingId, body });
      setEditingId(null);
    } else {
      sendMut.mutate({ body, replyToId: replyTo?.id });
      setReplyTo(null);
    }
    setDraft("");
  }

  function toggleReaction(msgId: string, emoji: string) {
    wsClient.send({ type: "dm:react", msgId, emoji });
  }

  function onLongPressMessage(msg: DM) {
    if (msg.deletedAt) return;
    const mine = me?.id === msg.fromId;
    const withinEditWindow = Date.now() - new Date(msg.createdAt).getTime() < 15 * 60 * 1000;

    const actions: { label: string; icon?: string; onPress: () => void; destructive?: boolean }[] =
      [];
    actions.push({ label: "React", icon: "🙂", onPress: () => showReactPicker(msg.id) });
    actions.push({
      label: "Reply",
      icon: "↩︎",
      onPress: () => {
        setReplyTo(msg);
        setEditingId(null);
      },
    });
    actions.push({
      label: "Copy",
      icon: "⎘",
      onPress: () => Share.share({ message: msg.body }).catch(() => {}),
    });
    if (mine && withinEditWindow) {
      actions.push({
        label: "Edit",
        icon: "✎",
        onPress: () => {
          setEditingId(msg.id);
          setReplyTo(null);
          setDraft(msg.body);
        },
      });
    }
    if (mine) {
      actions.push({
        label: "Delete",
        icon: "🗑",
        destructive: true,
        onPress: () => wsClient.send({ type: "dm:delete", msgId: msg.id }),
      });
    }
    if (!mine) {
      actions.push({
        label: "Report message",
        icon: "⚠️",
        destructive: true,
        onPress: () => setReportTarget({ type: "MESSAGE", id: msg.id }),
      });
    }

    sheet.open({
      title: mine ? "You" : peer?.name || "Message",
      subtitle: msg.body.slice(0, 120),
      actions,
    });
  }

  function showReactPicker(msgId: string) {
    sheet.open({
      title: "React",
      actions: QUICK_REACTS.map((emoji) => ({
        label: emoji,
        onPress: () => toggleReaction(msgId, emoji),
      })),
    });
  }

  const peer = peerQ.data;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen
        options={{
          title: peer?.name || "Message",
          headerTitle: () => (
            <Pressable
              onPress={() => router.push(`/user/${peerId}`)}
              className="flex-row items-center"
            >
              <View className="mr-2">
                <Avatar name={peer?.name || "?"} url={peer?.avatar} size={28} />
              </View>
              <Text className="text-weered-text font-bold text-base">
                {peer?.name || "Message"}
              </Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        {dmQ.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#5800E5" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item }) => {
              const mine = me?.id === item.fromId;
              return (
                <DMRow
                  dm={item}
                  mine={mine}
                  meId={me?.id || ""}
                  onLongPress={() => onLongPressMessage(item)}
                  onToggleReaction={(emoji) => toggleReaction(item.id, emoji)}
                />
              );
            }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View className="px-8 py-16 items-center">
                <Text className="text-weered-muted text-sm">Say hi.</Text>
              </View>
            }
          />
        )}

        {replyTo && (
          <View className="px-3 py-2 border-t border-border/40 bg-panel/60 flex-row items-center">
            <Text className="text-weered text-xs font-bold mr-2">REPLY</Text>
            <View className="flex-1">
              <Text className="text-weered-text text-xs font-semibold">
                {replyTo.fromId === me?.id ? "You" : peer?.name || "…"}
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

        {editingId && (
          <View className="px-3 py-2 border-t border-border/40 bg-panel/60 flex-row items-center">
            <Text className="text-weered text-xs font-bold mr-2">EDITING</Text>
            <Text className="text-weered-muted text-xs flex-1" numberOfLines={1}>
              {messages.find((m) => m.id === editingId)?.body}
            </Text>
            <Pressable
              onPress={() => {
                setEditingId(null);
                setDraft("");
              }}
              hitSlop={8}
            >
              <Text className="text-weered-muted text-xs">Cancel</Text>
            </Pressable>
          </View>
        )}

        <View className="px-3 py-2 border-t border-border/40 flex-row items-end bg-panel">
          <Pressable
            onPress={() => setGifOpen(true)}
            hitSlop={6}
            className="mr-1 px-2 py-2 rounded-lg active:opacity-70 bg-panel border border-border"
          >
            <Text className="text-weered-text font-bold text-xs">GIF</Text>
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={
              editingId
                ? "Edit message"
                : replyTo
                  ? `Reply to ${replyTo.fromId === me?.id ? "yourself" : peer?.name || "…"}`
                  : "Message"
            }
            placeholderTextColor="rgba(160,160,170,0.6)"
            multiline
            className="flex-1 text-weered-text text-base px-3 py-2"
            style={{ maxHeight: 120, minHeight: 40 }}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() || sendMut.isPending}
            className="bg-weered px-4 py-2.5 rounded-xl ml-2 active:opacity-80"
            style={{ opacity: !draft.trim() || sendMut.isPending ? 0.4 : 1 }}
          >
            <Text className="text-white font-bold">{editingId ? "Save" : "Send"}</Text>
          </Pressable>
        </View>
        <GifPicker
          visible={gifOpen}
          onClose={() => setGifOpen(false)}
          onSelect={(url) => setDraft((prev) => (prev ? prev.trimEnd() + " " : "") + url)}
        />
      </KeyboardAvoidingView>
      <ReportModal
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.type || "MESSAGE"}
        targetId={reportTarget?.id || ""}
        context={`dm:${peerId}`}
      />
    </SafeAreaView>
  );
}

function DMRow({
  dm,
  mine,
  meId,
  onLongPress,
  onToggleReaction,
}: {
  dm: DM;
  mine: boolean;
  meId: string;
  onLongPress: () => void;
  onToggleReaction: (emoji: string) => void;
}) {
  const deleted = !!dm.deletedAt;
  return (
    <View className={`px-3 py-1 ${mine ? "items-end" : "items-start"}`}>
      {dm.replyToId && (
        <View
          className={`mb-1 pl-2 py-1 ${mine ? "items-end" : "items-start"}`}
          style={{
            maxWidth: "80%",
            borderLeftWidth: 2,
            borderLeftColor: "#5800E5",
          }}
        >
          <Text className="text-weered text-xs font-semibold">{dm.replyToUserName}</Text>
          <Text className="text-weered-muted text-xs" numberOfLines={1}>
            {dm.replyToBody}
          </Text>
        </View>
      )}
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={300}
        className="max-w-[80%] active:opacity-80"
      >
        <View
          className="px-3 py-2 rounded-2xl"
          style={{
            backgroundColor: mine ? "#5800E5" : "rgba(60,60,70,0.5)",
            borderTopRightRadius: mine ? 4 : 16,
            borderTopLeftRadius: mine ? 16 : 4,
          }}
        >
          {deleted ? (
            <Text
              className="italic"
              style={{
                color: mine ? "rgba(255,255,255,0.7)" : "rgba(200,200,210,0.7)",
                fontSize: 14,
              }}
            >
              [deleted]
            </Text>
          ) : (
            <RichText
              body={dm.body}
              style={{ color: mine ? "#ffffff" : "#f0f0f5", fontSize: 14 }}
              linkStyle={{ color: mine ? "#ffffff" : "#a78bfa", textDecorationLine: "underline" }}
            />
          )}
        </View>
      </Pressable>
      {!deleted && dm.reactions && dm.reactions.length > 0 && (
        <View className={`flex-row flex-wrap mt-1 ${mine ? "justify-end" : "justify-start"}`}>
          {dm.reactions.map((r) => {
            const mineReact = r.users?.includes(meId);
            return (
              <Pressable
                key={r.emoji}
                onPress={() => onToggleReaction(r.emoji)}
                className="mr-1 mb-1 px-2 py-0.5 rounded-full active:opacity-80"
                style={{
                  backgroundColor: mineReact ? "#5800E533" : "rgba(60,60,70,0.5)",
                  borderWidth: 1,
                  borderColor: mineReact ? "#5800E5" : "rgba(120,120,130,0.3)",
                }}
              >
                <Text className="text-xs">
                  {r.emoji}{" "}
                  <Text className={mineReact ? "text-weered font-bold" : "text-weered-text"}>
                    {r.count}
                  </Text>
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <Text className="text-weered-muted text-xs mt-0.5">
        {formatTime(dm.createdAt)}
        {dm.editedAt ? " · edited" : ""}
      </Text>
    </View>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${ampm}`;
  } catch {
    return "";
  }
}
