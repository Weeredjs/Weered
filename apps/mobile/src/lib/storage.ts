import { createMMKV } from "react-native-mmkv";

export const storage = createMMKV({ id: "weered.v1" });

export const KEYS = {
  authToken: "auth.token",
  userId: "auth.userId",
  lastLobbyId: "nav.lastLobbyId",
  theme: "prefs.theme",
} as const;

export function getAuthToken(): string | null {
  return storage.getString(KEYS.authToken) ?? null;
}

export function setAuthToken(token: string | null) {
  if (token) storage.set(KEYS.authToken, token);
  else storage.remove(KEYS.authToken);
}
