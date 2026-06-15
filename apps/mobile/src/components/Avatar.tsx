import { useState } from "react";
import { View, Text, Image } from "react-native";

export function Avatar({
  name,
  url,
  size = 32,
  away,
  online,
  ring,
}: {
  name: string;
  url?: string | null;
  size?: number;
  away?: boolean;
  online?: boolean;
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const show = url && !failed;
  const letter = (name || "?").slice(0, 1).toUpperCase();

  // Status border: amber (away) > green (online) > muted
  const borderColor = away ? "#f59e0b" : online ? "#22c55e" : "rgba(120,120,130,0.3)";

  return (
    <View style={{ position: "relative" }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#1a1a1e",
          borderWidth: ring ? 2 : 1,
          borderColor: ring ? "#5800E5" : borderColor,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {show ? (
          <Image
            source={{ uri: url! }}
            style={{ width: size, height: size }}
            onError={() => setFailed(true)}
          />
        ) : (
          <Text style={{ color: "#f0f0f5", fontWeight: "700", fontSize: Math.round(size * 0.42) }}>
            {letter}
          </Text>
        )}
      </View>
      {away && (
        <View
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: Math.max(8, Math.round(size * 0.28)),
            height: Math.max(8, Math.round(size * 0.28)),
            borderRadius: 999,
            backgroundColor: "#f59e0b",
            borderWidth: 2,
            borderColor: "#0c0b0a",
          }}
        />
      )}
      {!away && online && (
        <View
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: Math.max(8, Math.round(size * 0.28)),
            height: Math.max(8, Math.round(size * 0.28)),
            borderRadius: 999,
            backgroundColor: "#22c55e",
            borderWidth: 2,
            borderColor: "#0c0b0a",
          }}
        />
      )}
    </View>
  );
}
