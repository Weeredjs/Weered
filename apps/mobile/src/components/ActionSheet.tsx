import { createContext, useCallback, useContext, useState } from "react";
import { View, Text, Modal, Pressable } from "react-native";

export type SheetAction = {
  label: string;
  destructive?: boolean;
  icon?: string;
  onPress: () => void;
};

type SheetState = {
  title?: string;
  subtitle?: string;
  actions: SheetAction[];
} | null;

type Ctx = {
  open: (s: NonNullable<SheetState>) => void;
  close: () => void;
};

const ActionSheetContext = createContext<Ctx>({ open: () => {}, close: () => {} });

export function useActionSheet() {
  return useContext(ActionSheetContext);
}

export function ActionSheetProvider({ children }: { children: React.ReactNode }) {
  const [sheet, setSheet] = useState<SheetState>(null);

  const close = useCallback(() => setSheet(null), []);
  const open = useCallback((s: NonNullable<SheetState>) => setSheet(s), []);

  return (
    <ActionSheetContext.Provider value={{ open, close }}>
      {children}
      <Modal transparent animationType="fade" visible={!!sheet} onRequestClose={close}>
        <Pressable onPress={close} className="flex-1 bg-black/70 justify-end">
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-weered-bg border-t border-border rounded-t-2xl pb-4 pt-3"
          >
            {(sheet?.title || sheet?.subtitle) && (
              <View className="px-5 pb-3 border-b border-border/30">
                {!!sheet?.title && (
                  <Text className="text-weered-text font-bold text-base">{sheet.title}</Text>
                )}
                {!!sheet?.subtitle && (
                  <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={2}>
                    {sheet.subtitle}
                  </Text>
                )}
              </View>
            )}
            {sheet?.actions.map((a, i) => (
              <Pressable
                key={`${a.label}-${i}`}
                onPress={() => {
                  close();
                  setTimeout(a.onPress, 10);
                }}
                className="px-5 py-3.5 active:bg-panel border-b border-border/20"
              >
                <Text
                  className="text-base font-semibold"
                  style={{ color: a.destructive ? "#ef4444" : "rgba(243,244,246,.96)" }}
                >
                  {a.icon ? `${a.icon}  ` : ""}
                  {a.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={close}
              className="px-5 py-3.5 mt-2 mx-5 bg-panel rounded-xl active:opacity-70"
            >
              <Text className="text-weered-muted text-center font-bold">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ActionSheetContext.Provider>
  );
}
