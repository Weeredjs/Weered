"use client";

// Asks a new account its one question once (StartPrompt): on Home, for a
// signed-in viewer whose account has neither answered nor skipped it. The
// account is asked, not just this browser, so answering in the browser covers
// the desktop app. The full setup (SetupFlow) is at /setup.
import { useEffect, useState } from "react";
import StartPrompt from "./StartPrompt";
import { pullUiPrefs, readUiPrefs } from "../../lib/uiPrefs";

export default function SetupGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let authed = false;
    try {
      authed = !!JSON.parse(localStorage.getItem("weered_user") || "null")?.id;
    } catch {}
    // The office host is a client-facing desk with a fixed look.
    if (!authed || document.documentElement.hasAttribute("data-pro-host")) return;
    if (readUiPrefs().setup) return;
    let alive = true;
    void pullUiPrefs().then((p) => {
      if (alive && p && !p.setup) setOpen(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!open) return null;
  return <StartPrompt onDone={() => setOpen(false)} />;
}
