"use client";

import React from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export default function Page() {
  const router = useRouter();
  const [username, setUsername] = React.useState("Weered");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string>("");

  React.useEffect(() => {
    // If already logged in, go straight to lobby
    try {
      const tok = localStorage.getItem("weered_token") || "";
      if (tok) router.replace("/lobby");
    } catch {}
  }, [router]);

  async function login() {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(`${API}/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`Login failed (${r.status}) ${txt}`.slice(0, 240));
      }

      const j: any = await r.json();
      if (!j?.token) throw new Error("No token returned");

      try {
        localStorage.setItem("weered_token", j.token);
        localStorage.setItem("weered_user", JSON.stringify(j.user || null));
      } catch {}

      router.replace("/lobby");
    } catch (e: any) {
      setErr(e?.message || "Failed to login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-[#E5E7EB]">
      {/* soft ambient glow */}
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl opacity-40"
          style={{ background: "linear-gradient(135deg,#7C3AED,#D946EF)" }}
        />
        <div
          className="absolute -bottom-32 right-[-120px] h-[420px] w-[420px] rounded-full blur-3xl opacity-20"
          style={{ background: "linear-gradient(135deg,#7C3AED,#D946EF)" }}
        />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6">
        <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-2">
          {/* left: brand */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-4">
              <img
                src="/brand/weered_badge_512.png"
                alt="weered"
                className="h-14 w-14 rounded-2xl"
              />
              <div>
                <div className="text-3xl font-semibold tracking-tight">weered</div>
                <div className="mt-1 text-sm opacity-70">
                  Portal-first chat + presence, built for lobbies.
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-[#1F2937] bg-[#121826] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
              <div className="text-sm font-medium opacity-80">What you&apos;re entering</div>
              <ul className="mt-3 space-y-2 text-sm opacity-70">
                <li>• Real-time lobby presence + chat</li>
                <li>• Docked controls, fast navigation</li>
                <li>• Reddit browser temporarily disabled (placeholder mode)</li>
              </ul>
              <div className="mt-4 text-xs opacity-50">
                Tip: This is dev login (JWT). We’ll harden auth once the UI is locked.
              </div>
            </div>
          </div>

          {/* right: login card */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-2xl border border-[#1F2937] bg-[#121826] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">Sign in</div>
                  <div className="text-sm opacity-70">Enter a username to continue.</div>
                </div>
                <img
                  src="/brand/weered_badge_512.png"
                  alt="badge"
                  className="h-10 w-10 rounded-xl opacity-90"
                />
              </div>

              <label className="mt-6 block text-sm opacity-80">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[#1F2937] bg-[#0B0F1A] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#7C3AED]"
                placeholder="Weered"
                autoComplete="off"
              />

              {err ? (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {err}
                </div>
              ) : null}

              <button
                onClick={login}
                disabled={busy || !username.trim()}
                className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#7C3AED,#D946EF)" }}
              >
                {busy ? "Signing in..." : "Login"}
              </button>

              <div className="mt-4 text-center text-xs opacity-60">
                By continuing you agree this is dev mode.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


