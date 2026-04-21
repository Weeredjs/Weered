import { Platform } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { api } from "./api";

// Expo Go dropped remote-push support in SDK 53; importing expo-notifications
// and calling its APIs in Expo Go throws and takes down the root layout.
// Detect the environment and no-op cleanly so dev on Expo Go keeps working.
// Real device/standalone builds (dev client or EAS build) get full push.
const IS_EXPO_GO = Constants.appOwnership === "expo";

let registeredToken: string | null = null;
let tapListener: { remove: () => void } | null = null;

// Lazy-loaded module — only touched outside Expo Go.
let Notifications: typeof import("expo-notifications") | null = null;
function loadNotifications() {
  if (IS_EXPO_GO) return null;
  if (Notifications) return Notifications;
  try {
    Notifications = require("expo-notifications");
    Notifications!.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return Notifications;
  } catch {
    return null;
  }
}

async function ensureAndroidChannel(N: NonNullable<typeof Notifications>) {
  if (Platform.OS !== "android") return;
  await N.setNotificationChannelAsync("default", {
    name: "Weered",
    importance: N.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#5800E5",
  }).catch(() => {});
}

async function obtainToken(N: NonNullable<typeof Notifications>): Promise<string | null> {
  const existing = await N.getPermissionsAsync();
  let granted = existing.status === "granted";
  if (!granted) {
    const asked = await N.requestPermissionsAsync();
    granted = asked.status === "granted";
  }
  if (!granted) return null;

  try {
    const projectId =
      (Constants.expoConfig?.extra as any)?.eas?.projectId ||
      (Constants.easConfig as any)?.projectId;
    const token = await N.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data || null;
  } catch {
    return null;
  }
}

export async function registerPushToken() {
  const N = loadNotifications();
  if (!N) return;
  await ensureAndroidChannel(N);
  const token = await obtainToken(N);
  if (!token) return;
  if (registeredToken === token) return;
  try {
    await api("/push/expo-register", {
      method: "POST",
      body: { token, platform: Platform.OS },
    });
    registeredToken = token;
  } catch {}
}

export async function unregisterPushToken() {
  if (!registeredToken) return;
  try {
    await api("/push/expo-register", {
      method: "DELETE",
      body: { token: registeredToken },
    });
  } catch {}
  registeredToken = null;
}

export function attachNotificationTapHandler() {
  const N = loadNotifications();
  if (!N) return;
  if (tapListener) return;
  tapListener = N.addNotificationResponseReceivedListener((resp) => {
    const data: any = resp.notification.request.content.data || {};
    const url = typeof data.url === "string" ? data.url : null;
    if (!url || url === "/" || url === "/home") return;
    const path = url.startsWith("http")
      ? (() => { try { return new URL(url).pathname + new URL(url).search; } catch { return null; } })()
      : url;
    if (path) router.push(path as any);
  });
}
