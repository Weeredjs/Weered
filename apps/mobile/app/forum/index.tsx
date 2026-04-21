import { useState } from "react";
import { View, Text, FlatList, Pressable, Modal, TextInput, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Author = { id: string; name: string; avatar: string | null; avatarColor: string | null; tier: string; globalRole: string };
type Post = {
  id: string; title: string; body: string; category: string;
  authorId: string; authorName: string;
  score: number; commentCount: number;
  pinned: boolean; locked: boolean;
  createdAt: string;
  lobbyId: string | null;
  author: Author | null;
  myVote: number;
};
type ListResp = { ok: boolean; posts: Post[]; nextCursor: string | null };

const SORTS = ["hot", "new", "top"] as const;
const CATEGORIES = ["", "DISCUSSION", "BUG_REPORT", "FEATURE_REQUEST", "ANNOUNCEMENT"];
const CATEGORY_LABEL: Record<string, string> = {
  "": "All",
  DISCUSSION: "Discussion",
  BUG_REPORT: "Bug",
  FEATURE_REQUEST: "Feature",
  ANNOUNCEMENT: "Announce",
};

export default function Forum() {
  const { lobbyId } = useLocalSearchParams<{ lobbyId?: string }>();
  const lobbyParam = lobbyId ? `&lobbyId=${encodeURIComponent(lobbyId)}` : "";
  const qc = useQueryClient();
  const [sort, setSort] = useState<typeof SORTS[number]>("hot");
  const [cat, setCat] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  const q = useQuery({
    queryKey: ["forum-list", sort, cat, lobbyId || ""],
    queryFn: () => api<ListResp>(`/forum/posts?sort=${sort}${cat ? `&category=${cat}` : ""}${lobbyParam}`),
  });

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen
        options={{
          title: "Forum",
          headerRight: () => (
            <Pressable onPress={() => setComposeOpen(true)} hitSlop={8} className="active:opacity-70 mr-2">
              <Text className="text-weered font-semibold">+ Post</Text>
            </Pressable>
          ),
        }}
      />

      <View className="flex-row border-b border-border/40">
        {SORTS.map((s) => (
          <Pressable key={s} onPress={() => setSort(s)} className="flex-1 py-3 items-center active:opacity-70" style={{ borderBottomWidth: 2, borderBottomColor: sort === s ? "#5800E5" : "transparent" }}>
            <Text className={`text-sm font-bold ${sort === s ? "text-weered" : "text-weered-muted"}`}>
              {s === "hot" ? "🔥 Hot" : s === "new" ? "🕒 New" : "🏆 Top"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="flex-row px-2 py-2 border-b border-border/30">
        {CATEGORIES.map((c) => (
          <Pressable key={c || "all"} onPress={() => setCat(c)} className="px-2 py-1 active:opacity-70">
            <Text className={`text-xs font-bold uppercase ${cat === c ? "text-weered" : "text-weered-muted"}`}>{CATEGORY_LABEL[c]}</Text>
          </Pressable>
        ))}
      </View>

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#5800E5" /></View>
      ) : (
        <FlatList
          data={q.data?.posts ?? []}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor="#5800E5" />}
          ItemSeparatorComponent={() => <View className="h-px bg-border/30" />}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => <PostRow post={item} />}
          ListEmptyComponent={
            <View className="px-8 py-16 items-center">
              <Text className="text-weered-muted text-sm">No posts yet. Tap + Post to start.</Text>
            </View>
          }
        />
      )}

      {composeOpen && (
        <Compose
          lobbyId={lobbyId}
          onClose={() => setComposeOpen(false)}
          onCreated={(postId) => {
            setComposeOpen(false);
            qc.invalidateQueries({ queryKey: ["forum-list"] });
            router.push(`/forum/${postId}`);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function PostRow({ post }: { post: Post }) {
  return (
    <Pressable
      onPress={() => router.push(`/forum/${post.id}`)}
      className="px-4 py-3 active:bg-panel"
    >
      <View className="flex-row items-center mb-1">
        {post.pinned && <Text className="text-amber-400 text-xs font-bold mr-2">★</Text>}
        {post.locked && <Text className="text-weered-muted text-xs mr-2">🔒</Text>}
        <Text className="text-weered-muted text-[10px] font-bold uppercase mr-2">{CATEGORY_LABEL[post.category] || post.category}</Text>
        <Text className="text-weered-muted text-xs">by {post.authorName}</Text>
      </View>
      <Text className="text-weered-text font-bold text-base mb-1" numberOfLines={2}>{post.title}</Text>
      {!!post.body && (
        <Text className="text-weered-muted text-xs" numberOfLines={2}>{post.body}</Text>
      )}
      <View className="flex-row items-center mt-2">
        <Text className="text-weered text-xs font-bold mr-3">▲ {post.score}</Text>
        <Text className="text-weered-muted text-xs mr-3">💬 {post.commentCount}</Text>
        <Text className="text-weered-muted/70 text-xs">{formatRel(post.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

function Compose({ lobbyId, onClose, onCreated }: { lobbyId?: string; onClose: () => void; onCreated: (postId: string) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("DISCUSSION");

  const create = useMutation({
    mutationFn: () => api<{ ok: boolean; post: { id: string } }>("/forum/posts", {
      method: "POST",
      body: { title: title.trim(), body: body.trim(), category, ...(lobbyId ? { lobbyId } : {}) },
    }),
    onSuccess: (res) => onCreated(res.post.id),
    onError: (e: any) => Alert.alert("Couldn't post", e?.message || "Unknown error"),
  });

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-center px-5">
        <View className="bg-weered-bg border border-border rounded-2xl p-5 max-h-[85%]">
          <Text className="text-weered-text font-bold text-lg mb-3">New post</Text>

          <View className="flex-row mb-3 flex-wrap">
            {["DISCUSSION", "BUG_REPORT", "FEATURE_REQUEST"].map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                className={`mr-2 mb-2 px-3 py-1.5 rounded-md border ${category === c ? "bg-weered border-weered" : "bg-panel border-border"}`}
              >
                <Text className={`text-xs font-bold ${category === c ? "text-white" : "text-weered-muted"}`}>{CATEGORY_LABEL[c]}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={200}
            placeholder="Title"
            placeholderTextColor="rgba(160,160,170,0.6)"
            className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-3"
            style={{ fontSize: 16, fontWeight: "700" }}
          />
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={10000}
            placeholder="What's on your mind?"
            placeholderTextColor="rgba(160,160,170,0.6)"
            className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg mb-4"
            style={{ fontSize: 14, minHeight: 160, textAlignVertical: "top" }}
          />

          <View className="flex-row">
            <Pressable onPress={onClose} className="flex-1 mr-2 px-3 py-3 rounded-lg bg-panel border border-border active:opacity-70">
              <Text className="text-weered-muted text-center font-bold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => title.trim() && body.trim() && create.mutate()}
              disabled={create.isPending || !title.trim() || !body.trim()}
              className="flex-1 px-3 py-3 rounded-lg bg-weered active:opacity-80"
            >
              <Text className="text-white text-center font-bold">{create.isPending ? "Posting…" : "Post"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function formatRel(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  } catch { return ""; }
}
