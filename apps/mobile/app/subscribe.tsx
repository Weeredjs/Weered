import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { api } from "@/lib/api";

type StatusResp = {
  ok: boolean;
  tier: "FREE" | "INDICTED" | "FELON";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

type ConfigResp = {
  ok: boolean;
  prices: Record<string, { id: string; amount: number; label: string }>;
};

const TIERS = [
  {
    id: "INDICTED",
    name: "Indicted",
    price: "$6/mo",
    perks: [
      "Custom avatar uploads",
      "Access to Felon-only lobbies",
      "Purple Indicted badge",
      "Priority voice quality",
    ],
    color: "#8b5cf6",
  },
  {
    id: "FELON",
    name: "Felon",
    price: "$14/mo",
    perks: [
      "Everything in Indicted",
      "Unlimited Paper stacks",
      "Gold Felon badge",
      "Create private lobbies",
      "Early features access",
    ],
    color: "#eab308",
  },
] as const;

export default function Subscribe() {
  const qc = useQueryClient();

  const statusQ = useQuery({
    queryKey: ["subscribe-status"],
    queryFn: () => api<StatusResp>("/subscribe/status"),
  });
  const cfgQ = useQuery({
    queryKey: ["subscribe-config"],
    queryFn: () => api<ConfigResp>("/subscribe/config"),
  });

  const checkout = useMutation({
    mutationFn: async (tier: string) => {
      const r = await api<{ ok: boolean; url?: string; error?: string }>("/subscribe/checkout", {
        method: "POST",
        body: { tier },
      });
      if (!r.ok || !r.url) throw new Error(r.error || "no_url");
      await WebBrowser.openBrowserAsync(r.url, { showTitle: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscribe-status"] }),
    onError: (e: any) => Alert.alert("Couldn't start checkout", e?.message || "Unknown error"),
  });

  const portal = useMutation({
    mutationFn: async () => {
      const r = await api<{ ok: boolean; url?: string; error?: string }>("/subscribe/portal", {
        method: "POST",
      });
      if (!r.ok || !r.url) throw new Error(r.error || "no_url");
      await WebBrowser.openBrowserAsync(r.url, { showTitle: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscribe-status"] }),
    onError: (e: any) => Alert.alert("Couldn't open portal", e?.message || "Unknown error"),
  });

  const current = statusQ.data?.tier || "FREE";
  const loading = statusQ.isLoading || cfgQ.isLoading;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Subscribe" }} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={statusQ.isRefetching}
            onRefresh={() => statusQ.refetch()}
            tintColor="#5800E5"
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color="#5800E5" />
          </View>
        ) : (
          <>
            <View className="px-4 py-6 border-b border-border/30 items-center">
              <Text className="text-weered-muted text-xs uppercase tracking-widest mb-1">
                Current tier
              </Text>
              <Text className="text-weered-text text-3xl font-black">{current}</Text>
              {statusQ.data?.currentPeriodEnd && (
                <Text className="text-weered-muted text-xs mt-1">
                  {statusQ.data.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
                  {new Date(statusQ.data.currentPeriodEnd).toLocaleDateString()}
                </Text>
              )}
              {current !== "FREE" && (
                <Pressable
                  onPress={() => portal.mutate()}
                  disabled={portal.isPending}
                  className="bg-panel border border-border px-4 py-2 rounded-lg mt-4 active:opacity-70"
                >
                  <Text className="text-weered-text font-bold">Manage subscription ↗</Text>
                </Pressable>
              )}
            </View>

            {TIERS.map((t) => {
              const isCurrent = current === t.id;
              return (
                <View key={t.id} className="px-4 py-4 border-b border-border/30">
                  <View className="flex-row items-end mb-2">
                    <Text style={{ color: t.color }} className="font-black text-xl flex-1">
                      {t.name}
                    </Text>
                    <Text className="text-weered-text font-bold">{t.price}</Text>
                  </View>
                  {t.perks.map((p) => (
                    <View key={p} className="flex-row items-start my-0.5">
                      <Text style={{ color: t.color }} className="font-bold mr-2">
                        ✓
                      </Text>
                      <Text className="text-weered-muted text-sm flex-1">{p}</Text>
                    </View>
                  ))}
                  {isCurrent ? (
                    <View className="mt-3 bg-green-500/10 border border-green-500/30 px-4 py-2 rounded-lg">
                      <Text className="text-green-400 text-center font-bold">Current plan</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => checkout.mutate(t.id)}
                      disabled={checkout.isPending}
                      className="mt-3 px-4 py-3 rounded-lg active:opacity-80"
                      style={{ backgroundColor: t.color }}
                    >
                      <Text className="text-white text-center font-bold">
                        {checkout.isPending
                          ? "Opening Stripe…"
                          : current === "FREE"
                            ? `Subscribe to ${t.name}`
                            : `Switch to ${t.name}`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}

            <Text className="text-weered-muted text-xs text-center px-8 pt-4">
              Checkout opens in your browser. After payment, pull to refresh.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
