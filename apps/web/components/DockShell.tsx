"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWeered } from "./WeeredProvider";

type DmMsg = { id: string; at: number; from: "me" | "them"; body: string };
type DmThread = { id: string; peer: string; peerId?: string; msgs: DmMsg[] };

const DM_KEY = "weered_dm_threads_v0";

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
 const [tab, setTab] = useState<"room" | "dms">("room");
 const [text, setText] = useState("");

 const [dockMode, setDockMode] = useState<"rail" | "floating">(props.forceMode || "floating");

 const [theme, setTheme] = useState<WeeredThemeName>(() => {
 try {
 const v = String(localStorage.getItem(WEERED_THEME_KEY) || "").trim();
 if (v === "slate" || v === "zinc" || v === "stone" || v === "gray") return v;
 } catch {}
 return "slate";
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

 // ---- DM state (local-only v0)
 const [dmThreads, setDmThreads] = useState<DmThread[]>([]);
 const [dmActiveId, setDmActiveId] = useState<string>("");
 const [dmPeer, setDmPeer] = useState("");
 const [dmDraft, setDmDraft] = useState("");
 const dmEndRef = useRef<HTMLDivElement | null>(null);


 const dmInputRef = useRef<HTMLInputElement | null>(null);
 const roomInputRef = useRef<HTMLInputElement | null>(null);
 useEffect(() => {
 if (typeof window === "undefined") return;
 try {
 const raw = localStorage.getItem(DM_KEY) || "[]";
 const arr = JSON.parse(raw);
 if (Array.isArray(arr)) setDmThreads(arr);
 } catch {}
 }, []);

 useEffect(() => {
 if (typeof window === "undefined") return;
 try {
 localStorage.setItem(DM_KEY, JSON.stringify(dmThreads || []));
 } catch {}
 }, [dmThreads]);

 useEffect(() => {
 try { dmEndRef.current?.scrollIntoView({ behavior: "smooth" }); } catch {}
 }, [dmActiveId, dmThreads]);

 
 // Focus after the dock finishes opening (most reliable post-mount)
 useEffect(() => {
 if (typeof window === "undefined") return;

 const focusNow = () => {
 try {
 // Next tick to ensure the drawer + inputs are mounted
 setTimeout(() => {
 try {
 if (tab === "dms") dmInputRef.current?.focus();
 else roomInputRef.current?.focus();
 } catch {}
 }, 0);
 } catch {}
 };

 const onOpened = () => focusNow();
 window.addEventListener("weered:dock:opened", onOpened as any);
 return () => window.removeEventListener("weered:dock:opened", onOpened as any);
 }, [tab, dmActiveId]);
const dmActive = useMemo(() => dmThreads.find((t) => t.id === dmActiveId) || null, [dmThreads, dmActiveId]);

 // ---- DM intent from UI (Presence "Message" button / other callers)
 useEffect(() => {
 if (typeof window === "undefined") return;

 const onDockOpen = (ev: any) => {
 const detail = ev?.detail || null;
 if (!detail || detail.mode !== "dm") return;

 const peerName = pickFirstString(detail?.peer?.name, detail?.peerName, detail?.peer, "");
 const peerId = pickFirstString(detail?.peer?.id, detail?.peerId, "");

 if (!peerName) return;

 // switch to DM tab
 setTab("dms");

 // create/select thread
 setDmThreads((cur) => {
 const arr = Array.isArray(cur) ? cur : [];
 const existing = arr.find((t) => String(t.peer || "").toLowerCase() === String(peerName).toLowerCase());

 if (existing) {
 setDmActiveId(existing.id);
 return arr;
 }

 const th: DmThread = { id: __id(), peer: peerName, peerId: peerId || undefined, msgs: [] };
 const next = [th, ...arr];
 setDmActiveId(th.id);
 return next;
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

 function dmCreateThread() {
 const peer = dmPeer.trim();
 if (!peer) return;
 const existing = dmThreads.find((t) => t.peer.toLowerCase() === peer.toLowerCase());
 if (existing) { setDmActiveId(existing.id); setDmPeer(""); return; }
 const t: DmThread = { id: __id(), peer, msgs: [] };
 const next = [t, ...(dmThreads || [])];
 setDmThreads(next);
 setDmActiveId(t.id);
 setDmPeer("");
 }

 function dmSend() {
 if (!dmActive) return;
 const b = dmDraft.trim();
 if (!b) return;
 const m: DmMsg = { id: __id(), at: Date.now(), from: "me", body: b };
 const next = dmThreads.map((t) => (t.id === dmActive.id ? { ...t, msgs: [...(t.msgs || []), m] } : t));
 setDmThreads(next);
 setDmDraft("");
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
 <button style={tab === "dms" ? btnActive : btn} onClick={() => setTab("dms")}>DMs</button>
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
 ) : (
 <div style={{ border: "1px solid var(--weered-bd)", borderRadius: 14, overflow: "hidden" }}>
 <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--weered-bd)", fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
 Private messages (local-only v0)
 </div>

 <div style={{ padding: 10, display: "grid", gap: 10, gridTemplateColumns: "1fr" }}>
 <div style={{ width: "100%" }}>
 <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
 <input
 value={dmPeer}
 onChange={(e) => setDmPeer((e.target as any).value || "")}
 placeholder="Username"
 style={{
 flex: 1,
 padding: "8px 10px",
 borderRadius: 12,
 border: "1px solid var(--weered-bd2)",
 background: "rgba(255,255,255,.06)",
 color: "var(--weered-text)",
 outline: "none",
 fontSize: 12,
 }}
 onKeyDown={(e) => { if ((e as any).key === "Enter") dmCreateThread(); }}
 />
 <button style={btn} onClick={dmCreateThread}>+</button>
 </div>

 <div style={{ border: "1px solid rgba(148,163,184,.12)", borderRadius: 12, overflow: "hidden" }}>
 {(dmThreads || []).length ? (
 (dmThreads || []).map((t) => {
 const active = t.id === dmActiveId;
 return (
 <button
 key={t.id}
 onClick={() => setDmActiveId(t.id)}
 style={{
 width: "100%",
 textAlign: "left",
 padding: "10px 10px",
 border: "0",
 borderBottom: "1px solid rgba(148,163,184,.08)",
 background: active ? "var(--weered-accent-bg, rgba(14,165,233,.18))" : "transparent",
 color: "var(--weered-text)",
 cursor: "pointer",
 fontWeight: 900,
 fontSize: 12,
 }}
 >
 @{t.peer}
 <div style={{ opacity: 0.6, fontWeight: 700, fontSize: 11, marginTop: 2 }}>
 {(t.msgs || []).length} msg
 </div>
 </button>
 );
 })
 ) : (
 <div style={{ padding: 10, opacity: 0.6, fontSize: 12 }}>No threads yet.</div>
 )}
 </div>
 </div>

 <div style={{ flex: 1, minWidth: 0 }}>
 {dmActive ? (
 <>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
 <div style={{ fontWeight: 950 }}>@{dmActive.peer}</div>
 <button
 style={btn}
 onClick={() => {
 const next = (dmThreads || []).filter((t) => t.id !== dmActive.id);
 setDmThreads(next);
 setDmActiveId(next[0]?.id || "");
 }}
 >
 Delete
 </button>
 </div>

 <div style={{ height: 230, overflow: "auto", padding: 10, borderRadius: 12, border: "1px solid rgba(148,163,184,.12)" }}>
 {(dmActive.msgs || []).length ? (
 dmActive.msgs.map((m) => (
 <div key={m.id} style={{ marginBottom: 10, display: "flex", justifyContent: m.from === "me" ? "flex-end" : "flex-start" }}>
 <div
 style={{
 maxWidth: "85%",
 padding: "8px 10px",
 borderRadius: 12,
 border: "1px solid var(--weered-bd)",
 background: m.from === "me" ? "var(--weered-accent-bg, rgba(14,165,233,.18))" : "rgba(255,255,255,.06)",
 }}
 >
 <div style={{ fontSize: 13, lineHeight: "18px" }}>{m.body}</div>
 <div style={{ opacity: 0.6, fontSize: 11, marginTop: 4 }}>
 {new Date(m.at).toLocaleTimeString()}
 </div>
 </div>
 </div>
 ))
 ) : (
 <div style={{ opacity: 0.6, fontSize: 12 }}>No messages yet.</div>
 )}
 <div ref={dmEndRef} />
 </div>

 <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
 <input
 ref={dmInputRef}
 value={dmDraft}
 onChange={(e) => setDmDraft((e.target as any).value || "")}
 placeholder="Message..."
 style={{
 flex: 1,
 padding: "10px 12px",
 borderRadius: 12,
 border: "1px solid var(--weered-bd2)",
 background: "rgba(255,255,255,.06)",
 color: "var(--weered-text)",
 outline: "none",
 }}
 onKeyDown={(e) => { if ((e as any).key === "Enter") dmSend(); }}
 />
 <button style={btn} onClick={dmSend}>Send</button>
 </div>
 </>
 ) : (
 <div style={{ opacity: 0.7, fontSize: 12, padding: "10px 0", lineHeight: 1.35 }}>Select a thread or create one.</div>
 )}
 </div>
 </div>

 <div style={{ padding: "8px 10px", borderTop: "1px solid rgba(148,163,184,.12)", opacity: 0.65, fontSize: 12 }}>
 v0 = localStorage only. Next: wire DMs to API + WS routing.
 </div>
 </div>
 )}
 </div>
 </div>
 );
}


