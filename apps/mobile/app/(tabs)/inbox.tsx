import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { FONT } from "@/components/Brand";

type DmPreview = {
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  lastMessage: string;
  lastTs: string;
  unread: boolean;
  isFromMe: boolean;
};

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  actorId: string | null;
  actorName: string | null;
  actorAvatar?: string | null;
  read: boolean;
  createdAt: string;
};

type DmPreviewsResp = { ok: boolean; previews: DmPreview[] };
type NotificationsResp = { ok: boolean; notifications: Notification[]; unreadCount: number };

type Mode = "dms" | "alerts" | "groups";

export default function Inbox() {
  const [mode, setMode] = useState<Mode>("dms");

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: "#0c0b0a" }}>
      <SegmentedTabs mode={mode} onChange={setMode} />
      {mode === "dms" ? <DmsList /> : mode === "alerts" ? <AlertsList /> : <GroupsList />}
    </SafeAreaView>
  );
}

function SegmentedTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const dmsQ = useQuery({
    queryKey: ["dm-unread"],
    queryFn: () => api<{ counts: Record<string, number> }>("/dm/unread"),
    refetchInterval: 60_000,
  });
  const notifQ = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => api<{ ok: boolean; count: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
  });
  const groupsQ = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<{ ok: boolean; threads: { unread: number }[] }>("/groups"),
    refetchInterval: 60_000,
  });
  const dmCount = Object.values(dmsQ.data?.counts ?? {}).reduce((a, b) => a + b, 0);
  const alertCount = notifQ.data?.count ?? 0;
  const groupCount = (groupsQ.data?.threads ?? []).reduce((a, t) => a + (t.unread || 0), 0);

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "#000",
        borderBottomWidth: 1.5,
        borderBottomColor: "rgba(245,183,0,0.3)",
        paddingHorizontal: 4,
      }}
    >
      <SegmentBtn
        label="Messages"
        active={mode === "dms"}
        badge={dmCount}
        onPress={() => onChange("dms")}
      />
      <SegmentBtn
        label="Groups"
        active={mode === "groups"}
        badge={groupCount}
        onPress={() => onChange("groups")}
      />
      <SegmentBtn
        label="Alerts"
        active={mode === "alerts"}
        badge={alertCount}
        onPress={() => onChange("alerts")}
      />
    </View>
  );
}

function SegmentBtn({
  label,
  active,
  badge,
  onPress,
}: {
  label: string;
  active: boolean;
  badge: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: 2,
        borderBottomColor: active ? "#5800E5" : "transparent",
        position: "relative",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text
          style={{
            color: active ? "#ffffff" : "rgba(180,180,190,0.6)",
            fontFamily: FONT.uiBold,
            fontSize: 13,
            letterSpacing: 1.6,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        {badge > 0 && (
          <View
            style={{
              minWidth: 20,
              height: 18,
              paddingHorizontal: 5,
              borderRadius: 9,
              backgroundColor: "#ef4444",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontFamily: FONT.uiBold, fontSize: 10 }}>
              {badge > 99 ? "99+" : badge}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function DmsList() {
  const q = useQuery({
    queryKey: ["dm-previews"],
    queryFn: () => api<DmPreviewsResp>("/dm/previews"),
    refetchInterval: 30_000,
  });

  const onRefresh = useCallback(() => q.refetch(), [q]);

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#5800E5" />
      </View>
    );
  }
  if (q.error) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}
      >
        <Text style={{ color: "#ef4444", fontSize: 14, textAlign: "center" }}>
          Couldn't load conversations.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={q.data?.previews ?? []}
      keyExtractor={(p) => p.peerId}
      refreshControl={
        <RefreshControl refreshing={q.isRefetching} onRefresh={onRefresh} tintColor="#5800E5" />
      }
      ItemSeparatorComponent={() => (
        <View
          style={{ height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginHorizontal: 16 }}
        />
      )}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/dm/${item.peerId}`)}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: item.unread ? "rgba(88,0,229,0.06)" : "transparent",
          }}
        >
          <View style={{ marginRight: 12 }}>
            <Avatar name={item.peerName} url={item.peerAvatar} size={44} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  flex: 1,
                  color: "rgba(243,244,246,0.96)",
                  fontFamily: FONT.uiBold,
                  fontSize: 15,
                }}
                numberOfLines={1}
              >
                {item.peerName}
              </Text>
              <Text
                style={{
                  color: "rgba(180,180,190,0.55)",
                  fontFamily: FONT.numericReg,
                  fontSize: 12,
                  marginLeft: 8,
                }}
              >
                {formatRelative(item.lastTs)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
              <Text
                style={{
                  flex: 1,
                  color: item.unread ? "rgba(243,244,246,0.94)" : "rgba(180,180,190,0.65)",
                  fontFamily: item.unread ? FONT.uiMed : FONT.uiReg,
                  fontSize: 13,
                }}
                numberOfLines={1}
              >
                {item.isFromMe ? "You: " : ""}
                {item.lastMessage}
              </Text>
              {item.unread && (
                <View
                  style={{
                    marginLeft: 8,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#5800E5",
                  }}
                />
              )}
            </View>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: 32, paddingTop: 80, alignItems: "center" }}>
          <Text
            style={{
              color: "rgba(180,180,190,0.55)",
              fontFamily: FONT.uiBold,
              fontSize: 13,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            No conversations yet
          </Text>
          <Text
            style={{
              color: "rgba(180,180,190,0.4)",
              fontFamily: FONT.uiReg,
              fontSize: 12,
              marginTop: 10,
              textAlign: "center",
              lineHeight: 18,
            }}
          >
            Tap Message on a friend's profile to start one.
          </Text>
        </View>
      }
    />
  );
}

function AlertsList() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<NotificationsResp>("/notifications?limit=50"),
  });

  const markAll = useMutation({
    mutationFn: () => api("/notifications/read", { method: "PATCH", body: { all: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      api("/notifications/read", { method: "PATCH", body: { ids: [id] } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const onRefresh = useCallback(() => q.refetch(), [q]);
  const unreadCount = q.data?.unreadCount ?? 0;

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#5800E5" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {unreadCount > 0 && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, alignItems: "flex-end" }}>
          <Pressable onPress={() => markAll.mutate()} hitSlop={8}>
            <Text
              style={{
                color: "#a78bfa",
                fontFamily: FONT.uiBold,
                fontSize: 11,
                letterSpacing: 1.4,
                textTransform: "uppercase",
              }}
            >
              Mark all read
            </Text>
          </Pressable>
        </View>
      )}
      <FlatList
        data={q.data?.notifications ?? []}
        keyExtractor={(n) => n.id}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={onRefresh} tintColor="#5800E5" />
        }
        ItemSeparatorComponent={() => (
          <View
            style={{ height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginHorizontal: 16 }}
          />
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              if (!item.read) markRead.mutate(item.id);
              if (item.actionUrl) {
                const path = item.actionUrl.startsWith("http")
                  ? new URL(item.actionUrl).pathname
                  : item.actionUrl;
                router.push(path as any);
              }
            }}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: item.read ? "transparent" : "rgba(88,0,229,0.06)",
            }}
          >
            <View style={{ marginRight: 12, marginTop: 2 }}>
              <Avatar name={item.actorName || item.title || "?"} url={item.actorAvatar} size={36} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {!item.read && (
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: "#5800E5",
                      marginRight: 6,
                    }}
                  />
                )}
                <Text
                  style={{
                    flex: 1,
                    color: "rgba(243,244,246,0.96)",
                    fontFamily: FONT.uiMed,
                    fontSize: 14,
                  }}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
              </View>
              {!!item.body && (
                <Text
                  style={{
                    color: "rgba(180,180,190,0.65)",
                    fontFamily: FONT.uiReg,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                  numberOfLines={2}
                >
                  {item.body}
                </Text>
              )}
              <Text
                style={{
                  color: "rgba(180,180,190,0.45)",
                  fontFamily: FONT.numericReg,
                  fontSize: 11,
                  marginTop: 4,
                }}
              >
                {formatRelative(item.createdAt)}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 32, paddingTop: 80, alignItems: "center" }}>
            <Text
              style={{
                color: "rgba(180,180,190,0.55)",
                fontFamily: FONT.uiBold,
                fontSize: 13,
                letterSpacing: 1.4,
                textTransform: "uppercase",
              }}
            >
              All quiet
            </Text>
          </View>
        }
      />
    </View>
  );
}

type GroupMember = { id: string; name: string; avatar?: string | null };
type GroupLastMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  deleted: boolean;
} | null;
type GroupThread = {
  id: string;
  name: string | null;
  lastMessageAt: string;
  unread: number;
  members: GroupMember[];
  lastMessage: GroupLastMessage;
};
type GroupThreadsResp = { ok: boolean; threads: GroupThread[] };

function GroupsList() {
  const q = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<GroupThreadsResp>("/groups"),
    refetchInterval: 30_000,
  });
  const onRefresh = useCallback(() => q.refetch(), [q]);

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#5800E5" />
      </View>
    );
  }
  if (q.error) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}
      >
        <Text style={{ color: "#ef4444", fontSize: 14, textAlign: "center" }}>
          Couldn't load groups.
        </Text>
      </View>
    );
  }
  return (
    <FlatList
      data={q.data?.threads ?? []}
      keyExtractor={(t) => t.id}
      refreshControl={
        <RefreshControl refreshing={q.isRefetching} onRefresh={onRefresh} tintColor="#5800E5" />
      }
      ItemSeparatorComponent={() => (
        <View
          style={{ height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginHorizontal: 16 }}
        />
      )}
      renderItem={({ item }) => {
        const title = item.name || otherMemberList(item.members);
        const preview = groupPreviewText(item.lastMessage, item.members);
        return (
          <Pressable
            onPress={() => router.push(`/group/${item.id}`)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: item.unread > 0 ? "rgba(88,0,229,0.06)" : "transparent",
            }}
          >
            <View style={{ marginRight: 12 }}>
              <GroupAvatarStack members={item.members} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={{
                    flex: 1,
                    color: "rgba(243,244,246,0.96)",
                    fontFamily: FONT.uiBold,
                    fontSize: 15,
                  }}
                  numberOfLines={1}
                >
                  {title}
                </Text>
                <Text
                  style={{
                    color: "rgba(180,180,190,0.55)",
                    fontFamily: FONT.numericReg,
                    fontSize: 12,
                    marginLeft: 8,
                  }}
                >
                  {formatRelative(item.lastMessageAt)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                <Text
                  style={{
                    flex: 1,
                    color: item.unread > 0 ? "rgba(243,244,246,0.94)" : "rgba(180,180,190,0.65)",
                    fontFamily: item.unread > 0 ? FONT.uiMed : FONT.uiReg,
                    fontSize: 13,
                  }}
                  numberOfLines={1}
                >
                  {preview}
                </Text>
                {item.unread > 0 && (
                  <View
                    style={{
                      marginLeft: 8,
                      minWidth: 18,
                      height: 18,
                      paddingHorizontal: 5,
                      borderRadius: 9,
                      backgroundColor: "#5800E5",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontFamily: FONT.uiBold, fontSize: 10 }}>
                      {item.unread > 99 ? "99+" : item.unread}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: 32, paddingTop: 80, alignItems: "center" }}>
          <Text
            style={{
              color: "rgba(180,180,190,0.55)",
              fontFamily: FONT.uiBold,
              fontSize: 13,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            No groups yet
          </Text>
          <Text
            style={{
              color: "rgba(180,180,190,0.4)",
              fontFamily: FONT.uiReg,
              fontSize: 12,
              marginTop: 10,
              textAlign: "center",
              lineHeight: 18,
            }}
          >
            Start one on web — mobile group creation coming next.
          </Text>
        </View>
      }
    />
  );
}

function otherMemberList(members: GroupMember[]): string {
  const names = members.map((m) => m.name);
  if (names.length === 0) return "Group";
  if (names.length <= 2) return names.join(" & ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

function groupPreviewText(last: GroupLastMessage, members: GroupMember[]): string {
  if (!last) return "No messages yet";
  if (last.deleted) return "Message deleted";
  const sender = members.find((m) => m.id === last.senderId)?.name || "?";
  return `${sender}: ${last.body}`;
}

function GroupAvatarStack({ members }: { members: GroupMember[] }) {
  if (members.length === 0) return <Avatar name="?" size={44} />;
  if (members.length === 1)
    return <Avatar name={members[0].name} url={members[0].avatar} size={44} />;
  return (
    <View style={{ width: 44, height: 44 }}>
      <View style={{ position: "absolute", top: 0, left: 0 }}>
        <Avatar name={members[0].name} url={members[0].avatar} size={30} />
      </View>
      <View style={{ position: "absolute", bottom: 0, right: 0 }}>
        <Avatar name={members[1].name} url={members[1].avatar} size={30} />
      </View>
    </View>
  );
}

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}
