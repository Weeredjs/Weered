import { View, Text, Pressable } from "react-native";

/**
 * Street-style section header. All-caps monospace with an amber tick and a
 * thick purple underline. Drop in place of plain `<Text>` headers.
 */
export function StampHeader({
  children,
  right,
  tone = "purple",
  className,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  tone?: "purple" | "gold" | "red";
  className?: string;
}) {
  const accent = tone === "gold" ? "#f5b700" : tone === "red" ? "#ef4444" : "#5800E5";
  return (
    <View className={`px-4 pt-4 pb-2 flex-row items-center ${className || ""}`}>
      <View style={{ width: 3, height: 14, backgroundColor: accent, marginRight: 8 }} />
      <Text
        className="flex-1"
        style={{
          fontFamily: "monospace",
          fontSize: 11,
          fontWeight: "900",
          letterSpacing: 1.8,
          color: "rgba(243,244,246,0.92)",
          textTransform: "uppercase",
        }}
      >
        {children}
      </Text>
      {right}
    </View>
  );
}

/**
 * Hard-edged card. Thicker border, tight radius, subtle drop shadow.
 */
export function StreetCard({
  children,
  tone = "default",
  style,
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "gold" | "purple" | "danger";
  style?: any;
  className?: string;
}) {
  const borderColor = tone === "gold"
    ? "rgba(245,183,0,0.35)"
    : tone === "purple"
    ? "rgba(88,0,229,0.45)"
    : tone === "danger"
    ? "rgba(239,68,68,0.45)"
    : "rgba(255,255,255,0.08)";
  return (
    <View
      className={className}
      style={[
        {
          backgroundColor: "rgba(255,255,255,0.04)",
          borderWidth: 1,
          borderColor,
          borderRadius: 6,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.6,
          shadowRadius: 6,
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Chunky primary button with high-contrast drop shadow.
 */
export function StreetButton({
  label,
  onPress,
  disabled,
  tone = "purple",
  size = "md",
  style,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: "purple" | "gold" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  style?: any;
}) {
  const bg = tone === "gold" ? "#f5b700"
    : tone === "danger" ? "#ef4444"
    : tone === "outline" ? "transparent"
    : "#5800E5";
  const txt = tone === "outline" ? "#5800E5"
    : tone === "gold" ? "#1a1408"
    : "#fff";
  const padY = size === "sm" ? 8 : size === "lg" ? 14 : 11;
  const padX = size === "sm" ? 12 : size === "lg" ? 20 : 16;
  const fontSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          backgroundColor: bg,
          paddingVertical: padY,
          paddingHorizontal: padX,
          borderRadius: 4,
          borderWidth: tone === "outline" ? 2 : 0,
          borderColor: "#5800E5",
          opacity: disabled ? 0.5 : 1,
          shadowColor: tone === "gold" ? "#f5b700" : tone === "danger" ? "#ef4444" : "#5800E5",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 4,
        },
        style,
      ]}
      className="active:opacity-80"
    >
      <Text
        style={{
          color: txt,
          fontFamily: "monospace",
          fontWeight: "900",
          fontSize,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Monospace tag/chip for stats, categories, or status labels.
 */
export function Tag({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "gold" | "purple" | "green" | "red";
}) {
  const colors = {
    muted: { bg: "rgba(255,255,255,0.06)", text: "rgba(203,213,225,0.85)", border: "rgba(255,255,255,0.1)" },
    gold:  { bg: "rgba(245,183,0,0.15)",   text: "#f5b700", border: "rgba(245,183,0,0.4)" },
    purple:{ bg: "rgba(88,0,229,0.2)",     text: "#a78bfa", border: "rgba(88,0,229,0.5)" },
    green: { bg: "rgba(34,197,94,0.15)",   text: "#22c55e", border: "rgba(34,197,94,0.4)" },
    red:   { bg: "rgba(239,68,68,0.15)",   text: "#ef4444", border: "rgba(239,68,68,0.4)" },
  };
  const c = colors[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: c.text, fontFamily: "monospace", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }}>
        {children}
      </Text>
    </View>
  );
}
