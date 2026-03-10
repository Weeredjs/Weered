"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function GoogleFinish() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    try {
      const token = sp?.get("token") || "";
      const userRaw = sp?.get("user") || "";
      if (token) {
        localStorage.setItem("weered_token", token);
        if (userRaw) {
          const user = JSON.parse(decodeURIComponent(userRaw));
          localStorage.setItem("weered_user", JSON.stringify(user));
        }
      }
    } catch {}
    router.replace("/home");
  }, [router, sp]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080810",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "monospace",
      color: "rgba(167,139,250,0.7)",
      fontSize: 13,
    }}>
      Signing you in...
    </div>
  );
}

export default function GoogleFinishPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#080810" }} />}>
      <GoogleFinish />
    </Suspense>
  );
}
