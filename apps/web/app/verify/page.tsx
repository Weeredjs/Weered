"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function VerifyInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
  const token = sp?.get("token") || "";
  const [status, setStatus] = useState<"working" | "ok" | "err">("working");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("err");
      setMsg("Missing token in link.");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const j = await r.json().catch(() => ({} as any));
        if (!r.ok) {
          setStatus("err");
          setMsg(j?.error || "Verification failed.");
          return;
        }
        setStatus("ok");
        setMsg("Email verified.");
        setTimeout(() => router.replace("/home"), 2200);
      } catch (e: any) {
        setStatus("err");
        setMsg(String(e?.message || "Network error."));
      }
    })();
  }, [token, API, router]);

  return (
    <div style={{ minHeight: "100vh", background: "#080810", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "monospace", color: "#e8e8f0" }}>
      <div style={{ width: "min(420px, 100%)", background: "rgba(12,12,20,0.92)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 16, padding: "32px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, marginBottom: 6 }}>WEERED</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#f5b700", letterSpacing: 2, marginBottom: 24 }}>EMAIL VERIFICATION</div>
        {status === "working" && <div style={{ fontSize: 14, color: "rgba(203,213,225,0.7)" }}>Verifying…</div>}
        {status === "ok" && (
          <>
            <div style={{ fontSize: 16, color: "#34d399", marginBottom: 8 }}>{msg}</div>
            <div style={{ fontSize: 12, color: "rgba(148,163,184,0.6)" }}>Redirecting…</div>
          </>
        )}
        {status === "err" && (
          <>
            <div style={{ fontSize: 16, color: "#fca5a5", marginBottom: 12 }}>{msg}</div>
            <a href="/login" style={{ fontSize: 12, color: "#a78bfa", textDecoration: "underline" }}>Back to sign in</a>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#080810" }} />}>
      <VerifyInner />
    </Suspense>
  );
}
