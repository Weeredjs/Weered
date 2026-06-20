import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { WEB_BASE } from "@/lib/config";
import { Avatar } from "@/components/Avatar";
import { ProfileBody, type Profile } from "@/components/ProfileBody";
import { BadgesSection } from "@/components/BadgesSection";
import { PlatformLinks } from "@/components/PlatformLinks";
import { LivePresenceBadge, type LivePresence } from "@/components/LivePresenceBadge";
import { WalletCard } from "@/components/WalletCard";
import { BungieLinkButton } from "@/components/BungieLinkButton";
import { Ionicons } from "@expo/vector-icons";
import { RoleChip, TierChip } from "@/components/RoleIcon";
import { FONT, StampHeader } from "@/components/Brand";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const AVATAR_COLORS = [
  "#5800E5",
  "#e85d75",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#a855f7",
  "#ef4444",
  "#eab308",
];

function MeInner() {
  const me = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile", me?.id],
    queryFn: () => api<{ ok: boolean } & Profile>(`/profile/${me!.id}`),
    enabled: !!me?.id,
  });

  const presenceQ = useQuery({
    queryKey: ["my-presence"],
    queryFn: () => api<{ ok: boolean; livePresence: LivePresence | null }>("/profile/me/presence"),
    refetchInterval: 60_000,
    enabled: !!me?.id,
  });

  const refreshPresence = useMutation({
    mutationFn: () => api("/profile/me/presence/refresh", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-presence"] }),
  });

  const profile = profileQ.data;
  const livePresence = presenceQ.data?.livePresence || null;
  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  const [color, setColor] = useState<string | null>(null);

  // Sync local editable state from server whenever we refetch.
  useEffect(() => {
    if (profile && !editingBio) setBio(profile.bio || "");
    if (profile && color == null) setColor(profile.avatarColor || null);
  }, [profile, editingBio, color]);

  const saveBio = useMutation({
    mutationFn: (newBio: string) => api("/profile/me", { method: "PATCH", body: { bio: newBio } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", me?.id] });
      setEditingBio(false);
    },
    onError: (e: any) => Alert.alert("Couldn't save bio", e?.message || "Unknown error"),
  });

  const saveColor = useMutation({
    mutationFn: (hex: string) =>
      api("/profile/me", { method: "PATCH", body: { avatarColor: hex } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", me?.id] }),
    onError: (e: any) => Alert.alert("Couldn't save color", e?.message || "Unknown error"),
  });

  const uploadAvatar = useMutation({
    mutationFn: (dataUrl: string) =>
      api<{ avatar?: string; error?: string; message?: string }>("/profile/avatar/upload", {
        method: "POST",
        body: { image: dataUrl },
      }),
    onSuccess: (r) => {
      if (r.error) Alert.alert("Couldn't upload", r.message || r.error);
      else {
        Alert.alert("Avatar updated");
        qc.invalidateQueries({ queryKey: ["profile", me?.id] });
      }
    },
    onError: (e: any) => Alert.alert("Couldn't upload", e?.message || "Unknown error"),
  });

  async function pickAvatar() {
    let ImagePicker: any;
    try {
      ImagePicker = require("expo-image-picker");
    } catch (_e: any) {
      Alert.alert("Image picker unavailable", "Reload the app after installing expo-image-picker.");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Give photos access to pick an avatar.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const asset = res.assets[0];
    const mime = asset.mimeType || (asset.uri?.endsWith(".png") ? "image/png" : "image/jpeg");
    const dataUrl = `data:${mime};base64,${asset.base64}`;
    // Size check (2MB)
    if (dataUrl.length > 2.8 * 1024 * 1024) {
      Alert.alert("Too big", "Pick a smaller image (under 2MB).");
      return;
    }
    uploadAvatar.mutate(dataUrl);
  }

  if (!me) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#0c0b0a",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "rgba(203,213,225,0.72)" }}>Not signed in.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: "#0c0b0a" }}>
      <ScrollView
        style={{ backgroundColor: "#0c0b0a" }}
        contentContainerStyle={{ paddingBottom: 40, backgroundColor: "#0c0b0a" }}
        refreshControl={
          <RefreshControl
            refreshing={profileQ.isRefetching}
            onRefresh={profileQ.refetch}
            tintColor="#5800E5"
          />
        }
      >
        <View
          style={{
            paddingTop: 28,
            paddingBottom: 18,
            alignItems: "center",
            backgroundColor: "#120a22",
            borderBottomWidth: 1,
            borderBottomColor: "rgba(88,0,229,0.35)",
          }}
        >
          <View
            style={{
              width: 80,
              height: 2,
              backgroundColor: "#5800E5",
              marginBottom: 14,
              opacity: 0.6,
            }}
          />
          <Pressable
            onPress={pickAvatar}
            style={{
              shadowColor: "#5800E5",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <Avatar name={me.name} url={profile?.avatar || me.avatar} size={104} />
            {uploadAvatar.isPending && (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.5)",
                  borderRadius: 52,
                }}
              >
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </Pressable>
          <Text
            style={{
              color: "rgba(203,213,225,0.5)",
              fontSize: 10,
              fontFamily: FONT.uiBold,
              letterSpacing: 1.4,
              marginTop: 6,
              textTransform: "uppercase",
            }}
          >
            Tap to change · Indicted+
          </Text>
          <Text
            style={{
              color: "rgba(243,244,246,0.98)",
              fontFamily: FONT.display,
              fontSize: 32,
              letterSpacing: 0.8,
              marginTop: 8,
            }}
          >
            {me.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 }}>
            {profile?.globalRole && profile.globalRole !== "USER" && (
              <RoleChip role={profile.globalRole} size={16} />
            )}
            {profile?.tier && profile.tier !== "INNOCENT" && (
              <TierChip tier={profile.tier} size={16} />
            )}
          </View>
        </View>

        <LivePresenceBadge
          presence={livePresence}
          onRefresh={() => refreshPresence.mutate()}
          refreshing={refreshPresence.isPending}
        />

        <WalletCard />

        <BungieLinkButton />

        {profileQ.isLoading ? (
          <View className="py-10 items-center">
            <ActivityIndicator color="#5800E5" />
          </View>
        ) : profile ? (
          <>
            <Section title="Bio">
              {editingBio ? (
                <View>
                  <TextInput
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell people about you (280 chars max)"
                    placeholderTextColor="rgba(160,160,170,0.6)"
                    multiline
                    maxLength={280}
                    className="bg-panel text-weered-text px-3 py-2 rounded-lg"
                    style={{ minHeight: 80, textAlignVertical: "top" }}
                  />
                  <Text className="text-weered-muted text-xs mt-1 text-right">
                    {bio.length}/280
                  </Text>
                  <View className="flex-row mt-2">
                    <Pressable
                      onPress={() => saveBio.mutate(bio.trim())}
                      disabled={saveBio.isPending}
                      className="bg-weered px-4 py-2 rounded-lg active:opacity-80 mr-2"
                    >
                      <Text className="text-white font-bold text-sm">Save</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setBio(profile.bio || "");
                        setEditingBio(false);
                      }}
                      className="bg-panel border border-border px-4 py-2 rounded-lg active:opacity-80"
                    >
                      <Text className="text-weered-muted font-bold text-sm">Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setEditingBio(true)} className="active:opacity-70">
                  <Text
                    className={
                      profile.bio ? "text-weered-text text-sm" : "text-weered-muted text-sm italic"
                    }
                  >
                    {profile.bio || "Tap to add a bio"}
                  </Text>
                </Pressable>
              )}
            </Section>

            <Section title="Avatar color">
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {AVATAR_COLORS.map((hex) => (
                  <Pressable
                    key={hex}
                    onPress={() => {
                      setColor(hex);
                      saveColor.mutate(hex);
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: hex,
                      borderWidth: color === hex ? 3 : 0,
                      borderColor: "#ffffff",
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  />
                ))}
              </View>
            </Section>

            <ProfileBody profile={profile} hidePlatforms />
            <PlatformLinks profile={profile} meId={me.id} />
            <BadgesSection userId={me.id} />
          </>
        ) : (
          <View className="py-10 items-center px-8">
            <Text className="text-red-400 text-sm text-center">Couldn't load profile.</Text>
          </View>
        )}

        <View style={{ marginTop: 6 }}>
          <DossierSection title="Identity">
            <NavTile
              icon="trophy-outline"
              label="Notoriety"
              tone="gold"
              onPress={() => router.push("/notoriety")}
            />
            <NavTile
              icon="bag-handle-outline"
              label="Inventory"
              onPress={() => router.push("/inventory")}
            />
            <NavTile
              icon="pulse-outline"
              label="Activity"
              onPress={() => router.push("/activity")}
            />
          </DossierSection>

          <DossierSection title="Circle">
            <NavTile icon="people-outline" label="Crews" onPress={() => router.push("/crews")} />
            <NavTile
              icon="chatbubbles-outline"
              label="Forum"
              onPress={() => router.push("/forum")}
            />
            <NavTile icon="mail-outline" label="Invites" onPress={() => router.push("/invites")} />
            <NavTile
              icon="share-social-outline"
              label="Share"
              onPress={() =>
                Share.share({ message: `Join me on Weered — ${WEB_BASE}`, url: WEB_BASE }).catch(
                  () => {},
                )
              }
            />
          </DossierSection>

          <DossierSection title="Games & Goods">
            <NavTile
              icon="cash-outline"
              label="Store"
              tone="gold"
              onPress={() => router.push("/store")}
            />
            <NavTile
              icon="storefront-outline"
              label="Market"
              onPress={() => router.push("/market")}
            />
            <NavTile
              icon="flag-outline"
              label="Challenges"
              onPress={() => router.push("/challenges")}
            />
            <NavTile
              icon="ribbon-outline"
              label="Tournaments"
              tone="gold"
              onPress={() => router.push("/tournaments")}
            />
            <NavTile
              icon="flame-outline"
              label="Hot"
              tone="red"
              onPress={() => router.push("/hot")}
            />
            <NavTile icon="newspaper-outline" label="News" onPress={() => router.push("/news")} />
          </DossierSection>

          <DossierSection title="Account">
            <NavTile
              icon="settings-outline"
              label="Settings"
              onPress={() => router.push("/settings")}
            />
            <NavTile
              icon="diamond-outline"
              label="Subscribe"
              tone="purple"
              onPress={() => router.push("/subscribe")}
            />
            {["GOD", "STAFF", "ADMIN", "SUPPORT"].includes(String(profile?.globalRole || "")) && (
              <NavTile
                icon="shield-checkmark-outline"
                label="Staff"
                tone="gold"
                onPress={() => router.push("/staff")}
              />
            )}
          </DossierSection>
        </View>

        <View className="px-3 mt-2">
          <Pressable
            onPress={() =>
              Alert.alert("Sign out?", "You'll need to sign in again to use Weered.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Sign out",
                  style: "destructive",
                  onPress: () => {
                    signOut();
                    router.replace("/login");
                  },
                },
              ])
            }
            className="active:opacity-80 mt-4 mx-1"
            style={{
              backgroundColor: "rgba(239,68,68,0.1)",
              borderWidth: 1,
              borderColor: "rgba(239,68,68,0.3)",
              paddingVertical: 14,
              borderRadius: 4,
            }}
          >
            <Text
              style={{
                color: "#ef4444",
                fontFamily: FONT.uiBold,
                textAlign: "center",
                letterSpacing: 2,
                textTransform: "uppercase",
                fontSize: 14,
              }}
            >
              Sign out
            </Text>
          </Pressable>

          <FooterLinks />

          <View className="items-center mt-6 mb-2">
            <Text className="text-weered-muted/60 text-[10px]">
              Weered mobile v{Constants.expoConfig?.version || "0.1.0"}
              {Constants.expoConfig?.runtimeVersion
                ? ` · rt ${Constants.expoConfig.runtimeVersion}`
                : ""}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FooterLinks() {
  const [open, setOpen] = useState(false);
  const links: { label: string; path: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: "About", path: "/about", icon: "information-circle-outline" },
    { label: "Premium", path: "/premium", icon: "diamond-outline" },
    { label: "Guidelines", path: "/guidelines", icon: "book-outline" },
    { label: "Contact", path: "/contact", icon: "mail-outline" },
    { label: "Apply to Mod", path: "/apply", icon: "shield-outline" },
    { label: "Terms", path: "/terms", icon: "document-text-outline" },
    { label: "Privacy", path: "/privacy", icon: "lock-closed-outline" },
  ];
  return (
    <View className="mt-5">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="active:opacity-80 mx-1"
        style={{
          backgroundColor: "#15131a",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 4,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View className="flex-row items-center">
          <Ionicons name="link-outline" size={14} color="rgba(203,213,225,0.7)" />
          <Text
            style={{
              color: "rgba(203,213,225,0.8)",
              fontFamily: "monospace",
              fontWeight: "900",
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginLeft: 8,
            }}
          >
            About & Links
          </Text>
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={14}
          color="rgba(203,213,225,0.5)"
        />
      </Pressable>
      {open && (
        <View
          className="mx-1 mt-1"
          style={{
            backgroundColor: "#0d0c12",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.06)",
            borderRadius: 4,
          }}
        >
          {links.map((l, i) => (
            <Pressable
              key={l.path}
              onPress={() => WebBrowser.openBrowserAsync(`${WEB_BASE}${l.path}`).catch(() => {})}
              className="active:opacity-60"
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                borderBottomWidth: i === links.length - 1 ? 0 : 1,
                borderBottomColor: "rgba(255,255,255,0.05)",
              }}
            >
              <Ionicons name={l.icon} size={14} color="rgba(203,213,225,0.6)" />
              <Text
                style={{
                  color: "rgba(203,213,225,0.85)",
                  fontFamily: "monospace",
                  fontWeight: "700",
                  fontSize: 12,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  marginLeft: 10,
                  flex: 1,
                }}
              >
                {l.label}
              </Text>
              <Ionicons name="open-outline" size={13} color="rgba(203,213,225,0.4)" />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
      <Text
        style={{
          color: "rgba(203,213,225,0.72)",
          fontFamily: FONT.uiBold,
          fontSize: 12,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

// Dossier sections — branded folder-tab look. The horizontal rule under
// the heading + the brass tick borrow from the desktop UserCorner aesthetic.
function DossierSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 14 }}>
      <StampHeader tone="gold">{title}</StampHeader>
      <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12 }}>
        {children}
      </View>
    </View>
  );
}

function NavTile({
  icon,
  label,
  onPress,
  tone = "default",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "default" | "gold" | "purple" | "red";
}) {
  const colors = {
    default: {
      bg: "#15131a",
      border: "rgba(255,255,255,0.1)",
      icon: "#d1d5db",
      text: "rgba(243,244,246,0.92)",
      shadow: "transparent",
    },
    gold: {
      bg: "#1a1408",
      border: "rgba(245,183,0,0.45)",
      icon: "#f5b700",
      text: "#f5b700",
      shadow: "#f5b700",
    },
    purple: {
      bg: "#160a24",
      border: "rgba(88,0,229,0.5)",
      icon: "#a78bfa",
      text: "#a78bfa",
      shadow: "#5800E5",
    },
    red: {
      bg: "#1a0a0a",
      border: "rgba(239,68,68,0.4)",
      icon: "#f87171",
      text: "#f87171",
      shadow: "#ef4444",
    },
  };
  const c = colors[tone];
  return (
    <View style={{ width: "33.333%", padding: 4 }}>
      <Pressable
        onPress={onPress}
        style={{
          backgroundColor: c.bg,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 4,
          paddingVertical: 18,
          paddingHorizontal: 4,
          minHeight: 92,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: c.shadow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: tone === "default" ? 0 : 0.3,
          shadowRadius: 6,
          elevation: tone === "default" ? 0 : 2,
        }}
      >
        <Ionicons name={icon} size={26} color={c.icon} />
        <Text
          numberOfLines={1}
          style={{
            color: c.text,
            fontFamily: FONT.uiBold,
            fontSize: 11,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            marginTop: 8,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

export default function Me() {
  return (
    <ErrorBoundary label="Me tab">
      <MeInner />
    </ErrorBoundary>
  );
}
