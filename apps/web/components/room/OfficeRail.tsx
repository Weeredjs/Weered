"use client";
// The office rail: the ECEB control surface docked inside a meeting room.
// Rendered only for the room owner / office staff. Every call is same-origin
// /api/office/* riding the session cookie — no tokens anywhere in the page.
// The foyer keeps working in parallel; this is the same API surface.
import { useCallback, useEffect, useState } from "react";
import { PlanModule } from "@/app/foyer/PlanModule";

const GOLD = "#e0b341";

type Knock = { userId: string; name: string; ts?: number };

function ago(ts?: number): string {
  if (!ts) return "";
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  return m === 0 ? "just now" : `${m}m ago`;
}

export default function OfficeRail({
  knocks,
  onAdmit,
}: {
  knocks: Knock[];
  onAdmit?: (userId: string) => void;
}) {
  const [status, setStatus] = useState<any | null>(null);
  const [waiting, setWaiting] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/office/status");
      const j = await r.json();
      if (j && j.ok !== false) setStatus(j);
    } catch {}
    try {
      const r = await fetch("/api/office/waiting");
      const j = await r.json();
      if (j?.ok) setWaiting(Array.isArray(j.waiting) ? j.waiting : []);
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
    const iv = setInterval(refresh, 15000);
    return () => clearInterval(iv);
  }, [refresh]);

  const toggleDoor = async () => {
    if (!status || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/office/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open: !status.open }),
      });
      const j = await r.json();
      if (j?.ok) setStatus(j);
    } catch {}
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: GOLD, fontWeight: 800, fontSize: 12, letterSpacing: "0.14em" }}>
            THE OFFICE
          </div>
          <div style={{ color: "rgba(226,232,240,0.85)", fontWeight: 700, fontSize: 14 }}>
            East Coast Employee Benefits
          </div>
        </div>
        {status && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              padding: "4px 10px",
              borderRadius: 999,
              background: status.open ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.12)",
              color: status.open ? "#4ade80" : "rgba(148,163,184,0.8)",
              border: `1px solid ${status.open ? "rgba(34,197,94,0.4)" : "rgba(148,163,184,0.25)"}`,
            }}
          >
            {status.open ? "DOOR OPEN" : "DOOR CLOSED"}
          </span>
        )}
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          background: "rgba(255,255,255,0.03)",
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, color: "rgba(148,163,184,0.8)" }}>
            {status?.schedule ? `Walk-in hours: ${status.schedule}` : "Walk-in office"}
          </div>
          <button
            onClick={toggleDoor}
            disabled={busy || !status}
            style={{
              padding: "7px 14px",
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.12)",
              background: status?.open ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.15)",
              color: status?.open ? "#fca5a5" : "#4ade80",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {busy ? "…" : status?.open ? "Close the door" : "Open the door"}
          </button>
        </div>

        {knocks.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div
              style={{
                fontSize: 11,
                color: GOLD,
                fontWeight: 800,
                letterSpacing: "0.1em",
                marginBottom: 6,
              }}
            >
              KNOCKING ({knocks.length})
            </div>
            {knocks.map((k) => (
              <div
                key={k.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "6px 0",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span style={{ fontSize: 13, color: "rgba(226,232,240,0.9)" }}>
                  {k.name}
                  <span style={{ color: "rgba(148,163,184,0.5)", fontSize: 11 }}>
                    {" "}
                    · {ago(k.ts)}
                  </span>
                </span>
                <button
                  onClick={() => onAdmit?.(k.userId)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: GOLD,
                    color: "#131313",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Let in
                </button>
              </div>
            ))}
          </div>
        )}

        {waiting.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div
              style={{
                fontSize: 11,
                color: "rgba(148,163,184,0.7)",
                fontWeight: 800,
                letterSpacing: "0.1em",
                marginBottom: 4,
              }}
            >
              WALKED IN RECENTLY
            </div>
            {waiting.slice(0, 6).map((v: any, i: number) => (
              <div
                key={i}
                style={{ fontSize: 12.5, color: "rgba(200,210,224,0.85)", padding: "3px 0" }}
              >
                {v.name}
                <span style={{ color: "rgba(148,163,184,0.5)", fontSize: 11 }}> · {ago(v.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <PlanModule jwt="" accent={GOLD} />
    </div>
  );
}
