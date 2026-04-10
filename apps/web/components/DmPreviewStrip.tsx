"use client";

import React, { useEffect, useState } from "react";
import { avatarBg } from "../lib/avatarColor";

// ─── Config ──────────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
function getToken() {
  try { return localStorage.getItem("weered_token") || ""; } catch { return ""; }
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface DmPreview {
  peerId: string;
  peerName: string;
  peerAvatar?: string;
  lastMessage: string;
  lastTs: string;
  isFromMe: boolean;
  unread: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function DmPreviewStrip() {
  const [previews, setPreviews] = useState<DmPreview[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const tok = getToken();
    if (!tok) { setLoaded(true); return; }

    let cancelled = false;
    fetch(`${API}/dm/previews`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
      .then(r => r.json())
      .then(j => {
        if (!cancelled && j.ok && Array.isArray(j.previews)) {
          setPreviews(j.previews.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });

    return () => { cancelled = true; };
  }, []);

  if (!loaded || previews.length === 0) return null;

  return (
    <div style={{ padding: "0 0 4px" }}>
      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "0 4px 10px",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(243,244,246,.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <span style={{
          fontSize: 13, fontWeight: 800, color: "rgba(243,244,246,.95)",
          letterSpacing: "-.2px",
        }}>
          Messages
        </span>
      </div>

      {/* Horizontal scroll strip */}
      <div style={{
        display: "flex", gap: 10, overflowX: "auto", overflowY: "hidden",
        paddingBottom: 4,
        scrollbarWidth: "none",
      }}>
        <style>{`
          .dm-strip-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        <div className="dm-strip-scroll" style={{
          display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2,
          scrollbarWidth: "none",
        }}>
          {previews.map((p) => (
            <DmCard key={p.peerId} preview={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
function DmCard({ preview }: { preview: DmPreview }) {
  const [hovered, setHovered] = useState(false);
  const bg = avatarBg(preview.peerName);

  function handleClick() {
    window.dispatchEvent(new CustomEvent("weered:dock:open", {
      detail: { mode: "dm", peer: { id: preview.peerId, name: preview.peerName } },
    }));
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 160, minWidth: 160, flexShrink: 0,
        padding: "14px 12px 12px",
        borderRadius: 12,
        background: hovered ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.03)",
        border: `1px solid ${hovered ? "rgba(88,0,229,.30)" : "rgba(255,255,255,.06)"}`,
        cursor: "pointer",
        transition: "all 0.15s",
        position: "relative",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      }}
    >
      {/* Unread dot */}
      {preview.unread && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          width: 8, height: 8, borderRadius: "50%",
          background: "#5800E5",
          boxShadow: "0 0 8px rgba(88,0,229,.6)",
        }} />
      )}

      {/* Avatar */}
      {preview.peerAvatar ? (
        <img
          src={preview.peerAvatar}
          alt=""
          style={{
            width: 40, height: 40, borderRadius: "50%",
            objectFit: "cover",
            border: `2px solid ${preview.unread ? "rgba(88,0,229,.5)" : "rgba(255,255,255,.08)"}`,
          }}
        />
      ) : (
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: `${bg}33`,
          border: `2px solid ${preview.unread ? "rgba(88,0,229,.5)" : bg + "44"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 800, color: bg,
        }}>
          {preview.peerName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name */}
      <div style={{
        fontSize: 12, fontWeight: 700,
        color: "rgba(243,244,246,.95)",
        textAlign: "center",
        width: "100%",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {preview.peerName}
      </div>

      {/* Last message preview */}
      <div style={{
        fontSize: 11, lineHeight: 1.35,
        color: "rgba(243,244,246,.45)",
        textAlign: "center",
        width: "100%",
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
      } as any}>
        {preview.isFromMe ? "You: " : ""}{preview.lastMessage}
      </div>

      {/* Time */}
      <div style={{
        fontSize: 10, color: "rgba(243,244,246,.25)",
        fontVariantNumeric: "tabular-nums",
      }}>
        {timeAgo(preview.lastTs)}
      </div>
    </div>
  );
}
