"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

  const [mode, setMode]         = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  const nextPath = React.useMemo(() => {
    const n = sp?.get("next") || "";
    return n.startsWith("/") ? n : "/home";
  }, [sp]);

  React.useEffect(() => {
    try {
      if (localStorage.getItem("weered_token")) router.replace(nextPath);
    } catch {}
  }, [router, nextPath]);

  async function submit() {
    const u = username.trim();
    const p = password.trim();
    const e = email.trim();
    setErr("");
    if (!u || !p) return setErr("Username and password required.");
    if (mode === "register" && !e) return setErr("Email address required.");
    setBusy(true);
    try {
      const url = mode === "register" ? `${API}/auth/register` : `${API}/auth/login`;
      const body: any = { username: u, password: p };
      if (mode === "register") body.email = e;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok) throw new Error(j?.error || j?.message || `Error ${r.status}`);
      const tok = String(j?.token || "");
      if (!tok) throw new Error("No token returned.");
      localStorage.setItem("weered_token", tok);
      if (j?.user) localStorage.setItem("weered_user", JSON.stringify(j.user));
      if (j?.pendingVerification) {
        setPendingEmail(e);
        return;
      }
      router.replace(nextPath);
    } catch (e: any) {
      setErr(String(e?.message || "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  async function devLogin() {
    if (!username.trim()) return setErr("Enter a username for dev login.");
    setBusy(true);
    try {
      const r = await fetch(`${API}/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok) throw new Error(j?.error || `Error ${r.status}`);
      localStorage.setItem("weered_token", j.token);
      if (j?.user) localStorage.setItem("weered_user", JSON.stringify(j.user));
      router.replace(nextPath);
    } catch (e: any) {
      setErr(String(e?.message || "Dev login failed."));
    } finally {
      setBusy(false);
    }
  }


  async function googleLogin() {
    const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
    window.location.href = `${API}/auth/google`;
  }

  const isDev = process.env.NODE_ENV === "development";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        .wl-root {
          min-height: 100vh;
          background: #080810;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          font-family: 'DM Mono', monospace;
          position: relative;
          overflow: hidden;
        }
        .wl-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 50% at 10% 0%, rgba(124,58,237,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 90% 100%, rgba(217,70,239,0.10) 0%, transparent 55%);
          pointer-events: none;
          z-index: 0;
        }
        .wl-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          z-index: 0;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
        }
        .wl-card {
          position: relative;
          z-index: 1;
          width: min(440px, 100%);
          background: rgba(12,12,20,0.92);
          border: 1px solid rgba(124,58,237,0.25);
          border-radius: 20px;
          padding: 36px 32px 28px;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(124,58,237,0.08);
          backdrop-filter: blur(20px);
        }
        .wl-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 28px;
        }
        .wl-logo {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          flex-shrink: 0;
          overflow: hidden;
        }
        .wl-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 0 16px rgba(124,58,237,0.4));
        }
         .wl-input:-webkit-autofill,
        .wl-input:-webkit-autofill:hover,
        .wl-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px rgba(20,20,35,0.95) inset !important;
          -webkit-text-fill-color: rgba(243,244,246,0.98) !important;
          caret-color: rgba(243,244,246,0.98);
        } 
        .wl-brand-name {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 20px;
          color: rgba(243,244,246,0.98);
          letter-spacing: -0.5px;
          line-height: 1;
        }
        .wl-brand-sub {
          font-size: 11px;
          color: rgba(148,163,184,0.55);
          margin-top: 3px;
          letter-spacing: 0.3px;
        }
        .wl-tabs {
          display: flex;
          gap: 4px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 24px;
        }
        .wl-tab {
          flex: 1;
          padding: 9px;
          border-radius: 9px;
          border: none;
          background: transparent;
          color: rgba(148,163,184,0.6);
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .wl-tab:hover { color: rgba(243,244,246,0.9); }
        .wl-tab.active {
          background: rgba(124,58,237,0.20);
          border: 1px solid rgba(124,58,237,0.35);
          color: rgba(243,244,246,0.98);
          box-shadow: 0 0 16px rgba(124,58,237,0.15);
        }
        .wl-label {
          display: block;
          font-size: 11px;
          color: rgba(148,163,184,0.65);
          letter-spacing: 0.8px;
          text-transform: uppercase;
          margin-bottom: 8px;
          margin-top: 14px;
        }
        .wl-input {
          width: 100%;
          padding: 13px 14px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 12px;
          color: rgba(243,244,246,0.98);
          font-family: 'DM Mono', monospace;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }
        .wl-input::placeholder { color: rgba(148,163,184,0.30); }
        .wl-input:focus {
          border-color: rgba(124,58,237,0.55);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.12);
          background: rgba(255,255,255,0.07);
        }
        .wl-error {
          margin-top: 12px;
          padding: 10px 14px;
          background: rgba(239,68,68,0.10);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px;
          color: rgba(254,202,202,0.95);
          font-size: 12px;
        }
        .wl-btn {
          width: 100%;
          margin-top: 20px;
          padding: 14px;
          background: linear-gradient(135deg, rgba(124,58,237,0.85), rgba(217,70,239,0.75));
          border: 1px solid rgba(124,58,237,0.45);
          border-radius: 12px;
          color: white;
          font-family: 'Syne', sans-serif;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 4px 24px rgba(124,58,237,0.25);
        }
        .wl-btn:hover:not(:disabled) {
          box-shadow: 0 4px 32px rgba(124,58,237,0.40);
          transform: translateY(-1px);
        }
        .wl-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .wl-footer {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .wl-footer-text { font-size: 11px; color: rgba(148,163,184,0.45); }
        .wl-switch { color: rgba(167,139,250,0.65); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
        .wl-switch:hover { color: rgba(167,139,250,0.90); }
        .wl-dev { font-size: 11px; color: rgba(100,116,139,0.40); background: none; border: none; cursor: pointer; font-family: 'DM Mono', monospace; text-decoration: underline; text-underline-offset: 3px; }
        .wl-dev:hover { color: rgba(100,116,139,0.70); }
      `}</style>

      <div className="wl-root">
        <div className="wl-card">
          <div className="wl-brand">
            <div className="wl-logo"><img src="/brand/mark-512.png" alt="Weered" /></div>
            <div>
              <div className="wl-brand-name">weered</div>
              <div className="wl-brand-sub">enter the portal</div>
            </div>
          </div>

          <div className="wl-tabs">
            <button className={`wl-tab${mode === "login" ? " active" : ""}`} onClick={() => { setMode("login"); setErr(""); }}>sign_in</button>
            <button className={`wl-tab${mode === "register" ? " active" : ""}`} onClick={() => { setMode("register"); setErr(""); }}>register</button>
          </div>

          {pendingEmail ? (
            <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
              <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.9 }}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{margin:"0 auto",display:"block"}}>
                  <rect width="40" height="40" rx="10" fill="rgba(124,58,237,0.15)" stroke="rgba(124,58,237,0.3)" strokeWidth="1"/>
                  <path d="M8 14l12 9 12-9" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round"/>
                  <rect x="8" y="12" width="24" height="17" rx="2" stroke="#a78bfa" strokeWidth="1.5"/>
                </svg>
              </div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: "rgba(232,232,240,0.95)", marginBottom: 8 }}>
                Check your email.
              </div>
              <div style={{ fontSize: 12, color: "rgba(148,163,184,0.6)", lineHeight: 1.8, marginBottom: 20 }}>
                We sent a verification link to<br/>
                <span style={{ color: "rgba(167,139,250,0.8)" }}>{pendingEmail}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(100,116,139,0.5)", lineHeight: 1.7 }}>
                Click the link in the email to activate your account.<br/>
                You can browse in the meantime.
              </div>
              <button
                style={{ marginTop: 20, background: "none", border: "none", color: "rgba(167,139,250,0.45)", fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono', monospace", textDecoration: "underline", textUnderlineOffset: 3 }}
                onClick={() => router.replace(nextPath)}
              >
                continue to weered →
              </button>
            </div>
          ) : (
            <>
          <label className="wl-label">username</label>
          <input className="wl-input" value={username} onChange={e => setUsername(e.target.value)}
            placeholder="your_handle" autoComplete="username" autoFocus />

          {mode === "register" && (
            <>
              <label className="wl-label">email</label>
              <input className="wl-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email" />
            </>
          )}

          <label className="wl-label">password</label>
          <input className="wl-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"}
            onKeyDown={e => { if (e.key === "Enter") submit(); }} />

          {err && <div className="wl-error">{err}</div>}

          <button className="wl-btn" disabled={busy} onClick={submit}>
            {busy ? "working..." : mode === "login" ? "sign_in()" : "create_account()"}
          </button>
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 4px" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
            <span style={{ fontSize: 11, color: "rgba(148,163,184,0.35)", letterSpacing: "0.06em", fontFamily: "'DM Mono', monospace" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          </div>

          <button
            onClick={googleLogin}
            disabled={busy}
            style={{
              width: "100%",
              padding: "13px 14px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              color: "rgba(243,244,246,0.90)",
              fontFamily: "'DM Mono', monospace",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.20)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            continue with Google
          </button>

          {!pendingEmail && <div className="wl-footer">
            <span className="wl-footer-text">
              {mode === "login" ? "no account? " : "have an account? "}
              <span className="wl-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}>
                {mode === "login" ? "register" : "sign in"}
              </span>
            </span>
            {isDev && <button className="wl-dev" onClick={devLogin} disabled={busy}>dev_login()</button>}
          </div>}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "center", gap: 20 }}>
            {[["about", "/about"], ["premium", "/premium"], ["contact", "/contact"]].map(([label, href]) => (
              <a key={href} href={href} style={{ fontSize: 10, color: "rgba(167,139,250,0.35)", textDecoration: "none", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace", transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(167,139,250,0.75)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(167,139,250,0.35)")}>
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#080810" }} />}>
      <LoginForm />
    </Suspense>
  );
}
