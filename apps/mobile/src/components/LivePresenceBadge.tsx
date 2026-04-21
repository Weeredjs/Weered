import { View, Text } from "react-native";

export type LivePresence = {
  source: "STEAM" | "TWITCH" | "XBOX";
  activity: string;
  detail?: string | null;
  url?: string | null;
  viewers?: number | null;
  updatedAt?: string;
} | null;

const SOURCE_COLOR: Record<string, string> = {
  STEAM: "#66c0f4",
  TWITCH: "#a970ff",
  XBOX: "#52b043",
};

export function LivePresenceBadge({ presence, compact }: { presence: LivePresence; compact?: boolean }) {
  if (!presence) return null;
  const color = SOURCE_COLOR[presence.source] || "#94a3b8";

  if (compact) {
    return (
      <Text className="text-xs" numberOfLines={1} style={{ color }}>
        {presence.activity}
      </Text>
    );
  }

  return (
    <View
      className="mx-4 mt-3 px-3 py-2 rounded-xl flex-row items-center"
      style={{
        backgroundColor: color + "1a",
        borderWidth: 1,
        borderColor: color + "66",
      }}
    >
      <View
        style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: color, marginRight: 8,
        }}
      />
      <View className="flex-1">
        <Text className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
          {presence.source}
        </Text>
        <Text className="text-weered-text text-sm font-semibold" numberOfLines={1}>
          {presence.activity}
        </Text>
        {!!presence.detail && (
          <Text className="text-weered-muted text-xs" numberOfLines={1}>
            {presence.detail}
          </Text>
        )}
      </View>
      {presence.viewers != null && (
        <Text className="text-weered-muted text-xs ml-2">{presence.viewers} viewers</Text>
      )}
    </View>
  );
}
