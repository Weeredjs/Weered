"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyEmailInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    const token = sp?.get("token") || "";
    if (!token) {
      setStatus("error");
      setErrMsg("No verification token found.");
      return;
    }

    fetch(`${API}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}) as any);
        if (!r.ok) {
          setStatus("error");
          setErrMsg(j?.error || "Verification failed.");
          return;
        }
        if (j.token) void 0;
        if (j.user) localStorage.setItem("weered_user", JSON.stringify(j.user));
        setStatus("success");
      })
      .catch(() => {
        setStatus("error");
        setErrMsg("Network error. Try again.");
      });
  }, [sp, API]);

  const icon = {
    loading: (
      <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        fill="none"
        style={{ animation: "spin 1s linear infinite" }}
      >
        <circle cx="22" cy="22" r="18" stroke="rgba(124,58,237,0.25)" strokeWidth="3" />
        <path d="M22 4a18 18 0 0118 18" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
    success: (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <circle
          cx="22"
          cy="22"
          r="20"
          fill="rgba(34,197,94,0.1)"
          stroke="rgba(34,197,94,0.35)"
          strokeWidth="1.5"
        />
        <path
          d="M13 22l7 7 11-13"
          stroke="#4ade80"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    error: (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <circle
          cx="22"
          cy="22"
          r="20"
          fill="rgba(239,68,68,0.1)"
          stroke="rgba(239,68,68,0.3)"
          strokeWidth="1.5"
        />
        <path
          d="M15 15l14 14M29 15L15 29"
          stroke="#f87171"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  }[status];

  const title = {
    loading: "Verifying...",
    success: "You're verified.",
    error: "Something went wrong.",
  }[status];

  const sub = {
    loading: "Checking your verification link.",
    success: "Your account is active. Welcome.",
    error: errMsg || "The link may have expired.",
  }[status];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        .ve-root {
          min-height: 100vh;
          background: #0c0b0a;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'DM Mono', monospace;
          position: relative;
          overflow: hidden;
        }
        .ve-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse 70% 50% at 15% 10%, rgba(124,58,237,0.12) 0%, transparent 55%);
          pointer-events: none;
        }
        .ve-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px);
          background-size: 52px 52px;
          pointer-events: none;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
        }
        .ve-card {
          position: relative;
          z-index: 1;
          width: min(400px, 100%);
          background: rgba(12,12,20,0.92);
          border: 1px solid rgba(124,58,237,0.2);
          border-radius: 20px;
          padding: 44px 36px;
          box-shadow: 0 0 60px rgba(124,58,237,0.07), 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(20px);
          text-align: center;
        }
        .ve-wordmark {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 900;
          font-size: 22px;
          letter-spacing: -1px;
          color: rgba(232,232,240,0.9);
          margin-bottom: 32px;
        }
        .ve-icon { margin: 0 auto 20px; display: flex; justify-content: center; }
        .ve-title {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 800;
          font-size: 22px;
          color: rgba(232,232,240,0.95);
          margin-bottom: 10px;
          letter-spacing: -0.5px;
        }
        .ve-sub {
          font-size: 13px;
          color: rgba(148,163,184,0.55);
          line-height: 1.7;
          margin-bottom: 28px;
        }
        .ve-btn {
          display: inline-block;
          padding: 12px 28px;
          background: linear-gradient(135deg, rgba(124,58,237,0.85), rgba(217,70,239,0.7));
          border: 1px solid rgba(124,58,237,0.4);
          border-radius: 10px;
          color: #fff;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
          box-shadow: 0 4px 20px rgba(124,58,237,0.2);
        }
        .ve-btn:hover { box-shadow: 0 4px 28px rgba(124,58,237,0.35); transform: translateY(-1px); }
        .ve-ghost {
          display: inline-block;
          padding: 12px 28px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: rgba(255,255,255,0.4);
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          cursor: pointer;
          background: none;
          transition: all 0.15s;
          text-decoration: none;
        }
        .ve-ghost:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); }
      `}</style>

      <div className="ve-root">
        <div className="ve-card">
          <div className="ve-wordmark">weered</div>
          <div className="ve-icon">{icon}</div>
          <div className="ve-title">{title}</div>
          <div className="ve-sub">{sub}</div>

          {status === "success" && (
            <button className="ve-btn" onClick={() => router.replace("/home")}>
              enter_weered()
            </button>
          )}
          {status === "error" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}
            >
              <a href="/login" className="ve-btn">
                back_to_login()
              </a>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>or</span>
              <span style={{ fontSize: 11, color: "rgba(148,163,184,0.4)" }}>
                need a new link?{" "}
                <a
                  href="/contact"
                  style={{
                    color: "rgba(167,139,250,0.5)",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  contact us
                </a>
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0c0b0a" }} />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
