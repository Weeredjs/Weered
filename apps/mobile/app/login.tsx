import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { router } from "expo-router";
import { API_BASE } from "@/lib/config";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/api";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      const isNew = parsed.searchParams.get("new") === "1";
      router.replace(isNew ? "/onboarding" : "/(tabs)/lobbies");
    } catch (e: any) {
      Alert.alert("Sign-in failed", e?.message || "Unknown error");
      setBusy(false);
    }
  }

  async function onPassword() {
    if (busy) return;
    const u = username.trim().toLowerCase();
    const p = password.trim();
    if (!u || !p) return;
    setBusy(true);
    try {
      const r = await api<{ token: string; user: any; error?: string }>(`/auth/${mode}`, {
        method: "POST",
        body: { username: u, password: p },
      });
      if (!r.token) throw new Error(r.error || "auth_failed");
      signIn(r.token, r.user);
      router.replace(mode === "register" ? "/onboarding" : "/(tabs)/lobbies");
    } catch (e: any) {
      const msg = e?.message || "Unknown error";
      Alert.alert(mode === "register" ? "Couldn't register" : "Couldn't sign in", msg);
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-weered-bg">
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-weered-text text-2xl font-bold mb-2">Sign in</Text>
        <Text className="text-weered-muted text-sm text-center mb-8">
          Google is recommended. Username/password available as fallback.
        </Text>

        <Pressable
          onPress={onGoogle}
          disabled={busy}
          className="bg-white px-8 py-4 rounded-xl active:opacity-80 flex-row items-center"
          style={{ minWidth: 240, justifyContent: "center" }}
        >
          {busy && !showPassword ? (
            <ActivityIndicator color="#5800E5" />
          ) : (
            <Text className="text-black font-bold text-base">Continue with Google</Text>
          )}
        </Pressable>

        {!showPassword ? (
          <Pressable onPress={() => setShowPassword(true)} hitSlop={6} className="mt-6">
            <Text className="text-weered-muted text-sm">Use username & password instead</Text>
          </Pressable>
        ) : (
          <View className="mt-6 w-full max-w-sm">
            <View className="flex-row justify-center mb-3">
              <Pressable
                onPress={() => setMode("login")}
                className={`px-4 py-1.5 rounded-full mr-2 ${mode === "login" ? "bg-weered" : "bg-panel border border-border"}`}
              >
                <Text className={`text-xs font-bold ${mode === "login" ? "text-white" : "text-weered-muted"}`}>Sign in</Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("register")}
                className={`px-4 py-1.5 rounded-full ${mode === "register" ? "bg-weered" : "bg-panel border border-border"}`}
              >
                <Text className={`text-xs font-bold ${mode === "register" ? "text-white" : "text-weered-muted"}`}>Create account</Text>
              </Pressable>
            </View>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor="rgba(160,160,170,0.6)"
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-2"
              style={{ fontSize: 16 }}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="password"
              placeholderTextColor="rgba(160,160,170,0.6)"
              secureTextEntry
              autoCapitalize="none"
              className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-3"
              style={{ fontSize: 16 }}
            />
            <Pressable
              onPress={onPassword}
              disabled={busy || !username.trim() || !password.trim()}
              className="bg-weered px-6 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-white font-bold text-center">
                {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
              </Text>
            </Pressable>
            <Pressable onPress={() => { setShowPassword(false); setUsername(""); setPassword(""); }} hitSlop={6} className="mt-3">
              <Text className="text-weered-muted text-xs text-center">Use Google instead</Text>
            </Pressable>
          </View>
        )}

        <Text className="text-weered-muted/60 text-xs mt-8 text-center">
          By continuing you agree to Weered's terms and privacy policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}
