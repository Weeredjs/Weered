import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { Avatar } from "@/components/Avatar";
import { ProfileBody, type Profile } from "@/components/ProfileBody";
import { BadgesSection } from "@/components/BadgesSection";
import { ReportModal } from "@/components/ReportModal";
import { RoleChip, TierChip } from "@/components/RoleIcon";

type FriendState = "none" | "pending_sent" | "pending_received" | "friends";

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = String(id || "");
  const me = useAuth((s) => s.user);
  const isMe = me?.id === userId;
  const qc = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);

  const profileQ = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => api<{ ok: boolean } & Profile>(`/profile/${userId}`),
    enabled: !!userId,
  });

  const friendsQ = useQuery({
    queryKey: ["friends"],
    queryFn: () => api<{ friends: { id: string }[] }>("/friends"),
    enabled: !isMe && !!me,
  });

  const requestsQ = useQuery({
    queryKey: ["friend-requests"],
    queryFn: () => api<{ requests: { id: string; fromId: string; toId?: string; status: string }[] }>("/friends/requests"),
    enabled: !isMe && !!me,
  });

  const friendState: FriendState = useMemo(() => {
    if (isMe) return "friends";
    if (friendsQ.data?.friends?.some((f) => f.id === userId)) return "friends";
    const pending = (requestsQ.data?.requests ?? []).find(
      (r) => r.status === "PENDING" && (r.fromId === userId || (r as any).toId === userId),
    );
    if (pending) return pending.fromId === userId ? "pending_received" : "pending_sent";
    return "none";
  }, [isMe, friendsQ.data, requestsQ.data, userId]);

  const sendRequest = useMutation({
    mutationFn: () => api(`/friends/request/${userId}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friend-requests"] }),
    onError: (e: any) => Alert.alert("Couldn't send request", e?.message || "Unknown error"),
  });

  const unfriend = useMutation({
    mutationFn: () => api(`/friends/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["friend-requests"] });
    },
    onError: (e: any) => Alert.alert("Couldn't unfriend", e?.message || "Unknown error"),
  });

  const blocksQ = useQuery({
    queryKey: ["blocks"],
    queryFn: () => api<{ blocks: { userId: string }[] }>("/blocks"),
    enabled: !isMe && !!me,
  });
  const isBlocked = !!blocksQ.data?.blocks?.some((b) => b.userId === userId);

  const block = useMutation({
    mutationFn: () => api(`/users/${userId}/block`, { method: "POST", body: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocks"] });
      qc.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (e: any) => Alert.alert("Couldn't block", e?.message || "Unknown error"),
  });
  const unblock = useMutation({
    mutationFn: () => api(`/users/${userId}/block`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocks"] }),
    onError: (e: any) => Alert.alert("Couldn't unblock", e?.message || "Unknown error"),
  });

  const profile = profileQ.data;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: profile?.name || "Profile" }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={profileQ.isRefetching} onRefresh={profileQ.refetch} tintColor="#5800E5" />
        }
      >
        {profileQ.isLoading ? (
          <View className="py-20 items-center">
            <ActivityIndicator color="#5800E5" />
          </View>
        ) : profile ? (
          <>
            <View className="items-center pt-6 pb-3">
              <Avatar name={profile.name} url={profile.avatar} size={96} />
              <Text className="text-weered-text text-2xl mt-3" style={{ fontFamily: "monospace", fontWeight: "900", letterSpacing: 0.5 }}>{profile.name}</Text>
              <View className="flex-row items-center mt-2" style={{ gap: 6 }}>
                {profile.globalRole && profile.globalRole !== "USER" && <RoleChip role={profile.globalRole} />}
                {profile.tier && profile.tier !== "INNOCENT" && <TierChip tier={profile.tier} />}
              </View>
            </View>

            {!!profile.bio && (
              <View className="px-6 pt-2 pb-1 items-center">
                <Text className="text-weered-text text-sm text-center">{profile.bio}</Text>
              </View>
            )}

            {!isMe && me && isBlocked && (
              <View className="px-4 pt-4">
                <Pressable
                  onPress={() => unblock.mutate()}
                  disabled={unblock.isPending}
                  className="bg-panel border border-red-500/40 px-4 py-3 rounded-xl active:opacity-80"
                >
                  <Text className="text-red-400 font-semibold text-center">Blocked · tap to unblock</Text>
                </Pressable>
              </View>
            )}
            {!isMe && me && !isBlocked && (
              <View className="px-4 pt-4 flex-row">
                <View className="flex-1 mr-2">
                  <FriendButton
                    state={friendState}
                    onSend={() => sendRequest.mutate()}
                    onUnfriend={() => Alert.alert("Unfriend?", `Remove ${profile.name} from your friends.`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Unfriend", style: "destructive", onPress: () => unfriend.mutate() },
                    ])}
                    pending={sendRequest.isPending || unfriend.isPending}
                  />
                </View>
                <Pressable
                  onPress={() => router.push(`/dm/${userId}`)}
                  className="bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80 items-center justify-center"
                  style={{ minWidth: 100 }}
                >
                  <Text className="text-weered-text font-bold text-center">Message</Text>
                </Pressable>
              </View>
            )}

            {!isMe && me && !isBlocked && (
              <View className="px-4 pt-2">
                <InviteToCrewButton targetUserId={userId} targetName={profile.name} />
                <View className="flex-row justify-center">
                  <Pressable
                    onPress={() => setReportOpen(true)}
                    hitSlop={6}
                    className="py-2 px-3 active:opacity-70"
                  >
                    <Text className="text-red-400 text-xs">Report user</Text>
                  </Pressable>
                  <Text className="text-weered-muted py-2">·</Text>
                  <Pressable
                    onPress={() => Alert.alert(
                      `Block ${profile.name}?`,
                      "They won't be able to DM you and you won't see their messages in rooms.",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Block", style: "destructive", onPress: () => block.mutate() },
                      ],
                    )}
                    hitSlop={6}
                    className="py-2 px-3 active:opacity-70"
                  >
                    <Text className="text-red-400 text-xs">Block user</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <ProfileBody profile={profile} />
            <BadgesSection userId={userId} />
          </>
        ) : (
          <View className="py-20 items-center px-8">
            <Text className="text-red-400 text-sm text-center">Couldn't load user.</Text>
          </View>
        )}
      </ScrollView>
      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="USER"
        targetId={userId}
      />
    </SafeAreaView>
  );
}

function InviteToCrewButton({ targetUserId, targetName }: { targetUserId: string; targetName: string }) {
  const [open, setOpen] = useState(false);
  const crewsQ = useQuery({
    queryKey: ["my-crews"],
    queryFn: () => api<{ crews: { id: string; name: string; tag: string; myRole: string; members: { userId: string }[] }[] }>("/crews/mine"),
    enabled: open,
  });
  const invite = useMutation({
    mutationFn: (crewId: string) => api(`/crews/${crewId}/invite/${targetUserId}`, { method: "POST" }),
    onSuccess: () => { setOpen(false); Alert.alert("Invited", `${targetName} added to crew.`); },
    onError: (e: any) => Alert.alert("Couldn't invite", e?.message || "Unknown error"),
  });

  const eligible = (crewsQ.data?.crews || []).filter(
    (c) => (c.myRole === "LEADER" || c.myRole === "OFFICER") && !c.members.some((m) => m.userId === targetUserId)
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80 mb-2"
      >
        <Text className="text-weered-text font-semibold text-center">Invite to crew</Text>
      </Pressable>
      {open && (
        <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <View className="flex-1 bg-black/70 justify-center px-5">
            <View className="bg-weered-bg border border-border rounded-2xl p-5 max-h-[70%]">
              <Text className="text-weered-text font-bold text-lg mb-3">Add {targetName} to a crew</Text>
              {crewsQ.isLoading && <ActivityIndicator color="#5800E5" />}
              {!crewsQ.isLoading && eligible.length === 0 && (
                <Text className="text-weered-muted text-sm">You don't have any crews where you can invite. Make one first or ask a leader.</Text>
              )}
              <ScrollView>
                {eligible.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => invite.mutate(c.id)}
                    disabled={invite.isPending}
                    className="px-3 py-3 border-b border-border/30 active:opacity-70"
                  >
                    <Text className="text-weered-text font-semibold">
                      {c.tag ? `[${c.tag}] ` : ""}{c.name}
                    </Text>
                    <Text className="text-weered-muted text-xs">{c.myRole}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable
                onPress={() => setOpen(false)}
                className="mt-4 px-3 py-3 rounded-lg bg-panel border border-border active:opacity-70"
              >
                <Text className="text-weered-muted text-center font-bold">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

function FriendButton({
  state, onSend, onUnfriend, pending,
}: { state: FriendState; onSend: () => void; onUnfriend: () => void; pending: boolean }) {
  if (state === "friends") {
    return (
      <Pressable
        onPress={onUnfriend}
        disabled={pending}
        className="bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
      >
        <Text className="text-weered-muted font-semibold text-center">Friends · tap to unfriend</Text>
      </Pressable>
    );
  }
  if (state === "pending_sent") {
    return (
      <View className="bg-panel border border-border px-4 py-3 rounded-xl">
        <Text className="text-weered-muted font-semibold text-center">Request sent</Text>
      </View>
    );
  }
  if (state === "pending_received") {
    return (
      <View className="bg-panel border border-border px-4 py-3 rounded-xl">
        <Text className="text-weered-muted text-center">They sent you a request — accept it in Friends · Requests.</Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={onSend}
      disabled={pending}
      className="bg-weered px-4 py-3 rounded-xl active:opacity-80"
    >
      <Text className="text-white font-bold text-center">Add friend</Text>
    </Pressable>
  );
}
