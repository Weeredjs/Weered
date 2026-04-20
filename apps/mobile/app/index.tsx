import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/stores/auth";

export default function Landing() {
  const { token, user, signOut } = useAuth();
  const signedIn = !!token && !!user;

  return (
    <SafeAreaView className="flex-1 bg-weered-bg">
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-weered-text text-5xl font-black tracking-tight mb-2">
          Weered
        </Text>
        <Text className="text-weered-muted text-sm mb-12 tracking-wide">
          Real-time community platform
        </Text>

        {signedIn ? (
          <>
            <Text className="text-weered-text text-base mb-2">
              Signed in as <Text className="font-bold">{user!.name}</Text>
            </Text>
            <Text className="text-weered-muted text-xs mb-8">Lobby list coming next.</Text>
            <Pressable
              className="bg-panel border border-border px-8 py-3 rounded-xl active:opacity-80"
              onPress={signOut}
            >
              <Text className="text-weered-text font-semibold">Sign out</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            className="bg-weered px-10 py-4 rounded-xl active:opacity-80"
            onPress={() => router.push("/login")}
            style={{
              shadowColor: "#5800E5",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <Text className="text-white font-bold text-base">Sign in</Text>
          </Pressable>
        )}

        <Text className="text-weered-muted/50 text-xs mt-10">
          v0.1.0 · alpha
        </Text>
      </View>
    </SafeAreaView>
  );
}
