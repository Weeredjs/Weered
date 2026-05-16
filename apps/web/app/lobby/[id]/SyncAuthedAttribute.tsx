"use client";
import { useEffect } from "react";

// Re-sync the data-weered-authed attribute on every mount, in case the
// initial theme-boot script in app/layout.tsx ran before localStorage was
// populated (post-login client-side navigation, soft refreshes with stale
// SW, etc.). Hides the SEO slab the moment we know we are authenticated.
export default function SyncAuthedAttribute() {
  useEffect(() => {
    try {
      const has = !!localStorage.getItem("weered_token");
      if (has) document.documentElement.setAttribute("data-weered-authed", "1");
      else document.documentElement.removeAttribute("data-weered-authed");
    } catch {}
  });
  return null;
}
