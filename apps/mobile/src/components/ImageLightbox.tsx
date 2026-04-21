import { useState, useEffect, createContext, useContext } from "react";
import { View, Modal, Image, Pressable, Text, Dimensions, Linking } from "react-native";

type Ctx = { open: (url: string) => void };
const LightboxContext = createContext<Ctx>({ open: () => {} });

export function useImageLightbox() { return useContext(LightboxContext); }

export function ImageLightboxProvider({ children }: { children: React.ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (url) {
      Image.getSize(url, (w, h) => setSize({ w, h }), () => setSize(null));
    } else {
      setSize(null);
    }
  }, [url]);

  const winW = Dimensions.get("window").width;
  const winH = Dimensions.get("window").height;
  let imgW = winW;
  let imgH = winH * 0.7;
  if (size) {
    const aspect = size.w / size.h;
    if (aspect > winW / (winH * 0.85)) {
      imgW = winW;
      imgH = winW / aspect;
    } else {
      imgH = winH * 0.85;
      imgW = imgH * aspect;
    }
  }

  return (
    <LightboxContext.Provider value={{ open: setUrl }}>
      {children}
      <Modal transparent visible={!!url} onRequestClose={() => setUrl(null)} animationType="fade">
        <Pressable
          onPress={() => setUrl(null)}
          className="flex-1 bg-black/95 items-center justify-center"
        >
          {url && (
            <Image
              source={{ uri: url }}
              style={{ width: imgW, height: imgH }}
              resizeMode="contain"
            />
          )}
          <View className="absolute top-12 right-4 flex-row">
            <Pressable
              onPress={() => url && Linking.openURL(url).catch(() => {})}
              hitSlop={10}
              className="bg-white/10 px-3 py-1.5 rounded-full mr-2 active:opacity-70"
            >
              <Text className="text-white text-xs font-bold">Open ↗</Text>
            </Pressable>
            <Pressable
              onPress={() => setUrl(null)}
              hitSlop={10}
              className="bg-white/10 px-3 py-1.5 rounded-full active:opacity-70"
            >
              <Text className="text-white text-xs font-bold">Close ✕</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </LightboxContext.Provider>
  );
}
