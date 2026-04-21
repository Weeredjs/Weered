import { useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, TextInput, ActivityIndicator, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { router } from "expo-router";

type Tab = "portfolio" | "markets" | "leaderboard" | "competitions";

type Symbol = { symbol: string; name: string; price: number | null };
type Position = {
  id: string; symbol: string; side: "BUY" | "SELL"; quantity: number; entryPrice: number;
  currentPrice: number | null; unrealizedPnl: number; openedAt: string;
};
type Account = {
  cashBalance: number; equity: number; realizedPnl: number; unrealizedPnl: number;
  totalPnl: number; pnlPercent: number; positions: Position[];
};
type AccountResp = { ok: boolean; account: Account };
type SymbolsResp = { ok: boolean; symbols: Symbol[] };
type LeaderboardResp = {
  ok: boolean;
  leaderboard: { userId: string; userName: string; equity: number; totalPnl: number; pnlPercent: number; openPositions: number }[];
};

export function TradingPanel({ lobbyId }: { lobbyId: string }) {
  const [tab, setTab] = useState<Tab>("portfolio");

  return (
    <View className="border-t border-border/40 pt-3">
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">FakeOut · paper trading</Text>

      <View className="flex-row border-b border-border/30">
        <TabBtn label="Portfolio" active={tab === "portfolio"} onPress={() => setTab("portfolio")} />
        <TabBtn label="Markets" active={tab === "markets"} onPress={() => setTab("markets")} />
        <TabBtn label="Leaderboard" active={tab === "leaderboard"} onPress={() => setTab("leaderboard")} />
        <TabBtn label="Comps" active={tab === "competitions"} onPress={() => setTab("competitions")} />
      </View>

      <View className="min-h-[160px]">
        {tab === "portfolio" && <PortfolioTab lobbyId={lobbyId} />}
        {tab === "markets" && <MarketsTab lobbyId={lobbyId} />}
        {tab === "leaderboard" && <LeaderboardTab lobbyId={lobbyId} />}
        {tab === "competitions" && <CompetitionsTab lobbyId={lobbyId} />}
      </View>
    </View>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 py-2.5 items-center active:opacity-70" style={{ borderBottomWidth: 2, borderBottomColor: active ? "#5800E5" : "transparent" }}>
      <Text className={`text-xs font-bold ${active ? "text-weered" : "text-weered-muted"}`}>{label}</Text>
    </Pressable>
  );
}

function PortfolioTab({ lobbyId }: { lobbyId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["trading-account", lobbyId],
    queryFn: () => api<AccountResp>(`/trading/account/${lobbyId}`),
    refetchInterval: 8_000,
  });

  const closePos = useMutation({
    mutationFn: (positionId: string) => api(`/trading/close/${lobbyId}/${positionId}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trading-account", lobbyId] }),
    onError: (e: any) => Alert.alert("Couldn't close", e?.message || "Unknown error"),
  });

  if (q.isLoading) return <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>;
  if (!q.data?.ok) return <Text className="text-red-400 text-sm text-center py-6">Couldn't load account.</Text>;

  const a = q.data.account;
  const pnlColor = a.totalPnl >= 0 ? "text-green-400" : "text-red-400";

  return (
    <View className="py-3">
      <View className="px-4 mb-3">
        <View className="flex-row items-end mb-1">
          <Text className="text-weered-text font-black text-2xl">${a.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
          <Text className={`ml-2 font-bold text-sm ${pnlColor}`}>
            {a.totalPnl >= 0 ? "+" : ""}{a.totalPnl.toFixed(2)} ({a.pnlPercent.toFixed(2)}%)
          </Text>
        </View>
        <Text className="text-weered-muted text-xs">
          Cash ${a.cashBalance.toFixed(2)} · Realized {a.realizedPnl.toFixed(2)} · Unrealized {a.unrealizedPnl.toFixed(2)}
        </Text>
      </View>

      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 mb-1.5">Open positions · {a.positions.length}</Text>
      {a.positions.length === 0 && (
        <Text className="text-weered-muted text-sm px-4 py-3">No open positions. Switch to Markets to trade.</Text>
      )}
      {a.positions.map((p) => {
        const pnlC = p.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400";
        return (
          <View key={p.id} className="px-4 py-2.5 border-b border-border/20">
            <View className="flex-row items-center mb-1">
              <Text className="text-weered-text font-bold flex-1">{p.symbol}</Text>
              <Text className={`text-xs font-bold mr-2 ${p.side === "BUY" ? "text-green-400" : "text-red-400"}`}>{p.side === "BUY" ? "LONG" : "SHORT"}</Text>
              <Text className="text-weered-muted text-xs">{p.quantity}</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-weered-muted text-xs flex-1">
                @ ${p.entryPrice.toFixed(2)} → ${p.currentPrice?.toFixed(2) ?? "—"}
              </Text>
              <Text className={`text-xs font-bold mr-2 ${pnlC}`}>
                {p.unrealizedPnl >= 0 ? "+" : ""}{p.unrealizedPnl.toFixed(2)}
              </Text>
              <Pressable
                onPress={() => closePos.mutate(p.id)}
                className="bg-panel border border-border px-3 py-1 rounded-md active:opacity-70"
              >
                <Text className="text-weered-muted text-xs font-bold">Close</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function MarketsTab({ lobbyId }: { lobbyId: string }) {
  const qc = useQueryClient();
  const [orderFor, setOrderFor] = useState<{ symbol: string; price: number | null } | null>(null);

  const q = useQuery({
    queryKey: ["trading-symbols"],
    queryFn: () => api<SymbolsResp>("/trading/symbols"),
    refetchInterval: 5_000,
  });

  if (q.isLoading) return <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>;
  if (!q.data?.symbols?.length) return <Text className="text-weered-muted text-sm text-center py-6">No symbols available.</Text>;

  return (
    <View className="py-2">
      {q.data.symbols.map((s) => (
        <Pressable
          key={s.symbol}
          onPress={() => setOrderFor({ symbol: s.symbol, price: s.price })}
          className="px-4 py-2.5 flex-row items-center border-b border-border/20 active:bg-panel"
        >
          <View className="flex-1">
            <Text className="text-weered-text font-bold">{s.symbol}</Text>
            <Text className="text-weered-muted text-xs">{s.name}</Text>
          </View>
          <Text className="text-weered-text font-bold text-sm">
            {s.price ? `$${s.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
          </Text>
        </Pressable>
      ))}

      {orderFor && (
        <OrderModal
          lobbyId={lobbyId}
          symbol={orderFor.symbol}
          price={orderFor.price}
          onClose={() => setOrderFor(null)}
          onPlaced={() => {
            setOrderFor(null);
            qc.invalidateQueries({ queryKey: ["trading-account", lobbyId] });
          }}
        />
      )}
    </View>
  );
}

function OrderModal({
  lobbyId, symbol, price, onClose, onPlaced,
}: {
  lobbyId: string; symbol: string; price: number | null; onClose: () => void; onPlaced: () => void;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("0.01");

  const place = useMutation({
    mutationFn: () => api<{ ok: boolean; error?: string }>(`/trading/order/${lobbyId}`, {
      method: "POST",
      body: { symbol, side, orderType: "MARKET", quantity: Number(quantity) },
    }),
    onSuccess: (res) => {
      if (res.ok) onPlaced();
      else Alert.alert("Order failed", res.error || "Unknown error");
    },
    onError: (e: any) => Alert.alert("Order failed", e?.message || "Unknown error"),
  });

  const cost = price ? price * Number(quantity || 0) : null;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-center px-5">
        <View className="bg-weered-bg border border-border rounded-2xl p-5">
          <Text className="text-weered-text font-bold text-lg mb-1">{symbol}</Text>
          <Text className="text-weered-muted text-xs mb-4">
            Live price: {price ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
          </Text>

          <View className="flex-row mb-3">
            <Pressable
              onPress={() => setSide("BUY")}
              className={`flex-1 mr-2 py-2.5 rounded-lg ${side === "BUY" ? "bg-green-500" : "bg-panel border border-border"}`}
            >
              <Text className={`text-center font-bold ${side === "BUY" ? "text-white" : "text-weered-muted"}`}>LONG</Text>
            </Pressable>
            <Pressable
              onPress={() => setSide("SELL")}
              className={`flex-1 py-2.5 rounded-lg ${side === "SELL" ? "bg-red-500" : "bg-panel border border-border"}`}
            >
              <Text className={`text-center font-bold ${side === "SELL" ? "text-white" : "text-weered-muted"}`}>SHORT</Text>
            </Pressable>
          </View>

          <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Quantity</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-2"
            style={{ fontSize: 16, fontWeight: "700" }}
          />
          {cost != null && (
            <Text className="text-weered-muted text-xs mb-3">≈ ${cost.toLocaleString(undefined, { maximumFractionDigits: 2 })} {side === "BUY" ? "to spend" : "exposure"}</Text>
          )}

          <View className="flex-row mt-2">
            <Pressable onPress={onClose} className="flex-1 mr-2 px-3 py-3 rounded-lg bg-panel border border-border active:opacity-70">
              <Text className="text-weered-muted text-center font-bold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => Number(quantity) > 0 && place.mutate()}
              disabled={place.isPending || !(Number(quantity) > 0)}
              className={`flex-1 px-3 py-3 rounded-lg active:opacity-80 ${side === "BUY" ? "bg-green-500" : "bg-red-500"}`}
            >
              <Text className="text-white text-center font-bold">{place.isPending ? "Placing…" : `${side} market`}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LeaderboardTab({ lobbyId }: { lobbyId: string }) {
  const q = useQuery({
    queryKey: ["trading-leaderboard", lobbyId],
    queryFn: () => api<LeaderboardResp>(`/trading/leaderboard/${lobbyId}`),
    refetchInterval: 30_000,
  });

  if (q.isLoading) return <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>;
  if (!q.data?.leaderboard?.length) return <Text className="text-weered-muted text-sm text-center py-6">No traders yet.</Text>;

  return (
    <View className="py-2">
      {q.data.leaderboard.slice(0, 25).map((row, i) => {
        const c = row.totalPnl >= 0 ? "text-green-400" : "text-red-400";
        return (
          <Pressable
            key={row.userId}
            onPress={() => router.push(`/user/${row.userId}`)}
            className="flex-row items-center px-4 py-2 border-b border-border/20 active:bg-panel"
          >
            <Text className="text-weered-muted text-xs w-7">#{i + 1}</Text>
            <Text className="text-weered-text font-semibold flex-1" numberOfLines={1}>{row.userName}</Text>
            <Text className={`text-sm font-bold mr-3 ${c}`}>
              {row.totalPnl >= 0 ? "+" : ""}{row.totalPnl.toFixed(2)}
            </Text>
            <Text className={`text-xs ${c}`}>{row.pnlPercent.toFixed(1)}%</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type Competition = {
  id: string; lobbyId: string; title: string; description: string;
  status: string; startBalance: number;
  startTime: string; endTime: string;
};
type CompsResp = { ok: boolean; competitions: Competition[] };

function CompetitionsTab({ lobbyId }: { lobbyId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["trading-competitions", lobbyId],
    queryFn: () => api<CompsResp>(`/trading/competitions/${lobbyId}`),
  });
  const join = useMutation({
    mutationFn: (compId: string) => api<{ ok: boolean; message?: string }>(`/trading/competition/${compId}/join`, { method: "POST" }),
    onSuccess: (r) => {
      Alert.alert("Joined", r.message === "already_enrolled" ? "You were already in this competition." : "Competition entry created. Trade from Markets to compete.");
      qc.invalidateQueries({ queryKey: ["trading-competitions", lobbyId] });
    },
    onError: (e: any) => Alert.alert("Couldn't join", e?.message || "Unknown error"),
  });

  if (q.isLoading) return <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>;
  const comps = q.data?.competitions ?? [];
  if (comps.length === 0) return <Text className="text-weered-muted text-sm text-center py-6">No competitions scheduled.</Text>;

  return (
    <View className="py-2">
      {comps.map((c) => {
        const now = Date.now();
        const ends = new Date(c.endTime).getTime();
        const starts = new Date(c.startTime).getTime();
        const isLive = c.status !== "ENDED" && now >= starts && now <= ends;
        const isOver = c.status === "ENDED" || now > ends;
        return (
          <View key={c.id} className="px-4 py-3 border-b border-border/20">
            <View className="flex-row items-center mb-1">
              <Text className={`text-[10px] font-bold uppercase mr-2 ${isLive ? "text-green-400" : isOver ? "text-weered-muted" : "text-amber-400"}`}>
                {isLive ? "LIVE" : isOver ? "ENDED" : "UPCOMING"}
              </Text>
              <Text className="text-weered-text font-bold flex-1" numberOfLines={1}>{c.title}</Text>
            </View>
            {!!c.description && (
              <Text className="text-weered-muted text-xs mb-1" numberOfLines={2}>{c.description}</Text>
            )}
            <Text className="text-weered-muted text-xs mb-2">
              ${c.startBalance.toLocaleString()} start · {new Date(c.startTime).toLocaleDateString()} → {new Date(c.endTime).toLocaleDateString()}
            </Text>
            {!isOver && (
              <Pressable
                onPress={() => join.mutate(c.id)}
                disabled={join.isPending}
                className="bg-weered px-3 py-1.5 rounded-md self-start active:opacity-80"
              >
                <Text className="text-white text-xs font-bold">Join competition</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}
