$ErrorActionPreference="Stop"

function Backup([string]$p, [string]$tag) {
  if (!(Test-Path -LiteralPath $p)) { throw "Missing: $p" }
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = "$p.bak_${tag}_$ts"
  Copy-Item -LiteralPath $p -Destination $bak -Force
  Write-Host "OK Backup:" $bak
}

$Repo="C:\Weered"
$Layout = Join-Path $Repo "apps\web\app\layout.tsx"
$Lobby  = Join-Path $Repo "apps\web\app\lobby\page.tsx"

Backup $Layout "ui_patch4"
Backup $Lobby  "ui_patch4"

# ---------------- layout.tsx (wrap DockShell as a drawer) ----------------
# We overwrite layout.tsx with a stable drawer mount.
$LayoutContent = @'
import "./globals.css";
import React from "react";
import DockShell from "../components/DockShell";
import WeeredProvider from "../components/WeeredProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "var(--weered-bg, #050816)" }}>
        <WeeredProvider>
          {/* App content */}
          {children}

          {/* Dock Drawer (global) */}
          <div
            id="weered-dock-drawer"
            style={{
              position: "fixed",
              top: 12,
              right: 12,
              bottom: 12,
              width: 420,
              maxWidth: "min(420px, calc(100vw - 24px))",
              zIndex: 60,
              pointerEvents: "none",
            }}
          >
            <div style={{ height: "100%", pointerEvents: "auto" }}>
              {/* DockShell already has its own close toggle; we let it behave like a drawer */}
              <DockShell forceMode="floating" />
            </div>
          </div>
        </WeeredProvider>
      </body>
    </html>
  );
}
'@

Set-Content -LiteralPath $Layout -Value $LayoutContent -Force
Write-Host "OK Wrote:" $Layout

# ---------------- lobby/page.tsx (new consistent base layout) ----------------
$LobbyContent = @'
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SubredditBrowser from "../../components/SubredditBrowser";
import LobbyChatPanel from "../../components/LobbyChatPanel";
import { useWeered } from "../../components/WeeredProvider";

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
    const s = (subParam || "r/all").trim();
    const normalized = s.startsWith("r/") ? s : ("r/" + s.replace(/^\/+/, ""));
    return "lobby:" + normalized;
  }, [subParam]);

  useEffect(() => { try { setActiveRoomId(lobbyRoomId); } catch {} }, [lobbyRoomId, setActiveRoomId]);

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

  const page: React.CSSProperties = {
    padding: 14,
  };

  const panel: React.CSSProperties = {
    background: "var(--weered-panel, rgba(15,23,42,.90))",
    border: "1px solid rgba(148,163,184,.14)",
    borderRadius: 18,
    padding: 12,
  };

  const btn: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,.20)",
    background: "rgba(255,255,255,.05)",
    color: "rgba(243,244,246,.98)",
    fontWeight: 950,
    cursor: "pointer"
  };

  return (
    <div style={page}>
      {/* Header (logo + title + controls) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 12,
            display: "grid", placeItems: "center",
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(148,163,184,.18)"
          }}>
            {/* If you add apps/web/public/weered-logo.png this will render */}
            <img src="/weered-logo.png" alt="weered" style={{ width: 22, height: 22, objectFit: "contain" }} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 900 }}>lobby</div>
            <div style={{ fontSize: 20, fontWeight: 1100, letterSpacing: ".1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              The Lobby <span style={{ opacity: 0.7 }}>|</span> {subParam}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href={`/r/${encodeURIComponent(sub)}`} style={{ ...btn, textDecoration: "none" }}>Open subreddit</Link>
          <button onClick={loadRooms} style={btn}>Refresh</button>
          {/* Dock is now global drawer, so just keep a hint button */}
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} style={btn}>Dock</button>
        </div>
      </div>

      {/* Base grid: LEFT / CENTER / RIGHT (Dock is separate drawer) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "320px minmax(680px, 1fr) 320px",
        gap: 14,
        alignItems: "start",
      }}>
        {/* Left: Rooms list */}
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

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 950 }}>Suggested</div>

            <Link href="/room/@me" style={{ textDecoration: "none", color: "rgba(243,244,246,.95)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, borderRadius: 14, border: "1px solid rgba(148,163,184,.14)", background: "rgba(255,255,255,.03)" }}>
                <Avatar name="@me" />
                <div>
                  <div style={{ fontWeight: 1000 }}>@me</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Your private room</div>
                </div>
              </div>
            </Link>

            <Link href={`/lobby?sub=${encodeURIComponent("r/all")}`} style={{ textDecoration: "none", color: "rgba(243,244,246,.95)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, borderRadius: 14, border: "1px solid rgba(148,163,184,.14)", background: "rgba(255,255,255,.03)" }}>
                <Avatar name="r/all" />
                <div>
                  <div style={{ fontWeight: 1000 }}>lobby:r/all</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Main lobby</div>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Center: Reddit (top) + main lobby chat (bottom) */}
        <section style={{ display: "grid", gap: 14 }}>
          <div style={panel}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 1000 }}>r/{sub}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>reddit</div>
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

        {/* Right: Organizer / Manager / Admin */}
        <section style={panel}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>Organizer</div>
          <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 10 }}>
            Current: <span style={{ fontWeight: 950 }}>{subParam}</span>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ padding: 10, borderRadius: 14, border: "1px solid rgba(148,163,184,.14)", background: "rgba(255,255,255,.03)" }}>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Room tools</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>This panel will show participants + admin actions.</div>
            </div>

            <div style={{ padding: 10, borderRadius: 14, border: "1px solid rgba(148,163,184,.14)", background: "rgba(255,255,255,.03)" }}>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Participants</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Coming next: avatar stack + role chips.</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
'@

Set-Content -LiteralPath $Lobby -Value $LobbyContent -Force
Write-Host "OK Wrote:" $Lobby

Write-Host ""
Write-Host "NEXT:"
Write-Host "  cd C:\Weered\apps\web ; pnpm dev"
Write-Host "  Confirm: no dock slab; right organizer is real; center chat is full width under reddit"
Write-Host "  If logo doesn't show, copy it to apps\web\public\weered-logo.png"