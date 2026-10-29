"use client";

// Opens first-run setup once per account: on Home, for a signed-in viewer
// whose account has neither finished nor skipped it. The account is asked,
// not just this browser, so setting up in the browser covers the desktop app.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SetupFlow from "./SetupFlow";
import { pullUiPrefs, readUiPrefs } from "../../lib/uiPrefs";

export default function SetupGate() {
  const router = useRouter();
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
  return (
    <SetupFlow
      mode="first"
      onClose={(next) => {
        setOpen(false);
        if (next && next !== window.location.pathname) router.push(next);
      }}
    />
  );
}
