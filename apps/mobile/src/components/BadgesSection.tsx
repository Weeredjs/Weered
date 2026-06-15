import { View, Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Badge = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  rarity?: string | null;
  earnedAt?: string | null;
};

const RARITY_COLOR: Record<string, string> = {
  legendary: "#f59e0b",
  epic: "#a855f7",
  rare: "#06b6d4",
  uncommon: "#22c55e",
  common: "#94a3b8",
};

export function BadgesSection({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ["badges", userId],
    queryFn: () => api<{ ok: boolean; badges: Badge[] }>(`/badges/user/${userId}`),
    enabled: !!userId,
    staleTime: 60_000,
  });

  // Hyper-defensive: array shape check + per-row type guard. Earlier crash
  // was `undefined is not a function` deep in .map() — likely the rarity
  // field came back as a non-string and `(b.rarity || "common").toLowerCase()`
  // failed. Belt-and-braces: cast through String() and skip null entries.
  const rawBadges = q.data?.badges;
  const badges: Badge[] = Array.isArray(rawBadges) ? (rawBadges.filter(Boolean) as Badge[]) : [];
  if (q.isLoading || badges.length === 0) return null;

  return (
    <View className="px-4 pt-5">
      <Text className="text-weered-muted text-xs uppercase tracking-widest mb-2">
        Badges · {badges.length}
      </Text>
      <View className="flex-row flex-wrap">
        {badges.slice(0, 12).map((b, idx) => {
          if (!b || typeof b !== "object") return null;
          const rarityKey = String(b.rarity ?? "common").toLowerCase();
          const color = RARITY_COLOR[rarityKey] || "#94a3b8";
          const name = typeof b.name === "string" ? b.name : "";
          const key = typeof b.id === "string" && b.id ? b.id : `badge-${idx}`;
          return (
            <View
              key={key}
              className="mr-2 mb-2 px-2 py-1.5 rounded-lg"
              style={{
                backgroundColor: color + "22",
                borderWidth: 1,
                borderColor: color + "66",
              }}
            >
              <Text className="text-xs font-bold" style={{ color }} numberOfLines={1}>
                {name}
              </Text>
            </View>
          );
        })}
        {badges.length > 12 && (
          <View className="px-2 py-1.5">
            <Text className="text-weered-muted text-xs">+{badges.length - 12} more</Text>
          </View>
        )}
      </View>
    </View>
  );
}
