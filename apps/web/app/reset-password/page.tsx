"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ResetInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
  const token = sp?.get("token") || "";

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setErr("Missing token in link.");
  }, [token]);

  async function submit() {
    setErr("");
    if (!pw || pw.length < 6) return setErr("Password must be at least 6 characters.");
    if (pw !== pw2) return setErr("Passwords don't match.");
    setBusy(true);
    try {
      const r = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw }),
      });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok) throw new Error(j?.error || "Reset failed.");
      setDone(true);
      setTimeout(() => router.replace("/login"), 2500);
    } catch (e: any) {
      setErr(String(e?.message || "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080810", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "monospace", color: "#e8e8f0" }}>
      <div style={{ width: "min(420px, 100%)", background: "rgba(12,12,20,0.92)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 16, padding: "32px 28px" }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, marginBottom: 6, textAlign: "center" }}>WEERED</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#f5b700", letterSpacing: 2, marginBottom: 24, textAlign: "center" }}>SET A NEW PASSWORD</div>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, color: "#34d399", marginBottom: 10 }}>Password updated.</div>
            <div style={{ fontSize: 12, color: "rgba(148,163,184,0.6)" }}>Redirecting to sign in…</div>
          </div>
        ) : (
          <>
            <label style={{ display: "block", fontSize: 11, color: "rgba(148,163,184,0.65)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>new password</label>
            <input
              type="password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              autoComplete="new-password"
              autoFocus
              style={{ width: "100%", padding: "13px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, color: "#f3f4f6", fontFamily: "monospace", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
            <label style={{ display: "block", fontSize: 11, color: "rgba(148,163,184,0.65)", letterSpacing: 0.8, textTransform: "uppercase", margin: "14px 0 8px" }}>confirm</label>
            <input
              type="password"
              value={pw2}
              onChange={e => setPw2(e.target.value)}
              autoComplete="new-password"
              onKeyDown={e => { if (e.key === "Enter") submit(); }}
              style={{ width: "100%", padding: "13px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, color: "#f3f4f6", fontFamily: "monospace", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
            {err && <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, color: "rgba(254,202,202,0.95)", fontSize: 12 }}>{err}</div>}
            <button
              onClick={submit}
              disabled={busy || !token}
              style={{ width: "100%", marginTop: 18, padding: 14, background: "linear-gradient(135deg, rgba(124,58,237,0.85), rgba(217,70,239,0.75))", border: "1px solid rgba(124,58,237,0.45)", borderRadius: 12, color: "white", fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1 }}
            >
              {busy ? "working..." : "update password"}
            </button>
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <a href="/login" style={{ fontSize: 11, color: "rgba(167,139,250,0.55)", textDecoration: "underline" }}>back to sign in</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#080810" }} />}>
      <ResetInner />
    </Suspense>
  );
}
