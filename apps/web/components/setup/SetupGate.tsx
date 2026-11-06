"use client";

// A new account's first screen (LayoutGallery), once: for a signed-in viewer
// whose account has neither picked a layout nor skipped it. The account is
// asked, not just this browser, so answering in the browser covers the
// desktop app. Mounted app-wide (RootFrame), so it meets the account wherever
// sign-up lands it (James 2026-11-05: "They create an account and the next
// screen is a full screen overlay"); not on the pages without the shell, the
// username step or /setup, which runs the full setup (SetupFlow).
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import LayoutGallery from "./LayoutGallery";
import { useWeered } from "../WeeredProvider";
import { NO_SHELL_ROUTES } from "../../lib/lobbyThemes";
import { prefsAreMine, pullUiPrefs, readUiPrefs } from "../../lib/uiPrefs";

const NOT_HERE = ["/onboarding", "/setup", "/overlay"];

export default function SetupGate() {
  const pathname = usePathname() || "";
  const { me, wsReady } = useWeered() as any;
  const [open, setOpen] = useState(false);
  // Answered, here or on the account: not asked again this visit.
  const settled = useRef(false);
  const onShell = ![...NO_SHELL_ROUTES, ...NOT_HERE].some(
    (r) => pathname === r || (r !== "/" && pathname.startsWith(r + "/")),
  );
  // Google and Discord sign-ups pick a username first (UsernameStep).
  const needsName = !!wsReady && !!me?.needsUsername;

  useEffect(() => {
    if (settled.current || open || !onShell || needsName) return;
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
    if (readUiPrefs().setup && prefsAreMine()) {
      settled.current = true;
      return;
    }
    let alive = true;
    // One question at a time: the cookie question (components/CookieConsent.tsx)
    // comes first, so this waits until it's answered.
    const consented = () => {
      try {
        return !!localStorage.getItem("weered_cookie_consent");
      } catch {
        return true;
      }
    };
    const ask = () =>
      void pullUiPrefs().then((p) => {
        if (!alive || !p) return;
        if (p.setup) settled.current = true;
        else setOpen(true);
      });
    const onConsent = () => ask();
    if (consented()) ask();
    else window.addEventListener("weered:cookie:consent", onConsent, { once: true });
    return () => {
      alive = false;
      window.removeEventListener("weered:cookie:consent", onConsent);
    };
  }, [onShell, needsName, open]);

  if (!open || !onShell || needsName) return null;
  return (
    <LayoutGallery
      name={String(me?.name || me?.username || "")}
      onDone={() => {
        settled.current = true;
        setOpen(false);
      }}
    />
  );
}
