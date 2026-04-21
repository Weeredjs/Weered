import { Alert, Pressable, Text, ActivityIndicator, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_BASE } from "@/lib/config";
import { getAuthToken } from "@/lib/storage";

type MeResp = {
  ok: boolean;
  linked?: boolean;
  displayName?: string;
  error?: string;
  message?: string;
};

export function BungieLinkButton() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["bungie-me"],
    queryFn: () => api<MeResp>("/bungie/me"),
  });

  const link = useMutation({
    mutationFn: async () => {
      const token = getAuthToken();
      if (!token) throw new Error("Not signed in");
      const url = `${API_BASE}/auth/bungie?token=${encodeURIComponent(token)}`;
      // Opens in an in-app browser; user completes OAuth on Bungie, server
      // stores the tokens, then redirects to the web lobby. User returns to
      // Weered via the system back button.
      await WebBrowser.openBrowserAsync(url, { showTitle: true });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bungie-me"] });
    },
    onError: (e: any) => Alert.alert("Couldn't link", e?.message || "Unknown error"),
  });

  const unlinked = !q.data?.linked || q.data?.error === "token_expired";

  return (
    <View className="mx-4 mt-3">
      {q.isLoading ? (
        <View className="bg-panel border border-border rounded-xl px-4 py-3 flex-row items-center">
          <ActivityIndicator color="#5800E5" />
          <Text className="text-weered-muted text-sm ml-3">Checking Bungie link…</Text>
        </View>
      ) : unlinked ? (
        <Pressable
          onPress={() => link.mutate()}
          disabled={link.isPending}
          className="bg-panel border border-amber-500/40 px-4 py-3 rounded-xl active:opacity-80"
        >
          <Text className="text-amber-400 text-center font-bold">
            {link.isPending ? "Opening Bungie…" : "Link Bungie account (Destiny 2)"}
          </Text>
          {q.data?.error === "token_expired" && (
            <Text className="text-weered-muted text-xs text-center mt-1">Session expired — tap to re-link.</Text>
          )}
        </Pressable>
      ) : (
        <View className="bg-panel border border-green-500/30 px-4 py-3 rounded-xl">
          <Text className="text-green-400 text-center font-bold">✓ Bungie linked{q.data?.displayName ? ` · ${q.data.displayName}` : ""}</Text>
        </View>
      )}
    </View>
  );
}
