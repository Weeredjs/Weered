"use client";
// The shared screen, with a larger view (James 2026-11-16: "make the share
// screen evolve into a larger view. Togglable of course").
//
// page.tsx's setScreenVideo puts the share's <video> into a box React never
// renders into (screenEl). This wraps that box: while a share is up, a button
// grows it to fill the window (a double-click or Esc toggles back), and from
// there the browser's own full screen.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

export function ScreenStage({ screenEl }: { screenEl: RefObject<HTMLDivElement | null> }) {
  const [sharing, setSharing] = useState(false);
  const [big, setBig] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  // Is a share on the box right now?
  useEffect(() => {
    const el = screenEl.current;
    if (!el) return;
    const read = () => setSharing(!!el.querySelector("video"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [screenEl]);

  // The share ended: back to the room.
  useEffect(() => {
    if (!sharing) setBig(false);
  }, [sharing]);

  useEffect(() => {
    if (!big) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setBig(false);
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [big]);

  const fullScreen = () => {
    const el = wrap.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void el.requestFullscreen?.().catch(() => {});
  };

  return (
    <div
      ref={wrap}
      className={big ? "fx-screen-big" : undefined}
      style={big ? S.big : S.small}
      onDoubleClick={() => sharing && setBig((v) => !v)}
    >
      <style>{CSS}</style>
      {big && sharing && (
        <div style={S.bar}>
          <span style={S.barTitle}>Shared screen</span>
          <span style={{ flex: 1 }} />
          <button className="fx-ctl" style={S.btn} onClick={fullScreen}>
            Full screen
          </button>
          <button
            className="fx-ctl"
            style={{ ...S.btn, ...S.primary }}
            onClick={() => setBig(false)}
          >
            Back to the room
          </button>
        </div>
      )}
      <div ref={screenEl} style={big ? S.boxBig : S.box} />
      {!big && sharing && (
        <button
          className="fx-ctl"
          style={S.grow}
          onClick={() => setBig(true)}
          title="Fill the window with the shared screen (double-click works too)"
        >
          ⤢ Larger view
        </button>
      )}
    </div>
  );
}

// The share's own <video> carries max-height:62vh inline; the larger view
// lifts it to the window.
const CSS = `
.fx-screen-big video{max-height:none!important;height:calc(100vh - 74px)!important;width:100%!important;border-radius:4px!important}
.fx-screen-big:fullscreen video{height:calc(100vh - 58px)!important}
@keyframes fx-grow{from{opacity:.4;transform:scale(.97)}to{opacity:1;transform:none}}
`;

const S: Record<string, CSSProperties> = {
  small: { position: "relative", width: "100%" },
  box: { width: "100%" },
  big: {
    position: "fixed",
    inset: 0,
    zIndex: 90,
    display: "flex",
    flexDirection: "column",
    padding: "0 12px 12px",
    background: "rgba(4,10,20,.95)",
    animation: "fx-grow 220ms cubic-bezier(0.22,0.61,0.36,1)",
  },
  boxBig: { flex: 1, minHeight: 0 },
  bar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    height: 52,
    flexShrink: 0,
  },
  barTitle: {
    fontFamily: "'Segoe UI', Inter, system-ui, sans-serif",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: ".18em",
    textTransform: "uppercase",
    color: "rgba(163,180,202,.85)",
  },
  btn: {
    padding: "7px 14px",
    borderRadius: 4,
    border: "1px solid #1E3A5F",
    background: "#122A4A",
    color: "rgba(236,242,250,.95)",
    fontSize: 13,
    fontFamily: "'Segoe UI', Inter, system-ui, sans-serif",
    cursor: "pointer",
  },
  primary: {
    border: "1px solid #A8853F",
    background: "linear-gradient(180deg,#D9B878,#C6A15B 55%,#A8853F)",
    color: "#10233F",
    fontWeight: 600,
  },
  grow: {
    position: "absolute",
    right: 10,
    top: 10,
    padding: "5px 11px",
    borderRadius: 4,
    border: "1px solid rgba(198,161,91,.6)",
    background: "rgba(10,29,53,.82)",
    color: "rgba(236,242,250,.95)",
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: "'Segoe UI', Inter, system-ui, sans-serif",
    cursor: "pointer",
    zIndex: 2,
  },
};
