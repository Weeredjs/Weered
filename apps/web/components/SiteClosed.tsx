"use client";
// "Weered is full" (flood readiness 2026-11-02). When the door shuts (api
// lib/flood.ts: lights off in a flood, or maintenance), the server tells each
// page why and closes its live connection with 4010, which isn't retried. This
// page takes over: the reason, the waitlist, and a quiet check every minute or
// so (spread out, so a thousand waiting tabs don't all ask at once) that lets
// people back in by itself once the door opens.
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export default function SiteClosed() {
  const [shut, setShut] = useState<{ door: string; message: string } | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onClosed = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      setShut({ door: String(d.door || "capacity"), message: String(d.message || "") });
    };
    window.addEventListener("weered:site-closed", onClosed);
    return () => window.removeEventListener("weered:site-closed", onClosed);
  }, []);

  useEffect(() => {
    if (!shut) return;
    let t: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const j = await fetch(`${API}/site/status`, { cache: "no-store" }).then((r) => r.json());
        if (j?.door === "open") {
          window.location.reload();
          return;
        }
      } catch {}
      t = setTimeout(check, 60_000 + Math.random() * 60_000);
    };
    t = setTimeout(check, 30_000 + Math.random() * 60_000);
    return () => clearTimeout(t);
  }, [shut]);

  if (!shut) return null;
  const full = shut.door !== "maintenance";
  const join = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return;
    try {
      const r = await fetch(`${API}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (r.ok) setSent(true);
    } catch {}
  };
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="weered-site-closed-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "rgba(7,6,15,.96)",
        color: "rgba(243,244,246,.95)",
        fontFamily: "inherit",
      }}
    >
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <div id="weered-site-closed-title" style={{ fontSize: 24, fontWeight: 800 }}>
          {full ? "Weered is full right now" : "Weered is down for maintenance"}
        </div>
        <p style={{ opacity: 0.75, fontSize: 14, lineHeight: 1.55, margin: "10px 0 18px" }}>
          {full
            ? "So many people turned up at once that we've paused for a moment. Leave this page open and you'll be let back in by yourself as soon as there's room."
            : shut.message || "Back shortly. This page lets you in by itself when it's done."}
        </p>
        {full &&
          (sent ? (
            <p style={{ fontSize: 14, fontWeight: 700 }}>
              You're on the list. One email when there's room.
            </p>
          ) : (
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void join();
                }}
                placeholder="your@email.com"
                aria-label="Your email, for one note when there's room"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(167,139,250,.45)",
                  background: "rgba(255,255,255,.06)",
                  color: "inherit",
                  fontFamily: "inherit",
                }}
              />
              <button
                type="button"
                onClick={() => void join()}
                style={{
                  padding: "10px 16px",
                  borderRadius: 999,
                  border: "1px solid rgba(167,139,250,.5)",
                  background: "rgba(124,58,237,.3)",
                  color: "inherit",
                  fontWeight: 800,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Tell me
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
