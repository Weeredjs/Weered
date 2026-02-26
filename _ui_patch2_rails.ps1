$ErrorActionPreference="Stop"

function Backup([string]$p, [string]$tag) {
  if (!(Test-Path -LiteralPath $p)) { throw "Missing: $p" }
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = "$p.bak_${tag}_$ts"
  Copy-Item -LiteralPath $p -Destination $bak -Force
  Write-Host "OK Backup:" $bak
}

$Repo="C:\Weered"
$PathLobby = Join-Path $Repo "apps\web\app\lobby\page.tsx"
$PathChat  = Join-Path $Repo "apps\web\components\LobbyChatPanel.tsx"

Backup $PathLobby "ui_patch2"
Backup $PathChat  "ui_patch2"

# ---------- LOBBY PAGE (replace with upgraded layout) ----------
$ContentLobby2 = @'
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

  // rails
  const [leftOpen, setLeftOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);

  const subParam = useMemo(() => sp.get("sub") || "r/all", [sp]);
  const sub = useMemo(() => subParam.replace(/^r\//i, ""), [subParam]);

  const { setActiveRoomId } = useWeered();

  const lobbyRoomId = useMemo(() => {
    const s = (subParam || "r/all").trim();
    const normalized = s.startsWith("r/") ? s : ("r/" + s.replace(/^\/+/, ""));
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

  const page: React.CSSProperties = {
    padding: "14px",
    paddingRight: 420, // keep the Dock column free
  };

  const panel: React.CSSProperties = {
    background: "var(--weered-panel, rgba(15,23,42,.90))",
    border: "1px solid rgba(148,163,184,.14)",
    borderRadius: 18,
    padding: 12,
  };

  const btnGhost: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,.20)",
    background: "rgba(255,255,255,.05)",
    color: "rgba(243,244,246,.98)",
    fontWeight: 950,
    cursor: "pointer"
  };

  // layout widths
  const leftW = leftOpen ? 340 : 84;
  const chatW = chatOpen ? 360 : 84;

  return (
    <div style={page}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 900 }}>lobby</div>
          <div style={{ fontSize: 20, fontWeight: 1100, letterSpacing: ".1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            The Lobby <span style={{ opacity: 0.7 }}>|</span> {subParam}
          </div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Center is the hero. Rails collapse. Dock stays right.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={btnGhost} onClick={() => setLeftOpen(v => !v)}>{leftOpen ? "Hide left" : "Show left"}</button>
          <button style={btnGhost} onClick={() => setChatOpen(v => !v)}>{chatOpen ? "Hide chat" : "Show chat"}</button>

          <Link href={`/r/${encodeURIComponent(sub)}`} style={{ ...btnGhost, textDecoration: "none" }}>Open subreddit</Link>
          <button onClick={loadRooms} style={btnGhost}>Refresh</button>
        </div>
      </div>

      {/* 3-column hero layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `${leftW}px minmax(520px, 1fr) ${chatW}px`,
        gap: 14,
        alignItems: "start",
      }}>
        {/* Left rail: Rooms */}
        <section style={{ ...panel, padding: leftOpen ? 12 : 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 1000 }}>{leftOpen ? "Rooms" : "R"}</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>{rooms.length}</div>
          </div>

          {leftOpen ? (
            <>
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

              {/* Suggested rooms so it never feels empty */}
              {!rooms.length ? (
                <div style={{ opacity: 0.8, fontSize: 12 }}>
                  <div style={{ fontWeight: 950, marginBottom: 8 }}>Suggested</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <Link href="/room/@me" style={{ textDecoration: "none", color: "rgba(243,244,246,.95)" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, borderRadius: 14, border: "1px solid rgba(148,163,184,.14)", background: "rgba(255,255,255,.03)" }}>
                        <Avatar name="@me" />
                        <div>
                          <div style={{ fontWeight: 1000 }}>@me</div>
                          <div style={{ opacity: 0.7 }}>Your private room</div>
                        </div>
                      </div>
                    </Link>

                    <Link href={`/lobby?sub=${encodeURIComponent("r/all")}`} style={{ textDecoration: "none", color: "rgba(243,244,246,.95)" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, borderRadius: 14, border: "1px solid rgba(148,163,184,.14)", background: "rgba(255,255,255,.03)" }}>
                        <Avatar name="r/all" />
                        <div>
                          <div style={{ fontWeight: 1000 }}>lobby:r/all</div>
                          <div style={{ opacity: 0.7 }}>Main lobby</div>
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
              ) : null}

              <div style={{ marginTop: 12 }}>
                <ModeratorToolsPanel roomId={lobbyRoomId} />
              </div>
            </>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <Link href="/room/@me" style={{ textDecoration: "none", color: "rgba(243,244,246,.95)" }}>
                <Avatar name="@me" size={34} />
              </Link>
              <Link href={`/lobby?sub=${encodeURIComponent("r/all")}`} style={{ textDecoration: "none", color: "rgba(243,244,246,.95)" }}>
                <Avatar name="r/all" size={34} />
              </Link>
            </div>
          )}
        </section>

        {/* Center hero: Subreddit browser */}
        <section style={panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontWeight: 1000 }}>r/{sub}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>posts</div>
          </div>
          <SubredditBrowser subreddit={sub} />
        </section>

        {/* Right rail: Main Lobby Chat */}
        <section style={{ ...panel, padding: chatOpen ? 12 : 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 1000 }}>{chatOpen ? "Main Lobby Chat" : "C"}</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>lobby:r/all</div>
          </div>

          {chatOpen ? (
            <LobbyChatPanel title="Lobby chat" style={{ width: "100%" }} />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Chat collapsed</div>
              <button style={btnGhost} onClick={() => setChatOpen(true)}>Open</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
'@

Set-Content -LiteralPath $PathLobby -Value $ContentLobby2 -Force
Write-Host "OK Wrote:" $PathLobby

# ---------- Chat panel: replace dot with Avatar + fix encoding label ----------
$chatText = Get-Content -Raw -LiteralPath $PathChat

# Fix mojibake in placeholder if present
$chatText = $chatText -replace "MessageÃ¢â‚¬Â¦", "Message..."

# Replace the tiny dot indicator with an Avatar block (simple, safe replace if line exists)
$chatText = $chatText -replace '<div style=\{\{ width: 10, height: 10, borderRadius: 999, marginTop: 5, background: isMe \? "rgba\([^)]+\)" : "rgba\([^)]+\)" \}\} \/>',
'<' + 'div style={{ display: "flex", alignItems: "center", gap: 10 }}>' +
'  <div style={{ width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(255,255,255,.07)", border: "1px solid rgba(148,163,184,.16)", boxShadow: isMe ? "0 0 0 2px var(--weered-accent-ring, rgba(14,165,233,.34))" : "none", fontWeight: 1000 }}>' +
'    <span style={{ fontSize: 12 }}>{uname.slice(0,1).toUpperCase()}</span>' +
'  </div>' +
'</' + 'div>'

Set-Content -LiteralPath $PathChat -Value $chatText -Force
Write-Host "OK Wrote:" $PathChat

Write-Host ""
Write-Host "NEXT:"
Write-Host "  cd C:\Weered\apps\web ; pnpm dev"
Write-Host "  Open /lobby and try Hide left / Hide chat"