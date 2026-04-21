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

  const badges = q.data?.badges ?? [];
  if (q.isLoading || badges.length === 0) return null;

  return (
    <View className="px-4 pt-5">
      <Text className="text-weered-muted text-xs uppercase tracking-widest mb-2">
        Badges · {badges.length}
      </Text>
      <View className="flex-row flex-wrap">
        {badges.slice(0, 12).map((b) => {
          const color = RARITY_COLOR[(b.rarity || "common").toLowerCase()] || "#94a3b8";
          return (
            <View
              key={b.id}
              className="mr-2 mb-2 px-2 py-1.5 rounded-lg"
              style={{
                backgroundColor: color + "22",
                borderWidth: 1,
                borderColor: color + "66",
              }}
            >
              <Text className="text-xs font-bold" style={{ color }} numberOfLines={1}>
                {b.name}
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
