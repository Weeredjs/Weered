"use client";

// Who can come in to your place (api routes/places.ts): one tap, on Home's
// Your place strip and on the place itself. James 2026-10-31: "make it so it
// can be more easily gated".
import React, { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export type Gate = "anyone" | "friends" | "ask" | "me";
export const GATES: { id: Gate; label: string; hint: string }[] = [
  { id: "anyone", label: "Anyone", hint: "Open to everyone with the link." },
  { id: "friends", label: "Friends", hint: "Only your friends get in." },
  { id: "ask", label: "Ask first", hint: "People knock; you let them in." },
  { id: "me", label: "Just me", hint: "Closed. Only you." },
];

export async function setPlaceGate(gate: Gate): Promise<Gate> {
  const r = await fetch(`${API}/places/mine/gate`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gate }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j?.gate) throw new Error(j?.error || `http_${r.status}`);
  return j.gate as Gate;
}

export default function PlaceGate({
  value,
  onChange,
  compact = false,
  accent = "#a78bfa",
}: {
  value: Gate;
  onChange?: (g: Gate) => void;
  compact?: boolean;
  accent?: string;
}) {
  const [gate, setGate] = useState<Gate>(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const pick = async (g: Gate) => {
    if (g === gate || busy) return;
    const was = gate;
    setGate(g);
    setBusy(true);
    setErr(false);
    try {
      const saved = await setPlaceGate(g);
      setGate(saved);
      onChange?.(saved);
    } catch {
      setGate(was);
      setErr(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label="Who can come in"
      title={err ? "Couldn't save that. Try again." : GATES.find((x) => x.id === gate)?.hint}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}
    >
      {!compact && (
        <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.6, marginRight: 4 }}>
          🚪 Who can come in
        </span>
      )}
      {GATES.map((x) => {
        const on = x.id === gate;
        return (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={busy}
            onClick={() => pick(x.id)}
            title={x.hint}
            style={{
              padding: compact ? "2px 8px" : "4px 10px",
              borderRadius: 99,
              fontSize: compact ? 11 : 12,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: busy ? "default" : "pointer",
              color: on ? "#fff" : "rgba(226,232,240,.75)",
              background: on ? accent : "rgba(255,255,255,.05)",
              border: `1px solid ${on ? accent : "rgba(255,255,255,.14)"}`,
              opacity: busy && !on ? 0.6 : 1,
            }}
          >
            {x.label}
          </button>
        );
      })}
      {err && <span style={{ fontSize: 11, color: "#fca5a5" }}>Not saved</span>}
    </div>
  );
}
