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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const ACCENT_COLORS = [
  "#5800E5",
  "#e85d75",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#a855f7",
  "#ef4444",
  "#eab308",
  "#14b8a6",
];

export default function NewLobby() {
  const qc = useQueryClient();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState(ACCENT_COLORS[0]);

  const create = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; lobby: { id: string } }>("/lobbies", {
        method: "POST",
        body: {
          id: id.trim(),
          name: name.trim(),
          description: description.trim(),
          accentColor: accent,
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["lobbies"] });
      router.replace(`/lobby/${res.lobby.id}`);
    },
    onError: (e: any) => Alert.alert("Couldn't create lobby", e?.message || "Unknown error"),
  });

  const idValid = /^[a-z0-9-]{3,32}$/.test(id);
  const canSubmit = idValid && name.trim().length >= 2 && !create.isPending;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen options={{ title: "New lobby" }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text className="text-weered-muted text-xs uppercase tracking-widest mb-1">Lobby ID</Text>
          <Text className="text-weered-muted/70 text-xs mb-2">
            Lowercase letters, digits, and dashes. This goes in the URL.
          </Text>
          <TextInput
            value={id}
            onChangeText={(t) => setId(t.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="my-lobby"
            placeholderTextColor="rgba(160,160,170,0.6)"
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={32}
            className="bg-panel text-weered-text px-3 py-2.5 rounded-lg mb-4"
            style={{ fontSize: 15 }}
          />

          <Text className="text-weered-muted text-xs uppercase tracking-widest mb-2">Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="My Lobby"
            placeholderTextColor="rgba(160,160,170,0.6)"
            maxLength={60}
            className="bg-panel text-weered-text px-3 py-2.5 rounded-lg mb-4"
            style={{ fontSize: 15 }}
          />

          <Text className="text-weered-muted text-xs uppercase tracking-widest mb-2">
            Description
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What's this lobby about?"
            placeholderTextColor="rgba(160,160,170,0.6)"
            multiline
            maxLength={280}
            className="bg-panel text-weered-text px-3 py-2.5 rounded-lg mb-4"
            style={{ fontSize: 15, minHeight: 80, textAlignVertical: "top" }}
          />

          <Text className="text-weered-muted text-xs uppercase tracking-widest mb-2">
            Accent color
          </Text>
          <View className="flex-row flex-wrap mb-4">
            {ACCENT_COLORS.map((hex) => (
              <Pressable
                key={hex}
                onPress={() => setAccent(hex)}
                className="mr-2 mb-2 active:opacity-80"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: hex,
                  borderWidth: accent === hex ? 3 : 0,
                  borderColor: "#ffffff",
                }}
              />
            ))}
          </View>

          <Pressable
            onPress={() => canSubmit && create.mutate()}
            disabled={!canSubmit}
            className="bg-weered px-4 py-3 rounded-xl active:opacity-80 mt-2"
            style={{ opacity: canSubmit ? 1 : 0.4 }}
          >
            {create.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white text-center font-bold">Create lobby</Text>
            )}
          </Pressable>

          <Text className="text-weered-muted/70 text-xs text-center mt-4">
            Creating a lobby requires Indicted tier or higher. Higher tiers can host more.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
