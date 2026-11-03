import React from "react";
import type { ChatMsg, RoomUser } from "./WeeredProvider";

// ── Hot-path store (presence / chat / typing) ────────────────────────────────
// These maps change on every message, keystroke and presence tick. They live
// outside React context so an update only re-renders components subscribed
// through the useRoom* hooks — not every useWeered() consumer.
type HotMaps = {
  usersByRoom: Record<string, RoomUser[]>;
  msgsByRoom: Record<string, ChatMsg[]>;
  typingByRoom: Record<string, { userId: string; name: string; ts: number }[]>;
};
const EMPTY_USERS: RoomUser[] = [];
const EMPTY_MSGS: ChatMsg[] = [];
const EMPTY_TYPING: { userId: string; name: string; ts: number }[] = [];
export const hotStore = {
  state: { usersByRoom: {}, msgsByRoom: {}, typingByRoom: {} } as HotMaps,
  subs: new Set<() => void>(),
  set<K extends keyof HotMaps>(key: K, updater: React.SetStateAction<HotMaps[K]>) {
    const prev = hotStore.state[key];
    const next =
      typeof updater === "function" ? (updater as (p: HotMaps[K]) => HotMaps[K])(prev) : updater;
    if (next === prev) return;
    hotStore.state = { ...hotStore.state, [key]: next };
    hotStore.subs.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  },
  subscribe(fn: () => void) {
    hotStore.subs.add(fn);
    return () => {
      hotStore.subs.delete(fn);
    };
  },
};
export function useRoomUsers(roomId?: string): RoomUser[] {
  return React.useSyncExternalStore(
    hotStore.subscribe,
    () => (roomId ? hotStore.state.usersByRoom[roomId] || EMPTY_USERS : EMPTY_USERS),
    () => EMPTY_USERS,
  );
}
export function useUsersByRoom(): Record<string, RoomUser[]> {
  return React.useSyncExternalStore(
    hotStore.subscribe,
    () => hotStore.state.usersByRoom,
    () => hotStore.state.usersByRoom,
  );
}
export function useRoomMsgs(roomId?: string): ChatMsg[] {
  return React.useSyncExternalStore(
    hotStore.subscribe,
    () => (roomId ? hotStore.state.msgsByRoom[roomId] || EMPTY_MSGS : EMPTY_MSGS),
    () => EMPTY_MSGS,
  );
}
export function useRoomTyping(roomId?: string): { userId: string; name: string; ts: number }[] {
  return React.useSyncExternalStore(
    hotStore.subscribe,
    () => (roomId ? hotStore.state.typingByRoom[roomId] || EMPTY_TYPING : EMPTY_TYPING),
    () => EMPTY_TYPING,
  );
}
