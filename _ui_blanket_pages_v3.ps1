$ErrorActionPreference="Stop"

function Backup([string]$p, [string]$tag) {
  if (!(Test-Path -LiteralPath $p)) { throw "Missing: $p" }
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = "$p.bak_${tag}_$ts"
  Copy-Item -LiteralPath $p -Destination $bak -Force
  Write-Host "OK Backup:" $bak
}

function Write-File {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  # Strip control chars from path (just in case)
  $clean = -join ($Path.ToCharArray() | Where-Object { -not [char]::IsControl($_) })
  Set-Content -LiteralPath $clean -Value $Content -Force
  Write-Host "OK Wrote:" $clean
}

$Repo="C:\Weered"
$root  = Join-Path $Repo "apps\web\app\page.tsx"
$login = Join-Path $Repo "apps\web\app\login\page.tsx"
$lobby = Join-Path $Repo "apps\web\app\lobby\page.tsx"
$room  = Join-Path $Repo "apps\web\app\room\[roomId]\page.tsx"
$rsub  = Join-Path $Repo "apps\web\app\r\[sub]\page.tsx"

Backup $root  "ui_blanket_v3"
Backup $login "ui_blanket_v3"
Backup $lobby "ui_blanket_v3"
Backup $room  "ui_blanket_v3"
Backup $rsub  "ui_blanket_v3"

# ---------------- app/page.tsx ----------------
$ROOT = @'
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextPath = React.useMemo(() => {
    const n = sp?.get("next") || "";
    return n && n.startsWith("/") ? n : "/lobby";
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

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "var(--weered-bg, #050816)",
      color: "rgba(243,244,246,.92)",
      fontWeight: 900
    }}>
      Loading…
    </div>
  );
}
'@

# ---------------- app/login/page.tsx ----------------
$LOGIN = @'
"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
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
      if (!r.ok) throw new Error(j?.error || j?.message || `HTTP ${r.status}`);

      const tok = String(j?.token || "");
      const user = j?.user || null;
      if (!tok) throw new Error("No token returned.");

      localStorage.setItem("weered_token", tok);
      if (user) localStorage.setItem("weered_user", JSON.stringify(user));
      router.replace(nextPath);
    } catch (e: any) {
      setErr(String(e?.message || e || "Login failed."));
    } finally {
      setBusy(false);
    }
  }

  const card: React.CSSProperties = {
    background: "rgba(15,23,42,.88)",
    border: "1px solid rgba(148,163,184,.18)",
    borderRadius: 20,
    boxShadow: "0 20px 60px rgba(0,0,0,.55)",
    padding: 20,
    width: "min(520px, calc(100vw - 28px))",
    color: "rgba(243,244,246,.95)",
  };

  const pill = (active: boolean): React.CSSProperties => ({
    padding: "8px 10px",
    borderRadius: 999,
    border: active ? "1px solid var(--weered-accent-ring, rgba(14,165,233,.34))" : "1px solid rgba(148,163,184,.18)",
    background: active ? "var(--weered-accent-bg, rgba(14,165,233,.16))" : "rgba(255,255,255,.05)",
    fontWeight: 950,
    cursor: "pointer",
    userSelect: "none",
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--weered-bg, #050816)" }}>
      <div style={{
        position: "fixed",
        inset: 0,
        background:
          "radial-gradient(900px 600px at 20% 20%, rgba(56,189,248,.10), transparent 60%)," +
          "radial-gradient(800px 520px at 80% 35%, rgba(34,197,94,.08), transparent 55%)," +
          "radial-gradient(720px 540px at 45% 85%, rgba(245,158,11,.08), transparent 55%)",
        pointerEvents: "none"
      }} />

      <div style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "grid",
        placeItems: "center",
        padding: 14,
      }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, opacity: 0.75, fontWeight: 900 }}>weered</div>
              <div style={{ fontSize: 22, fontWeight: 1000, letterSpacing: ".2px" }}>
                {mode === "login" ? "Sign in" : "Create account"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.72, marginTop: 2 }}>
                Full-screen overlay. Clean and fast.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div onClick={() => setMode("login")} style={pill(mode === "login")}>Login</div>
              <div onClick={() => setMode("register")} style={pill(mode === "register")}>Register</div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="testuser2" autoComplete="username"
              style={{ padding: "12px 12px", borderRadius: 14, border: "1px solid rgba(148,163,184,.18)", background: "rgba(255,255,255,.05)",
                color: "rgba(243,244,246,.95)", outline: "none", fontWeight: 800 }} />

            <label style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"} type="password"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              style={{ padding: "12px 12px", borderRadius: 14, border: "1px solid rgba(148,163,184,.18)", background: "rgba(255,255,255,.05)",
                color: "rgba(243,244,246,.95)", outline: "none", fontWeight: 800 }} />

            {err ? (
              <div style={{ marginTop: 6, padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(239,68,68,.28)",
                background: "rgba(239,68,68,.10)", color: "rgba(254,226,226,.95)", fontWeight: 900, fontSize: 12 }}>{err}</div>
            ) : null}

            <button disabled={busy} onClick={submit}
              style={{ marginTop: 6, padding: "12px 12px", borderRadius: 14,
                border: "1px solid var(--weered-accent-ring, rgba(14,165,233,.34))",
                background: "var(--weered-accent-bg, rgba(14,165,233,.16))",
                color: "rgba(243,244,246,.95)", fontWeight: 1000, cursor: busy ? "not-allowed" : "pointer" }}>
              {busy ? "Working…" : (mode === "login" ? "Sign in" : "Create account")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
'@

# NOTE: Lobby/Room/rsub bodies are big. If this writes cleanly, I’ll paste the full lobby+room+rsub block next.
# For now, we just verify writer works with named params.

Write-File -Path $root  -Content $ROOT
Write-File -Path $login -Content $LOGIN

Write-Host ""
Write-Host "NEXT:"
Write-Host "  cd C:\Weered\apps\web ; pnpm dev"
Write-Host "  Visit /login"