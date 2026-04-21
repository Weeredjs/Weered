import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function NewRoom() {
  const { lobbyId: lobbyIdParam } = useLocalSearchParams<{ lobbyId: string }>();
  const lobbyId = String(lobbyIdParam || "");
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; id: string; room: { id: string } }>("/rooms", {
        method: "POST",
        body: {
          name: name.trim(),
          lobbyId,
          ...(usePassword && password ? { password } : {}),
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["lobby", lobbyId] });
      qc.invalidateQueries({ queryKey: ["lobby-rooms", lobbyId] });
      router.replace(`/room/${res.id}`);
    },
    onError: (e: any) => Alert.alert("Couldn't create room", e?.message || "Unknown error"),
  });

  const canSubmit = name.trim().length >= 2 && !create.isPending;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "New room" }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text className="text-weered-muted text-xs uppercase tracking-widest mb-2">Room name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Gambit Hall"
            placeholderTextColor="rgba(160,160,170,0.6)"
            maxLength={64}
            className="bg-panel text-weered-text px-3 py-2.5 rounded-lg mb-4"
            style={{ fontSize: 15 }}
          />

          <View className="flex-row items-center justify-between py-2 mb-2">
            <Text className="text-weered-text font-semibold">Password protect</Text>
            <Switch
              value={usePassword}
              onValueChange={setUsePassword}
              trackColor={{ false: "rgba(80,80,90,0.5)", true: "#5800E5" }}
              thumbColor="#ffffff"
            />
          </View>

          {usePassword && (
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Room password"
              placeholderTextColor="rgba(160,160,170,0.6)"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-panel text-weered-text px-3 py-2.5 rounded-lg mb-4"
              style={{ fontSize: 15 }}
            />
          )}

          <Pressable
            onPress={() => canSubmit && create.mutate()}
            disabled={!canSubmit}
            className="bg-weered px-4 py-3 rounded-xl active:opacity-80 mt-2"
            style={{ opacity: canSubmit ? 1 : 0.4 }}
          >
            {create.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white text-center font-bold">Create room</Text>
            )}
          </Pressable>

          <Text className="text-weered-muted/70 text-xs text-center mt-4">
            Up to 3 of your own rooms at a time · up to 10 rooms/hour.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
