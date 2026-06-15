"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const TOKEN_KEY = "weered_user";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return !!(localStorage.getItem(TOKEN_KEY) || "");
    } catch {
      return null;
    }
  });

  useEffect(() => {
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
