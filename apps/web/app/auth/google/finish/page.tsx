"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { takeAfterAuth } from "@/lib/afterAuth";

function GoogleFinish() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    try {
      const token = sp?.get("token") || "";
      const userRaw = sp?.get("user") || "";
      if (token || userRaw) {
        /* the session lives in the httpOnly cookie set by the server */
        if (userRaw) {
          const user = JSON.parse(decodeURIComponent(userRaw));
          localStorage.setItem("weered_user", JSON.stringify(user));
        }
      }
    } catch {}
    // Back where they were headed (an invite to a lobby), else Home.
    router.replace(takeAfterAuth("/home"));
  }, [router, sp]);

  return (
    <div
      style={{
        minHeight: "var(--weered-page-h, 100vh)",
        background: "#080810",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "monospace",
        color: "rgba(167,139,250,0.7)",
        fontSize: 13,
      }}
    >
      Signing you in...
    </div>
  );
}

export default function GoogleFinishPage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: "var(--weered-page-h, 100vh)", background: "#080810" }} />}
    >
      <GoogleFinish />
    </Suspense>
  );
}
