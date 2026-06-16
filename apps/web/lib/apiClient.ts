"use client";

// Canonical lightweight API client for client components. The toast-wrapped
// variant lives in lib/api.ts; this is the bare fetch->json helper that the
// feature/dashboard modules use. Consolidated from 4 byte-identical copies.

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
