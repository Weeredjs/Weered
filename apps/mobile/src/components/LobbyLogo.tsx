import { useState } from "react";
import { View, Text, Image } from "react-native";
import { resolveImageUrl } from "@/lib/config";

export function LobbyLogo({
  name,
  url,
  size = 48,
  accent = "#5800E5",
}: {
  name: string;
  url?: string | null;
  size?: number;
  accent?: string | null;
}) {
  const resolved = resolveImageUrl(url);
  const [failed, setFailed] = useState(false);
  const tint = accent || "#5800E5";
  const letter = name.slice(0, 1).toUpperCase();
  const showImg = resolved && !failed;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: tint + "33",
        borderWidth: 1,
        borderColor: tint + "66",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {showImg ? (
        <Image
          source={{ uri: resolved! }}
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={{ color: tint, fontWeight: "900", fontSize: Math.round(size * 0.42) }}>
          {letter}
        </Text>
      )}
    </View>
  );
}
