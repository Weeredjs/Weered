import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

type Props = { children: React.ReactNode; label?: string };
type State = { error: Error | null };

/**
 * Minimal class-component error boundary. Wrap risky subtrees so a render
 * exception converts to a visible fallback instead of a hard crash to OS.
 * Particularly important for production APKs without dev-tools attached.
 *
 * Caller passes an optional `label` so the fallback can name which screen
 * failed — useful when the same boundary wraps multiple consumer surfaces
 * and we're triaging from a user screenshot.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Best-effort log; if there's a remote reporter installed it can be
    // wired in here later. For now console is enough — visible via adb
    // logcat or Sentry's RN integration.
    console.error("[ErrorBoundary]", this.props.label || "", error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    const msg = this.state.error.message || String(this.state.error);
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: "#0c0b0a" }}
        contentContainerStyle={{ padding: 20, paddingTop: 60 }}
      >
        <Text style={{ color: "#fca5a5", fontSize: 16, fontWeight: "800", marginBottom: 8 }}>
          {this.props.label || "Screen"} crashed.
        </Text>
        <Text
          style={{
            color: "rgba(243,244,246,0.85)",
            fontSize: 13,
            marginBottom: 12,
            fontFamily: "monospace",
          }}
        >
          {msg}
        </Text>
        {this.state.error.stack ? (
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <Text
              style={{ color: "rgba(203,213,225,0.7)", fontSize: 11, fontFamily: "monospace" }}
              selectable
            >
              {String(this.state.error.stack).split("\n").slice(0, 30).join("\n")}
            </Text>
          </View>
        ) : null}
        <Pressable
          onPress={this.reset}
          style={{
            backgroundColor: "#5800E5",
            paddingVertical: 12,
            paddingHorizontal: 18,
            borderRadius: 10,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>Try again</Text>
        </Pressable>
      </ScrollView>
    );
  }
}
