import { View, Text, Pressable, ActivityIndicator } from "react-native";

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

export function LivePresenceBadge({
  presence,
  compact,
  onRefresh,
  refreshing,
}: {
  presence: LivePresence;
  compact?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const color = presence ? SOURCE_COLOR[presence.source] || "#94a3b8" : "#94a3b8";

  if (compact) {
    if (!presence) return null;
    return (
      <Text className="text-xs" numberOfLines={1} style={{ color }}>
        {presence.activity}
      </Text>
    );
  }

  if (!presence) {
    if (!onRefresh) return null;
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginHorizontal: 16,
          marginTop: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 4,
          backgroundColor: "rgba(255,255,255,0.04)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <Text style={{ flex: 1, color: "rgba(203,213,225,0.6)", fontSize: 11 }}>
          No live presence detected.
        </Text>
        <Pressable onPress={onRefresh} disabled={refreshing} hitSlop={6}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#5800E5" />
          ) : (
            <Text
              style={{
                color: "#5800E5",
                fontSize: 11,
                fontFamily: "monospace",
                fontWeight: "900",
                letterSpacing: 1,
              }}
            >
              ↻ REFRESH
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 16,
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 4,
        backgroundColor: color + "1a",
        borderWidth: 1,
        borderColor: color + "66",
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          marginRight: 10,
        }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color,
            fontFamily: "monospace",
            fontSize: 10,
            fontWeight: "900",
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {presence.source}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: "rgba(243,244,246,0.96)", fontSize: 13, fontWeight: "700", marginTop: 1 }}
        >
          {presence.activity}
        </Text>
        {!!presence.detail && (
          <Text numberOfLines={1} style={{ color: "rgba(203,213,225,0.65)", fontSize: 11 }}>
            {presence.detail}
          </Text>
        )}
      </View>
      {presence.viewers != null && (
        <Text style={{ color: "rgba(203,213,225,0.72)", fontSize: 11, marginLeft: 8 }}>
          {presence.viewers} viewers
        </Text>
      )}
      {onRefresh && (
        <Pressable onPress={onRefresh} disabled={refreshing} hitSlop={6} style={{ marginLeft: 8 }}>
          {refreshing ? (
            <ActivityIndicator size="small" color={color} />
          ) : (
            <Text style={{ color, fontWeight: "900", fontSize: 14 }}>↻</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
