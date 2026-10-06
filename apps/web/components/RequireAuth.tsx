"use client";

import React, { useLayoutEffect, useState } from "react";
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
  // Starts unresolved on BOTH sides. The server cannot read localStorage, so
  // it renders the placeholder; a first browser render that already showed the
  // page made React discard and redraw every page wrapped in this gate (React
  // #418 on /home, every lobby and every room), and that redraw wiped the
  // theme attributes on <html>: the flicker James saw (2026-10-06). The layout
  // effect resolves it before the browser paints the hydrated page.
  const [ok, setOk] = useState<boolean | null>(null);

  useLayoutEffect(() => {
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
    return <div aria-busy="true" />;
  }
  if (ok === false) return null;

  return <>{children}</>;
}
