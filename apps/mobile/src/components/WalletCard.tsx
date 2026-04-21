import { View, Text, Pressable, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type WalletResp = {
  ok: boolean;
  balance: number;
  transactions: { id: string; type: string; amount: number; balance: number; description: string; createdAt: string }[];
};
type DailyResp = { ok: boolean; awarded?: number; balance?: number; error?: string; nextAt?: string };

export function WalletCard() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["paper-wallet"],
    queryFn: () => api<WalletResp>("/paper/wallet"),
    staleTime: 30_000,
  });

  const daily = useMutation({
    mutationFn: () => api<DailyResp>("/paper/daily", { method: "POST" }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["paper-wallet"] });
      if (res.ok) Alert.alert("Daily claimed", `+${res.awarded} Paper. Balance: ${res.balance}`);
      else if (res.error === "cooldown" && res.nextAt) {
        const mins = Math.ceil((new Date(res.nextAt).getTime() - Date.now()) / 60_000);
        const h = Math.floor(mins / 60), m = mins % 60;
        Alert.alert("Not yet", `Next claim in ${h > 0 ? `${h}h ${m}m` : `${m}m`}.`);
      } else Alert.alert("Couldn't claim", res.error || "Unknown error");
    },
    onError: (e: any) => Alert.alert("Couldn't claim", e?.message || "Unknown error"),
  });

  const balance = q.data?.balance ?? 0;

  return (
    <View className="mx-4 mt-4 bg-panel border border-border rounded-xl p-4">
      <View className="flex-row items-center">
        <View className="flex-1">
          <Text className="text-weered-muted text-xs uppercase tracking-widest mb-0.5">Paper</Text>
          <Text className="text-weered-text font-black text-2xl">{balance.toLocaleString()}</Text>
        </View>
        <Pressable
          onPress={() => daily.mutate()}
          disabled={daily.isPending}
          className="bg-weered px-4 py-2 rounded-lg active:opacity-80"
        >
          <Text className="text-white font-bold text-sm">
            {daily.isPending ? "…" : "Daily +25"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
