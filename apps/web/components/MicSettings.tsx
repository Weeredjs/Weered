"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useVoice } from "./VoiceContext";

export default function MicSettings() {
  const { mics, micId, inputLevel, setMic, refreshMics, muted } = useVoice();
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  function place() {
    const b = btnRef.current;
    if (b) setRect(b.getBoundingClientRect());
  }

  useEffect(() => {
    if (!open) return;
    refreshMics();
    place();
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onMove() {
      place();
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, refreshMics]);

  const level = muted ? 0 : inputLevel;
  const meterColor = level > 0.35 ? "#22c55e" : level > 0.12 ? "#eab308" : "#64748b";

  const popWidth = 280;
  const popTop = rect ? rect.bottom + 8 : 0;
  const popLeft = rect
    ? Math.max(8, Math.min(rect.right - popWidth, window.innerWidth - popWidth - 8))
    : 0;

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        title="Microphone settings"
        style={{
          padding: "5px 10px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
          background: "rgba(255,255,255,.07)",
          color: "rgba(255,255,255,.8)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        ⚙
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: meterColor,
            boxShadow: level > 0.12 ? `0 0 6px ${meterColor}` : "none",
            transition: "background .1s",
          }}
        />
      </button>

      {open &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: popTop,
              left: popLeft,
              zIndex: 2147483000,
              width: popWidth,
              padding: 12,
              borderRadius: 12,
              background: "rgba(12,12,20,.97)",
              border: "1px solid rgba(124,58,237,.35)",
              boxShadow: "0 12px 32px rgba(0,0,0,.55)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: "rgba(167,139,250,.85)",
                marginBottom: 8,
              }}
            >
              Microphone
            </div>

            <select
              value={micId || ""}
              onChange={(e) => setMic(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.12)",
                color: "#e8e8ec",
                fontSize: 12,
                fontFamily: "inherit",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {mics.length === 0 && <option value="">Default microphone</option>}
              {mics.map((m) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label}
                </option>
              ))}
            </select>

            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 9,
                  color: "rgba(148,163,184,.6)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 5,
                }}
              >
                <span>Input level</span>
                <span>
                  {muted ? "muted" : level > 0.35 ? "good" : level > 0.12 ? "faint" : "silent"}
                </span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 6,
                  background: "rgba(255,255,255,.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(level * 100)}%`,
                    background: meterColor,
                    borderRadius: 6,
                    transition: "width .08s linear, background .12s",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(148,163,184,.55)",
                  marginTop: 7,
                  lineHeight: 1.4,
                }}
              >
                {muted
                  ? "Unmute to test your mic."
                  : "Speak normally — the bar should turn green. If tapping the mic moves it but talking doesn't, raise your input level in Windows Sound settings or pick another device above."}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
