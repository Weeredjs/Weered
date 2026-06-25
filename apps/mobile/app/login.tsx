import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, TextInput, Image } from "react-native";
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
        Alert.alert("Sign-in failed", err.replaceAll(/_/g, " "));
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
        <Image
          source={require("../assets/logo.png")}
          style={{ width: 140, height: 140, marginBottom: 12 }}
          resizeMode="contain"
        />
        <Text
          style={{
            fontFamily: "monospace",
            fontSize: 36,
            fontWeight: "900",
            letterSpacing: -1,
            color: "rgba(243,244,246,0.96)",
          }}
        >
          WEERED
        </Text>
        <Text
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: "700",
            color: "#f5b700",
            letterSpacing: 2,
            marginTop: 4,
          }}
        >
          LOBBIES · CREWS · CRIME
        </Text>
        <View
          style={{
            width: 80,
            height: 2,
            backgroundColor: "#5800E5",
            marginTop: 16,
            marginBottom: 28,
          }}
        />

        <Pressable
          onPress={onGoogle}
          disabled={busy}
          className="bg-white active:opacity-80 flex-row items-center"
          style={{
            minWidth: 260,
            justifyContent: "center",
            paddingVertical: 14,
            paddingHorizontal: 24,
            borderRadius: 4,
            shadowColor: "#fff",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 10,
            elevation: 3,
          }}
        >
          {busy && !showPassword ? (
            <ActivityIndicator color="#5800E5" />
          ) : (
            <Text
              style={{
                color: "#111",
                fontFamily: "monospace",
                fontWeight: "900",
                fontSize: 14,
                letterSpacing: 1.4,
                textTransform: "uppercase",
              }}
            >
              Continue with Google
            </Text>
          )}
        </Pressable>

        {!showPassword ? (
          <>
            <View className="flex-row items-center mt-5 mb-4" style={{ width: 260 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.12)" }} />
              <Text
                style={{
                  marginHorizontal: 10,
                  color: "rgba(203,213,225,0.6)",
                  fontFamily: "monospace",
                  fontSize: 10,
                  letterSpacing: 1.5,
                  fontWeight: "800",
                }}
              >
                OR
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.12)" }} />
            </View>
            <View className="flex-row" style={{ gap: 8 }}>
              <Pressable
                onPress={() => {
                  setMode("login");
                  setShowPassword(true);
                }}
                className="active:opacity-80"
                style={{
                  backgroundColor: "#5800E5",
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: 4,
                  shadowColor: "#5800E5",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontFamily: "monospace",
                    fontWeight: "900",
                    fontSize: 13,
                    letterSpacing: 1.4,
                    textTransform: "uppercase",
                  }}
                >
                  Sign in
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMode("register");
                  setShowPassword(true);
                }}
                className="active:opacity-80"
                style={{
                  backgroundColor: "transparent",
                  borderWidth: 2,
                  borderColor: "#f5b700",
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    color: "#f5b700",
                    fontFamily: "monospace",
                    fontWeight: "900",
                    fontSize: 13,
                    letterSpacing: 1.4,
                    textTransform: "uppercase",
                  }}
                >
                  Register
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View className="mt-6 w-full max-w-sm">
            <View className="flex-row justify-center mb-4">
              <Pressable
                onPress={() => setMode("login")}
                className="active:opacity-80"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  marginRight: 4,
                  backgroundColor: mode === "login" ? "#5800E5" : "transparent",
                  borderWidth: 1,
                  borderColor: mode === "login" ? "#5800E5" : "rgba(255,255,255,0.15)",
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    color: mode === "login" ? "#fff" : "rgba(203,213,225,0.7)",
                    fontFamily: "monospace",
                    fontWeight: "900",
                    fontSize: 12,
                    letterSpacing: 1.2,
                  }}
                >
                  SIGN IN
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("register")}
                className="active:opacity-80"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: mode === "register" ? "#f5b700" : "transparent",
                  borderWidth: 1,
                  borderColor: mode === "register" ? "#f5b700" : "rgba(255,255,255,0.15)",
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    color: mode === "register" ? "#1a1408" : "rgba(203,213,225,0.7)",
                    fontFamily: "monospace",
                    fontWeight: "900",
                    fontSize: 12,
                    letterSpacing: 1.2,
                  }}
                >
                  REGISTER
                </Text>
              </Pressable>
            </View>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="USERNAME"
              placeholderTextColor="rgba(160,160,170,0.5)"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 4,
                color: "rgba(243,244,246,0.96)",
                fontFamily: "monospace",
                fontSize: 14,
                fontWeight: "700",
                letterSpacing: 1,
                marginBottom: 8,
              }}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="PASSWORD"
              placeholderTextColor="rgba(160,160,170,0.5)"
              secureTextEntry
              autoCapitalize="none"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 4,
                color: "rgba(243,244,246,0.96)",
                fontFamily: "monospace",
                fontSize: 14,
                fontWeight: "700",
                letterSpacing: 1,
                marginBottom: 12,
              }}
            />
            <Pressable
              onPress={onPassword}
              disabled={busy || !username.trim() || !password.trim()}
              className="active:opacity-80"
              style={{
                backgroundColor: mode === "register" ? "#f5b700" : "#5800E5",
                paddingVertical: 14,
                borderRadius: 4,
                opacity: busy || !username.trim() || !password.trim() ? 0.5 : 1,
                shadowColor: mode === "register" ? "#f5b700" : "#5800E5",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <Text
                style={{
                  color: mode === "register" ? "#1a1408" : "#fff",
                  fontFamily: "monospace",
                  fontWeight: "900",
                  textAlign: "center",
                  fontSize: 14,
                  letterSpacing: 1.6,
                  textTransform: "uppercase",
                }}
              >
                {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowPassword(false);
                setUsername("");
                setPassword("");
              }}
              hitSlop={6}
              className="mt-4"
            >
              <Text
                style={{
                  color: "rgba(203,213,225,0.6)",
                  fontFamily: "monospace",
                  fontSize: 11,
                  textAlign: "center",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                }}
              >
                · back to Google ·
              </Text>
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
