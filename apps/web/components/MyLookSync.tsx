"use client";

// Your colour changed (Your look, or the avatar picker's Colour tab): your
// messages already on screen wear it at once, as the server's copy of each
// room's chat now does (api routes/profile.ts). Each message carries its
// author's look as it was sent, so without this your own chat kept the colour
// you had dropped (James 2026-11-01).
import { useEffect } from "react";
import { hotStore } from "./WeeredProvider";

export default function MyLookSync() {
  useEffect(() => {
    const onColor = (e: Event) => {
      let myId = "";
      try {
        myId = String(JSON.parse(localStorage.getItem("weered_user") || "null")?.id || "");
      } catch {}
      if (!myId) return;
      const color = String((e as CustomEvent).detail || "") || undefined;
      hotStore.set("msgsByRoom", (prev) => {
        let changed = false;
        const next: typeof prev = {};
        for (const [rid, list] of Object.entries(prev)) {
          next[rid] = list.map((m) => {
            if (m?.user?.id !== myId || m.user.avatarColor === color) return m;
            changed = true;
            return { ...m, user: { ...m.user, avatarColor: color } };
          });
        }
        return changed ? next : prev;
      });
    };
    window.addEventListener("weered:avatarColor", onColor);
    return () => window.removeEventListener("weered:avatarColor", onColor);
  }, []);
  return null;
}
