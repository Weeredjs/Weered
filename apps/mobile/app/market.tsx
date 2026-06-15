import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

type Listing = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerColor: string | null;
  itemId: string;
  userItemId: string;
  itemName: string;
  itemRarity: string;
  imageUrl: string | null;
  description: string | null;
  category: string | null;
  price: number;
  createdAt: string;
  expiresAt: string;
};
type ListResp = { ok: boolean; listings: Listing[] };
type WalletResp = { ok: boolean; balance: number };

const RARITY_COLOR: Record<string, string> = {
  COMMON: "#94a3b8",
  UNCOMMON: "#22c55e",
  RARE: "#06b6d4",
  EPIC: "#a855f7",
  LEGENDARY: "#f59e0b",
  MYTHIC: "#ef4444",
};

export default function Market() {
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [listOpen, setListOpen] = useState(false);

  const q = useQuery({
    queryKey: ["market", search, sort],
    queryFn: () =>
      api<ListResp>(`/market?sort=${sort}${search ? `&search=${encodeURIComponent(search)}` : ""}`),
  });

  const walletQ = useQuery({
    queryKey: ["paper-wallet"],
    queryFn: () => api<WalletResp>("/paper/wallet"),
  });

  const buy = useMutation({
    mutationFn: (listingId: string) =>
      api<{ ok: boolean; balance?: number; error?: string }>(`/market/buy/${listingId}`, {
        method: "POST",
      }),
    onSuccess: (res) => {
      if (res.ok) {
        Alert.alert("Bought", `New balance: ${res.balance}`);
        qc.invalidateQueries({ queryKey: ["market"] });
        qc.invalidateQueries({ queryKey: ["paper-wallet"] });
        qc.invalidateQueries({ queryKey: ["inventory"] });
      } else if (res.error === "insufficient_paper") {
        Alert.alert("Not enough Paper", "Earn more or list an item.");
      } else if (res.error === "cant_buy_own") {
        Alert.alert("Can't buy your own", "Tap Cancel on your listing instead.");
      } else {
        Alert.alert("Couldn't buy", res.error || "Unknown error");
      }
    },
    onError: (e: any) => Alert.alert("Couldn't buy", e?.message || "Unknown error"),
  });

  const cancel = useMutation({
    mutationFn: (listingId: string) => api(`/market/cancel/${listingId}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["market"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e: any) => Alert.alert("Couldn't cancel", e?.message || "Unknown error"),
  });

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen
        options={{
          title: "Marketplace",
          headerRight: () => (
            <Pressable
              onPress={() => setListOpen(true)}
              hitSlop={8}
              className="active:opacity-70 mr-2"
            >
              <Text className="text-weered font-semibold">Sell</Text>
            </Pressable>
          ),
        }}
      />

      <View className="px-4 py-3 bg-panel/40 border-b border-border/40 flex-row items-center">
        <Text className="text-weered-muted text-xs uppercase tracking-widest mr-2">Paper</Text>
        <Text className="text-weered-text font-black text-lg flex-1">
          {(walletQ.data?.balance ?? 0).toLocaleString()}
        </Text>
      </View>

      <View className="px-3 py-2 border-b border-border/30 flex-row items-center">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search"
          placeholderTextColor="rgba(160,160,170,0.6)"
          className="bg-panel text-weered-text px-3 py-2 rounded-lg flex-1"
          style={{ fontSize: 14 }}
        />
        <Pressable
          onPress={() =>
            setSort(
              sort === "newest" ? "price_asc" : sort === "price_asc" ? "price_desc" : "newest",
            )
          }
          className="ml-2 px-3 py-2 rounded-lg bg-panel border border-border active:opacity-70"
        >
          <Text className="text-weered-muted text-xs font-bold">
            {sort === "newest" ? "🕒 New" : sort === "price_asc" ? "↑ Price" : "↓ Price"}
          </Text>
        </Pressable>
      </View>

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : (
        <FlatList
          data={q.data?.listings ?? []}
          keyExtractor={(l) => l.id}
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => q.refetch()}
              tintColor="#5800E5"
            />
          }
          ItemSeparatorComponent={() => <View className="h-px bg-border/30" />}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const mine = me?.id === item.sellerId;
            return (
              <View className="px-4 py-3 flex-row items-start">
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: "#1a1a1a" }}
                  />
                ) : (
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      backgroundColor: (RARITY_COLOR[item.itemRarity] || "#94a3b8") + "33",
                    }}
                    className="items-center justify-center"
                  >
                    <Text className="text-weered-text font-black text-lg">
                      {item.itemName.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View className="flex-1 ml-3">
                  <View className="flex-row items-center">
                    <Text className="text-weered-text font-semibold flex-1" numberOfLines={1}>
                      {item.itemName}
                    </Text>
                    <Text
                      style={{ color: RARITY_COLOR[item.itemRarity] || "#94a3b8" }}
                      className="text-[10px] font-bold uppercase ml-2"
                    >
                      {item.itemRarity}
                    </Text>
                  </View>
                  <Text className="text-weered-muted text-xs mt-0.5">by {item.sellerName}</Text>
                  <View className="flex-row items-center mt-2">
                    <Text className="text-weered font-bold text-base flex-1">
                      {item.price.toLocaleString()} Paper
                    </Text>
                    {mine ? (
                      <Pressable
                        onPress={() =>
                          Alert.alert("Cancel listing?", item.itemName, [
                            { text: "Keep", style: "cancel" },
                            {
                              text: "Cancel listing",
                              style: "destructive",
                              onPress: () => cancel.mutate(item.id),
                            },
                          ])
                        }
                        className="bg-panel border border-border px-3 py-1.5 rounded-md active:opacity-70"
                      >
                        <Text className="text-weered-muted text-xs font-bold">Cancel</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() =>
                          Alert.alert(`Buy ${item.itemName}?`, `${item.price} Paper`, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Buy", onPress: () => buy.mutate(item.id) },
                          ])
                        }
                        className="bg-weered px-4 py-1.5 rounded-md active:opacity-80"
                      >
                        <Text className="text-white text-xs font-bold">Buy</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View className="px-8 py-16 items-center">
              <Text className="text-weered-muted text-sm">No active listings.</Text>
            </View>
          }
        />
      )}

      {listOpen && (
        <SellModal
          onClose={() => setListOpen(false)}
          onListed={() => {
            setListOpen(false);
            qc.invalidateQueries({ queryKey: ["market"] });
          }}
        />
      )}
    </SafeAreaView>
  );
}

function SellModal({ onClose, onListed }: { onClose: () => void; onListed: () => void }) {
  const invQ = useQuery({
    queryKey: ["inventory"],
    queryFn: () =>
      api<{
        ok: boolean;
        items: {
          id: string;
          name: string;
          rarity: string;
          category: string;
          equipped: boolean;
          consumed: boolean;
          imageUrl: string | null;
        }[];
      }>("/inventory"),
  });

  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [price, setPrice] = useState("100");

  const list = useMutation({
    mutationFn: () =>
      api(`/market/list`, {
        method: "POST",
        body: { userItemId: selected!.id, price: Number(price) },
      }),
    onSuccess: () => onListed(),
    onError: (e: any) => Alert.alert("Couldn't list", e?.message || "Unknown error"),
  });

  const eligible = (invQ.data?.items || []).filter(
    (i) => !i.consumed && i.category !== "CONSUMABLE",
  );

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-end">
        <View
          className="bg-weered-bg border-t border-border rounded-t-2xl"
          style={{ maxHeight: "80%" }}
        >
          <View className="px-4 pt-4 pb-2 flex-row items-center">
            <Text className="text-weered-text font-bold text-lg flex-1">List an item</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text className="text-weered-muted font-bold text-base">✕</Text>
            </Pressable>
          </View>

          {selected ? (
            <View className="px-4 pt-2 pb-4">
              <Text className="text-weered-text font-semibold mb-2">Selling: {selected.name}</Text>
              <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">
                Price (Paper)
              </Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                keyboardType="number-pad"
                className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-3"
                style={{ fontSize: 16, fontWeight: "700" }}
              />
              <View className="flex-row">
                <Pressable
                  onPress={() => setSelected(null)}
                  className="flex-1 mr-2 px-3 py-3 rounded-lg bg-panel border border-border active:opacity-70"
                >
                  <Text className="text-weered-muted text-center font-bold">Back</Text>
                </Pressable>
                <Pressable
                  onPress={() => Number(price) > 0 && list.mutate()}
                  disabled={list.isPending || !(Number(price) > 0)}
                  className="flex-1 px-3 py-3 rounded-lg bg-weered active:opacity-80"
                >
                  <Text className="text-white text-center font-bold">
                    {list.isPending ? "Listing…" : "List for sale"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : invQ.isLoading ? (
            <View className="py-8 items-center">
              <ActivityIndicator color="#5800E5" />
            </View>
          ) : eligible.length === 0 ? (
            <Text className="text-weered-muted text-sm text-center py-12">
              Nothing sellable in your inventory.
            </Text>
          ) : (
            <FlatList
              data={eligible}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelected({ id: item.id, name: item.name })}
                  className="px-4 py-3 flex-row items-center border-b border-border/20 active:bg-panel"
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: "#1a1a1a" }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 6,
                        backgroundColor: (RARITY_COLOR[item.rarity] || "#94a3b8") + "33",
                      }}
                      className="items-center justify-center"
                    >
                      <Text className="text-weered-text font-black text-sm">
                        {item.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text className="text-weered-text font-semibold ml-3 flex-1" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text
                    style={{ color: RARITY_COLOR[item.rarity] || "#94a3b8" }}
                    className="text-[10px] font-bold uppercase"
                  >
                    {item.rarity}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
