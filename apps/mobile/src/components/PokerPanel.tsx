import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { LfgPanel } from "@/components/LfgPanel";

const TABLES = [
  { id: "default", label: "Casual table", blinds: "1/2", color: "#5800E5" },
  { id: "highstakes", label: "High stakes", blinds: "10/20", color: "#f59e0b" },
  { id: "turbo", label: "Turbo", blinds: "5/10", color: "#ef4444" },
];

export function PokerPanel({ lobbyId }: { lobbyId: string }) {
  return (
    <View className="border-t border-border/40 pt-3">
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">Poker</Text>

      <View className="px-4">
        <Text className="text-weered-muted text-xs mb-2">
          Texas Hold'em with Paper. Auto-starts at 2+ seated. Up to 9 seats per table.
        </Text>
        {TABLES.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => router.push(`/poker/${t.id}`)}
            className="flex-row items-center px-3 py-3 mb-2 rounded-xl active:opacity-80"
            style={{ backgroundColor: t.color + "15", borderWidth: 1, borderColor: t.color + "55" }}
          >
            <View className="flex-1">
              <Text style={{ color: t.color }} className="font-bold text-base">
                {t.label}
              </Text>
              <Text className="text-weered-muted text-xs">Blinds {t.blinds}</Text>
            </View>
            <Text className="text-weered-text font-bold">Open →</Text>
          </Pressable>
        ))}
      </View>

      <View className="border-t border-border/30 mt-2">
        <LfgPanel lobbyId={lobbyId} />
      </View>
    </View>
  );
}
