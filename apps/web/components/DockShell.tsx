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
 accentBg: "rgba(14,165,233,.18)", // sky
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
 accentBg: "rgba(34,197,94,.16)", // green
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
 accentBg: "rgba(245,158,11,.16)", // amber
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
 accentBg: "rgba(20,184,166,.16)", // teal
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
 try {
 return atob(String(input || ""));
 } catch {
 return "";
 }
 }
}

function decodeJwtClaims(token?: string | null): any {
 try {
 const t = String(token || "");
 const parts = t.split(".");
 if (parts.length !== 3) return null;
 const json = b64UrlDecode(parts[1]);
 return json ? JSON.parse(json) : null;
 } catch {
 return null;
 }
}

function normRole(v: any): string {
 const s = String(v || "").trim();
 return s ? s.toUpperCase() : "";
}

function globalIcon(role: string): string {
 const r = normRole(role);
  if (r === "GOD") return "⚡";
  if (r === "ADMIN") return "🛡️";
  if (r === "STAFF") return "⭐";
  if (r === "MOD") return "🔧";
 if (r === "VIP") return "⭐";
 return "⭐";
}

function Pill(props: { label: string; title?: string; tone?: "violet" | "slate" | "green" | "amber" | "red" }) {
 const tone = props.tone || "slate";
 const bg =
 tone === "violet"
 ? "var(--weered-accent-bg, rgba(14,165,233,.18))"
 : tone === "green"
 ? "rgba(16,185,129,.16)"
 : tone === "amber"
 ? "rgba(245,158,11,.16)"
 : tone === "red"
 ? "rgba(239,68,68,.16)"
 : "rgba(148,163,184,.14)";
 const bd =
 tone === "violet"
 ? "var(--weered-accent-ring, rgba(14,165,233,.35))"
 : tone === "green"
 ? "rgba(16,185,129,.35)"
 : tone === "amber"
 ? "rgba(245,158,11,.35)"
 : tone === "red"
 ? "rgba(239,68,68,.35)"
 : "rgba(148,163,184,.22)";

 return (
 <span
 title={props.title || props.label}
 style={{
 display: "inline-flex",
 alignItems: "center",
 gap: 6,
 padding: "2px 8px",
 borderRadius: 999,
 border: `1px solid ${bd}`,
 background: bg,
 color: "var(--weered-text)",
 fontSize: 11,
 lineHeight: "16px",
 fontWeight: 800,
 whiteSpace: "nowrap",
 }}
 >
 {props.label}
 </span>
 );
}

export default function DockShell(props: { forceMode?: "rail" | "floating" } = {}) {
 const ctx: any = (useWeered?.() as any) || {};

 const {
 me,
 authed,
 wsReady,
 wsState,
 activeRoomId,
 joinedRoomId,
 users,
 msgs,
 meta,
 admin,
 role,
 joinStatus,
 sendChat,
 logout,
 renameRoom,
 lockRoom,
 unlockRoom,
 knock,
 admit,
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
 try {
 localStorage.setItem(WEERED_THEME_KEY, theme);
 } catch {}
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
 if (mode === "rail") setOpen(true); // rail mode should not be "closed"
 };
 apply();

 try {
 mq.addEventListener("change", apply);
 return () => mq.removeEventListener("change", apply);
 } catch {
 // Safari fallback
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
 pickFirstString(
 ctx?.token,
 ctx?.authToken,
 ctx?.jwt,
 ctx?.auth?.token,
 ctx?.session?.token,
 me?.token,
 me?.jwt
 ) ||
 pickFirstString(
 localStorage.getItem("weered_token"),
 localStorage.getItem("token"),
 localStorage.getItem("auth_token"),
 localStorage.getItem("jwt"),
 localStorage.getItem("weered.jwt"),
 localStorage.getItem("weered.auth")
 )
 );
 }, [ctx, me]);

 const claims = useMemo(() => decodeJwtClaims(tokenMaybe), [tokenMaybe]);

 const globalRole = useMemo(() => {
 const gr = pickFirstString(
 me?.globalRole,
 me?.global_role,
 me?.user?.globalRole,
 me?.user?.global_role,
 claims?.globalRole,
 claims?.global_role,
 claims?.gr
 );
 return normRole(gr);
 }, [me, claims]);

 const meName = pickFirstString(me?.name, me?.username, "Guest");
 const roomTitle = pickFirstString(meta?.name, viewId, "Room");
const roomRole = normRole(pickFirstString(role, joinStatus?.role));

 // ---- DM state (API-backed)
 const [dmThreads, setDmThreads] = useState<DmThread[]>([]);
 const [dmActivePeerId, setDmActivePeerId] = useState<string>("");
 const [dmPeer, setDmPeer] = useState("");
 const [dmDraft, setDmDraft] = useState("");
 const [dmLoading, setDmLoading] = useState(false);
 const dmEndRef = useRef<HTMLDivElement | null>(null);
 const dmInputRef = useRef<HTMLInputElement | null>(null);
 const roomInputRef = useRef<HTMLInputElement | null>(null);

 const apiBase = pickFirstString(ctx?.apiBase, (ctx as any)?.api, "") || "";

 // Fetch unread counts on mount and when tab changes to dms
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

 // Load thread history when active peer changes
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

 // WS listener for incoming DMs
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
       return [{ peerId, peerName: peerId, msgs: [msg], unread: dmActivePeerId === peerId ? 0 : 1 }, ...cur];
     });
   };
   window.addEventListener("weered:dm:message", handler as any);
   return () => window.removeEventListener("weered:dm:message", handler as any);
 }, [me, dmActivePeerId]);

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

 // ---- DM intent from UI (Presence "Message" button / other callers)
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
   // Resolve via API to get real ID + name
   try {
     const r = await fetch(`${apiBase}/profile/${encodeURIComponent(peer)}`, {
       headers: tokenMaybe ? { Authorization: `Bearer ${tokenMaybe}` } : {},
     });
     const j = await r.json();
     const resolvedId   = j?.id   || peer;
     const resolvedName = j?.name || peer;
     const th: DmThread = { peerId: resolvedId, peerName: resolvedName, msgs: [], unread: 0 };
     setDmThreads(cur => [th, ...cur]);
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
   // Optimistic add
   const optimistic: DmMsg = { id: __id(), fromId: meId, toId: dmActive.peerId, body, createdAt: new Date().toISOString(), readAt: null };
   setDmThreads(cur => cur.map(t => t.peerId === dmActive.peerId ? { ...t, msgs: [...t.msgs, optimistic] } : t));
   try {
     // Try WS first via ctx.sendRaw, fall back to REST
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

const panel: React.CSSProperties =
  embedded
    ? {
        position: "relative",
        width: "100%",
        height: "100%",
        background: "transparent",
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
        backdropFilter: "none",
        overflow: "hidden",
        zIndex: 1,
        color: "var(--weered-text)",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      }
    : dockMode === "rail"
      ? {
          position: "sticky",
          top: 16,
          width: "100%",
          maxWidth: "100%",
          height: "calc(100vh - 32px)",
          background: "var(--weered-panel2)",
          border: "1px solid var(--weered-bd2)",
          borderRadius: 16,
          boxShadow: "0 16px 60px rgba(0,0,0,.45)",
          backdropFilter: "blur(10px)",
          overflow: "hidden",
          zIndex: 40,
          color: "var(--weered-text)",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          maxHeight: "calc(100vh - 32px)",
        }
      : {
          position: "fixed",
          right: 14,
          top: 88,
          width: 320,
          maxWidth: "92vw",
          height: "calc(100vh - 110px)",
          background: "var(--weered-panel2)",
          border: "1px solid var(--weered-bd2)",
          borderRadius: 16,
          boxShadow: "0 16px 60px rgba(0,0,0,.45)",
          backdropFilter: "blur(10px)",
          overflow: "hidden",
          zIndex: 9999,
          color: "var(--weered-text)",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          maxHeight: "calc(100vh - 24px)",
        };

 const btn: React.CSSProperties = {
 padding: "6px 10px",
 borderRadius: 10,
 border: "1px solid var(--weered-bd2)",
 background: "rgba(255,255,255,.06)",
 color: "var(--weered-text)",
 cursor: "pointer",
 fontWeight: 800,
 fontSize: 12,
 };

 const btnActive: React.CSSProperties = {
 ...btn,
 border: "1px solid var(--weered-accent-ring)",
 background: "var(--weered-accent-bg)",
 };

 if (!open) {
 return props.forceMode ? null : (
 <button
 onClick={() => setOpen(true)}
 style={{
 position: "fixed",
 right: 14,
 top: 88,
 zIndex: 9999,
 padding: "8px 12px",
 borderRadius: 999,
 border: "1px solid var(--weered-accent-ring)",
 background: "var(--weered-accent-bg)",
 color: "var(--weered-text)",
 fontWeight: 950,
 cursor: "pointer",
 }}
 >
 Dock
 </button>
 );
 }

 const userArr: any[] = Array.isArray(users) ? users : [];
 const msgArr: any[] = Array.isArray(msgs) ? msgs : [];

 return (
 <div style={panel}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid var(--weered-bd)" }}>
 <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
 <div style={{ fontWeight: 950, letterSpacing: ".2px", display: "none" }}>Dock</div>
 {globalRole ? <Pill tone="violet" label={`global: ${globalIcon(globalRole)} ${globalRole}`} /> : null}
 </div>
 <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
 <button style={tab === "room" ? btnActive : btn} onClick={() => setTab("room")}>Room</button>
 <button style={tab === "dms" ? btnActive : btn} onClick={() => setTab("dms")}>
   DMs{totalUnread > 0 ? ` (${totalUnread})` : ""}
 </button>
 <button style={tab === "friends" ? btnActive : btn} onClick={() => setTab("friends")}>Friends</button>
 <button style={btn} onClick={() => { try { window.dispatchEvent(new CustomEvent("weered:dock:close")); } catch {} }}>Close</button>
 </div>
 </div>

 <div style={{ padding: "12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
  {/* User header */}
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <span style={{
        width: 10, height: 10, borderRadius: 999,
        background: wsUp ? "rgba(34,197,94,.95)" : "rgba(239,68,68,.95)",
        boxShadow: wsUp ? "0 0 0 3px rgba(34,197,94,.18)" : "0 0 0 3px rgba(239,68,68,.18)"
      }} />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ fontWeight: 950, letterSpacing: ".2px", color: "var(--weered-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {meName}
        </div>
        <div style={{ fontSize: 12, opacity: 0.78, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {roomTitle}
        </div>
      </div>
    </div>
    {typeof logout === "function" ? <button style={btn} onClick={() => call(logout)}>Logout</button> : null}
  </div>

  {/* Roles / badges + theme */}
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
    <Pill tone={wsUp ? "green" : "red"} label={wsUp ? "online" : "offline"} />
    {roomRole ? <Pill tone="slate" label={`role: ${globalIcon(roomRole)} ${roomRole}`} /> : <Pill tone="slate" label="role: member" />}
    {globalRole ? <Pill tone="violet" label={`global: ${globalIcon(globalRole)} ${globalRole}`} /> : null}

    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 6 }}>
      <span style={{ fontSize: 11, opacity: 0.75 }}>Theme:</span>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as any)}
        style={{
          background: "rgba(255,255,255,.06)",
          color: "var(--weered-text)",
          border: "1px solid var(--weered-bd)",
          borderRadius: 10,
          padding: "4px 8px",
          fontSize: 12,
          outline: "none",
        }}
      >
        <option value="slate">Slate</option>
        <option value="zinc">Zinc</option>
        <option value="stone">Stone</option>
        <option value="gray">Gray</option>
      </select>
    </span>
  </div>

 {tab === "room" ? (
 <>
 {needJoin ? (
 <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
 <Pill tone="amber" label="chat disabled until joined/admitted" />
 {typeof knock === "function" ? <button style={btn} onClick={() => call(knock, viewId)}>Knock</button> : null}
 {typeof admit === "function" ? <button style={btn} onClick={() => call(admit, viewId, me?.id)}>Join</button> : null}
 </div>
 ) : null}

 <div style={{ border: "1px solid var(--weered-bd)", borderRadius: 14, overflow: "hidden" }}>
 <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--weered-bd)", fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
 Room chat (dock mirror)
 </div>
 <div style={{ padding: 10, height: 190, overflow: "auto" }}>
 {msgArr.length ? (
 msgArr.slice(-80).map((m: any, i: number) => {
 const who = pickFirstString(m?.user?.name, m?.name, m?.from, "someone");
const body = pickFirstString(m?.body, m?.text, "");
 return (
 <div key={m?.id || i} style={{ marginBottom: 8 }}>
 <div style={{ fontSize: 11, opacity: 0.7 }}>{who}</div>
 <div style={{ fontSize: 13, lineHeight: "18px" }}>{body}</div>
 </div>
 );
 })
 ) : (
 <div style={{ opacity: 0.6, fontSize: 12 }}>No messages yet.</div>
 )}
 </div>
 <div style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid rgba(148,163,184,.12)" }}>
 <input
 value={text}
 onChange={(e) => setText((e.target as any).value || "")}
 placeholder="Message"
 style={{
 flex: 1,
 padding: "10px 12px",
 borderRadius: 12,
 border: "1px solid var(--weered-bd2)",
 background: "rgba(255,255,255,.06)",
 color: "var(--weered-text)",
 outline: "none",
 }}
 onKeyDown={(e) => {
 if ((e as any).key === "Enter") {
 sendRoomChat(text);
 setText("");
 }
 }}
 />
 <button
 style={btn}
 onClick={() => {
 sendRoomChat(text);
 setText("");
 }}
 >
 Send
 </button>
 </div>
 </div>

 <div style={{ border: "1px solid var(--weered-bd)", borderRadius: 14, overflow: "hidden" }}>
 <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--weered-bd)", fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
 Presence ({userArr.length})
 </div>
 <div style={{ maxHeight: 200, overflow: "auto" }}>
 {userArr.length ? (
 userArr.map((u: any) => {
 const uname = pickFirstString(u?.name, u?.username, "someone");
 const ugr = normRole(pickFirstString(u?.globalRole, u?.global_role, u?.user?.globalRole, u?.user?.global_role));
 const ur = normRole(pickFirstString(u?.role, u?.roomRole, u?.room_role));
 const isMe = !!me?.id && u?.id === me?.id;
 return (
 <div key={u?.id || uname} style={{ padding: "10px 10px", borderBottom: "1px solid rgba(148,163,184,.08)" }}>
 <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
 <span style={{ fontWeight: 900 }}>{uname}{isMe ? " (you)" : ""}</span>
 {ugr ? <Pill tone="violet" label={`${globalIcon(ugr)} ${ugr}`} /> : null}
 {ur ? <Pill tone="slate" label={`room: ${ur}`} /> : null}
 </div>
 </div>
 );
 })
 ) : (
 <div style={{ padding: 10, opacity: 0.6, fontSize: 12 }}>No users yet.</div>
 )}
 </div>
 </div>

 {(admin || roomRole === "OWNER" || roomRole === "MOD") ? (
 <div style={{ border: "1px solid var(--weered-bd)", borderRadius: 14, overflow: "hidden" }}>
 <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--weered-bd)", fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
 Mod tools (light)
 </div>
 <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
 <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
 {typeof lockRoom === "function" ? <button style={btn} onClick={() => call(lockRoom, viewId)}>Lock</button> : null}
 {typeof unlockRoom === "function" ? <button style={btn} onClick={() => call(unlockRoom, viewId)}>Unlock</button> : null}
 {typeof renameRoom === "function" ? (
 <button
 style={btn}
 onClick={() => {
 const next = prompt("New room name?");
 if (next) call(renameRoom, viewId, next);
 }}
 >
 Rename
 </button>
 ) : null}
 </div>
 </div>
 </div>
 ) : null}
 </>
 ) : tab === "dms" ? (
 <div style={{ border: "1px solid var(--weered-bd)", borderRadius: 14, overflow: "hidden" }}>
   <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--weered-bd)", fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
     Messages {totalUnread > 0 && <span style={{ marginLeft: 4, padding: "1px 7px", borderRadius: 999, background: "rgba(239,68,68,.18)", border: "1px solid rgba(239,68,68,.3)", color: "#fca5a5", fontSize: 10 }}>{totalUnread}</span>}
   </div>

   <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
     {/* New thread input */}
     <div style={{ display: "flex", gap: 6 }}>
       <input
         value={dmPeer}
         onChange={(e) => setDmPeer((e.target as any).value || "")}
         placeholder="Username or ID..."
         style={{ flex: 1, padding: "8px 10px", borderRadius: 12, border: "1px solid var(--weered-bd2)", background: "rgba(255,255,255,.06)", color: "var(--weered-text)", outline: "none", fontSize: 12 }}
         onKeyDown={(e) => { if ((e as any).key === "Enter") dmCreateThread(); }}
       />
       <button style={btn} onClick={dmCreateThread}>+</button>
     </div>

     {/* Thread list */}
     <div style={{ border: "1px solid rgba(148,163,184,.12)", borderRadius: 12, overflow: "hidden" }}>
       {dmThreads.length ? dmThreads.map((t) => {
         const active = t.peerId === dmActivePeerId;
         return (
           <button key={t.peerId} onClick={() => setDmActivePeerId(t.peerId)} style={{
             width: "100%", textAlign: "left", padding: "10px 10px",
             border: "0", borderBottom: "1px solid rgba(148,163,184,.08)",
             background: active ? "var(--weered-accent-bg)" : "transparent",
             color: "var(--weered-text)", cursor: "pointer", fontWeight: 900, fontSize: 12,
             display: "flex", alignItems: "center", justifyContent: "space-between",
           }}>
             <div>
               <div>@{t.peerName}</div>
               <div style={{ opacity: 0.5, fontWeight: 700, fontSize: 11, marginTop: 2 }}>{t.msgs.length} msg</div>
             </div>
             {t.unread > 0 && (
               <span style={{ padding: "1px 7px", borderRadius: 999, background: "rgba(239,68,68,.2)", border: "1px solid rgba(239,68,68,.35)", color: "#fca5a5", fontSize: 10, fontWeight: 900 }}>{t.unread}</span>
             )}
           </button>
         );
       }) : (
         <div style={{ padding: 10, opacity: 0.6, fontSize: 12 }}>No threads yet.</div>
       )}
     </div>

     {/* Active thread */}
     {dmActive ? (
       <>
         <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
           <div style={{ fontWeight: 950 }}>@{dmActive.peerName}</div>
           <button style={btn} onClick={() => { setDmThreads(cur => cur.filter(t => t.peerId !== dmActive.peerId)); setDmActivePeerId(""); }}>Delete</button>
         </div>

         <div style={{ height: 230, overflow: "auto", padding: 10, borderRadius: 12, border: "1px solid rgba(148,163,184,.12)" }}>
           {dmLoading ? (
             <div style={{ opacity: 0.5, fontSize: 12 }}>Loading...</div>
           ) : dmActive.msgs.length ? (
             dmActive.msgs.map((m) => {
               const isMe = m.fromId === String(me?.id || "");
               return (
                 <div key={m.id} style={{ marginBottom: 10, display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                   <div style={{ maxWidth: "85%", padding: "8px 10px", borderRadius: 12, border: "1px solid var(--weered-bd)", background: isMe ? "var(--weered-accent-bg)" : "rgba(255,255,255,.06)" }}>
                     <div style={{ fontSize: 13, lineHeight: "18px" }}>{m.body}</div>
                     <div style={{ opacity: 0.5, fontSize: 11, marginTop: 4 }}>{new Date(m.createdAt).toLocaleTimeString()}</div>
                   </div>
                 </div>
               );
             })
           ) : (
             <div style={{ opacity: 0.6, fontSize: 12 }}>No messages yet.</div>
           )}
           <div ref={dmEndRef} />
         </div>

         <div style={{ display: "flex", gap: 8 }}>
           <input
             ref={dmInputRef}
             value={dmDraft}
             onChange={(e) => setDmDraft((e.target as any).value || "")}
             placeholder="Message..."
             style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--weered-bd2)", background: "rgba(255,255,255,.06)", color: "var(--weered-text)", outline: "none" }}
             onKeyDown={(e) => { if ((e as any).key === "Enter") { e.preventDefault(); void dmSend(); } }}
           />
           <button style={btn} onClick={() => void dmSend()}>Send</button>
         </div>
       </>
     ) : (
       <div style={{ opacity: 0.7, fontSize: 12, lineHeight: 1.35 }}>Select a thread or start a new one above.</div>
     )}
   </div>
 </div>
 ) : tab === "friends" ? (
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

  const onlineFriends  = friends.filter((f) => f.online);
  const offlineFriends = friends.filter((f) => !f.online);

  const friendBtn: React.CSSProperties = {
    padding: "6px 10px", borderRadius: 9,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.05)",
    fontSize: 11, cursor: "pointer",
    color: "rgba(243,244,246,.85)", fontWeight: 700,
  };

  const renderFriend = (f: { thread: DmThread; online: any }) => {
    const { thread, online } = f;
    const roomId = String(online?.roomId ?? online?.activeRoom ?? online?.room ?? "");
    const roomName = String(online?.roomName ?? online?.room ?? roomId ?? "");
    return (
      <div key={thread.peerId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 11, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.03)", marginBottom: 5 }}>
        <div style={{ width: 32, height: 32, borderRadius: 999, background: online ? "rgba(16,185,129,.18)" : "rgba(255,255,255,.06)", border: `1px solid ${online ? "rgba(16,185,129,.30)" : "rgba(255,255,255,.10)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
          {thread.peerName.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{thread.peerName}</div>
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 1 }}>{online ? (roomName ? `in ${roomName}` : "online") : "offline"}</div>
        </div>
        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          <button style={friendBtn} onClick={() => onMessage(thread.peerName, thread.peerId ?? "")}>DM</button>
          {online && roomId && (
            <button style={{ ...friendBtn, borderColor: "rgba(124,58,237,.30)", background: "rgba(124,58,237,.12)", color: "rgb(216,180,254)" }} onClick={() => onJoin(roomId)}>Join</button>
          )}
        </div>
      </div>
    );
  };

  if (friends.length === 0) {
    return <div style={{ padding: "20px 10px", fontSize: 13, opacity: 0.5, textAlign: "center" }}>No friends yet. Message someone from the Presence panel to start a thread.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {onlineFriends.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".6px", textTransform: "uppercase" as const, marginBottom: 4 }}>Online · {onlineFriends.length}</div>
          {onlineFriends.map(renderFriend)}
        </>
      )}
      {offlineFriends.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".6px", textTransform: "uppercase" as const, margin: "10px 0 4px" }}>Offline · {offlineFriends.length}</div>
          {offlineFriends.map(renderFriend)}
        </>
      )}
    </div>
  );
}

