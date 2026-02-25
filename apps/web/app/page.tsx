"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const sp = useSearchParams();

  const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const nextPath = useMemo(() => {
    const n = sp?.get("next") || "";
    return n.startsWith("/") ? n : "/lobby";
  }, [sp]);

  React.useEffect(() => {
    // If already logged in, go straight to lobby/next
    try {
      const tok = localStorage.getItem("weered_token") || "";
      if (tok) router.replace(nextPath);
    } catch {}
  }, [router, nextPath]);

  async function submit() {
    const u = (username || "").trim();
    const p = (password || "").trim();
    setErr("");
    if (!u || !p) return setErr("Enter username + password.");

    setBusy(true);
    try {
      const url = mode === "register" ? `${API}/auth/register` : `${API}/auth/login`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });

      const j = await r.json().catch(() => ({} as any));
      if (!r.ok) {
        throw new Error(j?.error || `Request failed (${r.status})`);
      }
      if (!j?.token) throw new Error("No token returned");

      try {
        localStorage.setItem("weered_token", j.token);
        localStorage.setItem("weered_user", JSON.stringify(j.user || null));
      } catch {}

      router.replace(nextPath);
    } catch (e: any) {
      setErr(String(e?.message || e || "Login failed"));
    } finally {
      setBusy(false);
    }
  }

  const bg = "#0B0F1A";
  const panel = "#121826";
  const border = "rgba(31,41,55,.9)";
  const text = "#E5E7EB";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, display: "grid", placeItems: "center", padding: 18 }}>
      <div style={{ width: "min(980px, 96vw)", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        {/* Left brand */}
        <div style={{ border: `1px solid ${border}`, borderRadius: 20, background: panel, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background: "linear-gradient(135deg, #7C3AED 0%, #D946EF 100%)",
                boxShadow: "0 10px 30px rgba(124,58,237,.22)",
              }}
            />
            <div>
              <div style={{ fontSize: 22, fontWeight: 950, letterSpacing: -0.4 }}>weered</div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>Spaces, rooms, presence — fast + stable.</div>
            </div>
          </div>

          <div style={{ marginTop: 14, opacity: 0.85, lineHeight: 1.55 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Tonight’s build</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Lobby chat in the center</li>
              <li>Moderator tools + room admin state</li>
              <li>Global staff controls (kick/ban)</li>
            </ul>
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid rgba(148,163,184,.14)", paddingTop: 12, opacity: 0.7, fontSize: 12 }}>
            Tip: use a simple username (no spaces). Passwords are stored hashed.
          </div>
        </div>

        {/* Right auth */}
        <div style={{ border: `1px solid ${border}`, borderRadius: 20, background: panel, padding: 18 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setMode("login")}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 14,
                fontWeight: 950,
                border: "1px solid rgba(148,163,184,.18)",
                background: mode === "login" ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.03)",
                color: text,
              }}
            >
              Login
            </button>
            <button
              onClick={() => setMode("register")}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 14,
                fontWeight: 950,
                border: "1px solid rgba(148,163,184,.18)",
                background: mode === "register" ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.03)",
                color: text,
              }}
            >
              Register
            </button>
          </div>

          <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 10 }}>
            {mode === "login" ? "Sign in to your account." : "Create a new account."}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={{ padding: "10px 12px", borderRadius: 14 }}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              style={{ padding: "10px 12px", borderRadius: 14 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />

            {err ? (
              <div style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", padding: "10px 12px", borderRadius: 14, color: "rgba(254,226,226,.95)" }}>
                {err}
              </div>
            ) : null}

            <button
              disabled={busy}
              onClick={submit}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                fontWeight: 950,
                border: "1px solid rgba(148,163,184,.18)",
                background: "linear-gradient(135deg, rgba(124,58,237,.95) 0%, rgba(217,70,239,.95) 100%)",
                color: "#0B0F1A",
                boxShadow: "0 10px 30px rgba(217,70,239,.16)",
              }}
            >
              {busy ? "Working…" : mode === "login" ? "Login" : "Create account"}
            </button>

            <div style={{ opacity: 0.65, fontSize: 12, lineHeight: 1.5 }}>
              This uses token auth (localStorage) to keep WS stable while we build.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}