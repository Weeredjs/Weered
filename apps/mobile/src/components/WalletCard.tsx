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
    <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 4, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: "rgba(203,213,225,0.72)", fontFamily: "monospace", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>Paper</Text>
          <Text style={{ color: "rgba(243,244,246,0.98)", fontFamily: "monospace", fontWeight: "900", fontSize: 22 }}>{balance.toLocaleString()}</Text>
        </View>
        <Pressable
          onPress={() => daily.mutate()}
          disabled={daily.isPending}
          style={{ backgroundColor: "#5800E5", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4 }}
        >
          <Text style={{ color: "#fff", fontFamily: "monospace", fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
            {daily.isPending ? "…" : "Daily +25"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
