import { useEffect, useState } from "react";
import { View, Text, Pressable, Alert, TextInput, Modal, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { wsClient } from "@/lib/ws";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/api";

type Card = { rank: string; suit: string };
type Seat = {
  seatIndex: number; userId: string; name: string; chips: number;
  folded: boolean; allIn: boolean; bet: number; cards: Card[];
};
type TableState = {
  tableId: string;
  seats: (Seat | null)[];
  communityCards: Card[];
  pot: number;
  sidePots?: { amount: number; eligible: string[] }[];
  currentBet: number;
  dealerIndex: number;
  turnIndex: number;
  phase: "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";
  blinds: { small: number; big: number };
  minBuyin: number;
  maxBuyin: number;
  lastShowdownResult?: any;
};

const SUIT_CHAR: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣", spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };

export default function PokerTable() {
  const { tableId } = useLocalSearchParams<{ tableId: string }>();
  const tid = String(tableId || "default");
  const me = useAuth((s) => s.user);

  const [state, setState] = useState<TableState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [buyin, setBuyin] = useState("");
  const [raiseAmount, setRaiseAmount] = useState("");
  const [raiseOpen, setRaiseOpen] = useState(false);

  useEffect(() => {
    wsClient.connect();
    wsClient.reauth();
    const off = wsClient.on((m: any) => {
      if (m.type === "poker:state" && m.tableId === tid) {
        setState(m);
      }
      if (m.type === "poker:error") {
        setError(m.error || "Unknown poker error");
        setTimeout(() => setError(null), 3000);
      }
    });
    wsClient.send({ type: "poker:spectate", tableId: tid });
    return () => { off?.(); wsClient.send({ type: "poker:leave", tableId: tid }); };
  }, [tid]);

  const cashout = useMutation({
    mutationFn: () => api<{ ok: boolean; cashed?: number; balance?: number; error?: string }>(`/poker/${tid}/cashout`, { method: "POST" }),
    onSuccess: (r) => {
      if (r.ok) Alert.alert("Cashed out", `Returned ${r.cashed} Paper. Balance: ${r.balance}`);
      else Alert.alert("Can't cashout", r.error || "Unknown error");
    },
    onError: (e: any) => Alert.alert("Couldn't cashout", e?.message || "Unknown error"),
  });

  const mySeat = state?.seats.find((s) => s && me && s.userId === me.id) || null;
  const isMyTurn = !!(mySeat && state && state.turnIndex === mySeat.seatIndex);
  const toCall = mySeat && state ? Math.max(0, state.currentBet - mySeat.bet) : 0;

  function act(action: "fold" | "check" | "call") {
    wsClient.send({ type: "poker:action", tableId: tid, action });
  }
  function raise(amount: number) {
    wsClient.send({ type: "poker:action", tableId: tid, action: "raise", amount });
    setRaiseOpen(false);
    setRaiseAmount("");
  }

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen
        options={{
          title: `Poker · ${tid}`,
          headerRight: () => mySeat ? (
            <Pressable
              onPress={() => Alert.alert("Cash out?", "You'll leave the table with your remaining chips.", [
                { text: "Cancel", style: "cancel" },
                { text: "Cash out", style: "destructive", onPress: () => cashout.mutate() },
              ])}
              hitSlop={8}
              className="active:opacity-70 mr-2"
            >
              <Text className="text-weered font-semibold">Cash out</Text>
            </Pressable>
          ) : null,
        }}
      />

      {!state ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#5800E5" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="px-4 py-3 border-b border-border/30">
            <Text className="text-weered-muted text-xs uppercase tracking-widest">{state.phase.toUpperCase()}</Text>
            <View className="flex-row items-center mt-1">
              <Text className="text-weered-muted text-xs mr-3">Blinds {state.blinds.small}/{state.blinds.big}</Text>
              <Text className="text-weered-text font-black text-lg flex-1">Pot ${state.pot.toLocaleString()}</Text>
              <Text className="text-weered-muted text-xs">to call ${toCall}</Text>
            </View>
          </View>

          <View className="px-4 py-3 border-b border-border/30 items-center">
            <Text className="text-weered-muted text-xs uppercase tracking-wide mb-2">Board</Text>
            <View className="flex-row">
              {state.communityCards.length === 0 ? (
                <Text className="text-weered-muted text-sm">— no flop yet —</Text>
              ) : (
                state.communityCards.map((c, i) => <CardChip key={i} card={c} />)
              )}
            </View>
          </View>

          <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-3 pb-2">Seats</Text>
          {state.seats.map((s, i) => <SeatRow key={i} seat={s} seatIndex={i} state={state} me={me?.id} />)}

          {!mySeat && (
            <View className="px-4 mt-5">
              <Pressable
                onPress={() => { setBuyin(String(state.minBuyin)); setJoinOpen(true); }}
                className="bg-weered px-4 py-3 rounded-xl active:opacity-80"
              >
                <Text className="text-white text-center font-bold">Buy in & sit down</Text>
              </Pressable>
              <Text className="text-weered-muted text-xs text-center mt-2">
                Spectating — min ${state.minBuyin}, max ${state.maxBuyin}
              </Text>
            </View>
          )}

          {state.lastShowdownResult && (
            <View className="mx-4 mt-4 p-3 bg-panel border border-border rounded-xl">
              <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Last showdown</Text>
              <Text className="text-weered-text text-sm">{JSON.stringify(state.lastShowdownResult).slice(0, 200)}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {error && (
        <View className="absolute top-16 left-4 right-4 bg-red-500 px-3 py-2 rounded-lg">
          <Text className="text-white text-center text-sm font-bold">{error}</Text>
        </View>
      )}

      {mySeat && state && (
        <View className="absolute bottom-0 left-0 right-0 bg-panel border-t border-border px-3 py-3 flex-row items-center">
          <View className="flex-1">
            <Text className="text-weered-muted text-[10px] uppercase">Your stack</Text>
            <Text className="text-weered-text font-black text-lg">${mySeat.chips.toLocaleString()}</Text>
          </View>
          {isMyTurn ? (
            <View className="flex-row">
              <Pressable
                onPress={() => act("fold")}
                className="bg-panel border border-red-500/40 px-3 py-2 rounded-lg mx-1 active:opacity-70"
              >
                <Text className="text-red-400 font-bold text-xs">Fold</Text>
              </Pressable>
              {toCall === 0 ? (
                <Pressable onPress={() => act("check")} className="bg-panel border border-border px-3 py-2 rounded-lg mx-1 active:opacity-70">
                  <Text className="text-weered-muted font-bold text-xs">Check</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => act("call")} className="bg-weered px-3 py-2 rounded-lg mx-1 active:opacity-80">
                  <Text className="text-white font-bold text-xs">Call ${toCall}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  setRaiseAmount(String(Math.max(state.currentBet * 2, state.blinds.big * 2)));
                  setRaiseOpen(true);
                }}
                className="bg-green-500 px-3 py-2 rounded-lg mx-1 active:opacity-80"
              >
                <Text className="text-white font-bold text-xs">Raise</Text>
              </Pressable>
            </View>
          ) : (
            <Text className="text-weered-muted text-xs">{state.phase === "waiting" ? "Waiting for more players" : "Waiting for turn"}</Text>
          )}
        </View>
      )}

      {joinOpen && (
        <Modal transparent animationType="fade" onRequestClose={() => setJoinOpen(false)}>
          <View className="flex-1 bg-black/70 justify-center px-5">
            <View className="bg-weered-bg border border-border rounded-2xl p-5">
              <Text className="text-weered-text font-bold text-lg mb-3">Buy in</Text>
              <Text className="text-weered-muted text-xs mb-3">
                Min ${state?.minBuyin} · Max ${state?.maxBuyin} · Blinds {state?.blinds.small}/{state?.blinds.big}
              </Text>
              <TextInput
                value={buyin}
                onChangeText={setBuyin}
                keyboardType="number-pad"
                className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-4"
                style={{ fontSize: 18, fontWeight: "700" }}
              />
              <View className="flex-row">
                <Pressable onPress={() => setJoinOpen(false)} className="flex-1 mr-2 px-3 py-3 rounded-lg bg-panel border border-border active:opacity-70">
                  <Text className="text-weered-muted text-center font-bold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const n = Number(buyin);
                    if (!n || n <= 0) return;
                    wsClient.send({ type: "poker:join", tableId: tid, buyin: n });
                    setJoinOpen(false);
                  }}
                  className="flex-1 px-3 py-3 rounded-lg bg-weered active:opacity-80"
                >
                  <Text className="text-white text-center font-bold">Sit down</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {raiseOpen && state && (
        <Modal transparent animationType="fade" onRequestClose={() => setRaiseOpen(false)}>
          <View className="flex-1 bg-black/70 justify-center px-5">
            <View className="bg-weered-bg border border-border rounded-2xl p-5">
              <Text className="text-weered-text font-bold text-lg mb-1">Raise</Text>
              <Text className="text-weered-muted text-xs mb-3">
                Current bet ${state.currentBet} · Min ${Math.max(state.currentBet * 2, state.blinds.big * 2)} · Your stack ${mySeat?.chips}
              </Text>
              <TextInput
                value={raiseAmount}
                onChangeText={setRaiseAmount}
                keyboardType="number-pad"
                className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-3"
                style={{ fontSize: 18, fontWeight: "700" }}
              />
              <View className="flex-row mb-3">
                {[2, 3, 5].map((mult) => (
                  <Pressable
                    key={mult}
                    onPress={() => setRaiseAmount(String(state.currentBet * mult))}
                    className="bg-panel border border-border px-3 py-1.5 rounded-md mr-2 active:opacity-70"
                  >
                    <Text className="text-weered-muted text-xs font-bold">{mult}x pot</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setRaiseAmount(String((mySeat?.chips || 0) + (mySeat?.bet || 0)))}
                  className="bg-panel border border-border px-3 py-1.5 rounded-md active:opacity-70"
                >
                  <Text className="text-weered-muted text-xs font-bold">All-in</Text>
                </Pressable>
              </View>
              <View className="flex-row">
                <Pressable onPress={() => setRaiseOpen(false)} className="flex-1 mr-2 px-3 py-3 rounded-lg bg-panel border border-border active:opacity-70">
                  <Text className="text-weered-muted text-center font-bold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const n = Number(raiseAmount);
                    if (!n || n <= 0) return;
                    raise(n);
                  }}
                  className="flex-1 px-3 py-3 rounded-lg bg-green-500 active:opacity-80"
                >
                  <Text className="text-white text-center font-bold">Raise to ${raiseAmount}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function CardChip({ card }: { card: Card }) {
  const isHidden = card.rank === "?";
  const isRed = card.suit === "h" || card.suit === "d" || card.suit === "hearts" || card.suit === "diamonds";
  const suit = SUIT_CHAR[card.suit] || card.suit;
  return (
    <View
      className="mx-1 items-center justify-center rounded-lg"
      style={{
        width: 44, height: 62,
        backgroundColor: isHidden ? "#2a2a3a" : "#fefefe",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.4)",
      }}
    >
      {isHidden ? (
        <Text className="text-weered-muted font-black">?</Text>
      ) : (
        <>
          <Text style={{ color: isRed ? "#dc2626" : "#111", fontWeight: "900", fontSize: 18 }}>{card.rank}</Text>
          <Text style={{ color: isRed ? "#dc2626" : "#111", fontSize: 18 }}>{suit}</Text>
        </>
      )}
    </View>
  );
}

function SeatRow({ seat, seatIndex, state, me }: { seat: Seat | null; seatIndex: number; state: TableState; me: string | undefined }) {
  if (!seat) {
    return (
      <View className="px-4 py-2 flex-row items-center border-b border-border/20">
        <Text className="text-weered-muted text-xs w-7">#{seatIndex + 1}</Text>
        <Text className="text-weered-muted/60 text-sm italic">empty seat</Text>
      </View>
    );
  }
  const isMe = me === seat.userId;
  const isTurn = state.turnIndex === seatIndex;
  const isDealer = state.dealerIndex === seatIndex;
  return (
    <View
      className="px-4 py-2.5 flex-row items-center border-b border-border/20"
      style={{ backgroundColor: isTurn ? "rgba(88,0,229,0.1)" : undefined }}
    >
      <Text className="text-weered-muted text-xs w-7">#{seatIndex + 1}</Text>
      <View className="flex-1">
        <View className="flex-row items-center">
          <Text className={`font-bold text-sm ${isMe ? "text-weered" : "text-weered-text"}`}>{seat.name}</Text>
          {isDealer && <Text className="text-amber-400 text-[10px] font-bold ml-2">D</Text>}
          {isTurn && <Text className="text-weered text-[10px] font-bold ml-2">← ACTING</Text>}
          {seat.folded && <Text className="text-weered-muted text-[10px] ml-2">folded</Text>}
          {seat.allIn && <Text className="text-red-400 text-[10px] font-bold ml-2">ALL-IN</Text>}
        </View>
        <Text className="text-weered-muted text-xs">${seat.chips.toLocaleString()} stack · bet ${seat.bet}</Text>
      </View>
      <View className="flex-row">
        {seat.cards.map((c, i) => <CardChip key={i} card={c} />)}
      </View>
    </View>
  );
}
