import { AppState, type AppStateStatus } from "react-native";
import { wsClient } from "./ws";

// Mobile idle semantics: we don't have mousemove/keydown listeners as the web
// does, so "away" tracks whether the app is in foreground. When the user
// backgrounds the app we go away; when they return, active.
let currentAway = false;
let attached = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const BACKGROUND_GRACE_MS = 30_000;

function setAway(away: boolean) {
  if (currentAway === away) return;
  currentAway = away;
  wsClient.send({ type: "presence:idle", away });
}

function onChange(state: AppStateStatus) {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (state === "active") {
    setAway(false);
  } else {
    // Short grace so quick app switches don't mark you "Lying low".
    idleTimer = setTimeout(() => setAway(true), BACKGROUND_GRACE_MS);
  }
}

export function attachPresenceIdle() {
  if (attached) return;
  attached = true;
  const sub = AppState.addEventListener("change", onChange);
  // Initial state: whatever AppState.currentState says.
  onChange(AppState.currentState);
  return () => {
    attached = false;
    sub.remove();
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };
}
