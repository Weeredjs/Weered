$ErrorActionPreference="Stop"

function Backup([string]$p, [string]$tag) {
  if (!(Test-Path -LiteralPath $p)) { throw "Missing: $p" }
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = "$p.bak_${tag}_$ts"
  Copy-Item -LiteralPath $p -Destination $bak -Force
  Write-Host "OK Backup:" $bak
}

$Repo="C:\Weered"
$root  = Join-Path $Repo "apps\web\app\page.tsx"
$login = Join-Path $Repo "apps\web\app\login\page.tsx"
$lobby = Join-Path $Repo "apps\web\app\lobby\page.tsx"
$room  = Join-Path $Repo "apps\web\app\room\[roomId]\page.tsx"
$rsub  = Join-Path $Repo "apps\web\app\r\[sub]\page.tsx"

Backup $root  "ui_blanket_v4"
Backup $login "ui_blanket_v4"
Backup $lobby "ui_blanket_v4"
Backup $room  "ui_blanket_v4"
Backup $rsub  "ui_blanket_v4"

Write-Host "PATH root :" $root
Write-Host "PATH login:" $login
Write-Host "PATH lobby:" $lobby
Write-Host "PATH room :" $room
Write-Host "PATH rsub :" $rsub

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

# ---------------- app/r/[sub]/page.tsx ----------------
$RSUB = @'
"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function SubredditRoute({ params }: { params: { sub: string } }) {
  const router = useRouter();

  React.useEffect(() => {
    const raw = String(params?.sub || "").trim();
    const sub = raw.replace(/^r\//i, "").replace(/^\/+/, "");
    router.replace(`/lobby?sub=${encodeURIComponent("r/" + sub)}`);
  }, [router, params?.sub]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "var(--weered-bg, #050816)",
      color: "rgba(243,244,246,.92)",
      fontWeight: 900
    }}>
      Opening lobby…
    </div>
  );
}
'@

# ---------------- app/lobby/page.tsx ----------------
$LOBBY = @'
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SubredditBrowser from "../../components/SubredditBrowser";
import LobbyChatPanel from "../../components/LobbyChatPanel";
import { useWeered } from "../../components/WeeredProvider";
import ModeratorToolsPanel from "../../components/ModeratorToolsPanel";

function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

function Avatar(props: { name: string; size?: number }) {
  const s = props.size || 28;
  const n = String(props.name || "?");
  const parts = n.trim().split(/\s+/).filter(Boolean);
  const initials = (parts[0]?.[0] || "?") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] || "") : (parts[0]?.[1] || ""));
  return (
    <div style={{
      width: s, height: s, borderRadius: 999,
      display: "grid", placeItems: "center",
      background: "rgba(255,255,255,.07)",
      border: "1px solid rgba(148,163,184,.16)",
      color: "rgba(243,244,246,.95)",
      fontWeight: 1000,
      flex: "0 0 auto"
    }}>
      <span style={{ fontSize: Math.max(10, Math.round(s * 0.40)) }}>{initials.toUpperCase()}</span>
    </div>
  );
}

export default function LobbyPage() {
  const sp = useSearchParams();
  const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

  const [rooms, setRooms] = useState<any[]>([]);
  const [createName, setCreateName] = useState("");

  const subParam = useMemo(() => sp.get("sub") || "r/all", [sp]);
  const sub = useMemo(() => subParam.replace(/^r\//i, ""), [subParam]);

  const { setActiveRoomId } = useWeered();

  const lobbyRoomId = useMemo(() => {
    const sp = (subParam || "r/all").trim();
    const normalized = sp.startsWith("r/") ? sp : ("r/" + sp.replace(/^\/+/, ""));
    return "lobby:" + normalized;
  }, [subParam]);

  useEffect(() => {
    try { setActiveRoomId(lobbyRoomId); } catch {}
  }, [lobbyRoomId, setActiveRoomId]);

  async function loadRooms() {
    try {
      const r = await fetch(`${API}/rooms`, { cache: "no-store" });
      const j = await r.json().catch(() => []);
      setRooms(Array.isArray(j) ? j : []);
    } catch {
      setRooms([]);
    }
  }

  async function createRoom() {
    const name = (createName || "").trim();
    if (!name) return;
    try {
      await fetch(`${API}/rooms/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setCreateName("");
      loadRooms();
    } catch {}
  }

  useEffect(() => { loadRooms(); }, []);

  const page = { padding: "14px", paddingRight: 420 } as React.CSSProperties;

  const grid = {
    display: "grid",
    gridTemplateColumns: "320px minmax(520px, 1fr)",
    gap: 14,
    alignItems: "start",
  } as React.CSSProperties;

  const panel = {
    background: "var(--weered-panel, rgba(15,23,42,.90))",
    border: "1px solid rgba(148,163,184,.14)",
    borderRadius: 18,
    padding: 12,
  } as React.CSSProperties;

  const card = {
    border: "1px solid rgba(148,163,184,.14)",
    borderRadius: 16,
    padding: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    background: "rgba(255,255,255,.03)"
  } as React.CSSProperties;

  return (
    <div style={page}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 900 }}>lobby</div>
          <div style={{ fontSize: 20, fontWeight: 1100, letterSpacing: ".1px" }}>
            The Lobby <span style={{ opacity: 0.7 }}>|</span> {subParam}
          </div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Rooms left. Subreddit + Main Lobby Chat center. Dock stays right.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            href={`/r/${encodeURIComponent(sub)}`}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,.20)",
              background: "rgba(255,255,255,.05)",
              fontWeight: 950,
              textDecoration: "none",
              color: "rgba(243,244,246,.98)"
            }}
          >
            Open subreddit
          </Link>

          <button
            onClick={loadRooms}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,.20)",
              background: "rgba(255,255,255,.05)",
              color: "rgba(243,244,246,.98)",
              fontWeight: 950
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={grid}>
        <section style={panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 1000 }}>Rooms</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>{rooms.length}</div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Create a room…"
              style={{
                flex: 1,
                padding: "10px 10px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,.18)",
                background: "rgba(255,255,255,.05)",
                color: "rgba(243,244,246,.95)",
                outline: "none",
                fontWeight: 900
              }}
            />
            <button
              onClick={createRoom}
              style={{
                padding: "10px 10px",
                borderRadius: 12,
                border: "1px solid var(--weered-accent-ring, rgba(14,165,233,.34))",
                background: "var(--weered-accent-bg, rgba(14,165,233,.16))",
                color: "rgba(243,244,246,.95)",
                fontWeight: 1000
              }}
            >
              Create
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflow: "auto", paddingRight: 4 }}>
            {rooms.map((r: any) => {
              const rid = String(r.id ?? "");
              const title = pickFirstString(r.name, rid);
              const users = r.users ?? r.userCount ?? "—";
              const go = (() => {
                if (!rid) return "/lobby";
                if (rid.startsWith("lobby:")) {
                  const sub = rid.slice("lobby:".length);
                  return `/lobby?sub=${encodeURIComponent(sub)}`;
                }
                return `/room/${encodeURIComponent(rid)}`;
              })();

              return (
                <Link
                  key={rid || Math.random()}
                  href={go}
                  style={{ ...card, textDecoration: "none", color: "rgba(243,244,246,.96)" }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                    <Avatar name={title} size={28} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {title}
                      </div>
                      <div style={{ opacity: 0.70, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        id: {rid} · users: {users}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,.18)",
                    background: "rgba(255,255,255,.04)",
                    fontWeight: 950,
                    fontSize: 12
                  }}>
                    Open
                  </div>
                </Link>
              );
            })}
            {!rooms.length ? <div style={{ opacity: 0.7 }}>No rooms found.</div> : null}
          </div>

          <div style={{ marginTop: 12 }}>
            <ModeratorToolsPanel roomId={lobbyRoomId} />
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1.6fr .9fr", gap: 14, alignItems: "start" }}>
          <div style={panel}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 1000 }}>r/{sub}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>posts</div>
            </div>
            <SubredditBrowser subreddit={sub} />
          </div>

          <div style={panel}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 1000 }}>Main Lobby Chat</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{lobbyRoomId}</div>
            </div>
            <LobbyChatPanel title="Lobby chat" style={{ width: "100%" }} />
          </div>
        </section>
      </div>
    </div>
  );
}
'@

# ---------------- app/room/[roomId]/page.tsx ----------------
$ROOM = @'
"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { useWeered } from "../../../components/WeeredProvider";
import LobbyChatPanel from "../../../components/LobbyChatPanel";
import ModeratorToolsPanel from "../../../components/ModeratorToolsPanel";

function safeDecode(s: string): string {
  let out = String(s || "");
  for (let i = 0; i < 3; i++) {
    if (!out.includes("%")) break;
    try {
      const d = decodeURIComponent(out);
      if (d === out) break;
      out = d;
    } catch { break; }
  }
  return out;
}

function Avatar(props: { name: string; size?: number; ring?: boolean }) {
  const s = props.size || 30;
  const n = String(props.name || "?");
  const parts = n.trim().split(/\s+/).filter(Boolean);
  const initials = (parts[0]?.[0] || "?") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] || "") : (parts[0]?.[1] || ""));
  const ring = props.ring ? "0 0 0 2px var(--weered-accent-ring, rgba(14,165,233,.34))" : "0 0 0 1px rgba(148,163,184,.16)";
  return (
    <div style={{
      width: s, height: s, borderRadius: 999,
      display: "grid", placeItems: "center",
      background: "rgba(255,255,255,.07)",
      border: "1px solid rgba(148,163,184,.16)",
      color: "rgba(243,244,246,.95)",
      fontWeight: 1000,
      boxShadow: ring,
      flex: "0 0 auto"
    }}>
      <span style={{ fontSize: Math.max(10, Math.round(s * 0.40)) }}>{initials.toUpperCase()}</span>
    </div>
  );
}

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const ridRaw = String(params?.roomId || "");
  const roomId = useMemo(() => safeDecode(ridRaw).trim(), [ridRaw]);

  const { me, users, joinedRoomId, joinStatus, setActiveRoomId } = useWeered();

  useEffect(() => { try { setActiveRoomId(roomId); } catch {} }, [roomId, setActiveRoomId]);

  const canChat = joinedRoomId === roomId && joinStatus === "joined";

  const page: React.CSSProperties = { padding: "14px", paddingRight: 420 };
  const panel: React.CSSProperties = {
    background: "var(--weered-panel, rgba(15,23,42,.90))",
    border: "1px solid rgba(148,163,184,.14)",
    borderRadius: 18,
    padding: 12,
  };

  return (
    <div style={page}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={roomId} size={34} ring />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>room</div>
            <div style={{ fontSize: 20, fontWeight: 1100, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {roomId}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              status: {canChat ? "joined · chat enabled" : "not joined"} · users: {Array.isArray(users) ? users.length : 0}
            </div>
          </div>
        </div>

        <Link
          href="/lobby"
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,.20)",
            background: "rgba(255,255,255,.05)",
            fontWeight: 950,
            textDecoration: "none",
            color: "rgba(243,244,246,.98)"
          }}
        >
          ← Lobby
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr .9fr", gap: 14, alignItems: "start" }}>
        <section style={panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontWeight: 1000 }}>Room chat</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {canChat ? "connected" : "disabled until joined/admitted"}
            </div>
          </div>
          <LobbyChatPanel title="Room chat" style={{ width: "100%" }} />
        </section>

        <section style={{ display: "grid", gap: 14 }}>
          <div style={panel}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 1000 }}>Participants</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{Array.isArray(users) ? users.length : 0}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(Array.isArray(users) ? users : []).map((u: any) => {
                const uname = String(u?.name || u?.username || u?.id || "user");
                const isMe = me?.id && (u?.id === me.id);
                const role = String(u?.role || u?.roomRole || "").toUpperCase();
                return (
                  <div key={String(u?.id || uname)} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                    padding: "8px 10px", borderRadius: 14,
                    border: "1px solid rgba(148,163,184,.14)",
                    background: "rgba(255,255,255,.03)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <Avatar name={uname} size={28} ring={isMe} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {uname}{isMe ? " (you)" : ""}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          {role ? `role: ${role}` : "role: member"}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,.18)",
                      background: "rgba(255,255,255,.04)",
                      fontWeight: 950,
                      fontSize: 12,
                      whiteSpace: "nowrap"
                    }}>
                      {role || "MEMBER"}
                    </div>
                  </div>
                );
              })}
              {(!Array.isArray(users) || !users.length) ? <div style={{ opacity: 0.7 }}>No users yet.</div> : null}
            </div>
          </div>

          <div style={panel}>
            <div style={{ fontWeight: 1000, marginBottom: 8 }}>Room tools</div>
            <ModeratorToolsPanel roomId={roomId} />
          </div>
        </section>
      </div>
    </div>
  );
}
'@

# Write directly (no wrapper funcs)
Set-Content -LiteralPath $root  -Value $ROOT  -Force
Write-Host "OK Wrote:" $root
Set-Content -LiteralPath $login -Value $LOGIN -Force
Write-Host "OK Wrote:" $login
Set-Content -LiteralPath $rsub  -Value $RSUB  -Force
Write-Host "OK Wrote:" $rsub
Set-Content -LiteralPath $lobby -Value $LOBBY -Force
Write-Host "OK Wrote:" $lobby
Set-Content -LiteralPath $room  -Value $ROOM  -Force
Write-Host "OK Wrote:" $room

Write-Host ""
Write-Host "NEXT:"
Write-Host "  cd C:\Weered\apps\web ; pnpm dev"
Write-Host "  /login -> login"
Write-Host "  /r/all -> /lobby?sub=r/all"
Write-Host "  /room/@me -> nice header + avatars"