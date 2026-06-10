export function apiBase(): string {
  const env = (process.env.NEXT_PUBLIC_API_BASE || "").trim();
  if (env) return env.replace(/\/+$/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "http://127.0.0.1:4000";
    if (host.endsWith("weered.ca")) return "https://api.weered.ca";
  }
  return "http://127.0.0.1:4000";
}

export function wsUrl(): string {
  const env = (process.env.NEXT_PUBLIC_WS_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (isLocal) return "ws://127.0.0.1:4001";
    if (host.endsWith("weered.ca")) return "wss://ws.weered.ca";
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    return `${scheme}://${host}`;
  }
  return "ws://127.0.0.1:4001";
}

export function liveKitUrl(): string {
  const env = (process.env.NEXT_PUBLIC_LIVEKIT_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "ws://127.0.0.1:7880";
    if (host.endsWith("weered.ca")) return "wss://livekit.weered.ca";
  }
  return "ws://127.0.0.1:7880";
}
