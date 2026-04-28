import { View, Text, Pressable } from "react-native";

// Brand font family names registered via expo-font in app/_layout.tsx.
// These match the @expo-google-fonts package exports — using the wrong
// name silently falls back to system, which is the failure mode we hit
// before this file existed. Always reference fonts through these
// constants so a typo on one screen doesn't quietly de-brand it.
export const FONT = {
  display: "PirataOne_400Regular",         // headlines, hero
  ui: "BarlowCondensed_700Bold",           // default UI/body
  uiBold: "BarlowCondensed_800ExtraBold",  // labels, stamps, tab bar
  uiMed: "BarlowCondensed_500Medium",      // secondary UI
  uiReg: "BarlowCondensed_400Regular",     // captions, paragraphs
  numeric: "Rajdhani_700Bold",             // tabular numbers, stats
  numericReg: "Rajdhani_400Regular",
} as const;

/**
 * Street-style section header. All-caps Barlow Condensed with an accent
 * tick on the left. Drop in place of plain `<Text>` headers.
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
      <View style={{ width: 3, height: 16, backgroundColor: accent, marginRight: 10 }} />
      <Text
        className="flex-1"
        style={{
          fontFamily: FONT.uiBold,
          fontSize: 14,
          letterSpacing: 1.8,
          color: "rgba(243,244,246,0.94)",
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
 * Display headline using Pirata One — for splashy moments only (hero
 * banners, big stats, lobby titles). Don't sprinkle this on UI chrome.
 */
export function DisplayTitle({
  children,
  size = 32,
  color = "rgba(243,244,246,0.96)",
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: any;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: FONT.display,
          fontSize: size,
          color,
          letterSpacing: 0.5,
          lineHeight: size * 1.05,
        },
        style,
      ]}
    >
      {children}
    </Text>
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
  const fontSize = size === "sm" ? 13 : size === "lg" ? 17 : 15;
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
          fontFamily: FONT.uiBold,
          fontSize,
          textTransform: "uppercase",
          letterSpacing: 1.4,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Compact tag/chip for stats, categories, or status labels.
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
    <View style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ color: c.text, fontFamily: FONT.uiBold, fontSize: 11, letterSpacing: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/**
 * Big-number stat with label below. Rajdhani for tabular feel; pairs well
 * inside a StreetCard for hero strips.
 */
export function Stat({
  value,
  label,
  tone = "default",
  size = "md",
  align = "left",
}: {
  value: string | number;
  label: string;
  tone?: "default" | "gold" | "purple" | "green" | "red";
  size?: "sm" | "md" | "lg";
  align?: "left" | "center" | "right";
}) {
  const numColor = tone === "gold" ? "#f5b700"
    : tone === "purple" ? "#a78bfa"
    : tone === "green" ? "#22c55e"
    : tone === "red" ? "#ef4444"
    : "rgba(243,244,246,0.96)";
  const numSize = size === "sm" ? 18 : size === "lg" ? 32 : 24;
  return (
    <View style={{ alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start" }}>
      <Text style={{ fontFamily: FONT.numeric, fontSize: numSize, color: numColor, lineHeight: numSize * 1.05 }}>
        {value}
      </Text>
      <Text
        style={{
          fontFamily: FONT.uiBold,
          fontSize: 9,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "rgba(180,180,190,0.65)",
          marginTop: 3,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Section divider with the rule-and-stamp shape used between groups in lists.
 */
export function SectionDivider({ label, tone = "muted" }: { label?: string; tone?: "muted" | "gold" | "purple" }) {
  const accent = tone === "gold" ? "rgba(245,183,0,0.45)" : tone === "purple" ? "rgba(88,0,229,0.45)" : "rgba(255,255,255,0.1)";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginVertical: 14 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: accent }} />
      {label && (
        <Text
          style={{
            fontFamily: FONT.uiBold,
            fontSize: 10,
            letterSpacing: 1.6,
            color: "rgba(180,180,190,0.5)",
            textTransform: "uppercase",
            marginHorizontal: 10,
          }}
        >
          {label}
        </Text>
      )}
      <View style={{ flex: 1, height: 1, backgroundColor: accent }} />
    </View>
  );
}
