import { View, Text, Pressable, Modal, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Avatar } from "@/components/Avatar";

export type RosterUser = {
  id: string;
  name: string;
  avatar?: string | null;
  globalRole?: string | null;
  tier?: string | null;
  isAway?: boolean;
};

export function RosterModal({
  visible,
  users,
  onClose,
  title = "In this room",
}: {
  visible: boolean;
  users: RosterUser[];
  onClose: () => void;
  title?: string;
}) {
  const online = users.filter((u) => !u.isAway);
  const away = users.filter((u) => u.isAway);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={false}
      presentationStyle="pageSheet"
    >
      <SafeAreaView className="flex-1 bg-weered-bg">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border/40">
          <Text className="text-weered-text font-bold text-base">
            {title} · {users.length}
          </Text>
          <Pressable onPress={onClose} hitSlop={8} className="active:opacity-70">
            <Text className="text-weered font-semibold">Close</Text>
          </Pressable>
        </View>

        <FlatList
          data={[
            ...(online.length ? [{ header: `Online · ${online.length}` } as any, ...online] : []),
            ...(away.length ? [{ header: `Lying low · ${away.length}` } as any, ...away] : []),
          ]}
          keyExtractor={(item: any, i) => (item.header ? `h-${i}` : item.id)}
          renderItem={({ item }: any) => {
            if (item.header) {
              return (
                <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pt-4 pb-1">
                  {item.header}
                </Text>
              );
            }
            return (
              <Pressable
                onPress={() => {
                  onClose();
                  router.push(`/user/${item.id}`);
                }}
                className="flex-row items-center px-4 py-2.5 active:bg-panel"
              >
                <View className="mr-3">
                  <Avatar name={item.name} url={item.avatar} size={36} away={item.isAway} />
                </View>
                <View className="flex-1">
                  <Text className="text-weered-text font-semibold" numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.globalRole && item.globalRole !== "USER" && (
                    <Text className="text-weered-muted text-xs uppercase tracking-wide">
                      {item.globalRole}
                    </Text>
                  )}
                </View>
                {item.isAway && <Text className="text-amber-400 text-xs">Lying low</Text>}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View className="px-8 py-16 items-center">
              <Text className="text-weered-muted text-sm">Nobody here.</Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
