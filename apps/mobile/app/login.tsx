import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { router } from "expo-router";
import { API_BASE } from "@/lib/config";
import { useAuth } from "@/stores/auth";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const [busy, setBusy] = useState(false);
  const signIn = useAuth((s) => s.signIn);

  async function onGoogle() {
    if (busy) return;
    setBusy(true);
    try {
      const redirectUri = AuthSession.makeRedirectUri({ scheme: "weered", path: "auth/finish" });
      const startUrl = `${API_BASE}/auth/google?redirect=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);

      if (result.type !== "success" || !result.url) {
        setBusy(false);
        return;
      }

      const parsed = new URL(result.url);
      const err = parsed.searchParams.get("error");
      if (err) {
        Alert.alert("Sign-in failed", err.replace(/_/g, " "));
        setBusy(false);
        return;
      }

      const token = parsed.searchParams.get("token");
      const userRaw = parsed.searchParams.get("user");
      if (!token || !userRaw) {
        Alert.alert("Sign-in failed", "Missing token in response.");
        setBusy(false);
        return;
      }

      const user = JSON.parse(decodeURIComponent(userRaw));
      signIn(token, user);
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Sign-in failed", e?.message || "Unknown error");
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-weered-bg">
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-weered-text text-2xl font-bold mb-2">Sign in</Text>
        <Text className="text-weered-muted text-sm text-center mb-10">
          Use your Google account to continue.
        </Text>

        <Pressable
          onPress={onGoogle}
          disabled={busy}
          className="bg-white px-8 py-4 rounded-xl active:opacity-80 flex-row items-center"
          style={{ minWidth: 240, justifyContent: "center" }}
        >
          {busy ? (
            <ActivityIndicator color="#5800E5" />
          ) : (
            <Text className="text-black font-bold text-base">Continue with Google</Text>
          )}
        </Pressable>

        <Text className="text-weered-muted/60 text-xs mt-8 text-center">
          By continuing you agree to Weered's terms and privacy policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}
