"use client";

// Once per session, lay the account's UI prefs (theme, colourway, sidebar)
// over this browser's, so a choice made in the browser shows up in the
// desktop app and the other way round. See lib/uiPrefs.ts.
import { useEffect } from "react";
import { pullUiPrefs } from "../lib/uiPrefs";

const PULLED = "weered:ui-prefs:pulled";

export default function UiPrefsSync() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(PULLED)) return;
      if (!JSON.parse(localStorage.getItem("weered_user") || "null")?.id) return;
      sessionStorage.setItem(PULLED, "1");
    } catch {
      return;
    }
    void pullUiPrefs();
  }, []);
  return null;
}
