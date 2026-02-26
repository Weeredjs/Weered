"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextPath = React.useMemo(() => {
    const n = sp?.get("next") || "";
    return n && n.startsWith("/") ? n : "/lobby";
  }, [sp]);

  React.useEffect(() => {
    try {
      const tok = localStorage.getItem("weered_token") || "";
      if (tok) router.replace(nextPath);
      else router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    } catch {
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [router, nextPath]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "var(--weered-bg, #050816)",
      color: "rgba(243,244,246,.92)",
      fontWeight: 900
    }}>
      Loading…
    </div>
  );
}
