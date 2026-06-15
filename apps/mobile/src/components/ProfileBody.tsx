import { View, Text } from "react-native";
import type { Profile } from "@weered/shared";

// Re-export so existing `import { type Profile } from "@/components/ProfileBody"` still works.
export type { Profile };

export function ProfileBody({
  profile,
  hidePlatforms,
}: {
  profile: Profile;
  hidePlatforms?: boolean;
}) {
  const platforms: { label: string; value: string }[] = [];
  if (profile.steamId) platforms.push({ label: "Steam", value: profile.steamId });
  if (profile.twitchLogin) platforms.push({ label: "Twitch", value: profile.twitchLogin });
  if (profile.xboxGamertag) platforms.push({ label: "Xbox", value: profile.xboxGamertag });
  if (Array.isArray(profile.gameAccounts)) {
    for (const g of profile.gameAccounts) {
      const label = (g?.platform || "").trim();
      const value = (g?.handle || "").trim();
      if (!label || !value) continue;
      if (!platforms.find((p) => p.label.toLowerCase() === label.toLowerCase())) {
        platforms.push({ label: label[0].toUpperCase() + label.slice(1), value });
      }
    }
  }

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 20,
        }}
      >
        <Stat label="Notoriety" value={profile.notoriety?.toLocaleString() ?? "0"} />
        <View style={{ width: 1, height: 36, backgroundColor: "rgba(245,183,0,0.25)" }} />
        <Stat label="Rank" value={profile.notorietyRank ? `#${profile.notorietyRank}` : "—"} />
        <View style={{ width: 1, height: 36, backgroundColor: "rgba(245,183,0,0.25)" }} />
        <Stat label="Hosted" value={profile.roomsHosted?.toString() ?? "0"} />
      </View>

      {!hidePlatforms && platforms.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Text
            style={{
              color: "rgba(203,213,225,0.72)",
              fontFamily: "monospace",
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Linked platforms
          </Text>
          {platforms.map((p) => (
            <View key={p.label} style={{ flexDirection: "row", paddingVertical: 6 }}>
              <Text
                style={{
                  color: "rgba(203,213,225,0.6)",
                  fontFamily: "monospace",
                  fontSize: 12,
                  width: 80,
                }}
              >
                {p.label}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: "rgba(243,244,246,0.96)",
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: "700",
                  flex: 1,
                }}
              >
                {p.value}
              </Text>
            </View>
          ))}
        </View>
      )}

      {(profile.joinedAt || profile.lastSeen) && (
        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Text
            style={{
              color: "rgba(203,213,225,0.72)",
              fontFamily: "monospace",
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Activity
          </Text>
          {profile.joinedAt && (
            <View style={{ flexDirection: "row", paddingVertical: 6 }}>
              <Text
                style={{
                  color: "rgba(203,213,225,0.6)",
                  fontFamily: "monospace",
                  fontSize: 12,
                  width: 80,
                }}
              >
                Joined
              </Text>
              <Text
                style={{
                  color: "rgba(243,244,246,0.96)",
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: "700",
                  flex: 1,
                }}
              >
                {formatDate(profile.joinedAt)}
              </Text>
            </View>
          )}
          {profile.lastSeen && (
            <View style={{ flexDirection: "row", paddingVertical: 6 }}>
              <Text
                style={{
                  color: "rgba(203,213,225,0.6)",
                  fontFamily: "monospace",
                  fontSize: 12,
                  width: 80,
                }}
              >
                Last seen
              </Text>
              <Text
                style={{
                  color: "rgba(243,244,246,0.96)",
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: "700",
                  flex: 1,
                }}
              >
                {formatRelative(profile.lastSeen)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text
        style={{
          color: "rgba(243,244,246,0.98)",
          fontFamily: "monospace",
          fontSize: 22,
          fontWeight: "900",
          letterSpacing: -0.5,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: "rgba(203,213,225,0.72)",
          fontFamily: "monospace",
          fontSize: 10,
          fontWeight: "800",
          letterSpacing: 1.8,
          textTransform: "uppercase",
          marginTop: 3,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string): string {
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(iso);
  } catch {
    return iso;
  }
}
