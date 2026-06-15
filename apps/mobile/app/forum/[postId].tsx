import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { RichText } from "@/components/RichText";
import { Avatar } from "@/components/Avatar";

type Author = {
  id: string;
  name: string;
  avatar: string | null;
  avatarColor: string | null;
  tier: string;
  globalRole: string;
};
type Comment = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  score: number;
  createdAt: string;
  deletedAt?: string | null;
  author: Author | null;
  myVote: number;
};
type Post = {
  id: string;
  title: string;
  body: string;
  category: string;
  authorId: string;
  authorName: string;
  score: number;
  commentCount: number;
  pinned: boolean;
  locked: boolean;
  createdAt: string;
  lobbyId: string | null;
  author: Author | null;
  myVote: number;
};
type DetailResp = {
  ok: boolean;
  post: Post;
  comments: Comment[];
  isMod: boolean;
  modPerms: { canDelete: boolean; canLock: boolean; canPin: boolean };
};

export default function ForumPost() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const id = String(postId || "");
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [comment, setComment] = useState("");

  const q = useQuery({
    queryKey: ["forum-post", id],
    queryFn: () => api<DetailResp>(`/forum/posts/${id}`),
    enabled: !!id,
  });

  const votePost = useMutation({
    mutationFn: (value: 1 | -1 | 0) =>
      api(`/forum/posts/${id}/vote`, { method: "POST", body: { value } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forum-post", id] }),
    onError: (e: any) => Alert.alert("Vote failed", e?.message || "Unknown error"),
  });

  const voteComment = useMutation({
    mutationFn: ({ commentId, value }: { commentId: string; value: 1 | -1 | 0 }) =>
      api(`/forum/comments/${commentId}/vote`, { method: "POST", body: { value } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forum-post", id] }),
    onError: (e: any) => Alert.alert("Vote failed", e?.message || "Unknown error"),
  });

  const addComment = useMutation({
    mutationFn: () =>
      api(`/forum/posts/${id}/comments`, { method: "POST", body: { body: comment.trim() } }),
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["forum-post", id] });
    },
    onError: (e: any) => Alert.alert("Comment failed", e?.message || "Unknown error"),
  });

  const deletePost = useMutation({
    mutationFn: () => api(`/forum/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum-list"] });
      router.back();
    },
    onError: (e: any) => Alert.alert("Delete failed", e?.message || "Unknown error"),
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => api(`/forum/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forum-post", id] }),
    onError: (e: any) => Alert.alert("Delete failed", e?.message || "Unknown error"),
  });

  const post = q.data?.post;
  const comments = q.data?.comments ?? [];
  const isAuthor = !!me && post?.authorId === me.id;
  const canDelete = q.data?.modPerms.canDelete || isAuthor;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-weered-bg">
      <Stack.Screen
        options={{
          title: "Post",
          headerRight: () =>
            canDelete ? (
              <Pressable
                onPress={() =>
                  Alert.alert("Delete post?", post?.title || "", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deletePost.mutate() },
                  ])
                }
                hitSlop={8}
                className="active:opacity-70 mr-2"
              >
                <Text className="text-red-400 font-semibold">Delete</Text>
              </Pressable>
            ) : null,
        }}
      />

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5800E5" />
        </View>
      ) : !post ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-400 text-sm">Couldn't load post.</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => q.refetch()}
              tintColor="#5800E5"
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-4 py-4 border-b border-border/40">
            <View className="flex-row items-center mb-1">
              {post.pinned && <Text className="text-amber-400 text-xs font-bold mr-2">★</Text>}
              {post.locked && <Text className="text-weered-muted text-xs mr-2">🔒</Text>}
              <Text className="text-weered-muted text-[10px] font-bold uppercase mr-2">
                {post.category}
              </Text>
            </View>
            <Text className="text-weered-text font-black text-xl mb-2">{post.title}</Text>

            <Pressable
              onPress={() => router.push(`/user/${post.authorId}`)}
              className="flex-row items-center mb-3 active:opacity-70"
            >
              <Avatar name={post.authorName} url={post.author?.avatar} size={28} />
              <Text className="text-weered-muted text-xs ml-2">
                <Text className="text-weered-text font-semibold">{post.authorName}</Text> ·{" "}
                {formatRel(post.createdAt)}
              </Text>
            </Pressable>

            <RichText
              body={post.body}
              style={{ color: "rgba(243,244,246,.92)", fontSize: 15, lineHeight: 22 }}
            />

            <View className="flex-row items-center mt-3">
              <VoteButtons
                score={post.score}
                myVote={post.myVote}
                onVote={(v) => votePost.mutate(v)}
              />
              <Text className="text-weered-muted text-xs ml-3">💬 {post.commentCount}</Text>
            </View>
          </View>

          <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-4 pb-2">
            Comments · {comments.length}
          </Text>

          {!post.locked && me && (
            <View className="px-4 mb-4">
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Add a comment"
                placeholderTextColor="rgba(160,160,170,0.6)"
                multiline
                className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg"
                style={{ fontSize: 14, minHeight: 70, textAlignVertical: "top" }}
              />
              <Pressable
                onPress={() => comment.trim() && addComment.mutate()}
                disabled={addComment.isPending || !comment.trim()}
                className="bg-weered px-4 py-2.5 rounded-lg active:opacity-80 mt-2 self-end"
              >
                <Text className="text-white font-bold text-sm">
                  {addComment.isPending ? "Posting…" : "Comment"}
                </Text>
              </Pressable>
            </View>
          )}

          {comments.length === 0 && (
            <Text className="text-weered-muted text-sm text-center py-6">No comments yet.</Text>
          )}
          {comments.map((c) => {
            const isMineComment = !!me && c.authorId === me.id;
            const canDeleteComment = isMineComment || q.data?.modPerms.canDelete;
            return (
              <View key={c.id} className="px-4 py-3 border-b border-border/20">
                <View className="flex-row items-center mb-1">
                  <Pressable
                    onPress={() => router.push(`/user/${c.authorId}`)}
                    className="flex-row items-center active:opacity-70 flex-1"
                  >
                    <Avatar name={c.authorName} url={c.author?.avatar} size={20} />
                    <Text className="text-weered-text font-semibold text-xs ml-2">
                      {c.authorName}
                    </Text>
                    <Text className="text-weered-muted text-xs ml-2">
                      · {formatRel(c.createdAt)}
                    </Text>
                  </Pressable>
                  {!c.deletedAt && canDeleteComment && (
                    <Pressable
                      onPress={() =>
                        Alert.alert("Delete comment?", "This can't be undone.", [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => deleteComment.mutate(c.id),
                          },
                        ])
                      }
                      hitSlop={8}
                      className="active:opacity-70"
                    >
                      <Text className="text-red-400 text-xs font-bold">✕</Text>
                    </Pressable>
                  )}
                </View>
                {c.deletedAt ? (
                  <Text className="text-weered-muted italic text-sm">[deleted]</Text>
                ) : (
                  <RichText
                    body={c.body}
                    style={{ color: "rgba(243,244,246,.88)", fontSize: 14 }}
                  />
                )}
                {!c.deletedAt && (
                  <View className="mt-1.5">
                    <VoteButtons
                      compact
                      score={c.score}
                      myVote={c.myVote}
                      onVote={(v) => voteComment.mutate({ commentId: c.id, value: v })}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function VoteButtons({
  score,
  myVote,
  onVote,
  compact = false,
}: {
  score: number;
  myVote: number;
  onVote: (v: 1 | -1 | 0) => void;
  compact?: boolean;
}) {
  const sz = compact ? "text-xs" : "text-sm";
  return (
    <View className="flex-row items-center">
      <Pressable
        onPress={() => onVote(myVote === 1 ? 0 : 1)}
        hitSlop={6}
        className={`px-2 py-1 rounded active:opacity-70 ${myVote === 1 ? "bg-weered/20" : ""}`}
      >
        <Text className={`${sz} font-bold ${myVote === 1 ? "text-weered" : "text-weered-muted"}`}>
          ▲
        </Text>
      </Pressable>
      <Text className={`${sz} font-bold mx-2 text-weered-text`}>{score}</Text>
      <Pressable
        onPress={() => onVote(myVote === -1 ? 0 : -1)}
        hitSlop={6}
        className={`px-2 py-1 rounded active:opacity-70 ${myVote === -1 ? "bg-red-500/20" : ""}`}
      >
        <Text className={`${sz} font-bold ${myVote === -1 ? "text-red-400" : "text-weered-muted"}`}>
          ▼
        </Text>
      </Pressable>
    </View>
  );
}

function formatRel(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  } catch {
    return "";
  }
}
