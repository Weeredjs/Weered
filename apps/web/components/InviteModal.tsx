"use client";

import React, { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

type InviteType = "PLATFORM" | "ROOM" | "LOBBY" | "CREW";

interface Props {
  type: InviteType;
  targetId?: string;
  targetName?: string;
  onClose: () => void;
}

const TYPE_LABEL: Record<InviteType, string> = {
  PLATFORM: "Platform",
  ROOM: "Room",
  LOBBY: "Lobby",
  CREW: "Crew",
};

export default function InviteModal({ type, targetId, targetName, onClose }: Props) {
  const [tab,      setTab]      = useState<"link" | "send">("link");
  const [link,     setLink]     = useState("");
  const [maxUses,  setMaxUses]  = useState(1);
  const [ttl,      setTtl]      = useState(24); // hours, 0 = no expiry
  const [note,     setNote]     = useState("");
  const [username, setUsername] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState("");
  const [copied,   setCopied]   = useState(false);

  async function createLink() {
    setLoading(true); setMsg(""); setLink("");
    const j = await apiFetch("/invites", {
      method: "POST",
      body: JSON.stringify({ type, targetId, maxUses, ttlHours: ttl || 0, note: note.trim() || undefined }),
    });
    setLoading(false);
    if (j.ok) { setLink(j.invite.url); }
    else setMsg(j.error || "Failed.");
  }

  async function sendToUser() {
    if (!username.trim()) return;
    setLoading(true); setMsg("");
    const j = await apiFetch("/invites/send", {
      method: "POST",
      body: JSON.stringify({ type, targetId, username: username.trim() }),
    });
    setLoading(false);
    if (j.ok) { setMsg(`Invite sent to ${j.sentTo} via DM ✓`); setUsername(""); }
    else setMsg(j.error === "user_not_found" ? "User not found." : j.error || "Failed.");
  }

  function copy() {
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const S = {
    overlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 },
    modal:   { width: "100%", maxWidth: 440, borderRadius: 18, border: "1px solid rgba(255,255,255,.12)", background: "rgba(14,14,22,.97)", padding: "28px 28px 24px", display: "flex", flexDirection: "column" as const, gap: 18, boxShadow: "0 32px 80px rgba(0,0,0,.7)" },
    input:   { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
    btn:     { padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.06)", fontSize: 13, cursor: "pointer", color: "rgba(243,244,246,.88)", fontWeight: 600 } as React.CSSProperties,
    btnPri:  { padding: "9px 20px", borderRadius: 9, border: "1px solid rgba(124,58,237,.40)", background: "rgba(124,58,237,.15)", fontSize: 13, cursor: "pointer", color: "rgb(216,180,254)", fontWeight: 700 } as React.CSSProperties,
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Invite to {TYPE_LABEL[type]}</div>
            {targetName && <div style={{ fontSize: 12, opacity: 0.45, marginTop: 2 }}>{targetName}</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, opacity: 0.45, color: "inherit" }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid rgba(255,255,255,.08)", paddingBottom: 0 }}>
          {(["link", "send"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 14px", borderRadius: "8px 8px 0 0", border: "none", background: tab === t ? "rgba(124,58,237,.15)" : "transparent", color: tab === t ? "rgb(216,180,254)" : "rgba(148,163,184,.65)", fontWeight: tab === t ? 700 : 400, cursor: "pointer", fontSize: 13 }}>
              {t === "link" ? "🔗 Create Link" : "📨 Send to User"}
            </button>
          ))}
        </div>

        {/* Link tab */}
        {tab === "link" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.45, marginBottom: 5, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: ".5px" }}>Max Uses</div>
                <select value={maxUses} onChange={e => setMaxUses(Number(e.target.value))}
                  style={{ ...S.input, appearance: "none" as const }}>
                  {[1, 5, 10, 25, 50, 100].map(n => <option key={n} value={n}>{n} use{n !== 1 ? "s" : ""}</option>)}
                  <option value={0}>Unlimited</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.45, marginBottom: 5, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: ".5px" }}>Expires</div>
                <select value={ttl} onChange={e => setTtl(Number(e.target.value))}
                  style={{ ...S.input, appearance: "none" as const }}>
                  <option value={0}>Never</option>
                  <option value={1}>1 hour</option>
                  <option value={24}>24 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                  <option value={720}>30 days</option>
                </select>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, opacity: 0.45, marginBottom: 5, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: ".5px" }}>Note (optional)</div>
              <input style={S.input} placeholder="Add a personal message…" value={note} onChange={e => setNote(e.target.value)} maxLength={200} />
            </div>

            {link ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly style={{ ...S.input, flex: 1, fontFamily: "monospace", fontSize: 11, opacity: 0.75 }} value={link} onClick={e => (e.target as HTMLInputElement).select()} />
                <button style={{ ...S.btnPri, flexShrink: 0 }} onClick={copy}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            ) : (
              <button style={{ ...S.btnPri, width: "100%", textAlign: "center" }} onClick={createLink} disabled={loading}>
                {loading ? "Generating…" : "Generate Link"}
              </button>
            )}

            {link && (
              <button style={{ ...S.btn, fontSize: 12, opacity: 0.6 }} onClick={() => { setLink(""); setMsg(""); }}>
                Generate New Link
              </button>
            )}
          </div>
        )}

        {/* Send tab */}
        {tab === "send" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, opacity: 0.55 }}>
              Search by username and send a direct invite via DM. They'll get a link valid for 7 days.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...S.input, flex: 1 }} placeholder="@username" value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendToUser()} />
              <button style={{ ...S.btnPri, flexShrink: 0 }} onClick={sendToUser} disabled={loading || !username.trim()}>
                {loading ? "…" : "Send"}
              </button>
            </div>
          </div>
        )}

        {msg && (
          <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: msg.includes("✓") ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.07)", border: `1px solid ${msg.includes("✓") ? "rgba(16,185,129,.20)" : "rgba(239,68,68,.20)"}`, color: msg.includes("✓") ? "rgb(110,231,183)" : "rgba(252,165,165,.90)" }}>
            {msg}
          </div>
        )}

      </div>
    </div>
  );
}
