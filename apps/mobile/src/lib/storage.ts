import * as SecureStore from "expo-secure-store";

// Expo Go can't load react-native-mmkv (Nitro native module).
// We keep the same sync API surface by caching values in memory and
// persisting to expo-secure-store asynchronously. On boot, call
// hydrateStorage() once before consumers read.

export const KEYS = {
  authToken: "auth.token",
  userId: "auth.userId",
  lastLobbyId: "nav.lastLobbyId",
  theme: "prefs.theme",
} as const;

const ALL_KEYS = Object.values(KEYS);
const cache = new Map<string, string>();
let hydrated = false;

export async function hydrateStorage(): Promise<void> {
  if (hydrated) return;
  await Promise.all(
    ALL_KEYS.map(async (k) => {
      try {
        const v = await SecureStore.getItemAsync(k);
        if (v != null) cache.set(k, v);
      } catch {}
    })
  );
  hydrated = true;
}

export const storage = {
  getString(key: string): string | undefined {
    return cache.get(key);
  },
  set(key: string, value: string) {
    cache.set(key, value);
    SecureStore.setItemAsync(key, value).catch(() => {});
  },
  remove(key: string) {
    cache.delete(key);
    SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

export function getAuthToken(): string | null {
  return cache.get(KEYS.authToken) ?? null;
}

export function setAuthToken(token: string | null) {
  if (token) storage.set(KEYS.authToken, token);
  else storage.remove(KEYS.authToken);
}
