import { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { storage } from "@/lib/storage";

type BannerResp = {
  ok: boolean;
  banner: { message: string; level: string; from: string; ts: number } | null;
};

const DISMISS_KEY = "weered.banner.dismissed";

export function SiteBanner() {
  const q = useQuery({
    queryKey: ["site-banner"],
    queryFn: () => api<BannerResp>("/banner"),
    refetchInterval: 5 * 60_000,
  });
  const [dismissedTs, setDismissedTs] = useState<number>(0);

  useEffect(() => {
    const stored = storage.getString(DISMISS_KEY);
    if (stored) setDismissedTs(Number(stored) || 0);
  }, []);

  const b = q.data?.banner;
  if (!b || !b.message) return null;
  if (dismissedTs && dismissedTs >= b.ts) return null;

  const colors: Record<string, { bg: string; border: string; text: string }> = {
    info:    { bg: "rgba(88,0,229,0.15)",   border: "rgba(88,0,229,0.5)",   text: "#a78bfa" },
    warning: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.5)", text: "#fbbf24" },
    urgent:  { bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.6)",  text: "#fca5a5" },
  };
  const c = colors[b.level] || colors.info;

  return (
    <View style={{ backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.border }} className="px-3 py-2 flex-row items-center">
      <View className="flex-1 mr-2">
        <Text style={{ color: c.text, fontSize: 12, fontWeight: "700" }}>{b.from}</Text>
        <Text style={{ color: c.text, fontSize: 12 }} numberOfLines={3}>{b.message}</Text>
      </View>
      <Pressable
        onPress={() => {
          storage.set(DISMISS_KEY, String(b.ts));
          setDismissedTs(b.ts);
        }}
        hitSlop={10}
      >
        <Text style={{ color: c.text, fontWeight: "700" }}>✕</Text>
      </Pressable>
    </View>
  );
}
