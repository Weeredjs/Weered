"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWeered } from "./WeeredProvider";

type DmMsg = { id: string; fromId: string; toId: string; body: string; createdAt: string; readAt?: string | null };
type DmThread = { peerId: string; peerName: string; msgs: DmMsg[]; unread: number };

const WEERED_THEME_KEY = "weered_theme_v1";

type WeeredThemeName = "slate" | "zinc" | "stone" | "gray";
const WEERED_THEMES: Record<WeeredThemeName, any> = {
 slate: {
 bg: "rgb(2,6,23)",
 panel: "rgba(15,23,42,.92)",
 panel2: "rgba(17,24,39,.94)",
 bd: "rgba(148,163,184,.14)",
 bd2: "rgba(148,163,184,.26)",
 text: "rgba(229,231,235,.96)",
 muted: "rgba(148,163,184,.75)",
 accentBg: "rgba(14,165,233,.18)",
 accentRing: "rgba(14,165,233,.35)",
 accentText: "rgba(56,189,248,.95)",
 },
 zinc: {
 bg: "rgb(9,9,11)",
 panel: "rgba(24,24,27,.92)",
 panel2: "rgba(24,24,27,.94)",
 bd: "rgba(161,161,170,.18)",
 bd2: "rgba(161,161,170,.28)",
 text: "rgba(244,244,245,.96)",
 muted: "rgba(161,161,170,.78)",
 accentBg: "rgba(34,197,94,.16)",
 accentRing: "rgba(34,197,94,.34)",
 accentText: "rgba(74,222,128,.95)",
 },
 stone: {
 bg: "rgb(12,10,9)",
 panel: "rgba(28,25,23,.92)",
 panel2: "rgba(28,25,23,.94)",
 bd: "rgba(168,162,158,.18)",
 bd2: "rgba(168,162,158,.28)",
 text: "rgba(245,245,244,.96)",
 muted: "rgba(168,162,158,.78)",
 accentBg: "rgba(245,158,11,.16)",
 accentRing: "rgba(245,158,11,.34)",
 accentText: "rgba(251,191,36,.95)",
 },
 gray: {
 bg: "rgb(3,7,18)",
 panel: "rgba(17,24,39,.92)",
 panel2: "rgba(17,24,39,.94)",
 bd: "rgba(156,163,175,.18)",
 bd2: "rgba(156,163,175,.28)",
 text: "rgba(243,244,246,.96)",
 muted: "rgba(156,163,175,.78)",
 accentBg: "rgba(20,184,166,.16)",
 accentRing: "rgba(20,184,166,.34)",
 accentText: "rgba(45,212,191,.95)",
 },
};

function applyWeeredTheme(name: WeeredThemeName) {
 if (typeof document === "undefined") return;
 const t = WEERED_THEMES[name] || WEERED_THEMES.slate;
 const root = document.documentElement;
 root.style.setProperty("--weered-bg", t.bg);
 root.style.setProperty("--weered-panel", t.panel);
 root.style.setProperty("--weered-panel2", t.panel2);
 root.style.setProperty("--weered-bd", t.bd);
 root.style.setProperty("--weered-bd2", t.bd2);
 root.style.setProperty("--weered-text", t.text);
 root.style.setProperty("--weered-muted", t.muted);
 root.style.setProperty("--weered-accent-bg", t.accentBg);
 root.style.setProperty("--weered-accent-ring", t.accentRing);
 root.style.setProperty("--weered-accent-text", t.accentText);
 root.setAttribute("data-weered-theme", name);
}

function __id() {
 return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function pickFirstString(...vals: any[]): string {
 for (const v of vals) {
 if (typeof v === "string" && v.trim()) return v.trim();
 }
 return "";
}

function b64UrlDecode(input: string): string {
 try {
 const s = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
 const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
 const raw = atob(s + pad);
 const pct = Array.prototype.map
 .call(raw, (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
 .join("");
 return decodeURIComponent(pct);
 } catch {
 try { return atob(String(input || "")); } catch { return ""; }
 }
}

function decodeJwtClaims(token?: string | null): any {
 try {
 const t = String(token || "");
 const parts = t.split(".");
 if (parts.length !== 3) return null;
 const json = b64UrlDecode(parts[1]);
 return json ? JSON.parse(json) : null;
 } catch { return null; }
}

function normRole(v: any): string {
 const s = String(v || "").trim();
 return s ? s.toUpperCase() : "";
}

function militaryTime(iso: string): string {
 try {
 const d = new Date(iso);
 return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
 } catch { return "--:--"; }
}

// ── Underground design tokens ────────────────────────────────────────────────
const C = {
 bg:       "var(--weered-bg)",
 panel:    "var(--weered-panel)",
 panel2:   "var(--weered-panel2)",
 border:   "var(--weered-bd)",
 border2:  "var(--weered-bd2)",
 green:    "rgba(34,197,94,.95)",
 greenDim: "rgba(34,197,94,.6)",
 greenBg:  "rgba(34,197,94,.08)",
 greenGlow:"rgba(34,197,94,.12)",
 amber:    "var(--weered-accent-text)",
 amberDim: "var(--weered-accent-text)",
 amberBg:  "var(--weered-accent-bg)",
 red:      "rgba(239,68,68,.9)",
 redBg:    "rgba(239,68,68,.10)",
 muted:    "var(--weered-muted)",
 font:     "'Courier New', 'JetBrains Mono', 'Consolas', monospace",
};

function BlinkCursor() {
 const [on, setOn] = useState(true);
 useEffect(() => {
 const t = setInterval(() => setOn(v => !v), 530);
 return () => clearInterval(t);
 }, []);
 return <span style={{ color: "var(--weered-accent-text)", opacity: on ? 1 : 0 }}>_</span>;
}

function ScanlineOverlay() {
 return (
 <div style={{
 position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
 backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.08) 2px, rgba(0,0,0,.08) 4px)",
 borderRadius: "inherit",
 }} />
 );
}

function TierBadge({ role }: { role: string }) {
 const r = normRole(role);
 const color = r === "GOD" ? C.amber : r === "ADMIN" ? C.amber : r === "STAFF" ? C.green : C.muted;
 const label = r === "GOD" ? "KINGPIN" : r === "ADMIN" ? "FELON" : r === "STAFF" ? "INDICTED" : "INNOCENT";
 return (
 <span style={{ fontFamily: C.font, fontSize: 10, color, border: `1px solid ${color}`, padding: "1px 6px", borderRadius: 2, letterSpacing: 1 }}>
 {label}
 </span>
 );
}

function SignalDots({ up }: { up: boolean }) {
 return (
 <span style={{ display: "inline-flex", gap: 2, alignItems: "flex-end" }}>
 {[1, 2, 3, 4].map(i => (
 <span key={i} style={{
 display: "inline-block",
 width: 3,
 height: 3 + i * 2,
 background: up && i <= 4 ? C.green : i === 1 && !up ? C.red : C.muted,
 borderRadius: 1,
 }} />
 ))}
 </span>
 );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DockShell(props: { forceMode?: "rail" | "floating" } = {}) {
 const ctx: any = (useWeered?.() as any) || {};

 const {
 me, authed, wsReady, wsState,
 activeRoomId, joinedRoomId,
 users, msgs, meta, admin, role, joinStatus,
 sendChat, logout, renameRoom, lockRoom, unlockRoom, knock, admit,
 } = ctx || {};

 const [open, setOpen] = useState(true);
 const [tab, setTab] = useState<"room" | "dms" | "friends">("room");
 const [text, setText] = useState("");
 const [dockMode, setDockMode] = useState<"rail" | "floating">(props.forceMode || "floating");

 const [theme, setTheme] = useState<WeeredThemeName>(() => {
 try {
 const v = String(localStorage.getItem(WEERED_THEME_KEY) || "").trim();
 if (v === "slate" || v === "zinc" || v === "stone" || v === "gray") return v;
 } catch {}
 return "stone";
 });

 useEffect(() => {
 try { localStorage.setItem(WEERED_THEME_KEY, theme); } catch {}
 applyWeeredTheme(theme);
 }, [theme]);

 useEffect(() => {
 if (props.forceMode) {
 setDockMode(props.forceMode);
 if (props.forceMode === "rail") setOpen(true);
 return;
 }
 if (typeof window === "undefined") return;
 const mq = window.matchMedia("(min-width: 1100px)");
 const apply = () => {
 const mode = mq.matches ? "rail" : "floating";
 setDockMode(mode);
 if (mode === "rail") setOpen(true);
 };
 apply();
 try {
 mq.addEventListener("change", apply);
 return () => mq.removeEventListener("change", apply);
 } catch {
 mq.addListener(apply);
 return () => mq.removeListener(apply);
 }
 }, [props.forceMode]);

 const viewId = String(activeRoomId || "");
 const joinedId = String(joinedRoomId || "");
 const needJoin = !!viewId && viewId !== joinedId;

 const wsUp = useMemo(() => {
 if (!!wsReady) return true;
 if (wsState === 1) return true;
 if (typeof wsState === "string" && wsState.toLowerCase() === "open") return true;
 return false;
 }, [wsReady, wsState]);

 const tokenMaybe = useMemo(() => {
 if (typeof window === "undefined") return "";
 return (
 pickFirstString(ctx?.token, ctx?.authToken, ctx?.jwt, ctx?.auth?.token, ctx?.session?.token, me?.token, me?.jwt) ||
 pickFirstString(
 localStorage.getItem("weered_token"), localStorage.getItem("token"),
 localStorage.getItem("auth_token"), localStorage.getItem("jwt"),
 localStorage.getItem("weered.jwt"), localStorage.getItem("weered.auth")
 )
 );
 }, [ctx, me]);

 const claims = useMemo(() => decodeJwtClaims(tokenMaybe), [tokenMaybe]);

 const globalRole = useMemo(() => {
 const gr = pickFirstString(
 me?.globalRole, me?.global_role, me?.user?.globalRole, me?.user?.global_role,
 claims?.globalRole, claims?.global_role, claims?.gr
 );
 return normRole(gr);
 }, [me, claims]);

 const meName = pickFirstString(me?.name, me?.username, "UNKNOWN");
 const roomTitle = pickFirstString(meta?.name, viewId, "---");
 const roomRole = normRole(pickFirstString(role, joinStatus?.role));

 // ── DM state ─────────────────────────────────────────────────────────────
 const [dmThreads, setDmThreads] = useState<DmThread[]>([]);
 const [dmActivePeerId, setDmActivePeerId] = useState<string>("");
 const [dmPeer, setDmPeer] = useState("");
 const [dmDraft, setDmDraft] = useState("");
 const [dmLoading, setDmLoading] = useState(false);
 const dmEndRef = useRef<HTMLDivElement | null>(null);
 const dmInputRef = useRef<HTMLInputElement | null>(null);
 const roomInputRef = useRef<HTMLInputElement | null>(null);
 const apiBase = pickFirstString(ctx?.apiBase, (ctx as any)?.api, "") || "";

 useEffect(() => {
 if (!tokenMaybe || !apiBase) return;
 fetch(`${apiBase}/dm/unread`, { headers: { Authorization: `Bearer ${tokenMaybe}` } })
 .then(r => r.json())
 .then(j => {
 if (!j?.counts) return;
 setDmThreads(cur => cur.map(t => ({ ...t, unread: j.counts[t.peerId] ?? 0 })));
 })
 .catch(() => {});
 }, [tokenMaybe, apiBase]);

 useEffect(() => {
 if (!dmActivePeerId || !tokenMaybe || !apiBase) return;
 setDmLoading(true);
 fetch(`${apiBase}/dm/${dmActivePeerId}`, { headers: { Authorization: `Bearer ${tokenMaybe}` } })
 .then(r => r.json())
 .then(j => {
 if (!Array.isArray(j?.messages)) return;
 setDmThreads(cur => cur.map(t =>
 t.peerId === dmActivePeerId ? { ...t, msgs: j.messages, unread: 0 } : t
 ));
 })
 .catch(() => {})
 .finally(() => setDmLoading(false));
 }, [dmActivePeerId, tokenMaybe, apiBase]);

 // WS listener for incoming DMs via window event bridge
 useEffect(() => {
 const handler = (ev: any) => {
 const payload = ev?.detail;
 const msg: DmMsg = payload?.message;
 if (!msg) return;
 const meId = String(me?.id || "");
 const peerId = msg.fromId === meId ? msg.toId : msg.fromId;
 setDmThreads(cur => {
 const existing = cur.find(t => t.peerId === peerId);
 if (existing) {
 return cur.map(t => t.peerId === peerId
 ? { ...t, msgs: [...t.msgs, msg], unread: dmActivePeerId === peerId ? 0 : t.unread + 1 }
 : t
 );
 }
 fetch(`${apiBase}/profile/${encodeURIComponent(peerId)}`, { headers: tokenMaybe ? { Authorization: `Bearer ${tokenMaybe}` } : {} })
 .then(r => r.json()).then(j => {
 if (j?.name) setDmThreads(ts => ts.map(t => t.peerId === peerId ? { ...t, peerName: j.name } : t));
 }).catch(() => {});
 return [{ peerId, peerName: peerId, msgs: [msg], unread: dmActivePeerId === peerId ? 0 : 1 }, ...cur];
 });
 };
 window.addEventListener("weered:dm:message", handler as any);
 return () => window.removeEventListener("weered:dm:message", handler as any);
 }, [me, dmActivePeerId, apiBase, tokenMaybe]);

 useEffect(() => {
 try { dmEndRef.current?.scrollIntoView({ behavior: "smooth" }); } catch {}
 }, [dmActivePeerId, dmThreads]);

 useEffect(() => {
 if (typeof window === "undefined") return;
 const focusNow = () => {
 setTimeout(() => {
 try {
 if (tab === "dms") dmInputRef.current?.focus();
 else roomInputRef.current?.focus();
 } catch {}
 }, 0);
 };
 window.addEventListener("weered:dock:opened", focusNow as any);
 return () => window.removeEventListener("weered:dock:opened", focusNow as any);
 }, [tab, dmActivePeerId]);

 const dmActive = useMemo(() => dmThreads.find(t => t.peerId === dmActivePeerId) || null, [dmThreads, dmActivePeerId]);
 const totalUnread = useMemo(() => dmThreads.reduce((s, t) => s + t.unread, 0), [dmThreads]);

 // DM intent from UI (Presence "Message" button)
 useEffect(() => {
 if (typeof window === "undefined") return;
 const onDockOpen = (ev: any) => {
 const detail = ev?.detail || null;
 if (!detail || detail.mode !== "dm") return;
 const peerName = pickFirstString(detail?.peer?.name, detail?.peerName, detail?.peer, "");
 const peerId = pickFirstString(detail?.peer?.id, detail?.peerId, "");
 if (!peerName && !peerId) return;
 setTab("dms");
 setDmThreads((cur) => {
 const existing = cur.find(t => t.peerId === peerId || t.peerName.toLowerCase() === peerName.toLowerCase());
 if (existing) { setDmActivePeerId(existing.peerId); return cur; }
 const th: DmThread = { peerId, peerName, msgs: [], unread: 0 };
 setDmActivePeerId(peerId);
 return [th, ...cur];
 });
 };
 window.addEventListener("weered:dock:open", onDockOpen as any);
 return () => window.removeEventListener("weered:dock:open", onDockOpen as any);
 }, []);

 function call(fn: any, ...args: any[]) {
 try { if (typeof fn === "function") return fn(...args); } catch {}
 return undefined;
 }

 function sendRoomChat(body: string) {
 const b = String(body || "").trim();
 if (!b) return;
 try { if (typeof sendChat === "function") { sendChat(b); return; } } catch {}
 try { if (typeof sendChat === "function") { sendChat(viewId || joinedId, b); return; } } catch {}
 try { if (typeof sendChat === "function") { sendChat({ roomId: viewId || joinedId, body: b }); return; } } catch {}
 }

 async function dmCreateThread() {
 const peer = dmPeer.trim();
 if (!peer) return;
 const existing = dmThreads.find(t => t.peerName.toLowerCase() === peer.toLowerCase() || t.peerId === peer);
 if (existing) { setDmActivePeerId(existing.peerId); setDmPeer(""); return; }
 setDmPeer("");
 try {
 const r = await fetch(`${apiBase}/profile/${encodeURIComponent(peer)}`, {
 headers: tokenMaybe ? { Authorization: `Bearer ${tokenMaybe}` } : {},
 });
 const j = await r.json();
 const resolvedId = j?.id || peer;
 const resolvedName = j?.name || peer;
 const th: DmThread = { peerId: resolvedId, peerName: resolvedName, msgs: [], unread: 0 };
 setDmThreads(cur => {
 const dup = cur.find(t => t.peerId === resolvedId);
 if (dup) { setDmActivePeerId(resolvedId); return cur; }
 return [th, ...cur];
 });
 setDmActivePeerId(resolvedId);
 } catch {
 const th: DmThread = { peerId: peer, peerName: peer, msgs: [], unread: 0 };
 setDmThreads(cur => [th, ...cur]);
 setDmActivePeerId(peer);
 }
 }

 async function dmSend() {
 if (!dmActive || !dmDraft.trim() || !tokenMaybe || !apiBase) return;
 const body = dmDraft.trim();
 setDmDraft("");
 const meId = String(me?.id || "");
 const optimistic: DmMsg = { id: __id(), fromId: meId, toId: dmActive.peerId, body, createdAt: new Date().toISOString(), readAt: null };
 setDmThreads(cur => cur.map(t => t.peerId === dmActive.peerId ? { ...t, msgs: [...t.msgs, optimistic] } : t));
 try {
 if (typeof (ctx as any)?.sendRaw === "function") {
 (ctx as any).sendRaw({ type: "dm:send", toId: dmActive.peerId, body });
 } else {
 await fetch(`${apiBase}/dm/${dmActive.peerId}`, {
 method: "POST",
 headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenMaybe}` },
 body: JSON.stringify({ body }),
 });
 }
 } catch {}
 }

 const embedded = !!props.forceMode;

 // ── Panel container styles ────────────────────────────────────────────────
 const panel: React.CSSProperties = embedded
 ? {
 position: "relative", width: "100%", height: "100%",
 background: C.bg, border: "none", borderRadius: 0,
 boxShadow: "none", overflow: "hidden", zIndex: 1,
 color: "var(--weered-text)", fontFamily: C.font,
 }
 : dockMode === "rail"
 ? {
 position: "sticky", top: 16, width: "100%", maxWidth: "100%",
 height: "calc(100vh - 32px)",
 background: C.bg,
 border: `1px solid ${C.border2}`,
 borderRadius: 4,
 boxShadow: `0 0 30px rgba(0,255,65,.06), inset 0 0 60px rgba(0,0,0,.4)`,
 overflow: "hidden", zIndex: 40,
 color: "var(--weered-text)", fontFamily: C.font,
 maxHeight: "calc(100vh - 32px)",
 }
 : {
 position: "fixed", right: 14, top: 88,
 width: 320, maxWidth: "92vw",
 height: "calc(100vh - 110px)",
 background: C.bg,
 border: `1px solid ${C.border2}`,
 borderRadius: 4,
 boxShadow: `0 0 40px rgba(0,255,65,.08), inset 0 0 60px rgba(0,0,0,.5)`,
 overflow: "hidden", zIndex: 9999,
 color: "var(--weered-text)", fontFamily: C.font,
 maxHeight: "calc(100vh - 24px)",
 };

 // Collapsed state
 if (!open) {
 return props.forceMode ? null : (
 <button
 onClick={() => setOpen(true)}
 style={{
 position: "fixed", right: 14, top: 88, zIndex: 9999,
 padding: "8px 14px", borderRadius: 2,
 border: `1px solid ${C.green}`,
 background: C.greenBg, color: C.green,
 fontFamily: C.font, fontWeight: 700, fontSize: 12,
 cursor: "pointer", letterSpacing: 2,
 boxShadow: `0 0 12px ${C.greenGlow}`,
 }}
 >
 [COMM]
 </button>
 );
 }

 const userArr: any[] = Array.isArray(users) ? users : [];
 const msgArr: any[] = Array.isArray(msgs) ? msgs : [];

 // Shared input style
 const termInput: React.CSSProperties = {
 flex: 1, padding: "8px 10px 8px 6px",
 background: "transparent",
 border: "none", borderBottom: `1px solid ${C.border}`,
 color: C.green, fontFamily: C.font, fontSize: 12,
 outline: "none", caretColor: "var(--weered-accent-text)",
 };

 const termBtn: React.CSSProperties = {
 padding: "6px 12px", borderRadius: 2,
 border: `1px solid ${C.border2}`,
 background: C.greenBg, color: C.green,
 fontFamily: C.font, fontWeight: 700, fontSize: 11,
 cursor: "pointer", letterSpacing: 1,
 };

 const termBtnActive: React.CSSProperties = {
 ...termBtn,
 background: C.greenGlow,
 border: `1px solid ${C.green}`,
 boxShadow: `0 0 8px ${C.greenGlow}`,
 };

 const sectionHead: React.CSSProperties = {
 padding: "6px 10px",
 borderBottom: `1px solid ${C.border}`,
 fontSize: 10, fontWeight: 700, letterSpacing: 2,
 color: C.muted, textTransform: "uppercase" as const,
 display: "flex", alignItems: "center", gap: 8,
 };

 return (
 <div style={{ ...panel, display: "flex", flexDirection: "column" }}>
 <ScanlineOverlay />

 {/* ── Header ── */}
 <div style={{
 position: "relative", zIndex: 1,
 padding: "10px 12px 8px",
 borderBottom: `1px solid ${C.border}`,
 background: "rgba(0,255,65,.03)",
 }}>
 {/* Top row: branding + signal + close */}
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
 <span style={{ fontSize: 10, color: C.muted, letterSpacing: 3 }}>COMM UNIT</span>
 <SignalDots up={wsUp} />
 </div>
 <button
 onClick={() => { try { window.dispatchEvent(new CustomEvent("weered:dock:close")); } catch {} }}
 style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: C.font, fontSize: 12, padding: "0 4px" }}
 >
 [X]
 </button>
 </div>

 {/* User identity line */}
 <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
 <TierBadge role={globalRole || roomRole} />
 <span style={{ fontSize: 13, fontWeight: 700, color: "var(--weered-text)", letterSpacing: .5 }}>
 {meName}
 </span>
 <BlinkCursor />
 {typeof logout === "function" && (
 <button onClick={() => call(logout)} style={{ marginLeft: "auto", ...termBtn, fontSize: 10, padding: "3px 8px" }}>
 LOGOUT
 </button>
 )}
 </div>

 {/* Status row */}
 <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10, color: C.muted }}>
 <span style={{ color: wsUp ? C.green : C.red }}>
 {wsUp ? "● CONNECTED" : "● OFFLINE"}
 </span>
 <span>|</span>
 <span>LOC: <span style={{ color: C.amber }}>{roomTitle}</span></span>
 <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
 <span>SKIN:</span>
 <select
 value={theme}
 onChange={(e) => setTheme(e.target.value as any)}
 style={{
 background: "transparent", color: C.muted,
 border: `1px solid ${C.border}`, borderRadius: 2,
 padding: "1px 4px", fontSize: 10, fontFamily: C.font, outline: "none",
 }}
 >
 <option value="slate">SLT</option>
 <option value="zinc">ZNC</option>
 <option value="stone">STN</option>
 <option value="gray">GRY</option>
 </select>
 </span>
 </div>

 {/* Tab bar */}
 <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
 {(["room", "dms", "friends"] as const).map(t => {
 const active = tab === t;
 const label = t === "room" ? "📡 ROOM" : t === "dms" ? `☎ COMMS${totalUnread > 0 ? ` [${totalUnread}]` : ""}` : "👁 NETWORK";
 return (
 <button
 key={t}
 onClick={() => setTab(t)}
 style={{
 flex: 1, padding: "5px 4px",
 background: active ? C.greenBg : "transparent",
 border: `1px solid ${active ? C.green : C.border}`,
 borderRadius: 2, color: active ? C.green : C.muted,
 fontFamily: C.font, fontSize: 10, fontWeight: 700,
 cursor: "pointer", letterSpacing: .5,
 boxShadow: active ? `0 0 8px ${C.greenGlow}` : "none",
 }}
 >
 {active ? `> ${label}` : label}
 </button>
 );
 })}
 </div>
 </div>

 {/* ── Body ── */}
 <div style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", padding: "10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>

 {/* ── ROOM TAB ── */}
 {tab === "room" ? (
 <>
 {needJoin && (
 <div style={{ padding: "8px 10px", border: `1px solid ${C.amber}`, borderRadius: 2, background: C.amberBg, fontSize: 11, color: C.amber, display: "flex", alignItems: "center", gap: 8 }}>
 <span>⚠ ACCESS RESTRICTED</span>
 {typeof knock === "function" && (
 <button style={{ ...termBtn, color: C.amber, borderColor: C.amber, marginLeft: "auto" }} onClick={() => call(knock, viewId)}>KNOCK</button>
 )}
 </div>
 )}

 {/* Chat log */}
 <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: "hidden" }}>
 <div style={sectionHead}>
 <span>// ROOM INTERCEPT</span>
 <span style={{ marginLeft: "auto", color: C.muted }}>{msgArr.length} LINES</span>
 </div>
 <div style={{ height: 200, overflow: "auto", padding: "8px 10px", background: "rgba(0,0,0,.3)" }}>
 {msgArr.length ? msgArr.slice(-80).map((m: any, i: number) => {
 const who = pickFirstString(m?.user?.name, m?.name, m?.from, "???");
 const body = pickFirstString(m?.body, m?.text, "");
 const isMe = !!me?.id && (m?.user?.id === me?.id || m?.fromId === me?.id);
 return (
 <div key={m?.id || i} style={{ marginBottom: 6, fontFamily: C.font }}>
 <span style={{ color: isMe ? C.green : C.amber, fontSize: 11, fontWeight: 700 }}>
 [{militaryTime(m?.createdAt || new Date().toISOString())}] {who}
 </span>
 <span style={{ color: "rgba(255,255,255,.75)", fontSize: 12 }}>{" > "}{body}</span>
 </div>
 );
 }) : (
 <div style={{ color: C.muted, fontSize: 11 }}>// NO TRANSMISSIONS INTERCEPTED</div>
 )}
 </div>
 <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${C.border}`, background: "rgba(0,0,0,.2)", alignItems: "center", padding: "6px 10px" }}>
 <span style={{ color: "var(--weered-accent-text)", fontSize: 12, marginRight: 4 }}>{">"}</span>
 <input
 ref={roomInputRef}
 value={text}
 onChange={(e) => setText((e.target as any).value || "")}
 placeholder="transmit..."
 style={termInput}
 onKeyDown={(e) => { if ((e as any).key === "Enter") { sendRoomChat(text); setText(""); } }}
 />
 <button style={{ ...termBtn, borderRadius: 0, borderLeft: "none" }} onClick={() => { sendRoomChat(text); setText(""); }}>
 SEND
 </button>
 </div>
 </div>

 {/* Presence */}
 <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: "hidden" }}>
 <div style={sectionHead}>
 <span>// KNOWN OPERATIVES</span>
 <span style={{ marginLeft: "auto" }}>{userArr.length} ACTIVE</span>
 </div>
 <div style={{ maxHeight: 180, overflow: "auto" }}>
 {userArr.length ? userArr.map((u: any) => {
 const uname = pickFirstString(u?.name, u?.username, "unknown");
 const ugr = normRole(pickFirstString(u?.globalRole, u?.global_role));
 const ur = normRole(pickFirstString(u?.role, u?.roomRole));
 const isMe = !!me?.id && u?.id === me?.id;
 return (
 <div key={u?.id || uname} style={{ padding: "7px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
 <span style={{ color: C.green, fontSize: 10 }}>▸</span>
 <span style={{ fontWeight: 700, fontSize: 12, color: isMe ? "var(--weered-accent-text)" : "var(--weered-text)" }}>
 {uname}{isMe ? " [YOU]" : ""}
 </span>
 {ugr ? <span style={{ fontSize: 9, color: C.muted, border: `1px solid ${C.border}`, padding: "1px 5px", borderRadius: 1 }}>{ugr}</span> : null}
 {ur ? <span style={{ fontSize: 9, color: C.muted, border: `1px solid ${C.border}`, padding: "1px 5px", borderRadius: 1 }}>{ur}</span> : null}
 </div>
 );
 }) : (
 <div style={{ padding: 10, color: C.muted, fontSize: 11 }}>// NO OPERATIVES DETECTED</div>
 )}
 </div>
 </div>

 {/* Mod tools */}
 {(admin || roomRole === "OWNER" || roomRole === "MOD") && (
 <div style={{ border: `1px solid rgba(255,49,49,.2)`, borderRadius: 2, overflow: "hidden" }}>
 <div style={{ ...sectionHead, color: C.red, borderColor: "rgba(255,49,49,.2)" }}>
 // COMMAND OVERRIDE
 </div>
 <div style={{ padding: 10, display: "flex", gap: 6, flexWrap: "wrap" as const }}>
 {typeof lockRoom === "function" && <button style={{ ...termBtn, color: C.red, borderColor: C.red }} onClick={() => call(lockRoom, viewId)}>LOCK</button>}
 {typeof unlockRoom === "function" && <button style={{ ...termBtn, color: C.red, borderColor: C.red }} onClick={() => call(unlockRoom, viewId)}>UNLOCK</button>}
 {typeof renameRoom === "function" && (
 <button style={{ ...termBtn, color: C.red, borderColor: C.red }} onClick={() => { const next = prompt("New room name?"); if (next) call(renameRoom, viewId, next); }}>
 RENAME
 </button>
 )}
 </div>
 </div>
 )}
 </>

 ) : tab === "dms" ? (
 // ── DMS TAB ──
 <>
 {/* New thread input */}
 <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: "hidden" }}>
 <div style={sectionHead}>// OPEN CHANNEL</div>
 <div style={{ display: "flex", alignItems: "center", padding: "6px 10px", gap: 6, background: "rgba(0,0,0,.2)" }}>
 <span style={{ color: "var(--weered-accent-text)", fontSize: 12 }}>{">"}</span>
 <input
 value={dmPeer}
 onChange={(e) => setDmPeer((e.target as any).value || "")}
 placeholder="callsign or ID..."
 style={termInput}
 onKeyDown={(e) => { if ((e as any).key === "Enter") void dmCreateThread(); }}
 />
 <button style={termBtn} onClick={() => void dmCreateThread()}>OPEN</button>
 </div>
 </div>

 {/* Thread list */}
 {dmThreads.length > 0 && (
 <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: "hidden" }}>
 <div style={sectionHead}>
 // ACTIVE CHANNELS
 {totalUnread > 0 && <span style={{ marginLeft: "auto", color: C.red }}>[{totalUnread} NEW]</span>}
 </div>
 {dmThreads.map(t => {
 const active = t.peerId === dmActivePeerId;
 return (
 <button key={t.peerId} onClick={() => setDmActivePeerId(t.peerId)} style={{
 width: "100%", textAlign: "left",
 padding: "8px 10px",
 border: "none", borderBottom: `1px solid ${C.border}`,
 background: active ? C.greenBg : "transparent",
 cursor: "pointer",
 display: "flex", alignItems: "center", justifyContent: "space-between",
 }}>
 <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
 <span style={{ color: active ? C.green : C.muted, fontSize: 11 }}>{active ? "▶" : "▷"}</span>
 <span style={{ fontFamily: C.font, fontSize: 12, color: active ? C.green : C.muted, fontWeight: 700 }}>
 @{t.peerName}
 </span>
 </div>
 {t.unread > 0 && (
 <span style={{ fontSize: 10, color: C.red, fontFamily: C.font, fontWeight: 700 }}>
 [{t.unread} NEW]
 </span>
 )}
 </button>
 );
 })}
 </div>
 )}

 {/* Active thread */}
 {dmActive ? (
 <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: "hidden", display: "flex", flexDirection: "column" }}>
 <div style={{ ...sectionHead, justifyContent: "space-between" }}>
 <span style={{ color: "var(--weered-accent-text)" }}>// @{dmActive.peerName}</span>
 <button
 onClick={() => { setDmThreads(cur => cur.filter(t => t.peerId !== dmActive.peerId)); setDmActivePeerId(""); }}
 style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: C.font, fontSize: 10, padding: 0 }}
 >
 [CLOSE]
 </button>
 </div>

 <div style={{ height: 230, overflow: "auto", padding: "8px 10px", background: "rgba(0,0,0,.3)" }}>
 {dmLoading ? (
 <div style={{ color: C.muted, fontSize: 11 }}>// RETRIEVING INTERCEPTS...</div>
 ) : dmActive.msgs.length ? (
 dmActive.msgs.map((m) => {
 const isMe = m.fromId === String(me?.id || "");
 return (
 <div key={m.id} style={{ marginBottom: 8, textAlign: isMe ? "right" : "left" }}>
 <div style={{
 display: "inline-block", maxWidth: "88%",
 padding: "5px 8px",
 border: `1px solid ${isMe ? "var(--weered-bd2)" : "var(--weered-bd)"}`,
 borderRadius: 2,
 background: isMe ? C.greenBg : C.amberBg,
 }}>
 <div style={{ fontFamily: C.font, fontSize: 12, color: isMe ? "var(--weered-accent-text)" : "var(--weered-text)", lineHeight: "18px" }}>
 {m.body}
 </div>
 <div style={{ fontFamily: C.font, fontSize: 10, color: C.muted, marginTop: 2 }}>
 {militaryTime(m.createdAt)}
 </div>
 </div>
 </div>
 );
 })
 ) : (
 <div style={{ color: C.muted, fontSize: 11 }}>// NO TRANSMISSIONS ON THIS CHANNEL</div>
 )}
 <div ref={dmEndRef} />
 </div>

 <div style={{ display: "flex", alignItems: "center", borderTop: `1px solid ${C.border}`, background: "rgba(0,0,0,.2)", padding: "6px 10px", gap: 6 }}>
 <span style={{ color: "var(--weered-accent-text)", fontSize: 12 }}>{">"}</span>
 <input
 ref={dmInputRef}
 value={dmDraft}
 onChange={(e) => setDmDraft((e.target as any).value || "")}
 placeholder="transmit..."
 style={termInput}
 onKeyDown={(e) => { if ((e as any).key === "Enter") { e.preventDefault(); void dmSend(); } }}
 />
 <button style={{ ...termBtn, borderRadius: 0, borderLeft: "none" }} onClick={() => void dmSend()}>SEND</button>
 </div>
 </div>
 ) : dmThreads.length === 0 ? (
 <div style={{ color: C.muted, fontSize: 11, padding: "10px 0", lineHeight: 1.6 }}>
 // NO ACTIVE CHANNELS<br />
 // OPEN A CHANNEL ABOVE TO BEGIN
 </div>
 ) : (
 <div style={{ color: C.muted, fontSize: 11, padding: "6px 0" }}>
 // SELECT A CHANNEL ABOVE
 </div>
 )}
 </>

 ) : tab === "friends" ? (
 // ── FRIENDS TAB ──
 <FriendsTab
 dmThreads={dmThreads}
 rooms={userArr}
 onMessage={(peerName: string, peerId: string) => {
 setTab("dms");
 setDmThreads((cur) => {
 const existing = cur.find(t => t.peerId === peerId || t.peerName.toLowerCase() === peerName.toLowerCase());
 if (existing) { setDmActivePeerId(existing.peerId); return cur; }
 const th: DmThread = { peerId, peerName, msgs: [], unread: 0 };
 setDmActivePeerId(peerId);
 return [th, ...cur];
 });
 }}
 onJoin={(roomId: string) => {
 try { (ctx as any)?.join?.(roomId); } catch {}
 }}
 />
 ) : null}
 </div>
 </div>
 );
}

// ── Friends Tab ───────────────────────────────────────────────────────────────
function FriendsTab({
 dmThreads, rooms, onMessage, onJoin,
}: {
 dmThreads: DmThread[];
 rooms: any[];
 onMessage: (peerName: string, peerId: string) => void;
 onJoin: (roomId: string) => void;
}) {
 const friends = dmThreads.map((t) => {
 const online = rooms.find((u: any) =>
 String(u?.name ?? u?.username ?? "").toLowerCase() === t.peerName.toLowerCase() ||
 (t.peerId && String(u?.id ?? "") === t.peerId)
 );
 return { thread: t, online: online ?? null };
 });

 const onlineFriends = friends.filter((f) => f.online);
 const offlineFriends = friends.filter((f) => !f.online);

 const sectionHead: React.CSSProperties = {
 fontSize: 10, fontWeight: 700, letterSpacing: 2,
 color: C.muted, textTransform: "uppercase" as const,
 marginBottom: 6, fontFamily: C.font,
 };

 const renderFriend = (f: { thread: DmThread; online: any }) => {
 const { thread, online } = f;
 const roomId = String(online?.roomId ?? online?.activeRoom ?? online?.room ?? "");
 const roomName = String(online?.roomName ?? online?.room ?? roomId ?? "");
 return (
 <div key={thread.peerId} style={{
 display: "flex", alignItems: "center", gap: 8,
 padding: "8px 10px", marginBottom: 4,
 border: `1px solid ${online ? C.border2 : C.border}`,
 borderRadius: 2,
 background: online ? C.greenBg : "transparent",
 }}>
 <div style={{
 width: 28, height: 28, borderRadius: 2,
 background: online ? "rgba(0,255,65,.12)" : "rgba(255,255,255,.04)",
 border: `1px solid ${online ? C.green : C.muted}`,
 display: "flex", alignItems: "center", justifyContent: "center",
 fontSize: 12, fontWeight: 800, flexShrink: 0,
 color: online ? C.green : C.muted, fontFamily: C.font,
 }}>
 {thread.peerName.slice(0, 1).toUpperCase()}
 </div>
 <div style={{ flex: 1, minWidth: 0 }}>
 <div style={{ fontWeight: 800, fontSize: 12, fontFamily: C.font, color: online ? "var(--weered-text)" : C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 @{thread.peerName}
 </div>
 <div style={{ fontSize: 10, color: C.muted, fontFamily: C.font, marginTop: 1 }}>
 {online ? (roomName ? `LOC: ${roomName}` : "ACTIVE") : "DARK"}
 </div>
 </div>
 <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
 <button
 style={{ padding: "4px 8px", borderRadius: 2, border: `1px solid ${C.border2}`, background: C.greenBg, color: C.green, fontFamily: C.font, fontSize: 10, cursor: "pointer", fontWeight: 700 }}
 onClick={() => onMessage(thread.peerName, thread.peerId ?? "")}
 >
 COMM
 </button>
 {online && roomId && (
 <button
 style={{ padding: "4px 8px", borderRadius: 2, border: "1px solid rgba(255,179,0,.3)", background: C.amberBg, color: C.amber, fontFamily: C.font, fontSize: 10, cursor: "pointer", fontWeight: 700 }}
 onClick={() => onJoin(roomId)}
 >
 JOIN
 </button>
 )}
 </div>
 </div>
 );
 };

 if (friends.length === 0) {
 return (
 <div style={{ color: C.muted, fontSize: 11, fontFamily: C.font, lineHeight: 1.6 }}>
 // NO KNOWN ASSOCIATES<br />
 // MESSAGE SOMEONE FROM PRESENCE TO ADD THEM
 </div>
 );
 }

 return (
 <div style={{ display: "flex", flexDirection: "column" }}>
 {onlineFriends.length > 0 && (
 <>
 <div style={sectionHead}>// ACTIVE · {onlineFriends.length}</div>
 {onlineFriends.map(renderFriend)}
 </>
 )}
 {offlineFriends.length > 0 && (
 <>
 <div style={{ ...sectionHead, marginTop: 12 }}>// DARK · {offlineFriends.length}</div>
 {offlineFriends.map(renderFriend)}
 </>
 )}
 </div>
 );
}
