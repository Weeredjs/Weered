"use client";

// Asks a new account its one question once (StartPrompt): on Home, for a
// signed-in viewer whose account has neither answered nor skipped it. The
// account is asked, not just this browser, so answering in the browser covers
// the desktop app. The full setup (SetupFlow) is at /setup.
import { useEffect, useState } from "react";
import StartPrompt from "./StartPrompt";
import { prefsAreMine, pullUiPrefs, readUiPrefs } from "../../lib/uiPrefs";

export default function SetupGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let authed = false;
    try {
      const cached = JSON.parse(localStorage.getItem("weered_user") || "null");
      // A guest (a lobby's guest link) is visiting, not setting up a Weered.
      authed = !!cached?.id && !cached?.isGuest;
    } catch {}
    // The office host is a client-facing desk with a fixed look.
    if (!authed || document.documentElement.hasAttribute("data-pro-host")) return;
    // This browser's answer counts only if it was this account's: a new
    // account here is asked even after another one answered (2026-11-01).
    if (readUiPrefs().setup && prefsAreMine()) return;
    let alive = true;
    // One question at a time: the cookie question (components/CookieConsent.tsx)
    // sits at the bottom of the screen too, so this waits until it's answered.
    const consented = () => {
      try {
        return !!localStorage.getItem("weered_cookie_consent");
      } catch {
        return true;
      }
    };
    const ask = () =>
      void pullUiPrefs().then((p) => {
        if (alive && p && !p.setup) setOpen(true);
      });
    const onConsent = () => ask();
    if (consented()) ask();
    else window.addEventListener("weered:cookie:consent", onConsent, { once: true });
    return () => {
      alive = false;
      window.removeEventListener("weered:cookie:consent", onConsent);
    };
  }, []);

  if (!open) return null;
  return <StartPrompt onDone={() => setOpen(false)} />;
}
