import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

export default function Onboarding() {
  const me = useAuth((s) => s.user);
  const refreshUser = useAuth((s) => s.refreshUser);
  const [username, setUsername] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);

  useEffect(() => {
    if (clean.length < 2) { setAvailable(null); setReason("too short"); return; }
    setReason(null);
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(() => {
      api<{ available: boolean; reason?: string }>(`/auth/username-check?username=${encodeURIComponent(clean)}`)
        .then((r) => {
          if (cancelled) return;
          setAvailable(r.available);
          if (!r.available) setReason(r.reason || "taken");
        })
        .catch(() => { if (!cancelled) setAvailable(null); })
        .finally(() => { if (!cancelled) setChecking(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [clean]);

  const submit = async () => {
    if (!available || clean.length < 2) return;
    setSubmitting(true);
    try {
      await api("/auth/onboarding", { method: "POST", body: { username: clean } });
      await refreshUser();
      router.replace("/(tabs)/lobbies");
    } catch (e: any) {
      Alert.alert("Couldn't save username", e?.message || "Unknown error");
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "Pick a username", headerBackVisible: false }} />
      <View className="flex-1 px-6 pt-10">
        <Text className="text-weered-text text-2xl font-black mb-1">Welcome, {me?.name?.split(" ")[0] || "friend"}.</Text>
        <Text className="text-weered-muted text-sm mb-8">
          Pick a handle. Lowercase letters, numbers, and underscores only. 2–32 characters.
        </Text>

        <View className="flex-row items-center bg-panel border border-border rounded-xl px-3">
          <Text className="text-weered-muted font-bold mr-1">@</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="yourname"
            placeholderTextColor="rgba(160,160,170,0.5)"
            autoCorrect={false}
            autoCapitalize="none"
            className="flex-1 text-weered-text py-3"
            style={{ fontSize: 18 }}
            maxLength={32}
          />
          {checking && <ActivityIndicator size="small" color="#5800E5" />}
        </View>

        <View className="mt-3 h-5">
          {clean.length >= 2 && available === true && (
            <Text className="text-green-400 text-xs">@{clean} is available.</Text>
          )}
          {clean.length >= 2 && available === false && (
            <Text className="text-red-400 text-xs">@{clean} is {reason || "taken"}.</Text>
          )}
          {clean.length < 2 && username.length > 0 && (
            <Text className="text-weered-muted text-xs">Too short.</Text>
          )}
        </View>

        <Pressable
          onPress={submit}
          disabled={!available || submitting || clean.length < 2}
          className="bg-weered px-6 py-4 rounded-xl active:opacity-80 mt-8"
          style={{ opacity: !available || submitting || clean.length < 2 ? 0.5 : 1 }}
        >
          <Text className="text-white font-bold text-center text-base">
            {submitting ? "Saving…" : "Continue"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
