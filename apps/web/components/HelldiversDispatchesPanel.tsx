"use client";

import React, { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

const stencil: React.CSSProperties = {
  fontFamily: '"Stencil Std","Black Ops One","Impact",sans-serif',
  letterSpacing: "1.5px",
  textTransform: "uppercase",
};

type Dispatch = {
  id: number;
  published: string;
  type: number;
  message: string;
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// Helldivers dispatches contain inline markup like <i=1>text</i> for emphasis.
// Strip tags but render emphasized chunks in italic gold.
function renderMessage(msg: string): React.ReactNode[] {
  if (!msg) return [];
  const parts: React.ReactNode[] = [];
  const re = /<i=\d+>(.*?)<\/i>/gs;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(msg)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{msg.slice(last, m.index)}</span>);
    parts.push(<em key={key++} style={{ color: "#FFD700", fontStyle: "italic", fontWeight: 600 }}>{m[1]}</em>);
    last = m.index + m[0].length;
  }
  if (last < msg.length) parts.push(<span key={key++}>{msg.slice(last)}</span>);
  return parts;
}

export default function HelldiversDispatchesPanel({ style, limit = 20 }: { style?: React.CSSProperties; limit?: number }) {
  const [items, setItems] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`${API}/helldivers/dispatches?limit=${limit}`);
        const j = await r.json();
        if (!alive) return;
        if (j?.ok) setItems(j.dispatches || []);
      } catch {}
      finally { if (alive) setLoading(false); }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [limit]);

  return (
    <div style={{
      borderRadius: 10,
      border: "1px solid rgba(255,215,0,.18)",
      background: "linear-gradient(180deg, rgba(20,18,12,.95), rgba(10,9,5,.97))",
      padding: 12,
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      ...style,
    }}>
      <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid rgba(255,215,0,.18)" }}>
        <div style={{ ...stencil, fontSize: 13, color: "#FFD700", fontWeight: 800 }}>
          ▌Ministry of Truth
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,215,0,.5)", letterSpacing: ".7px", textTransform: "uppercase", marginTop: 2 }}>
          Authorized Dispatches · Updated Continuously
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 16, textAlign: "center", color: "rgba(255,215,0,.4)", fontSize: 12 }}>
          Receiving transmissions…
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: 16, textAlign: "center", color: "rgba(255,255,255,.4)", fontSize: 12 }}>
          No dispatches at this hour. Praise democracy.
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map(d => (
            <article key={d.id} style={{
              padding: "8px 10px",
              borderRadius: 4,
              background: "linear-gradient(180deg, rgba(244,228,188,.06), rgba(244,228,188,.02))",
              border: "1px solid rgba(244,228,188,.10)",
              borderLeft: "3px solid rgba(255,215,0,.6)",
              fontFamily: '"Courier New", monospace',
            }}>
              <div style={{ fontSize: 9, color: "rgba(255,215,0,.55)", letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 4, ...stencil }}>
                {timeAgo(d.published)} · DISPATCH #{d.id}
              </div>
              <div style={{
                fontSize: 12,
                lineHeight: 1.55,
                color: "rgba(244,228,188,.92)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {renderMessage(d.message)}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
