import { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

export function PromptModal({
  visible,
  title,
  description,
  initialValue = "",
  placeholder,
  submitLabel = "Save",
  onSubmit,
  onClose,
  multiline,
  maxLength,
  autoCapitalize = "none",
  keyboardType,
}: {
  visible: boolean;
  title: string;
  description?: string;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
  multiline?: boolean;
  maxLength?: number;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "url";
}) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.7)",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View className="bg-panel rounded-2xl p-5">
          <Text className="text-weered-text font-bold text-lg mb-1">{title}</Text>
          {!!description && <Text className="text-weered-muted text-sm mb-3">{description}</Text>}
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor="rgba(160,160,170,0.6)"
            autoFocus
            multiline={multiline}
            maxLength={maxLength}
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
            autoCorrect={false}
            className="bg-weered-bg text-weered-text px-3 py-2.5 rounded-lg"
            style={{
              borderWidth: 1,
              borderColor: "rgba(120,120,130,0.3)",
              minHeight: multiline ? 80 : 44,
              textAlignVertical: multiline ? "top" : "center",
            }}
          />
          <View className="flex-row justify-end mt-4">
            <Pressable onPress={onClose} className="px-4 py-2 active:opacity-70 mr-2">
              <Text className="text-weered-muted font-semibold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onSubmit(value)}
              className="bg-weered px-4 py-2 rounded-lg active:opacity-80"
            >
              <Text className="text-white font-bold">{submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
