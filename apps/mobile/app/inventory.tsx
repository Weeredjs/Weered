import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type InvItem = {
  id: string;
  itemId: string;
  name: string;
  description: string | null;
  category: string;
  rarity: string;
  imageUrl: string | null;
  equipped: boolean;
  consumed: boolean;
  mintNumber: number | null;
  maxSupply: number | null;
  acquiredFrom: string;
  acquiredAt: string;
};
type InvResp = { ok: boolean; items: InvItem[] };

const RARITY_COLOR: Record<string, string> = {
  COMMON: "#94a3b8",
  UNCOMMON: "#22c55e",
  RARE: "#06b6d4",
  EPIC: "#a855f7",
  LEGENDARY: "#f59e0b",
  MYTHIC: "#ef4444",
};

export default function Inventory() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api<InvResp>("/inventory"),
  });

  const equip = useMutation({
    mutationFn: (userItemId: string) => api(`/inventory/equip/${userItemId}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
    onError: (e: any) => Alert.alert("Couldn't equip", e?.message || "Unknown error"),
  });

  const consume = useMutation({
    mutationFn: (userItemId: string) => api(`/inventory/consume/${userItemId}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      Alert.alert("Used", "Item consumed.");
    },
    onError: (e: any) => Alert.alert("Couldn't consume", e?.message || "Unknown error"),
  });

  const items = (q.data?.items ?? []).filter((i) => !i.consumed);
  const byCategory = items.reduce<Record<string, InvItem[]>>((acc, it) => {
    (acc[it.category] ||= []).push(it);
    return acc;
  }, {});
  const categories = Object.keys(byCategory).sort();

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Inventory" }} />
      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => q.refetch()}
              tintColor="#5800E5"
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {categories.length === 0 && (
            <Text className="text-weered-muted text-sm text-center py-12">
              No items yet. Visit the Store.
            </Text>
          )}
          {categories.map((cat) => (
            <View key={cat} className="mt-3">
              <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">
                {cat}
              </Text>
              {byCategory[cat].map((item) => (
                <View
                  key={item.id}
                  className="px-4 py-3 border-b border-border/30 flex-row items-start"
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: "#1a1a1a" }}
                    />
                  ) : (
                    <View
                      className="items-center justify-center rounded-lg"
                      style={{
                        width: 48,
                        height: 48,
                        backgroundColor: (RARITY_COLOR[item.rarity] || "#94a3b8") + "33",
                      }}
                    >
                      <Text className="text-weered-text font-black text-lg">
                        {item.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-center">
                      <Text className="text-weered-text font-semibold flex-1" numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text
                        style={{ color: RARITY_COLOR[item.rarity] || "#94a3b8" }}
                        className="text-[10px] font-bold uppercase ml-2"
                      >
                        {item.rarity}
                      </Text>
                    </View>
                    {!!item.description && (
                      <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={2}>
                        {item.description}
                      </Text>
                    )}
                    {item.mintNumber != null && item.maxSupply != null && (
                      <Text className="text-amber-400 text-xs mt-0.5">
                        #{item.mintNumber} of {item.maxSupply}
                      </Text>
                    )}
                    <View className="flex-row mt-2">
                      {item.category === "CONSUMABLE" ? (
                        <Pressable
                          onPress={() =>
                            Alert.alert("Use item?", item.name, [
                              { text: "Cancel", style: "cancel" },
                              { text: "Use", onPress: () => consume.mutate(item.id) },
                            ])
                          }
                          className="bg-weered px-3 py-1.5 rounded-md active:opacity-80"
                        >
                          <Text className="text-white text-xs font-bold">Use</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => equip.mutate(item.id)}
                          className={`px-3 py-1.5 rounded-md active:opacity-70 ${item.equipped ? "bg-weered" : "bg-panel border border-border"}`}
                        >
                          <Text
                            className={`text-xs font-bold ${item.equipped ? "text-white" : "text-weered-muted"}`}
                          >
                            {item.equipped ? "Equipped · tap to remove" : "Equip"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
