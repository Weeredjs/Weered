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

const AVATAR_COLORS = [
  "#5800E5", "#e85d75", "#f59e0b", "#22c55e",
  "#06b6d4", "#a855f7", "#ef4444", "#eab308",
];

export default function Me() {
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
    mutationFn: (hex: string) => api("/profile/me", { method: "PATCH", body: { avatarColor: hex } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", me?.id] }),
    onError: (e: any) => Alert.alert("Couldn't save color", e?.message || "Unknown error"),
  });

  const uploadAvatar = useMutation({
    mutationFn: (dataUrl: string) => api<{ avatar?: string; error?: string; message?: string }>("/profile/avatar/upload", { method: "POST", body: { image: dataUrl } }),
    onSuccess: (r) => {
      if (r.error) Alert.alert("Couldn't upload", r.message || r.error);
      else { Alert.alert("Avatar updated"); qc.invalidateQueries({ queryKey: ["profile", me?.id] }); }
    },
    onError: (e: any) => Alert.alert("Couldn't upload", e?.message || "Unknown error"),
  });

  async function pickAvatar() {
    let ImagePicker: any;
    try { ImagePicker = require("expo-image-picker"); } catch (e: any) {
      Alert.alert("Image picker unavailable", "Reload the app after installing expo-image-picker.");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Give photos access to pick an avatar."); return; }
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
      <SafeAreaView className="flex-1 bg-weered-bg items-center justify-center">
        <Text className="text-weered-muted">Not signed in.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} className="flex-1 bg-weered-bg">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={profileQ.isRefetching}
            onRefresh={profileQ.refetch}
            tintColor="#5800E5"
          />
        }
      >
        <View className="items-center pt-6 pb-3">
          <Pressable onPress={pickAvatar} className="active:opacity-80">
            <Avatar name={me.name} url={profile?.avatar || me.avatar} size={96} />
            {uploadAvatar.isPending && (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 48 }}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </Pressable>
          <Text className="text-weered-muted text-[10px] mt-1.5">Tap avatar to change (Indicted+)</Text>
          <Text className="text-weered-text text-2xl font-black mt-2">{me.name}</Text>
          {profile?.tier && (
            <Text className="text-weered-muted text-xs uppercase tracking-widest mt-0.5">
              {profile.tier}
              {profile.globalRole && profile.globalRole !== "USER" ? ` · ${profile.globalRole}` : ""}
            </Text>
          )}
        </View>

        <LivePresenceBadge presence={livePresence} />

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
                      onPress={() => { setBio(profile.bio || ""); setEditingBio(false); }}
                      className="bg-panel border border-border px-4 py-2 rounded-lg active:opacity-80"
                    >
                      <Text className="text-weered-muted font-bold text-sm">Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setEditingBio(true)} className="active:opacity-70">
                  <Text className={profile.bio ? "text-weered-text text-sm" : "text-weered-muted text-sm italic"}>
                    {profile.bio || "Tap to add a bio"}
                  </Text>
                </Pressable>
              )}
            </Section>

            <Section title="Avatar color">
              <View className="flex-row flex-wrap">
                {AVATAR_COLORS.map((hex) => (
                  <Pressable
                    key={hex}
                    onPress={() => { setColor(hex); saveColor.mutate(hex); }}
                    className="mr-2 mb-2 active:opacity-80"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: hex,
                      borderWidth: color === hex ? 3 : 0,
                      borderColor: "#ffffff",
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

        <View className="px-4 mt-6">
          <View className="flex-row mb-2">
            <Pressable
              onPress={() => router.push("/store")}
              className="flex-1 mr-2 bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-weered-text font-semibold text-center">Store</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/inventory")}
              className="flex-1 mr-2 bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-weered-text font-semibold text-center">Inventory</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/market")}
              className="flex-1 bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-weered-text font-semibold text-center">Market</Text>
            </Pressable>
          </View>
          <View className="flex-row mb-2">
            <Pressable
              onPress={() => router.push("/activity")}
              className="flex-1 mr-2 bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-weered-text font-semibold text-center">Activity</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/news")}
              className="flex-1 bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-weered-text font-semibold text-center">News</Text>
            </Pressable>
          </View>
          <View className="flex-row mb-2">
            <Pressable
              onPress={() => router.push("/hot")}
              className="flex-1 mr-2 bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-weered-text font-semibold text-center">🔥 Hot</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/notoriety")}
              className="flex-1 bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-weered-text font-semibold text-center">Notoriety</Text>
            </Pressable>
          </View>
          <View className="flex-row mb-2">
            <Pressable
              onPress={() => router.push("/crews")}
              className="flex-1 mr-2 bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-weered-text font-semibold text-center">Crews</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/forum")}
              className="flex-1 mr-2 bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-weered-text font-semibold text-center">Forum</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/challenges")}
              className="flex-1 bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-weered-text font-semibold text-center">Challenges</Text>
            </Pressable>
          </View>
          <View className="flex-row mb-2">
            <Pressable
              onPress={() => router.push("/tournaments")}
              className="flex-1 mr-2 bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-weered-text font-semibold text-center">🏆 Tournaments</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/invites")}
              className="flex-1 bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-weered-text font-semibold text-center">Invites</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push("/subscribe")}
            className="bg-panel border border-weered/40 px-4 py-3 rounded-xl active:opacity-80 mb-2"
          >
            <Text className="text-weered font-semibold text-center">💎 Subscribe</Text>
          </Pressable>
          {["GOD", "STAFF", "ADMIN", "SUPPORT"].includes(String(profile?.globalRole || "")) && (
            <Pressable
              onPress={() => router.push("/staff")}
              className="bg-panel border border-amber-500/40 px-4 py-3 rounded-xl active:opacity-80 mb-2"
            >
              <Text className="text-amber-400 font-semibold text-center">Staff console</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push("/settings")}
            className="bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80 mb-2"
          >
            <Text className="text-weered-text font-semibold text-center">Settings · Blocked users</Text>
          </Pressable>
          <Pressable
            onPress={() => Share.share({
              message: `Join me on Weered — ${WEB_BASE}`,
              url: WEB_BASE,
            }).catch(() => {})}
            className="bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80 mb-2"
          >
            <Text className="text-weered-text font-semibold text-center">📤 Share Weered</Text>
          </Pressable>
          <Pressable
            onPress={() => Alert.alert("Sign out?", "You'll need to sign in again to use Weered.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: signOut },
            ])}
            className="bg-panel border border-border px-4 py-3 rounded-xl active:opacity-80"
          >
            <Text className="text-red-400 font-semibold text-center">Sign out</Text>
          </Pressable>

          <View className="items-center mt-6 mb-2">
            <Text className="text-weered-muted/60 text-[10px]">
              Weered mobile v{Constants.expoConfig?.version || "0.1.0"}
              {Constants.expoConfig?.runtimeVersion ? ` · rt ${Constants.expoConfig.runtimeVersion}` : ""}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="px-4 pt-5">
      <Text className="text-weered-muted text-xs uppercase tracking-widest mb-2">{title}</Text>
      {children}
    </View>
  );
}
