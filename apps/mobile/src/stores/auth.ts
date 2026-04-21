import { create } from "zustand";
import { getAuthToken, setAuthToken, storage, KEYS, hydrateStorage } from "@/lib/storage";
import { registerPushToken, unregisterPushToken } from "@/lib/push";
import { api } from "@/lib/api";

type User = { id: string; name: string; avatar?: string | null; globalRole?: string; tier?: string };

type AuthState = {
  token: string | null;
  user: User | null;
  isReady: boolean;
  hydrate: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
};

async function fetchFullUser(id: string): Promise<User | null> {
  try {
    const p = await api<any>(`/profile/${id}`);
    if (!p?.id) return null;
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      globalRole: p.globalRole,
      tier: p.tier,
    };
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isReady: false,
  hydrate: async () => {
    await hydrateStorage();
    const token = getAuthToken();
    const userRaw = storage.getString(KEYS.userId);
    let user: User | null = null;
    if (userRaw) { try { user = JSON.parse(userRaw); } catch {} }
    set({ token, user, isReady: true });
    if (token) {
      registerPushToken().catch(() => {});
      if (user?.id) {
        fetchFullUser(user.id).then((full) => {
          if (full) {
            storage.set(KEYS.userId, JSON.stringify(full));
            set({ user: full });
          }
        }).catch(() => {});
      }
    }
  },
  refreshUser: async () => {
    const id = get().user?.id;
    if (!id) return;
    const full = await fetchFullUser(id);
    if (full) {
      storage.set(KEYS.userId, JSON.stringify(full));
      set({ user: full });
    }
  },
  signIn: (token, user) => {
    setAuthToken(token);
    storage.set(KEYS.userId, JSON.stringify(user));
    set({ token, user });
    registerPushToken().catch(() => {});
    fetchFullUser(user.id).then((full) => {
      if (full) {
        storage.set(KEYS.userId, JSON.stringify(full));
        set({ user: full });
      }
    }).catch(() => {});
  },
  signOut: () => {
    unregisterPushToken().catch(() => {});
    setAuthToken(null);
    storage.remove(KEYS.userId);
    set({ token: null, user: null });
  },
}));
