"use client";

// Once per session and account, lay the account's UI prefs (theme, colourway,
// sidebar) over this browser's, so a choice made in the browser shows up in the
// desktop app and the other way round. See lib/uiPrefs.ts.
import { useEffect } from "react";
import { pullUiPrefs } from "../lib/uiPrefs";

const PULLED = "weered:ui-prefs:pulled";

export default function UiPrefsSync() {
  useEffect(() => {
    try {
      const id = JSON.parse(localStorage.getItem("weered_user") || "null")?.id;
      // Another account signing in during the session is pulled for too.
      if (!id || sessionStorage.getItem(PULLED) === id) return;
      sessionStorage.setItem(PULLED, id);
    } catch {
      return;
    }
    void pullUiPrefs();
  }, []);
  return null;
}
