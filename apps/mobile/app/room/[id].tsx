import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
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
import { wsClient } from "@/lib/ws";
import { useAuth } from "@/stores/auth";
import { WEB_BASE } from "@/lib/config";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { RichText } from "@/components/RichText";
import { RosterModal } from "@/components/RosterModal";
import { GifPicker } from "@/components/GifPicker";
import { useActionSheet } from "@/components/ActionSheet";
import { ReportModal } from "@/components/ReportModal";
import { RoomNpcsButton } from "@/components/RoomNpcs";

const QUICK_REACTS = ["👍", "❤️", "😂", "🔥", "🎉", "😮", "😢", "👀"];

type User = {
  id: string;
  name: string;
  role?: string;
  globalRole?: string;
  tier?: string;
  avatar?: string | null;
  avatarColor?: string | null;
  isAway?: boolean;
};

type Reaction = { emoji: string; count: number; users: string[] };
type ReplyTo = { id: string; userId: string; userName: string; body: string };

type ChatMsg = {
  id: string;
  user: User;
  body: string;
  ts: number;
  editedAt?: number;
  deletedAt?: number;
  reactions?: Reaction[];
  replyTo?: ReplyTo;
};

export default function Room() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = String(id || "");
  const me = useAuth((s) => s.user);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roomName, setRoomName] = useState<string>("Room");
  const [connected, setConnected] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMsg | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [accessState, setAccessState] = useState<
    "joining" | "joined" | "knock_queued" | "password_required" | "denied"
  >("joining");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [knockers, setKnockers] = useState<{ id: string; name: string }[]>([]);
  const [ownerId, setOwnerId] = useState<string>("");
  const [modIds, setModIds] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<{ type: "MESSAGE" | "USER"; id: string } | null>(
    null,
  );
  const sheet = useActionSheet();
  const listRef = useRef<FlatList<ChatMsg>>(null);

  useEffect(() => {
    if (roomId && me) {
      api("/recents", { method: "POST", body: { roomId } }).catch(() => {});
    }
  }, [roomId, me]);

  useEffect(() => {
    if (!roomId) return;
    wsClient.connect();

    const off = wsClient.on((msg) => {
      if (!msg) return;
      if (msg.type === "auth:ok") {
        setConnected(true);
        return;
      }
      if (msg.roomId !== roomId) return;
      switch (msg.type) {
        case "presence:state":
          setUsers(msg.users || []);
          if (msg.name) setRoomName(msg.name);
          if (msg.ownerId) setOwnerId(String(msg.ownerId));
          if (Array.isArray(msg.mods)) setModIds(new Set(msg.mods.map(String)));
          setAccessState("joined");
          break;
        case "room:adminState":
          if (Array.isArray(msg.knocks)) {
            setKnockers(msg.knocks.map((k: any) => ({ id: k.userId, name: k.name })));
          }
          break;
        case "presence:join":
          if (msg.user) {
            setUsers((prev) => {
              const without = prev.filter((u) => u.id !== msg.user.id);
              return [...without, msg.user];
            });
          }
          break;
        case "presence:leave":
          setUsers((prev) => prev.filter((u) => u.id !== msg.userId));
          break;
        case "chat:history":
          setMessages(msg.msgs || []);
          break;
        case "chat:new":
          setMessages((prev) => [...prev, msg.msg]);
          break;
        case "chat:edited":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.msgId ? { ...m, body: msg.body, editedAt: msg.editedAt } : m,
            ),
          );
          break;
        case "chat:deleted":
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.msgId ? { ...m, deletedAt: msg.deletedAt } : m)),
          );
          break;
        case "reaction:changed":
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.msgId ? { ...m, reactions: msg.reactions } : m)),
          );
          break;
        case "room:password:required":
          setAccessState("password_required");
          setPasswordError(null);
          break;
        case "room:password:wrong":
          setPasswordError("Wrong password.");
          break;
        case "room:knock:queued":
          setAccessState("knock_queued");
          break;
        case "room:admitted":
          setAccessState("joining");
          wsClient.send({ type: "presence:join", roomId });
          wsClient.send({ type: "chat:history", roomId, limit: 50 });
          break;
        case "room:knock":
          if (msg.user)
            setKnockers((prev) =>
              prev.some((k) => k.id === msg.user.id)
                ? prev
                : [...prev, { id: msg.user.id, name: msg.user.name }],
            );
          break;
        case "room:deleted":
          Alert.alert("Room deleted", "This room no longer exists.", [
            { text: "OK", onPress: () => router.back() },
          ]);
          break;
      }
    });

    wsClient.send({ type: "presence:join", roomId });
    wsClient.send({ type: "chat:history", roomId, limit: 50 });

    return () => {
      wsClient.send({ type: "presence:leave", roomId });
      off();
    };
  }, [roomId]);

  useEffect(() => {
    if (connected && roomId) {
      wsClient.send({ type: "presence:join", roomId });
      wsClient.send({ type: "chat:history", roomId, limit: 50 });
    }
  }, [connected, roomId]);

  // Re-sync chat when the app returns to foreground. Android can silently
  // drop the WS in background (or keep it open but miss messages); either
  // way the user expects the room view to be current when they tab back in.
  // We just re-request chat:history; the wsClient outbox queues sends if
  // the socket is reconnecting, so this works whether the WS is OPEN or
  // re-establishing.
  useEffect(() => {
    if (!roomId) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        wsClient.send({ type: "presence:join", roomId });
        wsClient.send({ type: "chat:history", roomId, limit: 50 });
      }
    });
    return () => sub.remove();
  }, [roomId]);

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  function send() {
    const body = draft.trim();
    if (!body) return;
    if (editingId) {
      wsClient.send({ type: "chat:edit", roomId, msgId: editingId, body });
      setEditingId(null);
    } else {
      wsClient.send({
        type: "chat:send",
        roomId,
        body,
        ...(replyTo ? { replyToId: replyTo.id } : {}),
      });
      setReplyTo(null);
    }
    setDraft("");
  }

  function toggleReaction(msgId: string, emoji: string) {
    wsClient.send({ type: "reaction:toggle", roomId, msgId, emoji });
  }

  function submitPassword() {
    if (!passwordInput.trim()) return;
    setPasswordError(null);
    wsClient.send({ type: "presence:join", roomId, password: passwordInput.trim() });
  }
  function admitKnock(userId: string) {
    wsClient.send({ type: "room:admit", roomId, targetId: userId });
    setKnockers((prev) => prev.filter((k) => k.id !== userId));
  }
  function denyKnock(userId: string) {
    wsClient.send({ type: "room:deny", roomId, targetId: userId });
    setKnockers((prev) => prev.filter((k) => k.id !== userId));
  }

  function onLongPressMessage(msg: ChatMsg) {
    if (msg.deletedAt) return;
    const mine = me?.id === msg.user.id;
    const withinEditWindow = Date.now() - msg.ts < 15 * 60 * 1000;
    const staffRoles = new Set(["GOD", "STAFF", "ADMIN", "SUPPORT"]);
    const isGlobalStaff = staffRoles.has(String(me?.globalRole || ""));
    const isOwner = !!me && (ownerId === me.id || isGlobalStaff);
    const isMod = isOwner || (!!me && modIds.has(me.id));
    const targetIsOwnerOrStaff =
      msg.user.id === ownerId || staffRoles.has(String(msg.user.globalRole || ""));

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
      onPress: () => router.push(`/user/${msg.user.id}`),
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
        onPress: () => wsClient.send({ type: "chat:delete", roomId, msgId: msg.id }),
      });
    }
    if (!mine && me) {
      actions.push({
        label: "Report message",
        icon: "⚠️",
        destructive: true,
        onPress: () => setReportTarget({ type: "MESSAGE", id: msg.id }),
      });
      actions.push({
        label: "Block user",
        icon: "🚫",
        destructive: true,
        onPress: () =>
          Alert.alert(
            `Block ${msg.user.name}?`,
            "They won't be able to DM you and you won't see their messages.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Block",
                style: "destructive",
                onPress: () =>
                  api(`/users/${msg.user.id}/block`, { method: "POST" })
                    .then(() => Alert.alert("Blocked", `${msg.user.name} blocked.`))
                    .catch((e: any) =>
                      Alert.alert("Couldn't block", e?.message || "Unknown error"),
                    ),
              },
            ],
          ),
      });
    }
    if (!mine && isMod && !targetIsOwnerOrStaff) {
      actions.push({
        label: "Mute (5 min)",
        icon: "🔇",
        destructive: true,
        onPress: () =>
          wsClient.send({ type: "mod:mute", roomId, targetId: msg.user.id, duration: 300 }),
      });
      actions.push({
        label: "Kick",
        icon: "👢",
        destructive: true,
        onPress: () =>
          Alert.alert(`Kick ${msg.user.name}?`, "They'll be removed from this room.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Kick",
              style: "destructive",
              onPress: () => wsClient.send({ type: "mod:kick", roomId, targetId: msg.user.id }),
            },
          ]),
      });
      actions.push({
        label: "Ban from room",
        icon: "⛔",
        destructive: true,
        onPress: () =>
          Alert.alert(`Ban ${msg.user.name}?`, "They won't be able to rejoin.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Ban",
              style: "destructive",
              onPress: () => wsClient.send({ type: "mod:ban", roomId, targetId: msg.user.id }),
            },
          ]),
      });
    }

    sheet.open({
      title: msg.user.name,
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

  const onlineCount = useMemo(() => users.filter((u) => !u.isAway).length, [users]);

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen
        options={{
          title: roomName,
          headerRight: () => (
            <View className="flex-row items-center mr-2">
              <RoomNpcsButton roomId={roomId} />
              <Pressable
                onPress={() =>
                  Share.share({
                    url: `${WEB_BASE}/room/${roomId}`,
                    message: `Join ${roomName} on Weered — ${WEB_BASE}/room/${roomId}`,
                  }).catch(() => {})
                }
                hitSlop={8}
                className="active:opacity-70"
              >
                <Text className="text-weered font-semibold">Share</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        {accessState === "password_required" ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-weered-text font-bold text-lg mb-2">🔒 Locked room</Text>
            <Text className="text-weered-muted text-sm text-center mb-6">
              Enter the room password to join.
            </Text>
            <TextInput
              value={passwordInput}
              onChangeText={setPasswordInput}
              placeholder="Password"
              placeholderTextColor="rgba(160,160,170,0.6)"
              secureTextEntry
              autoCapitalize="none"
              onSubmitEditing={submitPassword}
              returnKeyType="go"
              className="bg-panel border border-border text-weered-text px-3 py-3 rounded-lg w-full max-w-sm"
              style={{ fontSize: 16 }}
            />
            {passwordError && <Text className="text-red-400 text-xs mt-2">{passwordError}</Text>}
            <Pressable
              onPress={submitPassword}
              disabled={!passwordInput.trim()}
              className="bg-weered px-6 py-3 rounded-lg active:opacity-80 mt-4"
              style={{ opacity: !passwordInput.trim() ? 0.4 : 1 }}
            >
              <Text className="text-white font-bold">Enter</Text>
            </Pressable>
          </View>
        ) : accessState === "knock_queued" ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-weered-text font-bold text-lg mb-2">🚪 Knocking…</Text>
            <Text className="text-weered-muted text-sm text-center mb-4">
              Waiting for a moderator to let you in. You'll be auto-joined when admitted.
            </Text>
            <ActivityIndicator color="#5800E5" />
          </View>
        ) : (
          <>
            <PresenceStrip
              users={users}
              onlineCount={onlineCount}
              totalCount={users.length}
              onOpenRoster={() => setRosterOpen(true)}
            />
            <RosterModal
              visible={rosterOpen}
              users={users}
              onClose={() => setRosterOpen(false)}
              title={roomName}
            />

            {knockers.length > 0 && (
              <View className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/30">
                <Text className="text-amber-400 text-xs uppercase font-bold mb-1.5">
                  🚪 Knocking · {knockers.length}
                </Text>
                {knockers.map((k) => (
                  <View key={k.id} className="flex-row items-center py-1.5">
                    <Text className="text-weered-text text-sm flex-1">{k.name}</Text>
                    <Pressable
                      onPress={() => admitKnock(k.id)}
                      className="bg-weered px-3 py-1 rounded-md active:opacity-80 mr-2"
                    >
                      <Text className="text-white text-xs font-bold">Admit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => denyKnock(k.id)}
                      className="bg-panel border border-red-500/40 px-3 py-1 rounded-md active:opacity-70"
                    >
                      <Text className="text-red-400 text-xs font-bold">Deny</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {accessState === "joined" && (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item, index }) => {
              const prev = index > 0 ? messages[index - 1] : null;
              const sameAuthor =
                prev &&
                prev.user.id === item.user.id &&
                item.ts - prev.ts < 60_000 &&
                !item.replyTo;
              const mine = me?.id === item.user.id;
              return (
                <MessageRow
                  msg={item}
                  compact={!!sameAuthor}
                  mine={mine}
                  meId={me?.id || ""}
                  onLongPress={() => onLongPressMessage(item)}
                  onTapUser={() => router.push(`/user/${item.user.id}`)}
                  onToggleReaction={(emoji) => toggleReaction(item.id, emoji)}
                />
              );
            }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View className="px-8 py-16 items-center">
                {connected ? (
                  <Text className="text-weered-muted text-sm">Be the first to say something.</Text>
                ) : (
                  <ActivityIndicator color="#5800E5" />
                )}
              </View>
            }
          />
        )}

        {accessState === "joined" && replyTo && (
          <View className="px-3 py-2 border-t border-border/40 bg-panel/60 flex-row items-center">
            <Text className="text-weered text-xs font-bold mr-2">REPLY</Text>
            <View className="flex-1">
              <Text className="text-weered-text text-xs font-semibold">{replyTo.user.name}</Text>
              <Text className="text-weered-muted text-xs" numberOfLines={1}>
                {replyTo.body}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8} className="ml-2">
              <Text className="text-weered-muted text-xs">Cancel</Text>
            </Pressable>
          </View>
        )}

        {accessState === "joined" && editingId && (
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

        {accessState === "joined" && (
          <>
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
                  editingId ? "Edit message" : replyTo ? `Reply to ${replyTo.user.name}` : "Message"
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
                <Text className="text-white font-bold">{editingId ? "Save" : "Send"}</Text>
              </Pressable>
            </View>
            <GifPicker
              visible={gifOpen}
              onClose={() => setGifOpen(false)}
              onSelect={(url) => {
                setDraft((prev) => (prev ? prev.trimEnd() + " " : "") + url);
              }}
            />
          </>
        )}
      </KeyboardAvoidingView>
      <ReportModal
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.type || "MESSAGE"}
        targetId={reportTarget?.id || ""}
        context={`room:${roomId}`}
      />
    </SafeAreaView>
  );
}

function PresenceStrip({
  users,
  onlineCount,
  totalCount,
  onOpenRoster,
}: {
  users: User[];
  onlineCount: number;
  totalCount: number;
  onOpenRoster: () => void;
}) {
  if (totalCount === 0) return null;
  const preview = users.slice(0, 6);
  return (
    <Pressable
      onPress={onOpenRoster}
      className="flex-row items-center px-3 py-2 border-b border-border/40 bg-weered-bg active:bg-panel/40"
    >
      <Text className="text-weered-muted text-xs mr-3">
        <Text className="text-green-400">●</Text> {onlineCount} online
      </Text>
      <View className="flex-row -space-x-2">
        {preview.map((u) => (
          <Avatar key={u.id} name={u.name} url={u.avatar} size={24} away={u.isAway} />
        ))}
      </View>
      {totalCount > preview.length && (
        <Text className="text-weered-muted text-xs ml-2">+{totalCount - preview.length}</Text>
      )}
      <Text className="text-weered text-xs ml-auto font-semibold">View all</Text>
    </Pressable>
  );
}

function MessageRow({
  msg,
  compact,
  mine,
  meId,
  onLongPress,
  onTapUser,
  onToggleReaction,
}: {
  msg: ChatMsg;
  compact: boolean;
  mine: boolean;
  meId: string;
  onLongPress: () => void;
  onTapUser: () => void;
  onToggleReaction: (emoji: string) => void;
}) {
  const deleted = !!msg.deletedAt;
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      className={`px-3 ${compact ? "pt-0.5" : "pt-2.5"} pb-0.5 flex-row active:bg-panel/40`}
    >
      <View style={{ width: 32, marginRight: 8, alignItems: "center" }}>
        {!compact && (
          <Pressable onPress={onTapUser} hitSlop={4}>
            <Avatar name={msg.user.name} url={msg.user.avatar} size={32} />
          </Pressable>
        )}
      </View>
      <View style={{ flex: 1 }}>
        {!compact && (
          <View className="flex-row items-baseline">
            <Pressable onPress={onTapUser} hitSlop={4}>
              <Text className={`font-bold text-sm ${mine ? "text-weered" : "text-weered-text"}`}>
                {msg.user.name}
              </Text>
            </Pressable>
            <Text className="text-weered-muted text-xs ml-2">{formatTime(msg.ts)}</Text>
            {msg.editedAt && <Text className="text-weered-muted text-xs ml-1.5">(edited)</Text>}
          </View>
        )}

        {msg.replyTo && (
          <View
            className="mt-1 mb-1 pl-2 py-1"
            style={{ borderLeftWidth: 2, borderLeftColor: "#5800E5" }}
          >
            <Text className="text-weered text-xs font-semibold">{msg.replyTo.userName}</Text>
            <Text className="text-weered-muted text-xs" numberOfLines={1}>
              {msg.replyTo.body}
            </Text>
          </View>
        )}

        {deleted ? (
          <Text className="text-sm text-weered-muted italic">[deleted]</Text>
        ) : (
          <RichText body={msg.body} style={{ color: "#f0f0f5", fontSize: 14 }} />
        )}

        {!deleted && msg.reactions && msg.reactions.length > 0 && (
          <View className="flex-row flex-wrap mt-1">
            {msg.reactions.map((r) => {
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
      </View>
    </Pressable>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}
