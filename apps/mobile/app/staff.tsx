import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

type Tab = "broadcast" | "reports" | "audit";

type Report = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  context: string | null;
  note: string | null;
  bodySnapshot: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reporterName: string;
  targetName: string | null;
  reviewerName: string | null;
};
type ReportsResp = { reports: Report[] };

type AuditRow = {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetId?: string | null;
  targetName?: string | null;
  detail?: any;
  ts: string;
};
type AuditResp = { ok: boolean; entries: AuditRow[] };

export default function Staff() {
  const me = useAuth((s) => s.user);
  const [tab, setTab] = useState<Tab>("broadcast");

  const staffRoles = new Set(["GOD", "STAFF", "ADMIN", "SUPPORT"]);
  const isStaff = staffRoles.has(String(me?.globalRole || ""));

  if (!isStaff) {
    return (
      <SafeAreaView className="flex-1 bg-weered-bg items-center justify-center px-8">
        <Stack.Screen options={{ title: "Staff" }} />
        <Text className="text-red-400 text-sm text-center">Staff access required.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Staff console" }} />

      <View className="flex-row border-b border-border/40">
        <TabBtn
          label="Broadcast"
          active={tab === "broadcast"}
          onPress={() => setTab("broadcast")}
        />
        <TabBtn label="Reports" active={tab === "reports"} onPress={() => setTab("reports")} />
        <TabBtn label="Audit" active={tab === "audit"} onPress={() => setTab("audit")} />
      </View>

      {tab === "broadcast" && <BroadcastTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "audit" && <AuditTab />}
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
    <Pressable
      onPress={onPress}
      className="flex-1 py-3 items-center active:opacity-70"
      style={{ borderBottomWidth: 2, borderBottomColor: active ? "#5800E5" : "transparent" }}
    >
      <Text className={`text-sm font-bold ${active ? "text-weered" : "text-weered-muted"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function BroadcastTab() {
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<"info" | "warning" | "urgent">("info");

  const send = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; sent?: number }>("/staff/broadcast", {
        method: "POST",
        body: { message: message.trim(), level },
      }),
    onSuccess: (r) => {
      Alert.alert("Sent", `Broadcast delivered to ${r.sent ?? 0} connected users.`);
      setMessage("");
    },
    onError: (e: any) => Alert.alert("Send failed", e?.message || "Unknown error"),
  });

  return (
    <ScrollView className="flex-1 px-4 py-4">
      <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Level</Text>
      <View className="flex-row mb-4">
        {(["info", "warning", "urgent"] as const).map((l) => (
          <Pressable
            key={l}
            onPress={() => setLevel(l)}
            className={`mr-2 px-3 py-2 rounded-lg border ${level === l ? "bg-weered border-weered" : "bg-panel border-border"}`}
          >
            <Text
              className={`text-xs font-bold uppercase ${level === l ? "text-white" : "text-weered-muted"}`}
            >
              {l}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Message</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Broadcast text (max 500 chars)"
        placeholderTextColor="rgba(160,160,170,0.6)"
        multiline
        maxLength={500}
        className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-1"
        style={{ fontSize: 14, minHeight: 100, textAlignVertical: "top" }}
      />
      <Text className="text-weered-muted/70 text-[10px] text-right mb-4">{message.length}/500</Text>

      <Pressable
        onPress={() => message.trim() && send.mutate()}
        disabled={!message.trim() || send.isPending}
        className="bg-weered px-4 py-3 rounded-lg active:opacity-80"
        style={{ opacity: !message.trim() || send.isPending ? 0.5 : 1 }}
      >
        <Text className="text-white text-center font-bold">
          {send.isPending ? "Sending…" : "Broadcast to all online"}
        </Text>
      </Pressable>

      <Text className="text-weered-muted text-xs mt-4 text-center">
        Goes to every user currently connected via WebSocket.
      </Text>
    </ScrollView>
  );
}

function ReportsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("OPEN");

  const q = useQuery({
    queryKey: ["staff-reports", statusFilter],
    queryFn: () => api<ReportsResp>(`/staff/reports?status=${statusFilter}`),
  });

  const act = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "REVIEWED" | "ACTIONED" | "DISMISSED" }) =>
      api(`/staff/reports/${id}/action`, { method: "POST", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-reports"] }),
    onError: (e: any) => Alert.alert("Action failed", e?.message || "Unknown error"),
  });

  return (
    <View className="flex-1">
      <View className="flex-row px-2 py-2 border-b border-border/30">
        {["OPEN", "REVIEWED", "ACTIONED", "DISMISSED", "ALL"].map((s) => (
          <Pressable
            key={s}
            onPress={() => setStatusFilter(s)}
            className="px-2 py-1 active:opacity-70"
          >
            <Text
              className={`text-xs font-bold uppercase ${statusFilter === s ? "text-weered" : "text-weered-muted"}`}
            >
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : (
        <FlatList
          data={q.data?.reports ?? []}
          keyExtractor={(r) => r.id}
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => q.refetch()}
              tintColor="#5800E5"
            />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <View className="px-4 py-3 border-b border-border/20">
              <View className="flex-row items-center mb-1">
                <Text className="text-red-400 text-xs font-bold mr-2">{item.reason}</Text>
                <Text className="text-weered-muted text-xs uppercase mr-2">{item.targetType}</Text>
                <Text className="text-weered-muted text-xs flex-1">by {item.reporterName}</Text>
                <Text className="text-weered-muted text-[10px]">
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              {item.bodySnapshot && (
                <View className="bg-panel border border-border rounded-md px-3 py-2 my-1">
                  <Text className="text-weered-muted text-xs italic" numberOfLines={4}>
                    "{item.bodySnapshot}"
                  </Text>
                </View>
              )}
              {item.note && (
                <Text className="text-weered-text text-xs my-1">Note: {item.note}</Text>
              )}
              {item.targetType === "USER" && item.targetName && (
                <Pressable
                  onPress={() => router.push(`/user/${item.targetId}`)}
                  className="mt-1 active:opacity-70"
                >
                  <Text className="text-weered text-xs font-bold">View {item.targetName} →</Text>
                </Pressable>
              )}
              {item.status === "OPEN" ? (
                <View className="flex-row mt-2">
                  <Pressable
                    onPress={() => act.mutate({ id: item.id, status: "ACTIONED" })}
                    className="bg-red-500 px-3 py-1 rounded-md mr-2 active:opacity-80"
                  >
                    <Text className="text-white text-xs font-bold">Actioned</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => act.mutate({ id: item.id, status: "DISMISSED" })}
                    className="bg-panel border border-border px-3 py-1 rounded-md mr-2 active:opacity-70"
                  >
                    <Text className="text-weered-muted text-xs font-bold">Dismiss</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => act.mutate({ id: item.id, status: "REVIEWED" })}
                    className="bg-panel border border-border px-3 py-1 rounded-md active:opacity-70"
                  >
                    <Text className="text-weered-muted text-xs font-bold">Reviewed</Text>
                  </Pressable>
                </View>
              ) : (
                <Text className="text-weered-muted text-[10px] mt-1">
                  {item.status} {item.reviewerName ? `by ${item.reviewerName}` : ""}
                </Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text className="text-weered-muted text-sm text-center py-12">
              No reports with status {statusFilter}.
            </Text>
          }
        />
      )}
    </View>
  );
}

function AuditTab() {
  const q = useQuery({
    queryKey: ["staff-audit"],
    queryFn: () => api<AuditResp>("/staff/audit"),
  });

  if (q.isLoading)
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#5800E5" />
      </View>
    );
  return (
    <FlatList
      data={q.data?.entries ?? []}
      keyExtractor={(e) => e.id}
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          tintColor="#5800E5"
        />
      }
      contentContainerStyle={{ paddingBottom: 32 }}
      renderItem={({ item }) => (
        <View className="px-4 py-2.5 border-b border-border/20">
          <Text className="text-weered-text text-sm">
            <Text className="font-bold">{item.actorName}</Text>{" "}
            <Text className="text-weered-muted">{item.action.replaceAll(/_/g, " ")}</Text>
            {item.targetName ? (
              <Text className="text-weered-muted"> → {item.targetName}</Text>
            ) : null}
          </Text>
          <Text className="text-weered-muted text-xs mt-0.5">
            {new Date(item.ts).toLocaleString()}
          </Text>
        </View>
      )}
      ListEmptyComponent={
        <Text className="text-weered-muted text-sm text-center py-12">No audit entries.</Text>
      }
    />
  );
}
