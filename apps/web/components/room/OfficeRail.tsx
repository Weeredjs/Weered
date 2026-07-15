"use client";
// The Desk: the ECEB advisor cockpit docked inside a meeting room.
// Rendered only for the room owner / office staff. Every call is same-origin
// /api/office/* riding the session cookie — no tokens anywhere in the page.
// The foyer keeps working in parallel; this is the same API surface.
import { useCallback, useEffect, useState } from "react";
import { PlanModule } from "@/app/foyer/PlanModule";

// Fathom office tokens
const GOLD = "#C6A15B";
const GOLD_SATIN = "linear-gradient(180deg,#D9B878,#C6A15B 55%,#A8853F)";
const PANEL = "#122A4A";
const HAIRLINE = "#1E3A5F";
const PAPER_INK = "#10233F";
const TEXT = "rgba(236,242,250,.95)";
const MUTED = "rgba(163,180,202,.72)";
const GOOD = "#3E7D5C";
const EASE = "cubic-bezier(0.22,0.61,0.36,1)";
const SERIF = "Georgia, 'Iowan Old Style', Cambria, 'Times New Roman', serif";
const UI_FONT = "'Segoe UI', Inter, system-ui, -apple-system, sans-serif";

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
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/office/status");
      const j = await r.json();
      if (j && j.ok !== false) setStatus(j);
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
    const iv = setInterval(refresh, 15000);
    return () => clearInterval(iv);
  }, [refresh]);

  // Present mode: PlanModule will announce presenting on/off via a window event
  // so the room chrome can quiet itself without prop-drilling. Only the listener
  // and attribute toggle are installed here; nothing dispatches the event yet,
  // which is harmless.
  useEffect(() => {
    const onPresenting = (ev: Event) => {
      const on = Boolean((ev as CustomEvent<{ on?: boolean }>)?.detail?.on);
      try {
        if (on) document.documentElement.setAttribute("data-office-presenting", "1");
        else document.documentElement.removeAttribute("data-office-presenting");
      } catch {}
    };
    window.addEventListener("fathom:presenting", onPresenting as EventListener);
    return () => {
      window.removeEventListener("fathom:presenting", onPresenting as EventListener);
      try {
        document.documentElement.removeAttribute("data-office-presenting");
      } catch {}
    };
  }, []);

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: UI_FONT,
        color: TEXT,
      }}
    >
      {/* The Desk header + The Sign on one line, over a hairline rule. */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          paddingBottom: 14,
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <div>
          <div
            style={{
              color: GOLD,
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              marginBottom: 3,
            }}
          >
            The Desk
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 20,
              lineHeight: 1.25,
              color: TEXT,
              letterSpacing: "0.01em",
            }}
          >
            East Coast Employee Benefits
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {status && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                padding: "6px 12px",
                borderRadius: 3,
                border: `1px solid ${HAIRLINE}`,
                background: "rgba(255,255,255,0.02)",
                color: status.open ? TEXT : MUTED,
                transition: `color 320ms ${EASE}`,
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 1,
                  background: status.open ? GOOD : "rgba(163,180,202,0.35)",
                  flexShrink: 0,
                  transition: `background 320ms ${EASE}`,
                }}
              />
              {status.open ? "Open for consultations" : "By appointment"}
            </span>
          )}
          <button
            onClick={toggleDoor}
            disabled={busy || !status}
            style={{
              padding: "7px 16px",
              borderRadius: 3,
              border: `1px solid ${HAIRLINE}`,
              background: PANEL,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              color: busy || !status ? MUTED : TEXT,
              fontFamily: UI_FONT,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.02em",
              cursor: busy || !status ? "default" : "pointer",
              whiteSpace: "nowrap",
              transition: `color 260ms ${EASE}`,
            }}
          >
            {busy ? "…" : "Flip the sign"}
          </button>
        </div>
      </div>

      {/* At the door: visitor cards surface only when someone is actually waiting — no idle log. */}
      {knocks.length > 0 && (
        <div
          style={{
            border: `1px solid ${HAIRLINE}`,
            borderRadius: 6,
            background: PANEL,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.35)",
            padding: "12px 16px 6px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: MUTED,
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: 8,
              display: "flex",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            At the door
            <span
              style={{
                fontFamily: SERIF,
                fontVariantNumeric: "tabular-nums lining-nums",
                fontSize: 11,
                letterSpacing: 0,
                color: MUTED,
              }}
            >
              {knocks.length}
            </span>
          </div>
          {knocks.map((k) => {
            const when = ago(k.ts);
            return (
              <div
                key={k.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 0",
                  borderTop: `1px solid ${HAIRLINE}`,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontFamily: SERIF,
                      fontSize: 15,
                      lineHeight: 1.3,
                      color: TEXT,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {k.name}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: MUTED,
                      fontVariantNumeric: "tabular-nums lining-nums",
                      marginTop: 1,
                    }}
                  >
                    {when ? `${when} · at the door` : "at the door"}
                  </span>
                </span>
                <button
                  onClick={() => onAdmit?.(k.userId)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 3,
                    border: "1px solid #A8853F",
                    background: GOLD_SATIN,
                    color: PAPER_INK,
                    fontFamily: UI_FONT,
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    transition: `opacity 260ms ${EASE}`,
                  }}
                >
                  Show them in
                </button>
              </div>
            );
          })}
        </div>
      )}

      <PlanModule jwt="" accent={GOLD} />
    </div>
  );
}
