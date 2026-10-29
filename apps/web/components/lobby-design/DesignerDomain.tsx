"use client";

// Design mode's domain dialog and the publish confetti.
import React, { useEffect, useState } from "react";
import { API, chip, input, panel } from "./designerKit";

// ── Domain ─────────────────────────────────────────────────────────────────
export function DomainModal({
  lobbyId,
  accent,
  domain,
  onChange,
  onClose,
}: {
  lobbyId: string;
  accent: string;
  domain: { host: string | null; status: string | null };
  onChange: (d: { host: string | null; status: string | null }) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(domain.host || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dnsRec, setDnsRec] = useState<{ type: string; name: string; value: string } | null>(null);
  const base = `${API}/lobbies/${encodeURIComponent(lobbyId)}/admin/domain`;

  const call = async (method: string, url: string, body?: any) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.message || j.error || "Something went wrong.");
      return j;
    } catch (e: any) {
      setMsg(e?.message || "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // Re-derive the DNS record for an existing domain.
    if (domain.host && !dnsRec) {
      const labels = domain.host.split(".");
      setDnsRec(
        labels.length === 2
          ? { type: "A", name: "@", value: "142.93.148.29" }
          : { type: "CNAME", name: labels[0], value: "weered.ca" },
      );
    }
  }, [domain.host, dnsRec]);

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Your domain"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99995,
        background: "rgba(0,0,0,.6)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...panel, position: "relative", width: "min(520px, 100%)", padding: 24 }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: accent,
          }}
        >
          Your domain
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>
          Put this lobby on your own address.
        </div>
        <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
          Members type your domain and land right here, with a secure certificate. The lobby stays
          listed in the Weered network.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="club.example.com"
            style={input}
            aria-label="Domain"
          />
          <button
            disabled={busy || !value.trim()}
            onClick={async () => {
              const j = await call("PUT", base, { domain: value });
              if (j) {
                onChange({ host: j.domain, status: j.status });
                setDnsRec(j.dns);
                setValue(j.domain);
              }
            }}
            style={{
              padding: "9px 16px",
              borderRadius: 9,
              border: "none",
              background: accent,
              color: "#0b0b0f",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
        {domain.host && dnsRec && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{domain.host}</strong>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "3px 9px",
                  borderRadius: 99,
                  background: domain.status === "live" ? "#22c55e22" : "#f59e0b22",
                  color: domain.status === "live" ? "#86efac" : "#fcd34d",
                }}
              >
                {domain.status === "live" ? "● Live" : "Waiting for DNS"}
              </span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, margin: "10px 0 6px" }}>
              Add this record where your domain's DNS is managed:
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr 1fr",
                gap: 6,
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
              }}
            >
              <span style={{ opacity: 0.5 }}>Type</span>
              <span style={{ opacity: 0.5 }}>Name</span>
              <span style={{ opacity: 0.5 }}>Value</span>
              <span>{dnsRec.type}</span>
              <span>{dnsRec.name}</span>
              <span>{dnsRec.value}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                disabled={busy}
                onClick={async () => {
                  const j = await call("POST", `${base}/verify`);
                  if (j) {
                    onChange({ host: j.domain, status: j.status });
                    setMsg(
                      j.status === "live"
                        ? "Live. Your domain points here."
                        : "Not pointing here yet. DNS can take a few minutes to an hour.",
                    );
                  }
                }}
                style={chip(false, accent)}
              >
                Check DNS
              </button>
              {domain.status === "live" && (
                <a
                  href={`https://${domain.host}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...chip(true, accent), textDecoration: "none" }}
                >
                  Open {domain.host} ↗
                </a>
              )}
              <button
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm(`Release ${domain.host}?`)) return;
                  const j = await call("DELETE", base);
                  if (j) {
                    onChange({ host: null, status: null });
                    setDnsRec(null);
                    setValue("");
                  }
                }}
                style={{ ...chip(false, accent), marginLeft: "auto", color: "#fca5a5" }}
              >
                Remove
              </button>
            </div>
          </div>
        )}
        {msg && <div style={{ marginTop: 12, fontSize: 13, color: "#fcd34d" }}>{msg}</div>}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "none",
            border: "none",
            color: "inherit",
            fontSize: 18,
            cursor: "pointer",
          }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Publish confetti ───────────────────────────────────────────────────────
export function Confetti({ accent }: { accent: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const colors = [accent, "#ffffff", "#facc15", "#22d3ee", "#f472b6"];
    const ps = Array.from({ length: 180 }, () => ({
      x: c.width / 2,
      y: 70,
      vx: (Math.random() - 0.5) * 18,
      vy: Math.random() * -6 - 2,
      r: Math.random() * 6 + 3,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      col: colors[Math.floor(Math.random() * colors.length)],
    }));
    let raf = 0;
    let t = 0;
    const tick = () => {
      t++;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const q of ps) {
        q.vy += 0.35;
        q.vx *= 0.99;
        q.x += q.vx;
        q.y += q.vy;
        q.rot += q.vr;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.col;
        ctx.globalAlpha = Math.max(0, 1 - t / 150);
        ctx.fillRect(-q.r / 2, -q.r / 4, q.r, q.r / 2);
        ctx.restore();
      }
      if (t < 150) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [accent]);
  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: 99999, pointerEvents: "none" }}
    />
  );
}
