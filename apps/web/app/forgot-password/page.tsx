"use client";

import React, { useState } from "react";

export default function ForgotPasswordPage() {
  const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    const v = identifier.trim();
    if (!v) return setErr("Enter your username or email.");
    setBusy(true);
    try {
      const isEmail = v.includes("@");
      const r = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEmail ? { email: v.toLowerCase() } : { username: v.toLowerCase() }),
      });
      const _ = await r.json().catch(() => ({} as any));
      setDone(true);
    } catch (e: any) {
      setErr(String(e?.message || "Network error."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080810", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "monospace", color: "#e8e8f0" }}>
      <div style={{ width: "min(420px, 100%)", background: "rgba(12,12,20,0.92)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 16, padding: "32px 28px" }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, marginBottom: 6, textAlign: "center" }}>WEERED</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#f5b700", letterSpacing: 2, marginBottom: 24, textAlign: "center" }}>RESET YOUR PASSWORD</div>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, color: "#34d399", marginBottom: 10 }}>If that account exists, a reset email is on its way.</div>
            <div style={{ fontSize: 12, color: "rgba(148,163,184,0.6)", lineHeight: 1.7 }}>Check your inbox (and spam). Link is good for 1 hour.</div>
            <a href="/login" style={{ display: "inline-block", marginTop: 18, fontSize: 11, color: "rgba(167,139,250,0.55)", textDecoration: "underline" }}>back to sign in</a>
          </div>
        ) : (
          <>
            <label style={{ display: "block", fontSize: 11, color: "rgba(148,163,184,0.65)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>username or email</label>
            <input
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              autoFocus
              autoComplete="username"
              onKeyDown={e => { if (e.key === "Enter") submit(); }}
              placeholder="your_handle or you@example.com"
              style={{ width: "100%", padding: "13px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, color: "#f3f4f6", fontFamily: "monospace", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
            {err && <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, color: "rgba(254,202,202,0.95)", fontSize: 12 }}>{err}</div>}
            <button
              onClick={submit}
              disabled={busy}
              style={{ width: "100%", marginTop: 18, padding: 14, background: "linear-gradient(135deg, rgba(124,58,237,0.85), rgba(217,70,239,0.75))", border: "1px solid rgba(124,58,237,0.45)", borderRadius: 12, color: "white", fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1 }}
            >
              {busy ? "working..." : "send reset link"}
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
