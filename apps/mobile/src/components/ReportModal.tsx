import { useState } from "react";
import { View, Text, Modal, Pressable, TextInput, Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

const REASONS: { id: string; label: string }[] = [
  { id: "SPAM", label: "Spam" },
  { id: "HARASSMENT", label: "Harassment" },
  { id: "HATE_SPEECH", label: "Hate speech" },
  { id: "THREATS", label: "Threats" },
  { id: "NSFW", label: "NSFW / sexual content" },
  { id: "MINOR_SAFETY", label: "Minor safety" },
  { id: "IMPERSONATION", label: "Impersonation" },
  { id: "SELF_HARM", label: "Self harm" },
  { id: "OTHER", label: "Other" },
];

export function ReportModal({
  visible, onClose, targetType, targetId, context,
}: {
  visible: boolean;
  onClose: () => void;
  targetType: "MESSAGE" | "USER" | "ROOM" | "LOBBY";
  targetId: string;
  context?: string;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const submit = useMutation({
    mutationFn: () => api("/reports", {
      method: "POST",
      body: { targetType, targetId, reason, context, note: note.trim() || undefined },
    }),
    onSuccess: () => {
      Alert.alert("Thanks", "Your report was sent to moderators.");
      setReason(null);
      setNote("");
      onClose();
    },
    onError: (e: any) => {
      if (e?.message?.includes("rate_limit")) {
        Alert.alert("Slow down", "Too many reports in a short time. Try again in a few minutes.");
      } else {
        Alert.alert("Couldn't report", e?.message || "Unknown error");
      }
    },
  });

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-end">
        <View className="bg-weered-bg border-t border-border rounded-t-2xl p-5 max-h-[80%]">
          <View className="flex-row items-center mb-4">
            <Text className="text-weered-text font-bold text-lg flex-1">Report {targetType.toLowerCase()}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text className="text-weered-muted font-bold text-base">✕</Text>
            </Pressable>
          </View>

          <Text className="text-weered-muted text-xs uppercase tracking-wide mb-2">Reason</Text>
          {REASONS.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setReason(r.id)}
              className={`flex-row items-center px-3 py-2.5 rounded-lg mb-1.5 ${reason === r.id ? "bg-weered/20 border border-weered" : "bg-panel border border-border"}`}
            >
              <View
                style={{
                  width: 16, height: 16, borderRadius: 8, borderWidth: 2,
                  borderColor: reason === r.id ? "#5800E5" : "rgba(160,160,170,0.5)",
                  marginRight: 10, alignItems: "center", justifyContent: "center",
                }}
              >
                {reason === r.id && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#5800E5" }} />}
              </View>
              <Text className={`text-sm ${reason === r.id ? "text-weered-text font-bold" : "text-weered-muted"}`}>{r.label}</Text>
            </Pressable>
          ))}

          <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1 mt-3">Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Anything else that helps mods?"
            placeholderTextColor="rgba(160,160,170,0.6)"
            multiline
            maxLength={500}
            className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg"
            style={{ fontSize: 14, minHeight: 64, textAlignVertical: "top" }}
          />

          <View className="flex-row mt-4">
            <Pressable onPress={onClose} className="flex-1 mr-2 px-3 py-3 rounded-lg bg-panel border border-border active:opacity-70">
              <Text className="text-weered-muted text-center font-bold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => reason && submit.mutate()}
              disabled={!reason || submit.isPending}
              className="flex-1 px-3 py-3 rounded-lg bg-red-500 active:opacity-80"
              style={{ opacity: !reason || submit.isPending ? 0.5 : 1 }}
            >
              <Text className="text-white text-center font-bold">{submit.isPending ? "Sending…" : "Report"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
