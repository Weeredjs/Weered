"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function OnboardingForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">(
    "idle",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      const t = sp?.get("token") || "";
      const userRaw = sp?.get("user") || "";
      if (t) {
        setToken(t);
        void 0;
        if (userRaw) {
          const user = JSON.parse(decodeURIComponent(userRaw));
          localStorage.setItem("weered_user", JSON.stringify(user));
        }
      } else {
        router.replace("/login");
      }
    } catch {}
  }, [sp, router]);

  const checkUsername = useCallback(
    async (val: string) => {
      const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (clean.length < 2) {
        setStatus("invalid");
        return;
      }
      setStatus("checking");
      try {
        const res = await fetch(`${API}/auth/username-check?username=${encodeURIComponent(clean)}`);
        const data = await res.json();
        setStatus(data.available ? "available" : "taken");
      } catch {
        setStatus("idle");
      }
    },
    [API],
  );

  useEffect(() => {
    if (!username) {
      setStatus("idle");
      return;
    }
    const timer = setTimeout(() => checkUsername(username), 400);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  async function submit() {
    if (status !== "available" || busy) return;
    setErr("");
    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      void 0;
      if (data.user) localStorage.setItem("weered_user", JSON.stringify(data.user));
      router.replace("/home");
    } catch (e: any) {
      setErr(String(e?.message || "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, "");

  const statusColor = {
    idle: "transparent",
    checking: "rgba(148,163,184,0.4)",
    available: "rgba(34,197,94,0.8)",
    taken: "rgba(239,68,68,0.8)",
    invalid: "rgba(239,68,68,0.8)",
  }[status];

  const statusText = {
    idle: "",
    checking: "checking...",
    available: `✓ ${clean} is available`,
    taken: `✗ ${clean} is taken`,
    invalid: "at least 2 characters",
  }[status];

  return (
    <>
      <style>{`
        .wo-root {
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
        .wo-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 50% at 10% 0%, rgba(124,58,237,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 90% 100%, rgba(217,70,239,0.10) 0%, transparent 55%);
          pointer-events: none;
          z-index: 0;
        }
        .wo-root::after {
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
        .wo-card {
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
        .wo-input {
          width: 100%;
          padding: 13px 14px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 12px;
          color: rgba(243,244,246,0.98);
          font-family: 'DM Mono', monospace;
          font-size: 15px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
          letter-spacing: 0.02em;
        }
        .wo-input::placeholder { color: rgba(148,163,184,0.30); }
        .wo-input:focus {
          border-color: rgba(124,58,237,0.55);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.12);
          background: rgba(255,255,255,0.07);
        }
        .wo-btn {
          width: 100%;
          margin-top: 20px;
          padding: 14px;
          background: linear-gradient(135deg, rgba(124,58,237,0.85), rgba(217,70,239,0.75));
          border: 1px solid rgba(124,58,237,0.45);
          border-radius: 12px;
          color: white;
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 4px 24px rgba(124,58,237,0.25);
        }
        .wo-btn:hover:not(:disabled) {
          box-shadow: 0 4px 32px rgba(124,58,237,0.40);
          transform: translateY(-1px);
        }
        .wo-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
      `}</style>

      <div className="wo-root">
        <div className="wo-card">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "linear-gradient(135deg, #7C3AED, #D946EF)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
                fontWeight: 800,
                fontSize: 18,
                color: "white",
                boxShadow: "0 0 24px rgba(124,58,237,0.35)",
              }}
            >
              w
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
                  fontWeight: 800,
                  fontSize: 20,
                  color: "rgba(243,244,246,0.98)",
                  letterSpacing: "-0.5px",
                }}
              >
                weered
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(148,163,184,0.55)",
                  marginTop: 3,
                  letterSpacing: "0.04em",
                }}
              >
                claim your handle
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 6 }}>
            <div
              style={{
                fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
                fontWeight: 800,
                fontSize: 22,
                color: "rgba(243,244,246,0.98)",
                letterSpacing: "-0.5px",
                lineHeight: 1.2,
              }}
            >
              Pick your handle.
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(148,163,184,0.55)",
                marginTop: 8,
                lineHeight: 1.65,
              }}
            >
              This is how you'll show up everywhere: rooms, chat, presence.
              <br />
              Lowercase, numbers, and underscores. Pick something you'll answer to.
            </div>
          </div>

          <div style={{ marginTop: 24, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 15,
                color: "rgba(124,58,237,0.6)",
                fontFamily: "'DM Mono', monospace",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              @
            </div>
            <input
              className="wo-input"
              style={{ paddingLeft: 28 }}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="your_handle"
              maxLength={24}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>

          <div
            style={{
              height: 20,
              marginTop: 8,
              fontSize: 12,
              color: statusColor,
              transition: "color 0.15s",
              paddingLeft: 2,
            }}
          >
            {statusText}
          </div>

          {err && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(239,68,68,0.10)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 10,
                color: "rgba(254,202,202,0.95)",
                fontSize: 12,
                marginTop: 4,
              }}
            >
              {err}
            </div>
          )}

          <button className="wo-btn" disabled={status !== "available" || busy} onClick={submit}>
            {busy ? "setting up..." : "claim_handle()"}
          </button>

          <div
            style={{
              marginTop: 16,
              fontSize: 11,
              color: "rgba(100,116,139,0.45)",
              textAlign: "center",
              lineHeight: 1.6,
              letterSpacing: "0.02em",
            }}
          >
            You can change this later in your profile.
          </div>
        </div>
      </div>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#080810" }} />}>
      <OnboardingForm />
    </Suspense>
  );
}
