"use client";

import React from "react";
import { useOverlay } from "./overlays/OverlayProvider";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type PlayingItem = {
  id: string;
  name: string;
  avatar: string | null;
  avatarColor: string | null;
  gameName: string | null;
  detail: string | null;
  since: string | null;
};

export default function LobbyPlayingNowPanel({
  appId,
  lobbyId,
  accentColor = "#FFD700",
  gameLabel = "this game",
}: {
  appId?: string | null;
  lobbyId?: string;
  accentColor?: string;
  gameLabel?: string;
}) {
  const { openSheet } = useOverlay();
  const [items, setItems] = React.useState<PlayingItem[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [invited, setInvited] = React.useState<Record<string, "sending" | "sent" | "rate-limited" | "error">>({});

  async function sendInvite(targetUserId: string) {
    if (!appId || !lobbyId) return;
    setInvited(prev => ({ ...prev, [targetUserId]: "sending" }));
    try {
      const tok = (() => { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } })();
      if (!tok) { setInvited(prev => ({ ...prev, [targetUserId]: "error" })); return; }
      const r = await fetch(`${API}/steam/squad-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ targetUserId, lobbyId, appId }),
      });
      if (r.status === 429) { setInvited(prev => ({ ...prev, [targetUserId]: "rate-limited" })); return; }
      const j = await r.json();
      setInvited(prev => ({ ...prev, [targetUserId]: j?.ok ? "sent" : "error" }));
    } catch {
      setInvited(prev => ({ ...prev, [targetUserId]: "error" }));
    }
  }

  React.useEffect(() => {
    if (!appId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const r = await fetch(`${API}/steam/playing/${encodeURIComponent(appId)}`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!alive) return;
        if (j?.ok && Array.isArray(j.items)) setItems(j.items);
        setLoaded(true);
      } catch {
        if (alive) setLoaded(true);
      }
      if (alive) timer = setTimeout(tick, 60_000);
    };
    tick();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [appId]);

  if (!appId) return null;
  if (!loaded) return null;
  if (items.length === 0) return null;

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${accentColor}28`,
      background: `linear-gradient(135deg, ${accentColor}08, transparent 60%), rgba(10,10,8,.5)`,
      padding: 10,
      marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3,
          background: "#22c55e",
          boxShadow: "0 0 6px rgba(34,197,94,.8)",
          animation: "pulse 2s ease-in-out infinite",
        }} />
        <span style={{
          fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
          fontSize: 9, fontWeight: 800, letterSpacing: "1.4px",
          color: accentColor, opacity: 0.85,
          textTransform: "uppercase",
        }}>
          ▌In Service Now
        </span>
        <span style={{ fontSize: 11, color: "rgba(243,244,246,.6)" }}>
          {items.length} Helldiver{items.length === 1 ? "" : "s"} dropped — invite a squad
        </span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
        gap: 6,
      }}>
        {items.map(p => {
          const inviteState = invited[p.id];
          const inviteLabel =
            inviteState === "sending" ? "…" :
            inviteState === "sent" ? "✓ SENT" :
            inviteState === "rate-limited" ? "SLOW" :
            inviteState === "error" ? "ERR" :
            "INVITE";
          const inviteDisabled = inviteState === "sending" || inviteState === "sent";
          return (
            <div
              key={p.id}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 8px",
                background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.06)",
                borderRadius: 6,
                fontFamily: "inherit",
                transition: "background .12s, border-color .12s",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(255,255,255,.06)";
                el.style.borderColor = `${accentColor}45`;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(255,255,255,.03)";
                el.style.borderColor = "rgba(255,255,255,.06)";
              }}
            >
              <button
                type="button"
                onClick={() => openSheet("profile", { userId: p.id })}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  flex: 1, minWidth: 0,
                  background: "none", border: "none", padding: 0,
                  cursor: "pointer", color: "inherit", textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 999, flexShrink: 0,
                  background: p.avatar ? "rgba(255,255,255,.08)" : (p.avatarColor || "rgba(255,215,0,.3)"),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#fff",
                  overflow: "hidden",
                  border: "1.5px solid rgba(34,197,94,.7)",
                  boxShadow: "0 0 4px rgba(34,197,94,.5)",
                }}>
                  {p.avatar ? <img src={p.avatar} alt={p.name + " avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.name || "?").slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(243,244,246,.95)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 9, color: "rgba(34,197,94,.85)", letterSpacing: "0.4px", textTransform: "uppercase", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    In Mission
                  </div>
                </div>
              </button>
              {lobbyId && (
                <button
                  type="button"
                  onClick={() => sendInvite(p.id)}
                  disabled={inviteDisabled}
                  title={inviteState === "sent" ? "Invite sent" : inviteState === "rate-limited" ? "Slow down — too many invites" : "Send a squad invite"}
                  style={{
                    flexShrink: 0,
                    padding: "3px 7px", borderRadius: 4,
                    fontSize: 9, fontWeight: 800, letterSpacing: "0.06em",
                    textTransform: "uppercase", cursor: inviteDisabled ? "default" : "pointer",
                    fontFamily: "inherit",
                    background: inviteState === "sent"
                      ? "rgba(34,197,94,.18)"
                      : inviteState === "rate-limited" || inviteState === "error"
                        ? "rgba(239,68,68,.14)"
                        : `${accentColor}1f`,
                    border: `1px solid ${inviteState === "sent"
                      ? "rgba(34,197,94,.5)"
                      : inviteState === "rate-limited" || inviteState === "error"
                        ? "rgba(239,68,68,.4)"
                        : `${accentColor}55`}`,
                    color: inviteState === "sent"
                      ? "#22c55e"
                      : inviteState === "rate-limited" || inviteState === "error"
                        ? "#ef4444"
                        : accentColor,
                    opacity: inviteDisabled ? 0.85 : 1,
                  }}
                >
                  {inviteLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
