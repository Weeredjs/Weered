"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const TOKEN_KEY = "weered_user";

// Public read-only surfaces: every lobby ROOT page is viewable without auth
// (the storefront). PAID / approval / password lobbies self-gate their body via
// LobbyJoinGate (keyed on joinMode, independent of auth), and every action still
// requires a token. Sub-routes like /lobby/x/admin stay gated by not matching.
const PUBLIC_PATHS: RegExp[] = [/^\/lobby\/[^/]+\/?$/];
const isPublicPath = (p: string | null): boolean => !!p && PUBLIC_PATHS.some((re) => re.test(p));

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    if (isPublicPath(pathname)) return true;
    try {
      return !!(localStorage.getItem(TOKEN_KEY) || "");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (isPublicPath(pathname)) {
      setOk(true);
      return;
    }
    try {
      const tok = localStorage.getItem(TOKEN_KEY) || "";
      if (!tok) {
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
        router.replace("/" + next);
        setOk(false);
        return;
      }
      setOk(true);
    } catch {
      router.replace("/");
      setOk(false);
    }
  }, [router, pathname]);

  if (ok === null) {
    return <div style={{ padding: 20, opacity: 0.7, fontSize: 13 }}>Checking session...</div>;
  }
  if (ok === false) return null;

  return <>{children}</>;
}
