import { create } from "zustand";
import { getAuthToken, setAuthToken, storage, KEYS } from "@/lib/storage";

type User = { id: string; name: string; avatar?: string | null; globalRole?: string; tier?: string };

type AuthState = {
  token: string | null;
  user: User | null;
  isReady: boolean;
  hydrate: () => void;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  isReady: false,
  hydrate: () => {
    const token = getAuthToken();
    const userRaw = storage.getString(KEYS.userId);
    let user: User | null = null;
    if (userRaw) { try { user = JSON.parse(userRaw); } catch {} }
    set({ token, user, isReady: true });
  },
  signIn: (token, user) => {
    setAuthToken(token);
    storage.set(KEYS.userId, JSON.stringify(user));
    set({ token, user });
  },
  signOut: () => {
    setAuthToken(null);
    storage.remove(KEYS.userId);
    set({ token: null, user: null });
  },
}));
