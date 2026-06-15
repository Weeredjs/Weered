import { useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, Image } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/stores/auth";

export default function Landing() {
  const { token, isReady } = useAuth();

  useEffect(() => {
    if (isReady && token) router.replace("/(tabs)/lobbies");
  }, [isReady, token]);

  if (!isReady || token) {
    return (
      <SafeAreaView className="flex-1 bg-weered-bg items-center justify-center">
        <ActivityIndicator color="#5800E5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-weered-bg">
      <View className="flex-1 items-center justify-center px-8">
        <Image
          source={require("../assets/logo.png")}
          style={{ width: 180, height: 180, marginBottom: 16 }}
          resizeMode="contain"
        />
        <Text
          style={{
            fontFamily: "monospace",
            fontSize: 44,
            fontWeight: "900",
            letterSpacing: -1.5,
            color: "rgba(243,244,246,0.96)",
          }}
        >
          WEERED
        </Text>
        <Text
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            fontWeight: "700",
            color: "#f5b700",
            letterSpacing: 2.4,
            marginTop: 4,
          }}
        >
          LOBBIES · CREWS · CRIME
        </Text>
        <View
          style={{
            width: 100,
            height: 2,
            backgroundColor: "#5800E5",
            marginTop: 18,
            marginBottom: 40,
          }}
        />

        <Pressable
          onPress={() => router.push("/login")}
          className="active:opacity-80"
          style={{
            backgroundColor: "#5800E5",
            paddingVertical: 14,
            paddingHorizontal: 48,
            borderRadius: 4,
            shadowColor: "#5800E5",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.5,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontFamily: "monospace",
              fontWeight: "900",
              fontSize: 16,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            Enter
          </Text>
        </Pressable>

        <Text
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "rgba(203,213,225,0.4)",
            marginTop: 40,
            letterSpacing: 1.5,
          }}
        >
          v0.1.0 · ALPHA
        </Text>
      </View>
    </SafeAreaView>
  );
}
