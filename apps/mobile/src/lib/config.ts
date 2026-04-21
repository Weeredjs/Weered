import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export const API_BASE = (extra.apiBase as string) || "https://api.weered.ca";
export const WS_URL = (extra.wsUrl as string) || "wss://ws.weered.ca";
export const WEB_BASE = (extra.webBase as string) || "https://weered.ca";

// Lobby logos/banners stored as site-relative paths ("/brand/...") need the
// web origin prefix on mobile. Absolute URLs pass through untouched.
export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${WEB_BASE}${url}`;
  return url;
}
