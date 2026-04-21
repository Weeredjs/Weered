import { View, Text } from "react-native";

export type Profile = {
  id: string;
  name: string;
  bio?: string | null;
  notoriety?: number;
  notorietyRank?: number | null;
  tier?: string | null;
  globalRole?: string | null;
  joinedAt?: string | null;
  lastSeen?: string | null;
  roomsHosted?: number;
  avatar?: string | null;
  avatarColor?: string | null;
  steamId?: string | null;
  twitchLogin?: string | null;
  xboxGamertag?: string | null;
  gameAccounts?: { platform: string; handle: string }[];
};

export function ProfileBody({ profile, hidePlatforms }: { profile: Profile; hidePlatforms?: boolean }) {
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
      <View className="px-4 pt-5 flex-row">
        <Stat label="Notoriety" value={profile.notoriety?.toLocaleString() ?? "0"} />
        <Stat label="Rank" value={profile.notorietyRank ? `#${profile.notorietyRank}` : "—"} />
        <Stat label="Hosted" value={profile.roomsHosted?.toString() ?? "0"} />
      </View>

      {!hidePlatforms && platforms.length > 0 && (
        <View className="px-4 pt-5">
          <Text className="text-weered-muted text-xs uppercase tracking-widest mb-2">
            Linked platforms
          </Text>
          {platforms.map((p) => (
            <View key={p.label} className="flex-row py-1.5">
              <Text className="text-weered-muted text-sm w-20">{p.label}</Text>
              <Text className="text-weered-text text-sm flex-1" numberOfLines={1}>
                {p.value}
              </Text>
            </View>
          ))}
        </View>
      )}

      {(profile.joinedAt || profile.lastSeen) && (
        <View className="px-4 pt-5">
          <Text className="text-weered-muted text-xs uppercase tracking-widest mb-2">
            Activity
          </Text>
          {profile.joinedAt && (
            <View className="flex-row py-1.5">
              <Text className="text-weered-muted text-sm w-20">Joined</Text>
              <Text className="text-weered-text text-sm flex-1">{formatDate(profile.joinedAt)}</Text>
            </View>
          )}
          {profile.lastSeen && (
            <View className="flex-row py-1.5">
              <Text className="text-weered-muted text-sm w-20">Last seen</Text>
              <Text className="text-weered-text text-sm flex-1">{formatRelative(profile.lastSeen)}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-weered-text text-xl font-black">{value}</Text>
      <Text className="text-weered-muted text-xs uppercase tracking-wide mt-0.5">{label}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
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
  } catch { return iso; }
}
