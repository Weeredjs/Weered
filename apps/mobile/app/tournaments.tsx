import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Tournament = {
  id: string;
  title: string;
  description: string;
  iconUrl: string | null;
  format: string;
  entryType: string;
  status: "REGISTRATION" | "ACTIVE" | "COMPLETED" | "CANCELED";
  registrationOpensAt: string;
  startsAt: string;
  endsAt: string;
  minEntries: number;
  maxEntries: number;
  _count: { entries: number };
};
type ListResp = { ok: boolean; tournaments: Tournament[] };

const STATUSES = [
  { id: "", label: "Active" },
  { id: "REGISTRATION", label: "Open" },
  { id: "ACTIVE", label: "Running" },
  { id: "COMPLETED", label: "Past" },
];

export default function Tournaments() {
  const [status, setStatus] = useState("");

  const q = useQuery({
    queryKey: ["tournaments", status],
    queryFn: () => api<ListResp>(`/tournaments${status ? `?status=${status}` : ""}`),
  });

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Tournaments" }} />

      <View className="flex-row px-2 py-2 border-b border-border/40">
        {STATUSES.map((s) => (
          <Pressable
            key={s.id || "active"}
            onPress={() => setStatus(s.id)}
            className="px-3 py-1 active:opacity-70"
          >
            <Text
              className={`text-xs font-bold uppercase ${status === s.id ? "text-weered" : "text-weered-muted"}`}
            >
              {s.label}
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
          data={q.data?.tournaments ?? []}
          keyExtractor={(t) => t.id}
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => q.refetch()}
              tintColor="#5800E5"
            />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-px bg-border/30" />}
          renderItem={({ item }) => (
            <TournamentRow t={item} onPress={() => router.push(`/tournament/${item.id}`)} />
          )}
          ListEmptyComponent={
            <Text className="text-weered-muted text-sm text-center py-12">
              No tournaments right now.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

function TournamentRow({ t, onPress }: { t: Tournament; onPress: () => void }) {
  const starts = new Date(t.startsAt);
  const endsAt = new Date(t.endsAt);
  const now = Date.now();
  let badge = "";
  let badgeColor = "#94a3b8";
  if (t.status === "REGISTRATION") {
    badge = "REG OPEN";
    badgeColor = "#5800E5";
  } else if (t.status === "ACTIVE") {
    badge = "LIVE";
    badgeColor = "#22c55e";
  } else if (t.status === "COMPLETED") {
    badge = "DONE";
    badgeColor = "#94a3b8";
  } else {
    badge = t.status;
  }

  return (
    <Pressable onPress={onPress} className="px-4 py-3 flex-row active:bg-panel">
      {t.iconUrl ? (
        <Image
          source={{ uri: t.iconUrl }}
          style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: "#1a1a1a" }}
        />
      ) : (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            backgroundColor: "#5800E533",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="text-weered font-black">🏆</Text>
        </View>
      )}
      <View className="flex-1 ml-3">
        <View className="flex-row items-center mb-0.5">
          <Text style={{ color: badgeColor }} className="text-[10px] font-bold uppercase mr-2">
            {badge}
          </Text>
          <Text className="text-weered-muted text-[10px] uppercase">
            {t.format} · {t.entryType}
          </Text>
        </View>
        <Text className="text-weered-text font-bold flex-1" numberOfLines={1}>
          {t.title}
        </Text>
        {!!t.description && (
          <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={2}>
            {t.description}
          </Text>
        )}
        <Text className="text-weered-muted text-xs mt-1">
          {t._count.entries}/{t.maxEntries} entries · starts {starts.toLocaleDateString()}
          {t.status === "ACTIVE" && endsAt.getTime() > now
            ? ` · ends ${endsAt.toLocaleDateString()}`
            : ""}
        </Text>
      </View>
    </Pressable>
  );
}
