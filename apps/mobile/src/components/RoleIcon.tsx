import { View, Text } from "react-native";
import { SvgUri } from "react-native-svg";
import { WEB_BASE } from "@/lib/config";

/**
 * Role + tier icon primitives. Uses the new SVG icon kit (shields, stars, etc.)
 * served from /brand/roles/*.svg on the web app.
 */

const ROLE_MAP: Record<string, { file: string; color: string; name: string }> = {
  GOD: { file: "godfather", color: "#D4A017", name: "Godfather" },
  ADMIN: { file: "lieutenant", color: "#EF4444", name: "Lieutenant" },
  STAFF: { file: "enforcer", color: "#60A5FA", name: "Enforcer" },
  SUPPORT: { file: "backup", color: "#5800E5", name: "Backup" },
  MOD: { file: "captain", color: "#5800E5", name: "Captain" },
  OWNER: { file: "founder", color: "#F97316", name: "Founder" },
  MEMBER: { file: "member", color: "#94A3B8", name: "Member" },
  LEADER: { file: "leader", color: "#D4A017", name: "Leader" },
  OFFICER: { file: "officer", color: "#60A5FA", name: "Officer" },
};

const TIER_MAP: Record<string, { file: string; color: string }> = {
  KINGPIN: { file: "kingpin", color: "#D4A017" },
  FELON: { file: "felon", color: "#F97316" },
  INDICTED: { file: "indicted", color: "#A78BFA" },
};

function svgUri(file: string) {
  return `${WEB_BASE}/brand/roles/${file}.svg`;
}

export function RoleIcon({ role, size = 16 }: { role?: string | null; size?: number }) {
  if (!role) return null;
  const info = ROLE_MAP[String(role).toUpperCase()];
  if (!info) return null;
  return <SvgUri uri={svgUri(info.file)} width={size} height={size} />;
}

export function TierIcon({ tier, size = 16 }: { tier?: string | null; size?: number }) {
  if (!tier) return null;
  const info = TIER_MAP[String(tier).toUpperCase()];
  if (!info) return null;
  return <SvgUri uri={svgUri(info.file)} width={size} height={size} />;
}

export function getRoleName(role?: string | null): string {
  if (!role) return "";
  return ROLE_MAP[String(role).toUpperCase()]?.name || String(role);
}

export function getRoleColor(roleOrTier?: string | null): string {
  if (!roleOrTier) return "#888";
  const k = String(roleOrTier).toUpperCase();
  return ROLE_MAP[k]?.color || TIER_MAP[k]?.color || "#888";
}

export function RoleChip({ role, size = 14 }: { role?: string | null; size?: number }) {
  if (!role) return null;
  const info = ROLE_MAP[String(role).toUpperCase()];
  if (!info) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#0c0b0a",
        borderWidth: 1.5,
        borderColor: info.color,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 3,
        shadowColor: info.color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <RoleIcon role={role} size={size} />
      <Text
        style={{
          color: info.color,
          fontFamily: "monospace",
          fontSize: 11,
          fontWeight: "900",
          letterSpacing: 1.2,
          marginLeft: 6,
          textTransform: "uppercase",
        }}
      >
        {info.name}
      </Text>
    </View>
  );
}

export function TierChip({ tier, size = 14 }: { tier?: string | null; size?: number }) {
  if (!tier) return null;
  const k = String(tier).toUpperCase();
  const info = TIER_MAP[k];
  if (!info) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#0c0b0a",
        borderWidth: 1.5,
        borderColor: info.color,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 3,
        shadowColor: info.color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <TierIcon tier={tier} size={size} />
      <Text
        style={{
          color: info.color,
          fontFamily: "monospace",
          fontSize: 11,
          fontWeight: "900",
          letterSpacing: 1.2,
          marginLeft: 6,
          textTransform: "uppercase",
        }}
      >
        {k}
      </Text>
    </View>
  );
}
