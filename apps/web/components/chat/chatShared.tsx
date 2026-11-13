"use client";

import React from "react";

export function detectMentionAtCaret(
  value: string,
  caret: number,
): { query: string; start: number } | null {
  let i = caret - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === "@") {
      if (i === 0 || /\s/.test(value[i - 1])) {
        return { query: value.slice(i + 1, caret), start: i };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

export function nameStyleFor(role?: string, tier?: string): React.CSSProperties {
  const r = String(role || "").toUpperCase();
  const t = String(tier || "").toUpperCase();
  if (r === "GOD") return { color: "#fcd34d", textShadow: "0 0 10px rgba(252,211,77,0.45)" };
  if (r === "STAFF") return { color: "#60a5fa", textShadow: "0 0 8px rgba(96,165,250,0.35)" };
  if (r === "SUPPORT") return { color: "#c4b5fd", textShadow: "0 0 8px rgba(196,181,253,0.35)" };
  if (r === "MOD") return { color: "#34d399", textShadow: "0 0 6px rgba(52,211,153,0.30)" };
  if (t === "KINGPIN") return { color: "#fcd34d", textShadow: "0 0 6px rgba(252,211,77,0.35)" };
  if (t === "CONDEMNED") return { color: "#f87171", textShadow: "0 0 6px rgba(248,113,113,0.35)" };
  if (t === "FELON") return { color: "#fb923c", textShadow: "0 0 5px rgba(251,146,60,0.30)" };
  if (t === "INDICTED") return { color: "#a78bfa" };
  return {};
}

export const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

/** A message's text for a preview (a DM or group list), its ||spoilers||
 *  shown as [spoiler] (messageRender.tsx; api lib/spoilers.ts). */
export const hideSpoilers = (text: string) =>
  String(text || "").replace(/\|\|[^|\n]+?\|\|/g, "[spoiler]");
export const IMG_EXT = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;
export const TENOR_RE = /https?:\/\/media\.tenor\.com\/[^\s]+/i;

/**
 * A picture drawn straight into a message: one uploaded here (it went through
 * the picture check) or a Tenor GIF. A picture on any other host is shown only
 * when the reader asks, so the picture check means something and a stranger's
 * server does not learn who read the message (fan-out audit, 2026-11-13).
 */
export function isOwnPicture(url: string): boolean {
  const s = String(url || "").trim();
  if (/^\/(?![/\\])/.test(s)) return true;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    return h === "weered.ca" || h.endsWith(".weered.ca") || h === "media.tenor.com";
  } catch {
    return false;
  }
}

export function pictureHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "another site";
  }
}
export const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export type InlineTok = {
  kind: "url" | "mention" | "bold" | "italic" | "code" | "card" | "spoiler";
  start: number;
  end: number;
  value: string;
  raw: string;
};

export type ChatAtt = {
  id: string;
  url: string;
  thumbUrl: string;
  w: number;
  h: number;
  trusted: boolean;
  expiresAt?: string | null;
};

export function authHeadersChat(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}
