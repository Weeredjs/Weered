import { useState } from "react";
import { Text, Linking, Alert, View, Image, Pressable } from "react-native";
import { router } from "expo-router";
import { useImageLightbox } from "@/components/ImageLightbox";

const TOKEN_REGEX = /(https?:\/\/[^\s<>()"']+|www\.[^\s<>()"']+|@[a-zA-Z0-9_]{2,32})/g;
const IMG_EXT = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;
const TENOR_RE = /^https?:\/\/media\.tenor\.com\/[^\s]+$/i;

function toFullUrl(raw: string): string {
  const cleaned = raw.replace(/[),.;:!?]+$/, "");
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

function isImageUrl(u: string) {
  return IMG_EXT.test(u) || TENOR_RE.test(u);
}

export function RichText({
  body,
  style,
  linkStyle,
  mentionStyle,
  renderImages = true,
}: {
  body: string;
  style?: any;
  linkStyle?: any;
  mentionStyle?: any;
  renderImages?: boolean;
}) {
  type Part = { type: "text" | "url" | "mention" | "image"; value: string };
  const parts: Part[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(TOKEN_REGEX)) {
    const start = match.index ?? 0;
    if (start > lastIndex) parts.push({ type: "text", value: body.slice(lastIndex, start) });
    const raw = match[0];
    if (raw.startsWith("@")) parts.push({ type: "mention", value: raw });
    else {
      const full = toFullUrl(raw);
      if (renderImages && isImageUrl(full)) parts.push({ type: "image", value: full });
      else parts.push({ type: "url", value: raw });
    }
    lastIndex = start + raw.length;
  }
  if (lastIndex < body.length) parts.push({ type: "text", value: body.slice(lastIndex) });

  const textParts = parts.filter((p) => p.type !== "image");
  const imageParts = parts.filter((p) => p.type === "image");
  const textIsEmpty = textParts.every((p) => p.type === "text" && !p.value.trim());

  return (
    <View>
      {!textIsEmpty && (
        <Text style={style}>
          {textParts.map((p, i) => {
            if (p.type === "text") return <Text key={i}>{p.value}</Text>;
            if (p.type === "mention") {
              const handle = p.value.slice(1);
              return (
                <Text
                  key={i}
                  style={[{ color: "#a78bfa", fontWeight: "700" }, mentionStyle]}
                  onPress={() => router.push(`/user/${handle}`)}
                >
                  {p.value}
                </Text>
              );
            }
            return (
              <Text
                key={i}
                style={[{ color: "#8b5cf6", textDecorationLine: "underline" }, linkStyle]}
                onPress={() => {
                  const full = toFullUrl(p.value);
                  Linking.openURL(full).catch(() => Alert.alert("Couldn't open link", full));
                }}
              >
                {p.value}
              </Text>
            );
          })}
        </Text>
      )}
      {imageParts.map((p, i) => (
        <InlineImage key={`img-${i}`} url={p.value} />
      ))}
    </View>
  );
}

function InlineImage({ url }: { url: string }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const lightbox = useImageLightbox();

  if (failed) {
    return (
      <Pressable onPress={() => Linking.openURL(url).catch(() => {})} className="mt-1">
        <Text style={{ color: "#8b5cf6", textDecorationLine: "underline", fontSize: 13 }}>
          {url}
        </Text>
      </Pressable>
    );
  }

  const aspect = size ? size.w / size.h : 1.5;
  return (
    <Pressable
      onPress={() => lightbox.open(url)}
      className="mt-1.5"
      style={{ maxWidth: 240, borderRadius: 10, overflow: "hidden" }}
    >
      <Image
        source={{ uri: url }}
        style={{ width: 240, aspectRatio: aspect, backgroundColor: "#1a1a1a" }}
        resizeMode="cover"
        onLoad={(e) => {
          const { width, height } = e.nativeEvent.source;
          if (width && height) setSize({ w: width, h: height });
        }}
        onError={() => setFailed(true)}
      />
    </Pressable>
  );
}
