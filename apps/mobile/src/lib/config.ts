import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export const API_BASE = (extra.apiBase as string) || "https://api.weered.ca";
export const WS_URL = (extra.wsUrl as string) || "wss://api.weered.ca/ws";
