"use client";
import React from "react";

export const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  return r.json();
}

export function currentUserId(): string | null {
  try {
    const t = localStorage.getItem("weered_token") || "";
    const p = JSON.parse(atob(t.split(".")[1]));
    return p.sub || p.userId || null;
  } catch {
    return null;
  }
}

export const S = {
  card: {
    borderRadius: 2,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.03)",
    padding: "10px 12px",
  } as React.CSSProperties,
  btn: {
    padding: "6px 12px",
    borderRadius: 2,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.05)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgba(243,244,246,.88)",
  } as React.CSSProperties,
  btnPri: {
    padding: "6px 12px",
    borderRadius: 2,
    border: "1px solid rgba(124,58,237,.35)",
    background: "rgba(124,58,237,.12)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgb(216,180,254)",
    fontWeight: 600,
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 2,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.30)",
    fontSize: 13,
    color: "rgba(243,244,246,.92)",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    opacity: 0.45,
    letterSpacing: ".7px",
    textTransform: "uppercase" as const,
    marginBottom: 6,
  } as React.CSSProperties,
};

export const ACCENT_DESTINY = "#4F88C6";

export const TIER_COLORS: Record<string, string> = {
  Exotic: "#ceae33",
  Legendary: "#522f65",
  Rare: "#5076a3",
  Uncommon: "#366e42",
  Common: "#c3bcb4",
  Unknown: "rgba(255,255,255,.1)",
  Currency: "rgba(255,255,255,.1)",
};
export const TIER_BORDER: Record<string, string> = {
  Exotic: "rgba(206,174,51,.6)",
  Legendary: "rgba(82,47,101,.8)",
  Rare: "rgba(80,118,163,.6)",
  Uncommon: "rgba(54,110,66,.6)",
  Common: "rgba(195,188,180,.4)",
  Unknown: "rgba(255,255,255,.08)",
  Currency: "rgba(255,255,255,.08)",
};
