"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const TOKEN_KEY = "weered_token";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const tok = localStorage.getItem(TOKEN_KEY) || "";
      if (!tok) {
        // preserve where they tried to go (optional €“ nice for later)
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
    return (
      <div style={{ padding: 20, opacity: 0.7, fontSize: 13 }}>
        Checking session€¦
      </div>
    );
  }
  if (ok === false) return null;

  return <>{children}</>;
}
