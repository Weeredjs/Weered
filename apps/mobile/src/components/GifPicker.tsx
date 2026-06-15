import { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
} from "react-native";
import { api } from "@/lib/api";

type Gif = { id: string; tiny: string; full: string; w: number; h: number };

export function GifPicker({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    const q = query.trim();
    const path = q ? `/tenor/search?q=${encodeURIComponent(q)}` : `/tenor/featured`;
    const timer = setTimeout(
      () => {
        api<{ ok: boolean; results: any[] }>(path)
          .then((j) => {
            if (cancelled) return;
            const results: Gif[] = (j.results || [])
              .map((r: any) => {
                const tiny = r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || "";
                const full = r.media_formats?.gif?.url || tiny;
                const dims = r.media_formats?.tinygif?.dims || [200, 200];
                return { id: r.id, tiny, full, w: dims[0], h: dims[1] };
              })
              .filter((g: Gif) => !!g.tiny);
            setGifs(results);
            setLoading(false);
          })
          .catch(() => {
            if (!cancelled) setLoading(false);
          });
      },
      query ? 300 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, visible]);

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-end">
        <View
          className="bg-weered-bg border-t border-border rounded-t-2xl"
          style={{ height: "72%" }}
        >
          <View className="px-4 pt-4 pb-2 flex-row items-center">
            <Text className="text-weered-text font-bold text-lg flex-1">GIFs</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text className="text-weered-muted font-bold text-base">✕</Text>
            </Pressable>
          </View>
          <View className="px-4 pb-3">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search Tenor"
              placeholderTextColor="rgba(160,160,170,0.6)"
              autoCorrect={false}
              autoCapitalize="none"
              className="bg-panel border border-border text-weered-text px-3 py-2 rounded-lg"
              style={{ fontSize: 14 }}
            />
          </View>

          {loading && gifs.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#5800E5" />
            </View>
          ) : (
            <FlatList
              data={gifs}
              keyExtractor={(g) => g.id}
              numColumns={2}
              contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 24 }}
              renderItem={({ item }) => {
                const aspect = item.w && item.h ? item.w / item.h : 1;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item.full);
                      onClose();
                    }}
                    className="flex-1 m-1 active:opacity-70"
                  >
                    <Image
                      source={{ uri: item.tiny }}
                      style={{
                        width: "100%",
                        aspectRatio: aspect,
                        backgroundColor: "#1a1a1a",
                        borderRadius: 8,
                      }}
                      resizeMode="cover"
                    />
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                !loading ? (
                  <Text className="text-weered-muted text-sm text-center py-10">No GIFs.</Text>
                ) : null
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
