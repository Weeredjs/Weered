"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectLogic() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextPath = React.useMemo(() => {
    const n = sp?.get("next") || "";
    return n && n.startsWith("/") ? n : "/home";
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

  return null;
}

export default function Page() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "var(--weered-bg, #050816)",
      color: "rgba(243,244,246,.92)",
      fontWeight: 900
    }}>
      <Suspense fallback={null}>
        <RedirectLogic />
      </Suspense>
      Loading…
    </div>
  );
}
