import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LobbyLogo } from "@/components/LobbyLogo";

type Tab = "settings" | "members" | "requests" | "rooms" | "audit";

type AdminLobby = {
  id: string;
  name: string;
  description: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  websiteUrl: string | null;
  keywords: string[];
  verified: boolean;
  pinned: boolean;
  moduleType: string | null;
  enabledModules: string[];
  joinMode: string;
  joinPassword: string | null;
  roleNames: Record<string, string>;
};
type Member = { id: string; userId: string; name: string; role: string; roleLevel: number };
type Room = {
  id: string;
  name: string;
  locked: boolean;
  ownerId: string;
  onlineCount: number;
  memberCount: number;
};
type Audit = {
  id: string;
  type: string;
  actorName: string;
  targetId?: string;
  note?: string;
  ts: string;
  detail?: string;
};
type Ban = { id: string; userId: string; reason: string | null; createdAt: string };
type AdminResp = {
  ok: boolean;
  lobby: AdminLobby;
  members: Member[];
  rooms: Room[];
  audit: Audit[];
  bans: Ban[];
  myLevel: number;
  overrideRole: boolean;
  perms: string[];
};

export default function LobbyAdmin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lobbyId = String(id || "");
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("settings");

  const q = useQuery({
    queryKey: ["lobby-admin", lobbyId],
    queryFn: () => api<AdminResp>(`/lobbies/${lobbyId}/admin`),
    enabled: !!lobbyId,
  });

  const requestsQ = useQuery({
    queryKey: ["lobby-admin-requests", lobbyId],
    queryFn: () =>
      api<{
        ok: boolean;
        requests: {
          id: string;
          userId: string;
          userName: string;
          createdAt: string;
          note?: string;
        }[];
      }>(`/lobbies/${lobbyId}/admin/join-requests`),
    enabled: !!lobbyId && tab === "requests",
  });

  const refresh = () => {
    q.refetch();
    if (tab === "requests") requestsQ.refetch();
  };

  if (q.isLoading) {
    return (
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg items-center justify-center">
        <Stack.Screen options={{ title: "Admin" }} />
        <ActivityIndicator color="#5800E5" />
      </SafeAreaView>
    );
  }
  if (q.error || !q.data?.ok) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        className="flex-1 bg-weered-bg items-center justify-center px-8"
      >
        <Stack.Screen options={{ title: "Admin" }} />
        <Text className="text-red-400 text-sm text-center">
          You don't have access to this lobby's admin panel.
        </Text>
      </SafeAreaView>
    );
  }

  const data = q.data;
  const perms = new Set(data.perms || []);
  const myLevel = data.myLevel;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: data.lobby.name }} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-b border-border/40"
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        <TabBtn label="Settings" active={tab === "settings"} onPress={() => setTab("settings")} />
        <TabBtn
          label={`Members (${data.members.length})`}
          active={tab === "members"}
          onPress={() => setTab("members")}
        />
        <TabBtn label="Requests" active={tab === "requests"} onPress={() => setTab("requests")} />
        <TabBtn
          label={`Rooms (${data.rooms.length})`}
          active={tab === "rooms"}
          onPress={() => setTab("rooms")}
        />
        <TabBtn label="Audit" active={tab === "audit"} onPress={() => setTab("audit")} />
      </ScrollView>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={refresh} tintColor="#5800E5" />
        }
      >
        {tab === "settings" && (
          <SettingsTab
            lobby={data.lobby}
            canEdit={perms.has("edit_branding")}
            onSaved={() => qc.invalidateQueries({ queryKey: ["lobby-admin", lobbyId] })}
            lobbyId={lobbyId}
          />
        )}
        {tab === "members" && (
          <MembersTab
            lobbyId={lobbyId}
            members={data.members}
            myLevel={myLevel}
            roleNames={data.lobby.roleNames || {}}
            canKick={perms.has("kick")}
            canBan={perms.has("ban")}
            canManageRoles={perms.has("manage_roles")}
          />
        )}
        {tab === "requests" && (
          <RequestsTab
            lobbyId={lobbyId}
            requests={requestsQ.data?.requests ?? []}
            isLoading={requestsQ.isLoading}
          />
        )}
        {tab === "rooms" && (
          <RoomsTab
            lobbyId={lobbyId}
            rooms={data.rooms}
            canPin={perms.has("pin_rooms")}
            canDelete={perms.has("manage_rooms")}
          />
        )}
        {tab === "audit" && (
          <AuditTab
            audit={data.audit}
            bans={data.bans}
            lobbyId={lobbyId}
            canUnban={perms.has("ban")}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="px-3 py-3 active:opacity-70">
      <Text
        className={`text-xs uppercase tracking-wide font-bold ${active ? "text-weered" : "text-weered-muted"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1.5">{label}</Text>
      {children}
    </View>
  );
}

function SettingsTab({
  lobby,
  canEdit,
  onSaved,
  lobbyId,
}: {
  lobby: AdminLobby;
  canEdit: boolean;
  onSaved: () => void;
  lobbyId: string;
}) {
  const [name, setName] = useState(lobby.name);
  const [description, setDescription] = useState(lobby.description || "");
  const [accentColor, setAccentColor] = useState(lobby.accentColor || "");
  const [logoUrl, setLogoUrl] = useState(lobby.logoUrl || "");
  const [bannerUrl, setBannerUrl] = useState(lobby.bannerUrl || "");
  const [websiteUrl, setWebsiteUrl] = useState(lobby.websiteUrl || "");
  const [keywords, setKeywords] = useState((lobby.keywords || []).join(", "));
  const [joinMode, setJoinMode] = useState(lobby.joinMode || "OPEN");
  const [joinPassword, setJoinPassword] = useState(lobby.joinPassword || "");

  const branding = useMutation({
    mutationFn: () =>
      api(`/lobbies/${lobbyId}/admin/branding`, {
        method: "PATCH",
        body: {
          name,
          description,
          accentColor,
          logoUrl,
          bannerUrl,
          websiteUrl,
          keywords: keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      Alert.alert("Saved", "Branding updated.");
      onSaved();
    },
    onError: (e: any) => Alert.alert("Couldn't save", e?.message || "Unknown error"),
  });

  const joinModeMut = useMutation({
    mutationFn: () =>
      api(`/lobbies/${lobbyId}/admin/join-mode`, {
        method: "PATCH",
        body: { joinMode, password: joinPassword },
      }),
    onSuccess: () => {
      Alert.alert("Saved", "Join mode updated.");
      onSaved();
    },
    onError: (e: any) => Alert.alert("Couldn't save", e?.message || "Unknown error"),
  });

  return (
    <View className="px-4 py-5">
      <View className="flex-row items-center mb-5">
        <LobbyLogo name={lobby.name} url={lobby.logoUrl} accent={lobby.accentColor} size={48} />
        <View className="flex-1 ml-3">
          <Text className="text-weered-text font-bold text-base">{lobby.name}</Text>
          <Text className="text-weered-muted text-xs mt-0.5">
            {lobby.verified ? "✓ Verified · " : ""}
            {lobby.moduleType && lobby.moduleType !== "NONE" ? lobby.moduleType : "No module"}
          </Text>
        </View>
      </View>

      <Text className="text-weered-muted text-xs uppercase tracking-wide mb-2">Branding</Text>

      <Field label="Name">
        <Input value={name} onChangeText={setName} editable={canEdit} />
      </Field>
      <Field label="Description">
        <Input value={description} onChangeText={setDescription} editable={canEdit} multiline />
      </Field>
      <Field label="Accent color (hex)">
        <Input
          value={accentColor}
          onChangeText={setAccentColor}
          editable={canEdit}
          placeholder="#5800E5"
        />
      </Field>
      <Field label="Logo URL">
        <Input value={logoUrl} onChangeText={setLogoUrl} editable={canEdit} autoCapitalize="none" />
      </Field>
      <Field label="Banner URL">
        <Input
          value={bannerUrl}
          onChangeText={setBannerUrl}
          editable={canEdit}
          autoCapitalize="none"
        />
      </Field>
      <Field label="Website URL">
        <Input
          value={websiteUrl}
          onChangeText={setWebsiteUrl}
          editable={canEdit}
          autoCapitalize="none"
        />
      </Field>
      <Field label="Keywords (comma separated)">
        <Input
          value={keywords}
          onChangeText={setKeywords}
          editable={canEdit}
          autoCapitalize="none"
        />
      </Field>

      {canEdit && (
        <Pressable
          onPress={() => branding.mutate()}
          disabled={branding.isPending}
          className="bg-weered px-4 py-3 rounded-lg active:opacity-80 mb-6"
        >
          <Text className="text-white text-center font-bold">
            {branding.isPending ? "Saving…" : "Save branding"}
          </Text>
        </Pressable>
      )}

      <Text className="text-weered-muted text-xs uppercase tracking-wide mb-2 mt-2">Join mode</Text>
      <View className="flex-row flex-wrap mb-3">
        {["OPEN", "APPROVAL", "PASSWORD"].map((m) => (
          <Pressable
            key={m}
            disabled={!canEdit}
            onPress={() => setJoinMode(m)}
            className={`mr-2 mb-2 px-3 py-2 rounded-lg border ${joinMode === m ? "bg-weered border-weered" : "bg-panel border-border"}`}
          >
            <Text
              className={`text-xs font-bold ${joinMode === m ? "text-white" : "text-weered-muted"}`}
            >
              {m}
            </Text>
          </Pressable>
        ))}
      </View>
      {joinMode === "PASSWORD" && (
        <Field label="Password">
          <Input
            value={joinPassword}
            onChangeText={setJoinPassword}
            editable={canEdit}
            autoCapitalize="none"
          />
        </Field>
      )}
      {canEdit && (
        <Pressable
          onPress={() => joinModeMut.mutate()}
          disabled={joinModeMut.isPending}
          className="bg-panel border border-border px-4 py-3 rounded-lg active:opacity-80 mb-10"
        >
          <Text className="text-weered-text text-center font-bold">
            {joinModeMut.isPending ? "Saving…" : "Save join mode"}
          </Text>
        </Pressable>
      )}
    </View>
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
        props.multiline ? { minHeight: 70, textAlignVertical: "top" } : null,
      ]}
    />
  );
}

function MembersTab({
  lobbyId,
  members,
  myLevel,
  roleNames,
  canKick,
  canBan,
  canManageRoles,
}: {
  lobbyId: string;
  members: Member[];
  myLevel: number;
  roleNames: Record<string, string>;
  canKick: boolean;
  canBan: boolean;
  canManageRoles: boolean;
}) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["lobby-admin", lobbyId] });

  const kick = useMutation({
    mutationFn: (userId: string) =>
      api(`/lobbies/${lobbyId}/admin/members/${userId}/kick`, { method: "POST" }),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert("Kick failed", e?.message || "Unknown error"),
  });
  const ban = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      api(`/lobbies/${lobbyId}/admin/members/${userId}/ban`, {
        method: "POST",
        body: { reason: reason || "" },
      }),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert("Ban failed", e?.message || "Unknown error"),
  });
  const setRole = useMutation({
    mutationFn: ({ userId, roleLevel }: { userId: string; roleLevel: number }) =>
      api(`/lobbies/${lobbyId}/admin/members/${userId}/role`, {
        method: "POST",
        body: { roleLevel },
      }),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert("Role change failed", e?.message || "Unknown error"),
  });

  return (
    <View className="py-2">
      {members.length === 0 && (
        <Text className="text-weered-muted text-sm text-center py-8">No members.</Text>
      )}
      {members.map((m) => {
        const canActOn = m.roleLevel < myLevel;
        const roleLabel = roleNames[String(m.roleLevel)] || m.role;
        return (
          <View key={m.id} className="px-4 py-3 border-b border-border/30">
            <Pressable
              onPress={() => router.push(`/user/${m.userId}`)}
              className="flex-row items-center active:opacity-70"
            >
              <View className="flex-1">
                <Text className="text-weered-text font-semibold">{m.name}</Text>
                <Text className="text-weered-muted text-xs mt-0.5">
                  {roleLabel} · level {m.roleLevel}
                </Text>
              </View>
            </Pressable>
            {canActOn && (canKick || canBan || canManageRoles) && (
              <View className="flex-row flex-wrap mt-2">
                {canManageRoles && m.roleLevel < myLevel - 1 && (
                  <Pressable
                    onPress={() => setRole.mutate({ userId: m.userId, roleLevel: m.roleLevel + 1 })}
                    className="mr-2 mb-2 bg-panel border border-border px-3 py-1.5 rounded-lg active:opacity-70"
                  >
                    <Text className="text-weered-text text-xs font-bold">Promote</Text>
                  </Pressable>
                )}
                {canManageRoles && m.roleLevel > 1 && (
                  <Pressable
                    onPress={() => setRole.mutate({ userId: m.userId, roleLevel: m.roleLevel - 1 })}
                    className="mr-2 mb-2 bg-panel border border-border px-3 py-1.5 rounded-lg active:opacity-70"
                  >
                    <Text className="text-weered-text text-xs font-bold">Demote</Text>
                  </Pressable>
                )}
                {canKick && (
                  <Pressable
                    onPress={() =>
                      Alert.alert("Kick?", `Remove ${m.name}?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Kick",
                          style: "destructive",
                          onPress: () => kick.mutate(m.userId),
                        },
                      ])
                    }
                    className="mr-2 mb-2 bg-panel border border-amber-500/40 px-3 py-1.5 rounded-lg active:opacity-70"
                  >
                    <Text className="text-amber-400 text-xs font-bold">Kick</Text>
                  </Pressable>
                )}
                {canBan && (
                  <Pressable
                    onPress={() =>
                      Alert.alert("Ban?", `Ban ${m.name}?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Ban",
                          style: "destructive",
                          onPress: () => ban.mutate({ userId: m.userId }),
                        },
                      ])
                    }
                    className="mr-2 mb-2 bg-panel border border-red-500/40 px-3 py-1.5 rounded-lg active:opacity-70"
                  >
                    <Text className="text-red-400 text-xs font-bold">Ban</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function RequestsTab({
  lobbyId,
  requests,
  isLoading,
}: {
  lobbyId: string;
  requests: { id: string; userId: string; userName: string; createdAt: string; note?: string }[];
  isLoading: boolean;
}) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lobby-admin-requests", lobbyId] });
    qc.invalidateQueries({ queryKey: ["lobby-admin", lobbyId] });
  };
  const approve = useMutation({
    mutationFn: (reqId: string) =>
      api(`/lobbies/${lobbyId}/admin/join-requests/${reqId}/approve`, { method: "POST" }),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert("Failed", e?.message || "Unknown error"),
  });
  const deny = useMutation({
    mutationFn: ({ reqId, reason }: { reqId: string; reason?: string }) =>
      api(`/lobbies/${lobbyId}/admin/join-requests/${reqId}/deny`, {
        method: "POST",
        body: { reason: reason || "" },
      }),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert("Failed", e?.message || "Unknown error"),
  });

  if (isLoading)
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color="#5800E5" />
      </View>
    );
  if (requests.length === 0) {
    return (
      <Text className="text-weered-muted text-sm text-center py-12">No pending requests.</Text>
    );
  }
  return (
    <View className="py-2">
      {requests.map((r) => (
        <View key={r.id} className="px-4 py-3 border-b border-border/30">
          <Text className="text-weered-text font-semibold">{r.userName}</Text>
          {!!r.note && (
            <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={2}>
              {r.note}
            </Text>
          )}
          <Text className="text-weered-muted text-xs mt-0.5">
            {new Date(r.createdAt).toLocaleString()}
          </Text>
          <View className="flex-row mt-2">
            <Pressable
              onPress={() => approve.mutate(r.id)}
              className="mr-2 bg-weered px-3 py-1.5 rounded-lg active:opacity-80"
            >
              <Text className="text-white text-xs font-bold">Approve</Text>
            </Pressable>
            <Pressable
              onPress={() => deny.mutate({ reqId: r.id })}
              className="bg-panel border border-red-500/40 px-3 py-1.5 rounded-lg active:opacity-70"
            >
              <Text className="text-red-400 text-xs font-bold">Deny</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function RoomsTab({
  lobbyId,
  rooms,
  canPin,
  canDelete,
}: {
  lobbyId: string;
  rooms: Room[];
  canPin: boolean;
  canDelete: boolean;
}) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lobby-admin", lobbyId] });
    qc.invalidateQueries({ queryKey: ["lobby-rooms", lobbyId] });
  };
  const pin = useMutation({
    mutationFn: ({ roomId, pinned }: { roomId: string; pinned: boolean }) =>
      api(`/lobbies/${lobbyId}/admin/rooms/${roomId}/pin`, { method: "POST", body: { pinned } }),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert("Failed", e?.message || "Unknown error"),
  });
  const del = useMutation({
    mutationFn: (roomId: string) =>
      api(`/lobbies/${lobbyId}/admin/rooms/${roomId}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert("Failed", e?.message || "Unknown error"),
  });

  if (rooms.length === 0) {
    return <Text className="text-weered-muted text-sm text-center py-12">No rooms yet.</Text>;
  }
  return (
    <View className="py-2">
      {rooms.map((r) => (
        <View key={r.id} className="px-4 py-3 border-b border-border/30">
          <Pressable onPress={() => router.push(`/room/${r.id}`)} className="active:opacity-70">
            <Text className="text-weered-text font-semibold" numberOfLines={1}>
              {r.locked ? "🔒 " : ""}
              {r.name || r.id}
            </Text>
            <Text className="text-weered-muted text-xs mt-0.5">
              {r.onlineCount} online · {r.memberCount} members
            </Text>
          </Pressable>
          {(canPin || canDelete) && (
            <View className="flex-row mt-2">
              {canPin && (
                <Pressable
                  onPress={() => pin.mutate({ roomId: r.id, pinned: true })}
                  className="mr-2 bg-panel border border-border px-3 py-1.5 rounded-lg active:opacity-70"
                >
                  <Text className="text-weered-text text-xs font-bold">Pin</Text>
                </Pressable>
              )}
              {canDelete && (
                <Pressable
                  onPress={() =>
                    Alert.alert("Delete room?", `Delete "${r.name}"? This can't be undone.`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => del.mutate(r.id) },
                    ])
                  }
                  className="bg-panel border border-red-500/40 px-3 py-1.5 rounded-lg active:opacity-70"
                >
                  <Text className="text-red-400 text-xs font-bold">Delete</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function AuditTab({
  audit,
  bans,
  lobbyId,
  canUnban,
}: {
  audit: Audit[];
  bans: Ban[];
  lobbyId: string;
  canUnban: boolean;
}) {
  const qc = useQueryClient();
  const unban = useMutation({
    mutationFn: (userId: string) =>
      api(`/lobbies/${lobbyId}/admin/members/${userId}/ban`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lobby-admin", lobbyId] }),
    onError: (e: any) => Alert.alert("Failed", e?.message || "Unknown error"),
  });

  return (
    <View>
      {bans.length > 0 && (
        <View className="py-2">
          <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-2 pb-1">
            Banned ({bans.length})
          </Text>
          {bans.map((b) => (
            <View key={b.id} className="px-4 py-3 border-b border-border/30 flex-row items-center">
              <View className="flex-1">
                <Text className="text-weered-text font-semibold">{b.userId}</Text>
                {!!b.reason && <Text className="text-weered-muted text-xs mt-0.5">{b.reason}</Text>}
              </View>
              {canUnban && (
                <Pressable
                  onPress={() => unban.mutate(b.userId)}
                  className="bg-panel border border-border px-3 py-1.5 rounded-lg active:opacity-70"
                >
                  <Text className="text-weered-text text-xs font-bold">Unban</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-3 pb-1">
        Recent audit log
      </Text>
      {audit.length === 0 && (
        <Text className="text-weered-muted text-sm text-center py-8">No audit entries.</Text>
      )}
      {audit.map((a) => (
        <View key={a.id} className="px-4 py-2.5 border-b border-border/30">
          <Text className="text-weered-text text-sm">
            <Text className="font-semibold">{a.actorName}</Text>{" "}
            <Text className="text-weered-muted">{a.type.replace(/_/g, " ")}</Text>
            {a.note ? <Text className="text-weered-muted"> — {a.note}</Text> : null}
            {a.detail ? <Text className="text-weered-muted"> — {a.detail}</Text> : null}
          </Text>
          <Text className="text-weered-muted text-xs mt-0.5">
            {new Date(a.ts).toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );
}
