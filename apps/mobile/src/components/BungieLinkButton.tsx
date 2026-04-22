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
    <View style={{ marginHorizontal: 16, marginTop: 12 }}>
      {q.isLoading ? (
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12 }}>
          <ActivityIndicator color="#5800E5" />
          <Text style={{ color: "rgba(203,213,225,0.72)", fontSize: 12, marginLeft: 10 }}>Checking Bungie link…</Text>
        </View>
      ) : unlinked ? (
        <Pressable
          onPress={() => link.mutate()}
          disabled={link.isPending}
          style={{ backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(245,158,11,0.4)", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 4 }}
        >
          <Text style={{ color: "#fbbf24", textAlign: "center", fontFamily: "monospace", fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
            {link.isPending ? "Opening Bungie…" : "Link Bungie · Destiny 2"}
          </Text>
          {q.data?.error === "token_expired" && (
            <Text style={{ color: "rgba(203,213,225,0.6)", fontSize: 10, textAlign: "center", marginTop: 3 }}>Session expired — tap to re-link.</Text>
          )}
        </Pressable>
      ) : (
        <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 4 }}>
          <Text style={{ color: "#22c55e", textAlign: "center", fontFamily: "monospace", fontWeight: "900", fontSize: 12, letterSpacing: 1 }}>✓ BUNGIE LINKED{q.data?.displayName ? ` · ${q.data.displayName}` : ""}</Text>
        </View>
      )}
    </View>
  );
}
