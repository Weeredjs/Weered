import { View, Text, Pressable, Alert } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { api } from "@/lib/api";

type Tier = { id: string; name: string; description: string; priceMonthly: number; grantLevel: number; color: string | null; sortOrder: number };
type TiersResp = { ok: boolean; tiers: Tier[] };
type MyTier = { ok: boolean; tier: { id: string; name: string; color: string | null } | null };

export function LobbyTiers({ lobbyId }: { lobbyId: string }) {
  const tiersQ = useQuery({
    queryKey: ["lobby-tiers", lobbyId],
    queryFn: () => api<TiersResp>(`/lobbies/${lobbyId}/tiers`),
  });
  const mineQ = useQuery({
    queryKey: ["lobby-my-tier", lobbyId],
    queryFn: () => api<MyTier>(`/lobbies/${lobbyId}/my-tier`),
  });

  const checkout = useMutation({
    mutationFn: async (tierId: string) => {
      const r = await api<{ ok: boolean; url?: string; error?: string }>(`/lobbies/${lobbyId}/tiers/${tierId}/checkout`, { method: "POST" });
      if (!r.ok || !r.url) throw new Error(r.error || "no_url");
      await WebBrowser.openBrowserAsync(r.url, { showTitle: true });
    },
    onError: (e: any) => Alert.alert("Couldn't start checkout", e?.message || "Unknown error"),
  });

  const portal = useMutation({
    mutationFn: async () => {
      const r = await api<{ ok: boolean; url?: string; error?: string }>(`/lobbies/${lobbyId}/tiers/portal`, { method: "POST" });
      if (!r.ok || !r.url) throw new Error(r.error || "no_url");
      await WebBrowser.openBrowserAsync(r.url, { showTitle: true });
    },
    onError: (e: any) => Alert.alert("Couldn't open portal", e?.message || "Unknown error"),
  });

  const tiers = tiersQ.data?.tiers ?? [];
  if (tiers.length === 0) return null;
  const myTierId = mineQ.data?.tier?.id || null;

  return (
    <View className="border-t border-border/40 pt-3 pb-2">
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">Supporter tiers</Text>
      {tiers.map((t) => {
        const accent = t.color || "#5800E5";
        const isMine = t.id === myTierId;
        return (
          <View key={t.id} className="px-4 py-3 border-b border-border/20" style={isMine ? { backgroundColor: `${accent}10` } : undefined}>
            <View className="flex-row items-center mb-1">
              <Text style={{ color: accent }} className="font-bold text-sm flex-1">{t.name}</Text>
              <Text className="text-weered-text font-black">${(t.priceMonthly / 100).toFixed(2)}</Text>
              <Text className="text-weered-muted text-xs ml-1">/mo</Text>
            </View>
            {!!t.description && (
              <Text className="text-weered-muted text-xs mb-2" numberOfLines={3}>{t.description}</Text>
            )}
            {isMine ? (
              <Pressable
                onPress={() => portal.mutate()}
                disabled={portal.isPending}
                className="bg-panel border border-border px-3 py-1.5 rounded-md self-start active:opacity-70"
              >
                <Text className="text-weered-muted text-xs font-bold">{portal.isPending ? "Opening…" : "Manage"}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => checkout.mutate(t.id)}
                disabled={checkout.isPending}
                className="px-3 py-1.5 rounded-md self-start active:opacity-80"
                style={{ backgroundColor: accent }}
              >
                <Text className="text-white text-xs font-bold">{checkout.isPending ? "Opening…" : "Subscribe"}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}
