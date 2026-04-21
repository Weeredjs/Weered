import { useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PromptModal } from "@/components/PromptModal";
import type { Profile } from "@/components/ProfileBody";

type Platform = "steam" | "twitch" | "xbox";

const META: Record<Platform, {
  label: string;
  hint: string;
  placeholder: string;
  endpoint: string;
  fieldIn: string;
  fieldOut: keyof Profile;
}> = {
  steam: {
    label: "Steam",
    hint: "Steam 17-digit ID or vanity URL",
    placeholder: "76561198000000000 or my-steam-id",
    endpoint: "/profile/me/steam-id",
    fieldIn: "steamId",
    fieldOut: "steamId",
  },
  twitch: {
    label: "Twitch",
    hint: "Twitch username",
    placeholder: "your_twitch_handle",
    endpoint: "/profile/me/twitch-login",
    fieldIn: "twitchLogin",
    fieldOut: "twitchLogin",
  },
  xbox: {
    label: "Xbox",
    hint: "Xbox gamertag (with spaces if any)",
    placeholder: "Gamertag",
    endpoint: "/profile/me/xbox-gamertag",
    fieldIn: "gamertag",
    fieldOut: "xboxGamertag",
  },
};

export function PlatformLinks({ profile, meId }: { profile: Profile; meId: string }) {
  const [editing, setEditing] = useState<Platform | null>(null);
  const qc = useQueryClient();

  const mutate = useMutation({
    mutationFn: async ({ platform, value }: { platform: Platform; value: string }) => {
      const meta = META[platform];
      return api<{ ok: boolean }>(meta.endpoint, {
        method: "POST",
        body: { [meta.fieldIn]: value },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", meId] }),
    onError: (e: any) => Alert.alert("Link failed", e?.message || "Unknown error"),
  });

  function currentValue(platform: Platform): string {
    return (profile as any)[META[platform].fieldOut] || "";
  }

  return (
    <View className="px-4 pt-5">
      <Text className="text-weered-muted text-xs uppercase tracking-widest mb-2">
        Linked platforms
      </Text>
      {(["steam", "twitch", "xbox"] as Platform[]).map((p) => {
        const linked = !!currentValue(p);
        return (
          <View key={p} className="flex-row items-center py-2">
            <Text className="text-weered-muted text-sm w-16">{META[p].label}</Text>
            {linked ? (
              <>
                <Text className="text-weered-text text-sm flex-1" numberOfLines={1}>
                  {currentValue(p)}
                </Text>
                <Pressable
                  onPress={() => setEditing(p)}
                  hitSlop={6}
                  className="px-2 active:opacity-70"
                >
                  <Text className="text-weered text-xs font-semibold">Change</Text>
                </Pressable>
                <Pressable
                  onPress={() => Alert.alert(`Unlink ${META[p].label}?`, undefined, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Unlink", style: "destructive", onPress: () => mutate.mutate({ platform: p, value: "" }) },
                  ])}
                  hitSlop={6}
                  className="px-2 active:opacity-70 ml-1"
                >
                  <Text className="text-red-400 text-xs font-semibold">Unlink</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text className="text-weered-muted/60 text-sm flex-1 italic">not linked</Text>
                <Pressable
                  onPress={() => setEditing(p)}
                  className="bg-weered px-3 py-1 rounded-lg active:opacity-80"
                >
                  <Text className="text-white text-xs font-bold">Link</Text>
                </Pressable>
              </>
            )}
          </View>
        );
      })}
      {editing && (
        <PromptModal
          visible
          title={`Link ${META[editing].label}`}
          description={META[editing].hint}
          placeholder={META[editing].placeholder}
          initialValue={currentValue(editing)}
          onSubmit={(value) => {
            const trimmed = value.trim();
            if (!trimmed) { setEditing(null); return; }
            mutate.mutate({ platform: editing, value: trimmed });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}
