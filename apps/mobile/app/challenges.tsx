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

type Definition = {
  id: string;
  title: string;
  description: string;
  iconUrl: string | null;
  category: string;
  difficulty: number;
  objectives: { id: string; target: number; description?: string }[];
};
type Instance = {
  id: string;
  definitionId: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  definition: Definition;
  _count: { enrollments: number };
};
type ActiveResp = { ok: boolean; challenges: Instance[] };

type Enrollment = {
  id: string;
  instanceId: string;
  status: string;
  progress: Record<string, { current: number; target: number; completed: boolean }>;
  instance: Instance;
};
type MyResp = { ok: boolean; enrollments: Enrollment[] };

const CATEGORIES = ["", "crucible", "pve", "raid", "seasonal"];

export default function Challenges() {
  const [tab, setTab] = useState<"active" | "mine">("active");
  const [cat, setCat] = useState("");

  const activeQ = useQuery({
    queryKey: ["challenges-active", cat],
    queryFn: () => api<ActiveResp>(`/challenges${cat ? `?category=${cat}` : ""}`),
    enabled: tab === "active",
  });
  const myQ = useQuery({
    queryKey: ["challenges-mine"],
    queryFn: () => api<MyResp>("/challenges/my"),
    enabled: tab === "mine",
  });

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Challenges" }} />

      <View className="flex-row border-b border-border/40">
        <Pressable
          onPress={() => setTab("active")}
          className="flex-1 py-3 items-center active:opacity-70"
          style={{
            borderBottomWidth: 2,
            borderBottomColor: tab === "active" ? "#5800E5" : "transparent",
          }}
        >
          <Text
            className={`text-sm font-bold ${tab === "active" ? "text-weered" : "text-weered-muted"}`}
          >
            Browse
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("mine")}
          className="flex-1 py-3 items-center active:opacity-70"
          style={{
            borderBottomWidth: 2,
            borderBottomColor: tab === "mine" ? "#5800E5" : "transparent",
          }}
        >
          <Text
            className={`text-sm font-bold ${tab === "mine" ? "text-weered" : "text-weered-muted"}`}
          >
            My challenges
          </Text>
        </Pressable>
      </View>

      {tab === "active" && (
        <>
          <View className="flex-row px-2 py-2 border-b border-border/30">
            {CATEGORIES.map((c) => (
              <Pressable
                key={c || "all"}
                onPress={() => setCat(c)}
                className="px-2 py-1 active:opacity-70"
              >
                <Text
                  className={`text-xs font-bold uppercase ${cat === c ? "text-weered" : "text-weered-muted"}`}
                >
                  {c || "All"}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeQ.isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#5800E5" />
            </View>
          ) : (
            <FlatList
              data={activeQ.data?.challenges ?? []}
              keyExtractor={(i) => i.id}
              refreshControl={
                <RefreshControl
                  refreshing={activeQ.isRefetching}
                  onRefresh={() => activeQ.refetch()}
                  tintColor="#5800E5"
                />
              }
              contentContainerStyle={{ paddingBottom: 32 }}
              ItemSeparatorComponent={() => <View className="h-px bg-border/30" />}
              renderItem={({ item }) => (
                <ChallengeRow
                  instance={item}
                  onPress={() => router.push(`/challenge/${item.id}`)}
                />
              )}
              ListEmptyComponent={
                <Text className="text-weered-muted text-sm text-center py-12">
                  No active challenges in {cat || "any category"}.
                </Text>
              }
            />
          )}
        </>
      )}

      {tab === "mine" &&
        (myQ.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#5800E5" />
          </View>
        ) : (
          <FlatList
            data={(myQ.data?.enrollments ?? []).filter(
              (e) => e.status === "ACTIVE" || e.status === "COMPLETED",
            )}
            keyExtractor={(e) => e.id}
            refreshControl={
              <RefreshControl
                refreshing={myQ.isRefetching}
                onRefresh={() => myQ.refetch()}
                tintColor="#5800E5"
              />
            }
            contentContainerStyle={{ paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View className="h-px bg-border/30" />}
            renderItem={({ item }) => (
              <EnrollmentRow
                enrollment={item}
                onPress={() => router.push(`/challenge/${item.instanceId}`)}
              />
            )}
            ListEmptyComponent={
              <View className="px-8 py-16 items-center">
                <Text className="text-weered-muted text-sm">
                  No enrollments yet. Browse to enroll.
                </Text>
              </View>
            }
          />
        ))}
    </SafeAreaView>
  );
}

function ChallengeRow({ instance, onPress }: { instance: Instance; onPress: () => void }) {
  const d = instance.definition;
  const ends = instance.endsAt ? new Date(instance.endsAt) : null;
  const daysLeft = ends ? Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 86400000)) : null;
  return (
    <Pressable onPress={onPress} className="px-4 py-3 flex-row active:bg-panel">
      {d.iconUrl ? (
        <Image
          source={{ uri: d.iconUrl }}
          style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: "#1a1a1a" }}
        />
      ) : (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            backgroundColor: "#5800E533",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="text-weered font-black text-sm">
            {d.category?.slice(0, 3).toUpperCase() || "CHL"}
          </Text>
        </View>
      )}
      <View className="flex-1 ml-3">
        <View className="flex-row items-center">
          <Text className="text-weered-text font-bold flex-1" numberOfLines={1}>
            {d.title}
          </Text>
          <Text className="text-amber-400 text-xs">{"★".repeat(d.difficulty)}</Text>
        </View>
        {!!d.description && (
          <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={2}>
            {d.description}
          </Text>
        )}
        <View className="flex-row items-center mt-1">
          <Text className="text-weered-muted text-xs">{instance._count.enrollments} enrolled</Text>
          {daysLeft !== null && (
            <Text className="text-weered-muted text-xs ml-3">· {daysLeft}d left</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function EnrollmentRow({ enrollment, onPress }: { enrollment: Enrollment; onPress: () => void }) {
  const d = enrollment.instance.definition;
  const objectives = d.objectives || [];
  const progressEntries = objectives.map((o) => enrollment.progress?.[o.id]).filter(Boolean);
  const total = progressEntries.length;
  const done = progressEntries.filter((p) => p.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isDone = enrollment.status === "COMPLETED";

  return (
    <Pressable onPress={onPress} className="px-4 py-3 active:bg-panel">
      <View className="flex-row items-center mb-1">
        {isDone && <Text className="text-green-400 text-xs font-bold mr-2">✓ DONE</Text>}
        <Text className="text-weered-text font-bold flex-1" numberOfLines={1}>
          {d.title}
        </Text>
        <Text className="text-weered-muted text-xs">
          {done}/{total}
        </Text>
      </View>
      <View className="h-1.5 bg-panel rounded-full overflow-hidden mt-1">
        <View style={{ width: `${pct}%` }} className="h-1.5 bg-weered rounded-full" />
      </View>
    </Pressable>
  );
}
