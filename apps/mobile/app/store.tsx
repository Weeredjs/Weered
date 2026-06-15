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

type StoreItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  price: number;
  imageUrl: string | null;
  maxSupply: number | null;
  totalMinted: number;
  featured: boolean;
  soldOut: boolean;
  remaining: number | null;
};
type StoreResp = { ok: boolean; items: StoreItem[]; week: number };
type WalletResp = { ok: boolean; balance: number };

const RARITY_COLOR: Record<string, string> = {
  COMMON: "#94a3b8",
  UNCOMMON: "#22c55e",
  RARE: "#06b6d4",
  EPIC: "#a855f7",
  LEGENDARY: "#f59e0b",
  MYTHIC: "#ef4444",
};

export default function Store() {
  const qc = useQueryClient();

  const storeQ = useQuery({
    queryKey: ["store"],
    queryFn: () => api<StoreResp>("/store"),
  });

  const walletQ = useQuery({
    queryKey: ["paper-wallet"],
    queryFn: () => api<WalletResp>("/paper/wallet"),
  });

  const buy = useMutation({
    mutationFn: (itemId: string) =>
      api<{ ok: boolean; balance?: number; error?: string; need?: number; have?: number }>(
        `/store/buy/${itemId}`,
        { method: "POST" },
      ),
    onSuccess: (res, itemId) => {
      if (res.ok) {
        Alert.alert("Purchased", `New balance: ${res.balance}`);
        qc.invalidateQueries({ queryKey: ["store"] });
        qc.invalidateQueries({ queryKey: ["paper-wallet"] });
        qc.invalidateQueries({ queryKey: ["inventory"] });
      } else if (res.error === "insufficient_paper") {
        Alert.alert("Not enough Paper", `Need ${res.need}, have ${res.have}.`);
      } else if (res.error === "already_owned") {
        Alert.alert("Already owned", "You already have this item.");
      } else {
        Alert.alert("Couldn't buy", res.error || "Unknown error");
      }
    },
    onError: (e: any) => Alert.alert("Couldn't buy", e?.message || "Unknown error"),
  });

  const confirmBuy = (item: StoreItem) => {
    Alert.alert(
      `Buy ${item.name}?`,
      `${item.price} Paper${item.maxSupply ? ` · #${item.totalMinted + 1} of ${item.maxSupply}` : ""}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Buy", onPress: () => buy.mutate(item.id) },
      ],
    );
  };

  const items = storeQ.data?.items ?? [];
  const byCategory = items.reduce<Record<string, StoreItem[]>>((acc, it) => {
    (acc[it.category] ||= []).push(it);
    return acc;
  }, {});
  const categories = Object.keys(byCategory).sort();

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Store" }} />
      <View className="px-4 py-3 bg-panel/40 border-b border-border/40 flex-row items-center">
        <Text className="text-weered-muted text-xs uppercase tracking-widest mr-2">Paper</Text>
        <Text className="text-weered-text font-black text-lg">
          {(walletQ.data?.balance ?? 0).toLocaleString()}
        </Text>
      </View>

      {storeQ.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={storeQ.isRefetching}
              onRefresh={() => storeQ.refetch()}
              tintColor="#5800E5"
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {categories.length === 0 && (
            <Text className="text-weered-muted text-sm text-center py-12">
              No items in the store right now.
            </Text>
          )}
          {categories.map((cat) => (
            <View key={cat} className="mt-3">
              <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">
                {cat}
              </Text>
              {byCategory[cat].map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => !item.soldOut && confirmBuy(item)}
                  className="px-4 py-3 border-b border-border/30 flex-row items-start active:bg-panel"
                  style={{ opacity: item.soldOut ? 0.5 : 1 }}
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
                    <View className="flex-row items-center mt-1">
                      <Text className="text-weered font-bold text-sm">
                        {item.price.toLocaleString()} Paper
                      </Text>
                      {item.maxSupply != null && (
                        <Text className="text-weered-muted text-xs ml-3">
                          {item.soldOut
                            ? "sold out"
                            : `${item.remaining} of ${item.maxSupply} left`}
                        </Text>
                      )}
                      {item.featured && (
                        <Text className="text-amber-400 text-xs ml-3">★ featured</Text>
                      )}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
