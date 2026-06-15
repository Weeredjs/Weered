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
  Modal,
  ScrollView,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { wsClient } from "@/lib/ws";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { RichText } from "@/components/RichText";
import { GifPicker } from "@/components/GifPicker";
import { useActionSheet } from "@/components/ActionSheet";
import { ReportModal } from "@/components/ReportModal";

type Member = {
  userId: string;
  name: string;
  role: string;
  online: boolean;
  roomName?: string | null;
  avatar?: string | null;
  avatarColor?: string | null;
};
type Crew = {
  id: string;
  name: string;
  tag: string;
  description: string;
  ownerId: string;
  myRole: "LEADER" | "OFFICER" | "MEMBER";
  members: Member[];
};
type CrewsResp = { crews: Crew[] };

type Reaction = { emoji: string; count: number; users: string[] };

type CrewMessage = {
  id: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  replyToId?: string | null;
  replyToUserName?: string | null;
  replyToBody?: string | null;
  reactions?: Reaction[];
};

const QUICK_REACTS = ["👍", "❤️", "😂", "🔥", "🎉", "😮"];

export default function CrewDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const crewId = String(id || "");
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();

  const crewsQ = useQuery({
    queryKey: ["my-crews"],
    queryFn: () => api<CrewsResp>("/crews/mine"),
  });
  const crew = (crewsQ.data?.crews || []).find((c) => c.id === crewId) || null;

  const msgsQ = useQuery({
    queryKey: ["crew-messages", crewId],
    queryFn: () => api<{ ok: boolean; messages: CrewMessage[] }>(`/crews/${crewId}/messages`),
    enabled: !!crewId,
  });

  const [messages, setMessages] = useState<CrewMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [gifOpen, setGifOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<CrewMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const listRef = useRef<FlatList<CrewMessage>>(null);
  const sheet = useActionSheet();
  const [reportTarget, setReportTarget] = useState<{ type: "MESSAGE"; id: string } | null>(null);

  useEffect(() => {
    const initial = msgsQ.data?.messages;
    if (initial) setMessages(initial);
  }, [msgsQ.data]);

  useEffect(() => {
    wsClient.connect();
    wsClient.reauth();
    const off = wsClient.on((m: any) => {
      if (m.type === "auth:ok") {
        setConnected(true);
        return;
      }
      if (m.type === "crew:message" && m.crewId === crewId) {
        setMessages((prev) =>
          prev.some((x) => x.id === m.message.id) ? prev : [...prev, m.message],
        );
      }
      if (m.type === "crew:edited" && m.crewId === crewId) {
        setMessages((prev) =>
          prev.map((x) => (x.id === m.msgId ? { ...x, body: m.body, editedAt: m.editedAt } : x)),
        );
      }
      if (m.type === "crew:deleted" && m.crewId === crewId) {
        setMessages((prev) =>
          prev.map((x) => (x.id === m.msgId ? { ...x, deletedAt: m.deletedAt, body: "" } : x)),
        );
      }
      if (m.type === "crew:rejected" && m.crewId === crewId) {
        Alert.alert("Message rejected", m.reason || "Try again");
      }
      if (m.type === "crew:reaction" && m.crewId === crewId) {
        setMessages((prev) =>
          prev.map((x) => (x.id === m.msgId ? { ...x, reactions: m.reactions } : x)),
        );
      }
    });
    return () => {
      off?.();
    };
  }, [crewId]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    if (editingId) {
      wsClient.send({ type: "crew:edit", crewId, msgId: editingId, body });
      setEditingId(null);
    } else {
      wsClient.send({
        type: "crew:send",
        crewId,
        body,
        ...(replyTo ? { replyToId: replyTo.id } : {}),
      });
      setReplyTo(null);
    }
    setDraft("");
  };

  function toggleReaction(msgId: string, emoji: string) {
    wsClient.send({ type: "crew:react", crewId, msgId, emoji });
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

  function onLongPressMessage(msg: CrewMessage) {
    if (msg.deletedAt) return;
    const mine = me?.id === msg.userId;
    const within = Date.now() - new Date(msg.createdAt).getTime() < 15 * 60 * 1000;

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
    actions.push({
      label: "View profile",
      icon: "👤",
      onPress: () => router.push(`/user/${msg.userId}`),
    });
    if (mine && within) {
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
        onPress: () => wsClient.send({ type: "crew:delete", crewId, msgId: msg.id }),
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
      title: msg.userName,
      subtitle: msg.body.slice(0, 120),
      actions,
    });
  }

  const leave = useMutation({
    mutationFn: () => api(`/crews/${crewId}/members/${me!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-crews"] });
      router.back();
    },
    onError: (e: any) => Alert.alert("Couldn't leave", e?.message || "Unknown error"),
  });

  const dissolve = useMutation({
    mutationFn: () => api(`/crews/${crewId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-crews"] });
      router.back();
    },
    onError: (e: any) => Alert.alert("Couldn't dissolve", e?.message || "Unknown error"),
  });

  const isLeader = crew?.myRole === "LEADER" || crew?.ownerId === me?.id;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen
        options={{
          title: crew ? `${crew.tag ? `[${crew.tag}] ` : ""}${crew.name}` : "Crew",
          headerRight: () => (
            <View className="flex-row items-center mr-2">
              <Pressable
                onPress={() => setRosterOpen(true)}
                hitSlop={8}
                className="active:opacity-70 mr-3"
              >
                <Text className="text-weered font-semibold">Members</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  Alert.alert(
                    isLeader ? "Dissolve crew?" : "Leave crew?",
                    isLeader
                      ? "This deletes the crew for everyone."
                      : "You can be re-invited later.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: isLeader ? "Dissolve" : "Leave",
                        style: "destructive",
                        onPress: () => (isLeader ? dissolve.mutate() : leave.mutate()),
                      },
                    ],
                  )
                }
                hitSlop={8}
                className="active:opacity-70"
              >
                <Text className="text-red-400 font-semibold">
                  {isLeader ? "Dissolve" : "Leave"}
                </Text>
              </Pressable>
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <Msg
              msg={item}
              isSelf={item.userId === me?.id}
              onLongPress={() => onLongPressMessage(item)}
              onTapReaction={(emoji) => toggleReaction(item.id, emoji)}
            />
          )}
          ListEmptyComponent={
            <View className="px-8 py-16 items-center">
              {msgsQ.isLoading ? (
                <ActivityIndicator color="#5800E5" />
              ) : (
                <Text className="text-weered-muted text-sm">Start the conversation.</Text>
              )}
            </View>
          }
        />

        {replyTo && (
          <View className="px-3 py-2 border-t border-border/40 bg-panel/60 flex-row items-center">
            <Text className="text-weered text-xs font-bold mr-2">REPLY</Text>
            <View className="flex-1">
              <Text className="text-weered-text text-xs font-semibold">{replyTo.userName}</Text>
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
                  ? `Reply to ${replyTo.userName}`
                  : "Message your crew"
            }
            placeholderTextColor="rgba(160,160,170,0.6)"
            multiline
            className="flex-1 text-weered-text text-base px-3 py-2"
            style={{ maxHeight: 120, minHeight: 40 }}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() || !connected}
            className="bg-weered px-4 py-2.5 rounded-xl ml-2 active:opacity-80"
            style={{ opacity: !draft.trim() || !connected ? 0.4 : 1 }}
          >
            <Text className="text-white font-bold">
              {!connected ? "…" : editingId ? "Save" : "Send"}
            </Text>
          </Pressable>
        </View>
        <GifPicker
          visible={gifOpen}
          onClose={() => setGifOpen(false)}
          onSelect={(url) => setDraft((prev) => (prev ? prev.trimEnd() + " " : "") + url)}
        />
      </KeyboardAvoidingView>

      {rosterOpen && crew && (
        <Modal transparent animationType="slide" onRequestClose={() => setRosterOpen(false)}>
          <View className="flex-1 bg-black/70 justify-end">
            <View
              className="bg-weered-bg border-t border-border rounded-t-2xl"
              style={{ maxHeight: "70%" }}
            >
              <View className="px-4 pt-4 pb-2 flex-row items-center">
                <Text className="text-weered-text font-bold text-lg flex-1">
                  Members · {crew.members.length}
                </Text>
                <Pressable onPress={() => setRosterOpen(false)} hitSlop={10}>
                  <Text className="text-weered-muted font-bold text-base">✕</Text>
                </Pressable>
              </View>
              <ScrollView>
                {crew.members.map((m) => (
                  <Pressable
                    key={m.userId}
                    onPress={() => {
                      setRosterOpen(false);
                      router.push(`/user/${m.userId}`);
                    }}
                    className="flex-row items-center px-4 py-2.5 border-b border-border/20 active:bg-panel"
                  >
                    <View className="mr-3">
                      <Avatar name={m.name} url={m.avatar} size={36} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-weered-text font-semibold" numberOfLines={1}>
                        {m.name}
                      </Text>
                      <Text className="text-weered-muted text-xs">
                        {m.online ? <Text className="text-green-400">● online</Text> : "offline"}
                        {m.roomName ? ` · in ${m.roomName}` : ""} · {m.role}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
      <ReportModal
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType="MESSAGE"
        targetId={reportTarget?.id || ""}
        context={`crew:${crewId}`}
      />
    </SafeAreaView>
  );
}

function Msg({
  msg,
  isSelf,
  onLongPress,
  onTapReaction,
}: {
  msg: CrewMessage;
  isSelf: boolean;
  onLongPress: () => void;
  onTapReaction: (emoji: string) => void;
}) {
  if (msg.deletedAt) {
    return (
      <View className="px-4 py-1">
        <Text className="text-weered-muted text-xs italic">[deleted]</Text>
      </View>
    );
  }
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      className="px-4 py-1.5 active:bg-panel/40"
    >
      <View className="flex-row items-baseline mb-0.5">
        <Pressable onPress={() => router.push(`/user/${msg.userId}`)} hitSlop={4}>
          <Text className={`font-bold text-sm ${isSelf ? "text-weered" : "text-weered-text"}`}>
            {msg.userName}
          </Text>
        </Pressable>
        <Text className="text-weered-muted/70 text-xs ml-2">
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          {msg.editedAt ? " · edited" : ""}
        </Text>
      </View>
      {!!msg.replyToId && (
        <View className="border-l-2 border-weered/40 pl-2 mb-1">
          <Text className="text-weered-muted text-xs" numberOfLines={1}>
            <Text className="font-bold">{msg.replyToUserName || "?"}</Text>: {msg.replyToBody}
          </Text>
        </View>
      )}
      <RichText body={msg.body} style={{ color: "rgba(243,244,246,.92)", fontSize: 15 }} />
      {(msg.reactions?.length ?? 0) > 0 && (
        <View className="flex-row flex-wrap mt-1.5">
          {msg.reactions!.map((r) => (
            <Pressable
              key={r.emoji}
              onPress={() => onTapReaction(r.emoji)}
              className="flex-row items-center bg-panel border border-border rounded-full px-2 py-0.5 mr-1.5 mb-1 active:opacity-70"
            >
              <Text className="text-sm">{r.emoji}</Text>
              <Text className="text-weered-muted text-xs font-bold ml-1">{r.count}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Pressable>
  );
}
