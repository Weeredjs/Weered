import { View, Text } from "react-native";

const MODULE_LABEL: Record<string, string> = {
  BUNGIE: "DESTINY",
  RIOT: "LEAGUE",
  FORTNITE: "FORTNITE",
  CRYPTO: "CRYPTO",
  FAKEOUT: "FAKEOUT",
  DND: "D&D",
  YOUTUBE: "CO-WATCH",
  MUSIC: "MUSIC",
  LIVEKIT: "VOICE",
  STORM: "STORMS",
  BIRD: "BIRDING",
  CAR: "GARAGE",
  BOOK: "BOOKS",
  FANTASY: "FANTASY",
  FISH: "FISHING",
  TRUCK: "TRUCKING",
};

export function ModuleBadge({ type, accent }: { type: string; accent?: string | null }) {
  const label = MODULE_LABEL[type] || type;
  const color = accent || "#5800E5";
  return (
    <View
      style={{
        marginLeft: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: color + "22",
        borderWidth: 1,
        borderColor: color + "55",
      }}
    >
      <Text style={{ color, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}
