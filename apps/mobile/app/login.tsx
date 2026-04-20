import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Login() {
  return (
    <SafeAreaView className="flex-1 bg-weered-bg">
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-weered-text text-2xl font-bold mb-2">
          Sign in
        </Text>
        <Text className="text-weered-muted text-sm text-center mb-10">
          Google OAuth flow wires in next. Placeholder for now.
        </Text>
        <ActivityIndicator color="#5800E5" />
      </View>
    </SafeAreaView>
  );
}
