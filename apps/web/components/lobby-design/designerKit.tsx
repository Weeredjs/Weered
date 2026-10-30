"use client";

// Shared look for the Design mode panels.
import React from "react";

export const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

/** `px` below the top of the window, clear of the desktop app's title bar
 *  (--wtb-h: 38px there, 0 in a browser; styles/90-desktop-chrome.css).
 *  James 2026-10-30: the Design bars sat under it in the desktop app. */
export const belowTitlebar = (px: number) => `calc(var(--wtb-h, 0px) + ${px}px)`;

export const panel: React.CSSProperties = {
  position: "fixed",
  zIndex: 99990,
  background: "rgba(14,14,20,.92)",
  backdropFilter: "blur(14px) saturate(140%)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 16,
  boxShadow: "0 24px 60px rgba(0,0,0,.55)",
  color: "rgba(243,244,246,.92)",
};

export const chip = (on: boolean, accent: string): React.CSSProperties => ({
  padding: "7px 11px",
  borderRadius: 999,
  border: `1px solid ${on ? accent : "rgba(255,255,255,.12)"}`,
  background: on ? `${accent}22` : "rgba(255,255,255,.03)",
  color: on ? "#fff" : "rgba(243,244,246,.75)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

export const label: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "rgba(243,244,246,.5)",
  margin: "14px 0 8px",
};

export const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(0,0,0,.35)",
  color: "inherit",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

export function IconBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(255,255,255,.04)",
        color: "inherit",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        fontSize: 15,
      }}
    >
      {children}
    </button>
  );
}
