"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWeered } from "./WeeredProvider";
import { avatarBg } from "../lib/avatarColor";
import CrewChatPanel from "./CrewChatPanel";

type DmMsg = { id: string; fromId: string; toId: string; body: string; createdAt: string; readAt?: string | null };
type DmThread = { peerId: string; peerName: string; msgs: DmMsg[]; unread: number };

const IMG_RE = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;
const TENOR_DM_RE = /https?:\/\/media\.tenor\.com\/[^\s]+/i;

function linkify(text: string): React.ReactNode {
  const urlRx = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRx);
  const nodes: React.ReactNode[] = [];
  const images: string[] = [];

  parts.forEach((p, i) => {
    if (urlRx.test(p)) {
      nodes.push(<a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: "rgb(167,139,250)", textDecoration: "underline", wordBreak: "break-all" }}>{p}</a>);
      if (IMG_RE.test(p) || TENOR_DM_RE.test(p)) images.push(p);
    } else {
      nodes.push(p);
    }
  });

  if (images.length > 0) {
    return (
      <>
        <div>{nodes}</div>
        {images.map((src, i) => (
          <img key={`dm-img-${i}`} src={src} alt="Chat image" loading="lazy" style={{
            maxWidth: 200, maxHeight: 160, borderRadius: 8, marginTop: 4,
            border: "1px solid rgba(255,255,255,.1)", display: "block",
          }} onError={e => (e.currentTarget.style.display = "none")} />
        ))}
      </>
    );
  }

  return <>{nodes}</>;
}

const WEERED_THEME_KEY = "weered_theme_v2";
type WeeredThemeName = "slate" | "zinc" | "stone" | "gray" | "ishimura" | "broadcast" | "press";

const WEERED_THEMES: Record<WeeredThemeName, any> = {
  slate: { bg:"rgb(2,6,23)", panel:"rgba(15,23,42,.92)", panel2:"rgba(17,24,39,.94)", bd:"rgba(148,163,184,.14)", bd2:"rgba(148,163,184,.26)", text:"rgba(229,231,235,.96)", muted:"rgba(148,163,184,.75)", accentBg:"rgba(14,165,233,.18)", accentRing:"rgba(14,165,233,.35)", accentText:"rgba(56,189,248,.95)" },
  zinc:  { bg:"rgb(9,9,11)", panel:"rgba(24,24,27,.92)", panel2:"rgba(24,24,27,.94)", bd:"rgba(161,161,170,.18)", bd2:"rgba(161,161,170,.28)", text:"rgba(244,244,245,.96)", muted:"rgba(161,161,170,.78)", accentBg:"rgba(34,197,94,.16)", accentRing:"rgba(34,197,94,.34)", accentText:"rgba(74,222,128,.95)" },
  stone: { bg:"rgb(12,10,9)", panel:"rgba(28,25,23,.92)", panel2:"rgba(28,25,23,.94)", bd:"rgba(168,162,158,.18)", bd2:"rgba(168,162,158,.28)", text:"rgba(245,245,244,.96)", muted:"rgba(168,162,158,.78)", accentBg:"rgba(245,158,11,.16)", accentRing:"rgba(245,158,11,.34)", accentText:"rgba(251,191,36,.95)" },
  gray:  { bg:"rgb(3,7,18)", panel:"rgba(17,24,39,.92)", panel2:"rgba(17,24,39,.94)", bd:"rgba(156,163,175,.18)", bd2:"rgba(156,163,175,.28)", text:"rgba(243,244,246,.96)", muted:"rgba(156,163,175,.78)", accentBg:"rgba(20,184,166,.16)", accentRing:"rgba(20,184,166,.34)", accentText:"rgba(45,212,191,.95)" },
  ishimura: { bg:"rgb(10,8,6)", panel:"rgba(14,12,10,.94)", panel2:"rgba(10,8,6,.95)", bd:"rgba(212,146,10,.18)", bd2:"rgba(212,146,10,.28)", text:"rgba(243,234,220,.96)", muted:"rgba(180,165,140,.72)", accentBg:"rgba(212,146,10,.14)", accentRing:"rgba(212,146,10,.30)", accentText:"rgba(212,146,10,.95)" },
  broadcast: { bg:"rgb(14,14,16)", panel:"rgba(20,20,22,.95)", panel2:"rgba(14,14,16,.96)", bd:"rgba(232,168,60,.18)", bd2:"rgba(232,168,60,.32)", text:"rgba(240,234,216,.96)", muted:"rgba(200,190,170,.65)", accentBg:"rgba(232,168,60,.14)", accentRing:"rgba(232,168,60,.35)", accentText:"rgba(240,196,120,.95)" },
  press: { bg:"rgb(26,26,28)", panel:"rgba(32,32,34,.95)", panel2:"rgba(22,22,24,.96)", bd:"rgba(217,169,66,.16)", bd2:"rgba(217,169,66,.30)", text:"rgba(240,232,214,.96)", muted:"rgba(198,188,168,.65)", accentBg:"rgba(217,169,66,.14)", accentRing:"rgba(217,169,66,.32)", accentText:"rgba(230,190,110,.95)" },
};

function applyWeeredTheme(name: WeeredThemeName) {
  if (typeof document === "undefined") return;
  const t = WEERED_THEMES[name] || WEERED_THEMES.ishimura;
  const root = document.documentElement;
  Object.entries({ "--weered-bg":t.bg,"--weered-panel":t.panel,"--weered-panel2":t.panel2,"--weered-bd":t.bd,"--weered-bd2":t.bd2,"--weered-text":t.text,"--weered-muted":t.muted,"--weered-accent-bg":t.accentBg,"--weered-accent-ring":t.accentRing,"--weered-accent-text":t.accentText }).forEach(([k,v]) => root.style.setProperty(k, v));
  root.setAttribute("data-weered-theme", name);
}

function __id() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function pickFirstString(...vals: any[]): string { for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim(); return ""; }
function normRole(v: any): string { const s = String(v||"").trim(); return s ? s.toUpperCase() : ""; }

const ROLE_DISPLAY_DOCK: Record<string, string> = {
  GOD: "GODFATHER", ADMIN: "LIEUTENANT", STAFF: "ENFORCER", SUPPORT: "LOOKOUT",
  MOD: "CAPTAIN", OWNER: "FOUNDER",
};
function roleDisplayDock(dbRole: string): string { return ROLE_DISPLAY_DOCK[dbRole] || dbRole; }

function b64UrlDecode(input: string): string {
  try {
    const s = String(input||"").replace(/-/g,"+").replace(/_/g,"/");
    const pad = s.length%4===0 ? "" : "=".repeat(4-(s.length%4));
    const raw = atob(s+pad);
    return decodeURIComponent(Array.prototype.map.call(raw,(c:string)=>"%"+("00"+c.charCodeAt(0).toString(16)).slice(-2)).join(""));
  } catch { try { return atob(String(input||"")); } catch { return ""; } }
}
function decodeJwtClaims(token?: string|null): any {
  try { const parts = String(token||"").split("."); if (parts.length!==3) return null; const j = b64UrlDecode(parts[1]); return j ? JSON.parse(j) : null; } catch { return null; }
}

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true}); } catch { return ""; }
}

function fmtRelative(iso: string): string {
  try {
    const now = Date.now();
    const d = new Date(iso).getTime();
    const diff = now - d;
    if (diff < 60_000) return "now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d >= yesterday.getTime() && d < today.getTime()) return "Yesterday";
    if (diff < 604_800_000) return new Date(d).toLocaleDateString("en-US", { weekday: "short" });
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}

function fmtDateSep(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const t = d.getTime();
    if (t >= today.getTime()) return "Today";
    if (t >= yesterday.getTime()) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function Avatar({ name, size=32, color, isMe, chosenColor }: { name: string; size?: number; color?: string; isMe?: boolean; chosenColor?: string }) {
  const bg = color || avatarBg(name, isMe, chosenColor);
  return (
    <div style={{ width:size, height:size, borderRadius:999, background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.38, fontWeight:700, color:"#fff", flexShrink:0, userSelect:"none" as const }}>
      {name.slice(0,1).toUpperCase()}
    </div>
  );
}

function StatusDot({ online }: { online: boolean }) {
  return <span style={{ width:8, height:8, borderRadius:999, background: online ? "#22c55e" : "rgba(255,255,255,.2)", display:"inline-block", flexShrink:0 }} />;
}

function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return <span style={{ minWidth:18, height:18, borderRadius:999, background:"#ef4444", color:"#fff", fontSize:10, fontWeight:800, display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"0 5px" }}>{count > 99 ? "99+" : count}</span>;
}

function SegmentedControl({ tabs, active, onChange }: { tabs: {id:string;label:string;badge?:number}[]; active:string; onChange:(id:string)=>void }) {
  return (
    <div className="weered-dock-tabs" style={{ display:"flex", background:"rgba(255,255,255,.06)", borderRadius:10, padding:3, gap:2 }}>
      {tabs.map(t => (
        <button key={t.id} className={`weered-dock-tab${active===t.id?" weered-dock-tab-active":""}`} onClick={() => onChange(t.id)} style={{
          flex:1, padding:"5px 8px", borderRadius:8, border:"none",
          background: active===t.id ? "rgba(255,255,255,.12)" : "transparent",
          color: active===t.id ? "var(--weered-text)" : "var(--weered-muted)",
          fontSize:12, fontWeight: active===t.id ? 700 : 500,
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5,
          transition:"all .15s",
        }}>
          {t.label}
          {!!t.badge && <UnreadBadge count={t.badge} />}
        </button>
      ))}
    </div>
  );
}

export default function DockShell(props: { forceMode?: "rail"|"floating" } = {}) {
  const ctx: any = (useWeered?.() as any) || {};
  const { me, wsReady, wsState, activeRoomId, joinedRoomId, users, msgs, meta, admin, role, joinStatus, sendChat, logout, renameRoom, lockRoom, unlockRoom, knock, admit } = ctx || {};

  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"room"|"dms"|"friends"|"crew">("dms");
  const [text, setText] = useState("");
  const [dockMode, setDockMode] = useState<"rail"|"floating">(props.forceMode || "floating");
  const [theme, setTheme] = useState<WeeredThemeName>("ishimura");

  // Hydrate theme from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const v = String(localStorage.getItem(WEERED_THEME_KEY) || "").trim();
      if (["slate","zinc","stone","gray","ishimura","broadcast","press"].includes(v)) setTheme(v as WeeredThemeName);
    } catch {}
  }, []);

  useEffect(() => { try { localStorage.setItem(WEERED_THEME_KEY,theme); } catch {} applyWeeredTheme(theme); }, [theme]);

  useEffect(() => {
    if (props.forceMode) { setDockMode(props.forceMode); if (props.forceMode==="rail") setOpen(true); return; }
    if (typeof window==="undefined") return;
    const mq = window.matchMedia("(min-width:1100px)");
    const apply = () => { const m = mq.matches?"rail":"floating"; setDockMode(m); if(m==="rail") setOpen(true); };
    apply();
    try { mq.addEventListener("change",apply); return ()=>mq.removeEventListener("change",apply); }
    catch { mq.addListener(apply); return ()=>mq.removeListener(apply); }
  }, [props.forceMode]);

  const viewId = String(activeRoomId||"");
  const joinedId = String(joinedRoomId||"");
  const needJoin = !!viewId && viewId!==joinedId;
  const wsUp = useMemo(()=>!!wsReady||wsState===1||(typeof wsState==="string"&&wsState.toLowerCase()==="open"),[wsReady,wsState]);

  const tokenMaybe = useMemo(()=>{
    if (typeof window==="undefined") return "";
    return pickFirstString(ctx?.token,ctx?.authToken,ctx?.jwt,me?.token,me?.jwt)||pickFirstString(localStorage.getItem("weered_token"),localStorage.getItem("token"),localStorage.getItem("auth_token"));
  },[ctx,me]);

  const claims = useMemo(()=>decodeJwtClaims(tokenMaybe),[tokenMaybe]);
  const globalRole = useMemo(()=>normRole(pickFirstString(me?.globalRole,me?.global_role,claims?.globalRole,claims?.gr)),[me,claims]);
  const meName = pickFirstString(me?.name,me?.username,"Guest");
  const roomTitle = pickFirstString(meta?.name,viewId,"");
  const roomRole = normRole(pickFirstString(role,joinStatus?.role));
  const apiBase = pickFirstString(ctx?.apiBase,(ctx as any)?.api,"")||"";

  // ── DM state ──
  const [dmThreads, setDmThreads] = useState<DmThread[]>([]);
  const [dmActivePeerId, setDmActivePeerId] = useState("");
  const [dmPeer, setDmPeer] = useState("");
  const [dmDraft, setDmDraft] = useState("");
  const [dmLoading, setDmLoading] = useState(false);
  const dmEndRef = useRef<HTMLDivElement|null>(null);
  const dmInputRef = useRef<HTMLInputElement|null>(null);
  const roomInputRef = useRef<HTMLInputElement|null>(null);

  // Load all conversations on mount so incoming DMs are visible
  useEffect(()=>{
    if (!tokenMaybe||!apiBase) return;
    fetch(`${apiBase}/dm/conversations`,{headers:{Authorization:`Bearer ${tokenMaybe}`}}).then(r=>r.json()).then(j=>{
      if (!Array.isArray(j?.conversations)) return;
      setDmThreads(cur=>{
        const existing=new Set(cur.map((t:DmThread)=>t.peerId));
        const incoming=j.conversations
          .filter((c:any)=>!existing.has(c.id))
          .map((c:any)=>({peerId:c.id||c.peerId,peerName:c.name||c.usernameKey||c.peerId||c.id,msgs:[],unread:c.unread||0}));
        return [...cur,...incoming];
      });
    }).catch(()=>{});
  },[tokenMaybe,apiBase]);

  useEffect(()=>{
    if (!tokenMaybe||!apiBase) return;
    function pollUnread() {
      fetch(`${apiBase}/dm/unread`,{headers:{Authorization:`Bearer ${tokenMaybe}`}}).then(r=>r.json()).then(j=>{
        if (!j?.counts) return;
        // Also discover new conversations we don't have yet
        const newPeerIds = Object.keys(j.counts).filter(pid=>!dmThreads.find(t=>t.peerId===pid));
        if (newPeerIds.length) {
          fetch(`${apiBase}/dm/conversations`,{headers:{Authorization:`Bearer ${tokenMaybe}`}}).then(r=>r.json()).then(conv=>{
            if (!Array.isArray(conv?.conversations)) return;
            setDmThreads(cur=>{
              const existing=new Set(cur.map((t:DmThread)=>t.peerId));
              const incoming=conv.conversations.filter((c:any)=>!existing.has(c.id||c.peerId)).map((c:any)=>({peerId:c.id||c.peerId,peerName:c.name||c.usernameKey||c.id,msgs:[],unread:c.unread||0}));
              return [...cur,...incoming];
            });
          }).catch(()=>{});
        }
        setDmThreads(cur=>cur.map(t=>({...t,unread:j.counts[t.peerId]??0})));
      }).catch(()=>{});
    }
    pollUnread();
    const t = setInterval(pollUnread, 8000);
    return () => clearInterval(t);
  },[tokenMaybe,apiBase]);

  useEffect(()=>{
    if (!dmActivePeerId||!tokenMaybe||!apiBase) return;
    setDmLoading(true);
    fetch(`${apiBase}/dm/${dmActivePeerId}`,{headers:{Authorization:`Bearer ${tokenMaybe}`}}).then(r=>r.json()).then(j=>{
      if (!Array.isArray(j?.messages)) return;
      setDmThreads(cur=>cur.map(t=>t.peerId===dmActivePeerId?{...t,msgs:j.messages,unread:0}:t));
    }).catch(()=>{}).finally(()=>setDmLoading(false));
  },[dmActivePeerId,tokenMaybe,apiBase]);

  useEffect(()=>{
    const handler=(ev:any)=>{
      const msg:DmMsg=ev?.detail?.message;
      if (!msg) return;
      const meId=String(me?.id||"");
      const peerId=msg.fromId===meId?msg.toId:msg.fromId;
      setDmThreads(cur=>{
        const existing=cur.find(t=>t.peerId===peerId);
        if (existing) return cur.map(t=>t.peerId===peerId?{...t,msgs:[...t.msgs,msg],unread:dmActivePeerId===peerId?0:t.unread+1}:t);
        fetch(`${apiBase}/profile/${encodeURIComponent(peerId)}`,{headers:tokenMaybe?{Authorization:`Bearer ${tokenMaybe}`}:{}}).then(r=>r.json()).then(j=>{if(j?.name)setDmThreads(ts=>ts.map(t=>t.peerId===peerId?{...t,peerName:j.name}:t));}).catch(()=>{});
        return [{peerId,peerName:peerId,msgs:[msg],unread:dmActivePeerId===peerId?0:1},...cur];
      });
    };
    window.addEventListener("weered:dm:message",handler as any);
    return ()=>window.removeEventListener("weered:dm:message",handler as any);
  },[me,dmActivePeerId,apiBase,tokenMaybe]);

  useEffect(()=>{ try { dmEndRef.current?.scrollIntoView({behavior:"smooth"}); } catch {} },[dmActivePeerId,dmThreads]);

  useEffect(()=>{
    if (typeof window==="undefined") return;
    const h=()=>setTimeout(()=>{ try { if(tab==="dms") dmInputRef.current?.focus(); else roomInputRef.current?.focus(); } catch {} },0);
    window.addEventListener("weered:dock:opened",h as any);
    return ()=>window.removeEventListener("weered:dock:opened",h as any);
  },[tab,dmActivePeerId]);

  useEffect(()=>{
    if (typeof window==="undefined") return;
    const h=(ev:any)=>{
      const d=ev?.detail;
      if (!d||d.mode!=="dm") return;
      const peerName=pickFirstString(d?.peer?.name,d?.peerName,d?.peer,"");
      const peerId=pickFirstString(d?.peer?.id,d?.peerId,"");
      if (!peerName&&!peerId) return;
      setTab("dms");
      setDmThreads(cur=>{
        const ex=cur.find(t=>t.peerId===peerId||t.peerName.toLowerCase()===peerName.toLowerCase());
        if (ex){setDmActivePeerId(ex.peerId);return cur;}
        setDmActivePeerId(peerId);
        return [{peerId,peerName,msgs:[],unread:0},...cur];
      });
    };
    window.addEventListener("weered:dock:open",h as any);
    return ()=>window.removeEventListener("weered:dock:open",h as any);
  },[]);

  const dmActive = useMemo(()=>dmThreads.find(t=>t.peerId===dmActivePeerId)||null,[dmThreads,dmActivePeerId]);
  const totalUnread = useMemo(()=>dmThreads.reduce((s,t)=>s+t.unread,0),[dmThreads]);

  // Broadcast unread count to UserCorner badge whenever it changes.
  // UserCorner listens for this event AND polls localStorage as a fallback.
  useEffect(()=>{
    try { localStorage.setItem("weered:dock:unread", String(totalUnread)); } catch {}
    try { window.dispatchEvent(new CustomEvent("weered:dock:unread",{detail:{count:totalUnread}})); } catch {}
  },[totalUnread]);

  function call(fn:any,...args:any[]){ try{if(typeof fn==="function")return fn(...args);}catch{} }
  function sendRoomChat(body:string){ const b=body.trim(); if(!b)return; try{if(typeof sendChat==="function"){sendChat(b);return;}}catch{} try{sendChat(viewId||joinedId,b);}catch{} }

  async function dmCreateThread(){
    const peer=dmPeer.trim(); if(!peer) return;
    const existing=dmThreads.find(t=>t.peerName.toLowerCase()===peer.toLowerCase()||t.peerId===peer);
    if(existing){setDmActivePeerId(existing.peerId);setDmPeer("");return;}
    setDmPeer("");
    try {
      const r=await fetch(`${apiBase}/profile/${encodeURIComponent(peer)}`,{headers:tokenMaybe?{Authorization:`Bearer ${tokenMaybe}`}:{}});
      const j=await r.json();
      const resolvedId=j?.id||peer; const resolvedName=j?.name||peer;
      setDmThreads(cur=>{ const dup=cur.find(t=>t.peerId===resolvedId); if(dup){setDmActivePeerId(resolvedId);return cur;} return [{peerId:resolvedId,peerName:resolvedName,msgs:[],unread:0},...cur]; });
      setDmActivePeerId(resolvedId);
    } catch {
      setDmThreads(cur=>[{peerId:peer,peerName:peer,msgs:[],unread:0},...cur]);
      setDmActivePeerId(peer);
    }
  }

  async function dmSend(){
    if(!dmActive||!dmDraft.trim()||!tokenMaybe||!apiBase) return;
    const body=dmDraft.trim(); setDmDraft("");
    const meId=String(me?.id||"");
    const optimistic:DmMsg={id:__id(),fromId:meId,toId:dmActive.peerId,body,createdAt:new Date().toISOString(),readAt:null};
    setDmThreads(cur=>cur.map(t=>t.peerId===dmActive.peerId?{...t,msgs:[...t.msgs,optimistic]}:t));
    try {
      if(typeof (ctx as any)?.sendRaw==="function") (ctx as any).sendRaw({type:"dm:send",toId:dmActive.peerId,body});
      else await fetch(`${apiBase}/dm/${dmActive.peerId}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${tokenMaybe}`},body:JSON.stringify({body})});
    } catch {}
  }

  const embedded=!!props.forceMode;
  const panel: React.CSSProperties = embedded
    ? { position:"relative",width:"100%",height:"100%",background:"transparent",border:"none",borderRadius:0,overflow:"hidden",zIndex:1,color:"var(--weered-text)",fontFamily:"ui-sans-serif,system-ui,-apple-system,sans-serif" }
    : dockMode==="rail"
    ? { position:"sticky",top:16,width:"100%",height:"calc(100vh - 32px)",background:"var(--weered-panel2)",border:"1px solid var(--weered-bd2)",borderRadius:16,boxShadow:"0 8px 40px rgba(0,0,0,.4)",backdropFilter:"blur(12px)",overflow:"hidden",zIndex:40,color:"var(--weered-text)",fontFamily:"ui-sans-serif,system-ui,-apple-system,sans-serif",maxHeight:"calc(100vh - 32px)" }
    : { position:"fixed",right:14,top:88,width:320,maxWidth:"92vw",height:"calc(100vh - 110px)",background:"var(--weered-panel2)",border:"1px solid var(--weered-bd2)",borderRadius:16,boxShadow:"0 8px 40px rgba(0,0,0,.4)",backdropFilter:"blur(12px)",overflow:"hidden",zIndex:9999,color:"var(--weered-text)",fontFamily:"ui-sans-serif,system-ui,-apple-system,sans-serif",maxHeight:"calc(100vh - 24px)" };

  if (!open) return props.forceMode ? null : (
    <button onClick={()=>setOpen(true)} style={{ position:"fixed",right:14,top:88,zIndex:9999,padding:"8px 16px",borderRadius:999,border:"1px solid var(--weered-bd2)",background:"var(--weered-panel2)",color:"var(--weered-text)",fontWeight:700,cursor:"pointer",fontSize:13,backdropFilter:"blur(12px)" }}>
      Chat
    </button>
  );

  const userArr:any[]=Array.isArray(users)?users:[];
  const msgArr:any[]=Array.isArray(msgs)?msgs:[];

  const inputStyle: React.CSSProperties = {
    flex:1, padding:"10px 12px", borderRadius:12, border:"1px solid var(--weered-bd2)",
    background:"rgba(255,255,255,.05)", color:"var(--weered-text)", outline:"none", fontSize:13,
  };

  const sendBtn: React.CSSProperties = {
    padding:"10px 14px", borderRadius:12, border:"1px solid var(--weered-accent-ring)",
    background:"var(--weered-accent-bg)", color:"var(--weered-accent-text)",
    fontWeight:700, fontSize:13, cursor:"pointer",
  };

  return (
    <div className="weered-dock" style={{...panel, display:"flex", flexDirection:"column"}}>

      {/* ── Header ── */}
      <div className="weered-dock-header" style={{ padding:"10px 14px 0", borderBottom:"1px solid var(--weered-bd)", flexShrink:0 }}>
        {/* App bar */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <img src="/brand/logo/weered-logo-32.png" alt="Weered" style={{ width:22, height:22, borderRadius:5 }} />
          <span className="weered-dock-title" style={{ fontWeight:800, fontSize:15, letterSpacing:".02em", color:"var(--weered-text)" }}>Burner</span>
          <StatusDot online={wsUp} />
          <span style={{ flex:1 }} />
          <button className="weered-dock-close" onClick={()=>{try{window.dispatchEvent(new CustomEvent("weered:dock:close"));}catch{}}} style={{ width:28,height:28,borderRadius:8,border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.04)",color:"var(--weered-muted)",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s" }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,.1)";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,.04)";}}
          >×</button>
        </div>

        {/* Tabs */}
        <SegmentedControl
          tabs={[
            {id:"dms",label:"Messages",badge:totalUnread},
            {id:"friends",label:"Friends"},
            {id:"room",label:"Room"},
            {id:"crew",label:"Crew"},
          ]}
          active={tab}
          onChange={id=>setTab(id as any)}
        />
      </div>

      {/* ── Body ── */}
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>

        {/* ── ROOM TAB ── */}
        {tab==="room" ? (
          <div style={{ display:"flex", flexDirection:"column", flex:1, height:"100%" }}>
            {needJoin && (
              <div style={{ margin:"12px 14px 0", padding:"10px 12px", borderRadius:12, background:"var(--weered-accent-bg)", border:"1px solid var(--weered-accent-ring)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                <span style={{ fontSize:12, color:"var(--weered-accent-text)", fontWeight:600 }}>Not joined yet</span>
                {typeof knock==="function" && <button onClick={()=>call(knock,viewId)} style={{ padding:"5px 12px",borderRadius:8,border:"1px solid var(--weered-accent-ring)",background:"transparent",color:"var(--weered-accent-text)",fontSize:12,cursor:"pointer",fontWeight:700 }}>Knock</button>}
              </div>
            )}

            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:6 }}>
              {msgArr.length ? msgArr.slice(-80).map((m:any,i:number)=>{
                const who=pickFirstString(m?.user?.name,m?.name,m?.from,"?");
                const body=pickFirstString(m?.body,m?.text,"");
                const isMe=!!me?.id&&(m?.user?.id===me?.id||m?.fromId===me?.id);
                return (
                  <div key={m?.id||i} style={{ display:"flex", flexDirection:"column", alignItems:isMe?"flex-end":"flex-start" }}>
                    {!isMe && <span style={{ fontSize:11, color:"var(--weered-muted)", marginBottom:2, paddingLeft:4 }}>{who}</span>}
                    <div style={{ maxWidth:"82%", padding:"8px 12px", borderRadius:isMe?"16px 16px 4px 16px":"16px 16px 16px 4px", background:isMe?"var(--weered-accent-bg)":"rgba(255,255,255,.07)", border:isMe?"1px solid var(--weered-accent-ring)":"1px solid var(--weered-bd)" }}>
                      <div style={{ fontSize:13, lineHeight:"18px", color:"var(--weered-text)" }}>{linkify(body)}</div>
                    </div>
                    <span style={{ fontSize:10, color:"var(--weered-muted)", marginTop:2, paddingLeft:4, paddingRight:4 }}>{fmtTime(m?.createdAt||new Date().toISOString())}</span>
                  </div>
                );
              }) : (
                <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:13, color:"var(--weered-muted)" }}>No messages yet</span>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ padding:"10px 12px", borderTop:"1px solid var(--weered-bd)", display:"flex", gap:8, flexShrink:0 }}>
              <input ref={roomInputRef} value={text} onChange={e=>setText((e.target as any).value||"")} placeholder="Message..." style={inputStyle}
                onKeyDown={e=>{if((e as any).key==="Enter"){sendRoomChat(text);setText("");}}} />
              <button style={sendBtn} onClick={()=>{sendRoomChat(text);setText("");}}>↑</button>
            </div>

            {/* Presence */}
            {userArr.length>0 && (
              <div style={{ borderTop:"1px solid var(--weered-bd)", padding:"10px 14px", maxHeight:160, overflowY:"auto", flexShrink:0 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--weered-muted)", marginBottom:8, textTransform:"uppercase" as const, letterSpacing:.5 }}>In this room · {userArr.length}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {userArr.map((u:any)=>{
                    const uname=pickFirstString(u?.name,u?.username,"?");
                    const ugr=normRole(pickFirstString(u?.globalRole,u?.global_role));
                    const isMe=!!me?.id&&u?.id===me?.id;
                    return (
                      <div key={u?.id||uname} style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Avatar name={uname} size={26} isMe={isMe} chosenColor={u?.avatarColor} />
                        <span style={{ fontSize:12, fontWeight:600, color:isMe?"var(--weered-accent-text)":"var(--weered-text)" }}>{uname}{isMe?" (you)":""}</span>
                        {ugr && <span style={{ fontSize:10, color:"var(--weered-muted)", marginLeft:"auto" }}>{ugr}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mod tools */}
            {(admin||roomRole==="OWNER"||roomRole==="MOD") && (
              <div style={{ borderTop:"1px solid var(--weered-bd)", padding:"10px 14px", flexShrink:0 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--weered-muted)", marginBottom:8, textTransform:"uppercase" as const, letterSpacing:.5 }}>Moderation</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" as const }}>
                  {typeof lockRoom==="function"&&<button style={{ padding:"6px 12px",borderRadius:8,border:"1px solid var(--weered-bd)",background:"transparent",color:"var(--weered-text)",fontSize:12,cursor:"pointer",fontWeight:600 }} onClick={()=>call(lockRoom,viewId)}>Lock</button>}
                  {typeof unlockRoom==="function"&&<button style={{ padding:"6px 12px",borderRadius:8,border:"1px solid var(--weered-bd)",background:"transparent",color:"var(--weered-text)",fontSize:12,cursor:"pointer",fontWeight:600 }} onClick={()=>call(unlockRoom,viewId)}>Unlock</button>}
                  {typeof renameRoom==="function"&&<button style={{ padding:"6px 12px",borderRadius:8,border:"1px solid var(--weered-bd)",background:"transparent",color:"var(--weered-text)",fontSize:12,cursor:"pointer",fontWeight:600 }} onClick={()=>{const n=prompt("New name?");if(n)call(renameRoom,viewId,n);}}>Rename</button>}
                </div>
              </div>
            )}
          </div>

        ) : tab==="dms" ? (
          // ── MESSAGES TAB ──
          <div style={{ display:"flex", flexDirection:"column", flex:1, height:"100%", position:"relative" }}>

            {dmActive ? (
              <>
                {/* Conversation header */}
                <div className="weered-dock-conv-header" style={{ padding:"8px 12px", borderBottom:"1px solid var(--weered-bd)", display:"flex", alignItems:"center", gap:10, flexShrink:0, background:"rgba(255,255,255,.02)" }}>
                  <button onClick={()=>setDmActivePeerId("")} style={{ background:"none",border:"none",color:"var(--weered-muted)",cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1,display:"flex",alignItems:"center" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  <div style={{ position:"relative" }}>
                    <Avatar name={dmActive.peerName} size={30} />
                    <span style={{ position:"absolute",bottom:-1,right:-1,width:9,height:9,borderRadius:999,background:"#22c55e",border:"2px solid var(--weered-panel2)" }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <span style={{ fontWeight:700, fontSize:14, color:"var(--weered-text)" }}>{dmActive.peerName}</span>
                  </div>
                </div>

                {/* Messages with date separators */}
                <div style={{ flex:1, overflowY:"auto", padding:"10px 14px", display:"flex", flexDirection:"column", gap:3 }}>
                  {dmLoading ? (
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", flex:1 }}>
                      <span style={{ color:"var(--weered-muted)", fontSize:13 }}>Loading...</span>
                    </div>
                  ) : dmActive.msgs.length ? dmActive.msgs.map((m,i,arr)=>{
                    const isMe=m.fromId===String(me?.id||"");
                    const prevMsg=i>0?arr[i-1]:null;
                    const sameSender=prevMsg&&prevMsg.fromId===m.fromId;
                    // Date separator
                    const msgDate=fmtDateSep(m.createdAt);
                    const prevDate=prevMsg?fmtDateSep(prevMsg.createdAt):"";
                    const showDateSep=msgDate!==prevDate;
                    // Show time only on last in a group or every 5 min gap
                    const nextMsg=i<arr.length-1?arr[i+1]:null;
                    const sameNext=nextMsg&&nextMsg.fromId===m.fromId;
                    const timeDiff=nextMsg?new Date(nextMsg.createdAt).getTime()-new Date(m.createdAt).getTime():Infinity;
                    const showTime=!sameNext||timeDiff>300_000;
                    // Read receipt on last sent message
                    const isLastSent=isMe&&(!nextMsg||nextMsg.fromId!==String(me?.id||""));
                    return (
                      <React.Fragment key={m.id}>
                        {showDateSep && (
                          <div style={{ display:"flex", alignItems:"center", gap:10, margin:"12px 0 8px" }}>
                            <div style={{ flex:1, height:1, background:"var(--weered-bd)" }} />
                            <span style={{ fontSize:10, fontWeight:600, color:"var(--weered-muted)", letterSpacing:".04em", whiteSpace:"nowrap" }}>{msgDate}</span>
                            <div style={{ flex:1, height:1, background:"var(--weered-bd)" }} />
                          </div>
                        )}
                        <div style={{ display:"flex", flexDirection:"column", alignItems:isMe?"flex-end":"flex-start", marginTop:sameSender&&!showDateSep?1:8 }}>
                          <div className={`weered-dock-bubble${isMe?" weered-dock-bubble-me":""}`} style={{ maxWidth:"82%", padding:"9px 13px", borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px", background:isMe?"var(--weered-accent-bg)":"rgba(255,255,255,.07)", border:isMe?"1px solid var(--weered-accent-ring)":"1px solid var(--weered-bd)" }}>
                            <div style={{ fontSize:13, lineHeight:"19px", color:"var(--weered-text)" }}>{linkify(String(m.body||""))}</div>
                          </div>
                          {showTime && (
                            <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2, padding:"0 4px" }}>
                              <span style={{ fontSize:10, color:"var(--weered-muted)" }}>{fmtTime(m.createdAt)}</span>
                              {isLastSent && m.readAt && <span style={{ fontSize:9, color:"var(--weered-accent-text)", fontWeight:600 }}>Read</span>}
                              {isLastSent && !m.readAt && <span style={{ fontSize:9, color:"var(--weered-muted)" }}>Sent</span>}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  }) : (
                    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
                      <Avatar name={dmActive.peerName} size={56} />
                      <span style={{ fontSize:14, fontWeight:700, color:"var(--weered-text)" }}>{dmActive.peerName}</span>
                      <span style={{ color:"var(--weered-muted)", fontSize:12 }}>Start the conversation</span>
                    </div>
                  )}
                  <div ref={dmEndRef} />
                </div>

                {/* Pill input */}
                <div style={{ padding:"8px 12px 10px", borderTop:"1px solid var(--weered-bd)", flexShrink:0 }}>
                  <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
                    <input ref={dmInputRef} value={dmDraft} onChange={e=>setDmDraft((e.target as any).value||"")} placeholder="Message..."
                      style={{ width:"100%", padding:"10px 42px 10px 16px", borderRadius:22, border:"1px solid var(--weered-bd2)", background:"rgba(255,255,255,.05)", color:"var(--weered-text)", outline:"none", fontSize:13, fontFamily:"inherit" }}
                      onKeyDown={e=>{if((e as any).key==="Enter"){e.preventDefault();void dmSend();}}} />
                    {dmDraft.trim() && (
                      <button className="weered-dock-send" onClick={()=>void dmSend()} style={{ position:"absolute", right:6, width:30, height:30, borderRadius:999, border:"none", background:"var(--weered-accent-bg)", color:"var(--weered-accent-text)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Search / compose bar */}
                <div style={{ padding:"10px 12px", borderBottom:"1px solid var(--weered-bd)", flexShrink:0 }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <div style={{ flex:1, position:"relative", display:"flex", alignItems:"center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ position:"absolute", left:10, opacity:.4, pointerEvents:"none" }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
                      <input value={dmPeer} onChange={e=>setDmPeer((e.target as any).value||"")} placeholder="Search or start new chat..."
                        style={{ ...inputStyle, paddingLeft:32, borderRadius:22, fontSize:12 }}
                        onKeyDown={e=>{if((e as any).key==="Enter") void dmCreateThread();}} />
                    </div>
                    <button className="weered-dock-compose" style={{ width:36, height:36, borderRadius:999, border:"1px solid var(--weered-accent-ring)", background:"var(--weered-accent-bg)", color:"var(--weered-accent-text)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18, fontWeight:700 }} onClick={()=>void dmCreateThread()}>+</button>
                  </div>
                </div>

                {/* Conversation list */}
                {dmThreads.length>0 ? (
                  <div style={{ flex:1, overflowY:"auto" }}>
                    {[...dmThreads].sort((a,b)=>{
                      const aTime=a.msgs.length?new Date(a.msgs[a.msgs.length-1].createdAt).getTime():0;
                      const bTime=b.msgs.length?new Date(b.msgs[b.msgs.length-1].createdAt).getTime():0;
                      return bTime-aTime;
                    }).filter(t=>!dmPeer.trim()||t.peerName.toLowerCase().includes(dmPeer.toLowerCase())).map(t=>{
                      const lastMsg=t.msgs.length?t.msgs[t.msgs.length-1]:null;
                      const isMyLastMsg=lastMsg&&lastMsg.fromId===String(me?.id||"");
                      const preview=lastMsg?(isMyLastMsg?"You: ":"")+lastMsg.body.slice(0,40)+(lastMsg.body.length>40?"...":""):"Tap to start chatting";
                      const time=lastMsg?fmtRelative(lastMsg.createdAt):"";
                      return (
                        <button key={t.peerId} className="weered-dock-thread" onClick={()=>setDmActivePeerId(t.peerId)} style={{ width:"100%",textAlign:"left",padding:"12px 14px",border:"none",borderBottom:"1px solid rgba(255,255,255,.04)",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"background .1s" }}
                          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,.04)";}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}
                        >
                          <div style={{ position:"relative", flexShrink:0 }}>
                            <Avatar name={t.peerName} size={42} />
                            <span style={{ position:"absolute",bottom:0,right:0,width:10,height:10,borderRadius:999,background:"#22c55e",border:"2px solid var(--weered-panel2)" }} />
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                              <span style={{ fontWeight:600, fontSize:13, color:"var(--weered-text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.peerName}</span>
                              {time && <span style={{ fontSize:10, color:"var(--weered-muted)", flexShrink:0 }}>{time}</span>}
                            </div>
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginTop:2 }}>
                              <span style={{ fontSize:12, color:"var(--weered-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{preview}</span>
                              {t.unread>0 && <UnreadBadge count={t.unread} />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, padding:24 }}>
                    <img src="/brand/logo/weered-logo-64.png" alt="Weered logo" style={{ width:48, height:48, opacity:.3, borderRadius:10 }} />
                    <span style={{ fontSize:14, fontWeight:700, color:"var(--weered-text)", opacity:.5 }}>No messages yet</span>
                    <span style={{ fontSize:12, color:"var(--weered-muted)", textAlign:"center" }}>Search for someone above to start a conversation</span>
                  </div>
                )}
              </>
            )}
          </div>

        ) : tab==="friends" ? (
          <FriendsTab
            apiBase={apiBase}
            tokenMaybe={tokenMaybe}
            myId={String(me?.id||"")}
            rooms={userArr}
            onMessage={(peerName,peerId)=>{
              setTab("dms");
              setDmThreads(cur=>{const ex=cur.find(t=>t.peerId===peerId||t.peerName.toLowerCase()===peerName.toLowerCase()); if(ex){setDmActivePeerId(ex.peerId);return cur;} setDmActivePeerId(peerId); return [{peerId,peerName,msgs:[],unread:0},...cur];});
            }}
            onJoin={roomId=>{try{(ctx as any)?.join?.(roomId);}catch{}}}
          />
        ) : tab==="crew" ? (
          <CrewTab
            apiBase={apiBase}
            tokenMaybe={tokenMaybe}
            myId={String(me?.id||"")}
            myName={meName}
            onJoin={roomId=>{try{(ctx as any)?.join?.(roomId);}catch{}}}
          />
        ) : null}
      </div>
    </div>
  );
}

function FriendsTab({ apiBase, tokenMaybe, myId, rooms: roomUsers, onMessage, onJoin }: {
  apiBase: string; tokenMaybe: string; myId: string;
  rooms: any[]; onMessage: (pn: string, pi: string) => void; onJoin: (r: string) => void;
}) {
  const [friends, setFriends] = React.useState<any[]>([]);
  const [requests, setRequests] = React.useState<any[]>([]);
  const [addInput, setAddInput] = React.useState("");
  const [addNote, setAddNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [subTab, setSubTab] = React.useState<"friends"|"requests">("friends");

  async function load() {
    if (!apiBase || !tokenMaybe) return;
    setLoading(true);
    try {
      const [fr, rq] = await Promise.all([
        fetch(`${apiBase}/friends`, { headers: { Authorization: `Bearer ${tokenMaybe}` } }).then(r => r.json()),
        fetch(`${apiBase}/friends/requests`, { headers: { Authorization: `Bearer ${tokenMaybe}` } }).then(r => r.json()),
      ]);
      setFriends(Array.isArray(fr?.friends) ? fr.friends : []);
      setRequests(Array.isArray(rq?.requests) ? rq.requests : []);
    } catch {}
    setLoading(false);
  }

  React.useEffect(() => { void load(); }, [apiBase, tokenMaybe]);
  React.useEffect(() => { const t = setInterval(load, 8000); return () => clearInterval(t); }, [apiBase, tokenMaybe]);

  async function sendRequest() {
    const target = addInput.trim(); if (!target) return;
    setAddNote("");
    try {
      const profile = await fetch(`${apiBase}/profile/${encodeURIComponent(target)}`, { headers: { Authorization: `Bearer ${tokenMaybe}` } }).then(r => r.json());
      if (!profile?.id) { setAddNote("User not found"); return; }
      const res = await fetch(`${apiBase}/friends/request/${profile.id}`, { method: "POST", headers: { Authorization: `Bearer ${tokenMaybe}` } }).then(r => r.json());
      if (res.ok) { setAddInput(""); setAddNote("Request sent!"); void load(); }
      else setAddNote(res.error || "Failed");
    } catch { setAddNote("Error"); }
  }

  async function accept(id: string) { await fetch(`${apiBase}/friends/accept/${id}`, { method: "POST", headers: { Authorization: `Bearer ${tokenMaybe}` } }); void load(); }
  async function decline(id: string) { await fetch(`${apiBase}/friends/decline/${id}`, { method: "POST", headers: { Authorization: `Bearer ${tokenMaybe}` } }); void load(); }
  async function remove(userId: string) { await fetch(`${apiBase}/friends/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${tokenMaybe}` } }); void load(); }

  const online = friends.filter(f => f.online);
  const offline = friends.filter(f => !f.online);

  const iStyle: React.CSSProperties = { flex:1, padding:"8px 10px", borderRadius:10, border:"1px solid var(--weered-bd2)", background:"rgba(255,255,255,.05)", color:"var(--weered-text)", outline:"none", fontSize:12 };

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1 }}>
      <div style={{ padding:"10px 12px", borderBottom:"1px solid var(--weered-bd)", flexShrink:0 }}>
        <div style={{ display:"flex", gap:6 }}>
          <input value={addInput} onChange={e=>setAddInput(e.target.value)} placeholder="Add by username…" style={iStyle} onKeyDown={e=>e.key==="Enter"&&sendRequest()} />
          <button onClick={sendRequest} style={{ padding:"8px 12px", borderRadius:10, border:"1px solid var(--weered-accent-ring)", background:"var(--weered-accent-bg)", color:"var(--weered-accent-text)", fontSize:12, cursor:"pointer", fontWeight:700 }}>+</button>
        </div>
        {addNote && <div style={{ fontSize:11, marginTop:5, color:"var(--weered-muted)" }}>{addNote}</div>}
      </div>
      <div style={{ display:"flex", borderBottom:"1px solid var(--weered-bd)", flexShrink:0 }}>
        {(["friends","requests"] as const).map(t=>(
          <button key={t} onClick={()=>setSubTab(t)} style={{ flex:1, padding:"8px 0", border:"none", background:"transparent", color:subTab===t?"var(--weered-accent-text)":"var(--weered-muted)", fontSize:11, fontWeight:subTab===t?700:500, cursor:"pointer", borderBottom:subTab===t?"2px solid var(--weered-accent-text)":"2px solid transparent" }}>
            {t==="friends"?`Friends${friends.length?` · ${friends.length}`:""}`:(`Requests${requests.length?` · ${requests.length}`:""}`)}
          </button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {loading&&!friends.length&&!requests.length&&<div style={{ padding:20, textAlign:"center" as const, color:"var(--weered-muted)", fontSize:13 }}>Loading…</div>}
        {subTab==="requests"&&(requests.length===0
          ?<div style={{ padding:24, textAlign:"center" as const, color:"var(--weered-muted)", fontSize:13 }}>No pending requests</div>
          :requests.map(r=>(
            <div key={r.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:"1px solid var(--weered-bd)" }}>
              <Avatar name={r.fromName||"?"} size={34} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>@{r.fromName}</div>
                <div style={{ fontSize:11, color:"var(--weered-muted)" }}>wants to connect</div>
              </div>
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={()=>accept(r.id)} style={{ padding:"5px 9px", borderRadius:8, border:"1px solid rgba(34,197,94,.4)", background:"rgba(34,197,94,.12)", color:"rgb(134,239,172)", fontSize:11, cursor:"pointer", fontWeight:700 }}>✓</button>
                <button onClick={()=>decline(r.id)} style={{ padding:"5px 9px", borderRadius:8, border:"1px solid var(--weered-bd)", background:"transparent", color:"var(--weered-muted)", fontSize:11, cursor:"pointer" }}>✕</button>
              </div>
            </div>
          ))
        )}
        {subTab==="friends"&&(friends.length===0
          ?<div style={{ padding:24, textAlign:"center" as const, color:"var(--weered-muted)", fontSize:13 }}>No friends yet.<br/>Search by username above.</div>
          :<>
            {online.length>0&&<div style={{ padding:"10px 14px 4px", fontSize:10, fontWeight:700, color:"var(--weered-muted)", textTransform:"uppercase" as const, letterSpacing:.5 }}>Online · {online.length}</div>}
            {online.map(f=><FriendRow key={f.id} f={f} onMessage={onMessage} onJoin={onJoin} onRemove={remove} />)}
            {offline.length>0&&<div style={{ padding:"10px 14px 4px", fontSize:10, fontWeight:700, color:"var(--weered-muted)", textTransform:"uppercase" as const, letterSpacing:.5, marginTop:4 }}>Offline · {offline.length}</div>}
            {offline.map(f=><FriendRow key={f.id} f={f} onMessage={onMessage} onJoin={onJoin} onRemove={remove} />)}
          </>
        )}
      </div>
    </div>
  );
}

function FriendRow({ f, onMessage, onJoin, onRemove }: { f:any; onMessage:(n:string,i:string)=>void; onJoin:(r:string)=>void; onRemove:(id:string)=>void }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:"1px solid var(--weered-bd)" }}>
      <div style={{ position:"relative" as const }}>
        <Avatar name={f.name||"?"} size={34} chosenColor={f.avatarColor} />
        <span style={{ position:"absolute" as const, bottom:0, right:0, width:9, height:9, borderRadius:999, background:f.online?"#22c55e":"rgba(255,255,255,.2)", border:"2px solid var(--weered-panel2)" }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:13 }}>@{f.name}</div>
        <div style={{ fontSize:11, color:"var(--weered-muted)", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{f.online?(f.roomName?`in ${f.roomName}`:"online"):"offline"}</div>
      </div>
      <div style={{ display:"flex", gap:4 }}>
        <button onClick={()=>onMessage(f.name,f.id)} style={{ padding:"5px 9px", borderRadius:8, border:"1px solid var(--weered-bd2)", background:"rgba(255,255,255,.05)", color:"var(--weered-text)", fontSize:11, cursor:"pointer", fontWeight:600 }}>DM</button>
        {f.online&&f.roomId&&<button onClick={()=>onJoin(f.roomId)} style={{ padding:"5px 9px", borderRadius:8, border:"1px solid var(--weered-accent-ring)", background:"var(--weered-accent-bg)", color:"var(--weered-accent-text)", fontSize:11, cursor:"pointer", fontWeight:600 }}>Join</button>}
      </div>
    </div>
  );
}

function CrewTab({ apiBase, tokenMaybe, myId, myName, onJoin }: { apiBase:string; tokenMaybe:string; myId:string; myName:string; onJoin:(r:string)=>void }) {
  const [crews, setCrews] = React.useState<any[]>([]);
  const [view, setView] = React.useState<"list"|"create">("list");
  const [newName, setNewName] = React.useState("");
  const [newTag, setNewTag] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [expandedCrew, setExpandedCrew] = React.useState<string|null>(null);
  const [presenceToast, setPresenceToast] = React.useState<{name:string;online:boolean}|null>(null);

  // Crew presence toast — show when a mate comes online/offline
  React.useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d?.name || d.userId === myId) return;
      setPresenceToast({ name: d.name, online: Boolean(d.online) });
      setTimeout(() => setPresenceToast(null), 3000);
    };
    window.addEventListener("weered:crew:presence", handler);
    return () => window.removeEventListener("weered:crew:presence", handler);
  }, [myId]);

  async function load() {
    if (!apiBase||!tokenMaybe) return;
    try { const j = await fetch(`${apiBase}/crews/mine`,{headers:{Authorization:`Bearer ${tokenMaybe}`}}).then(r=>r.json()); setCrews(Array.isArray(j?.crews)?j.crews:[]); } catch {}
  }

  React.useEffect(()=>{void load();},[apiBase,tokenMaybe]);
  React.useEffect(()=>{const t=setInterval(load,8000);return()=>clearInterval(t);},[apiBase,tokenMaybe]);

  async function createCrew() {
    if (!newName.trim()) return;
    setCreating(true); setNote("");
    try {
      const j = await fetch(`${apiBase}/crews`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${tokenMaybe}`},body:JSON.stringify({name:newName.trim(),tag:newTag.trim(),description:newDesc.trim()})}).then(r=>r.json());
      if (j.ok){setView("list");setNewName("");setNewTag("");setNewDesc("");void load();}
      else setNote(j.error||"Failed");
    } catch {setNote("Error");}
    setCreating(false);
  }

  const [inviteInput, setInviteInput] = React.useState<Record<string,string>>({});
  const [inviteNote, setInviteNote] = React.useState<Record<string,string>>({});

  async function inviteMember(crewId: string) {
    const username = (inviteInput[crewId] || "").trim();
    if (!username) return;
    try {
      const profile = await fetch(`${apiBase}/profile/${encodeURIComponent(username)}`, { headers: { Authorization: `Bearer ${tokenMaybe}` } }).then(r => r.json());
      if (!profile?.id) { setInviteNote(n => ({ ...n, [crewId]: "User not found" })); return; }
      const res = await fetch(`${apiBase}/crews/${crewId}/invite/${profile.id}`, { method: "POST", headers: { Authorization: `Bearer ${tokenMaybe}` } }).then(r => r.json());
      if (res.ok) { setInviteInput(v => ({ ...v, [crewId]: "" })); setInviteNote(n => ({ ...n, [crewId]: "Invited!" })); void load(); }
      else setInviteNote(n => ({ ...n, [crewId]: res.error || "Failed" }));
    } catch { setInviteNote(n => ({ ...n, [crewId]: "Error" })); }
    setTimeout(() => setInviteNote(n => ({ ...n, [crewId]: "" })), 3000);
  }

  async function leaveCrew(crewId:string){if(!confirm("Leave this crew?"))return;await fetch(`${apiBase}/crews/${crewId}/members/${myId}`,{method:"DELETE",headers:{Authorization:`Bearer ${tokenMaybe}`}});void load();}
  async function disbandCrew(crewId:string){if(!confirm("Disband? Cannot be undone."))return;await fetch(`${apiBase}/crews/${crewId}`,{method:"DELETE",headers:{Authorization:`Bearer ${tokenMaybe}`}});void load();}

  const iStyle:React.CSSProperties={width:"100%",padding:"8px 10px",borderRadius:10,border:"1px solid var(--weered-bd2)",background:"rgba(255,255,255,.05)",color:"var(--weered-text)",outline:"none",fontSize:13,boxSizing:"border-box" as const};

  const roleBadge = (role: string) => {
    if (role === "LEADER") return { label: "★ LEADER", bg: "rgba(212,160,23,.15)", border: "rgba(212,160,23,.35)", color: "#D4A017" };
    if (role === "OFFICER") return { label: "◆ OFFICER", bg: "rgba(88,0,229,.12)", border: "rgba(88,0,229,.3)", color: "#a78bfa" };
    return null;
  };

  if (view==="create") return (
    <div style={{padding:"14px",display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
        <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:"var(--weered-muted)",cursor:"pointer",fontSize:18,padding:"0 4px"}}>←</button>
        <span style={{fontWeight:800,fontSize:14,letterSpacing:"-0.2px"}}>Establish Crew</span>
      </div>
      {([["Name","name",newName,setNewName,40,"The 8 Meter"],["Tag","tag",newTag,setNewTag,6,"W8M"],["Description","desc",newDesc,setNewDesc,200,"What's your crew about"]] as any[]).map(([label,key,val,set,max,ph])=>(
        <div key={key}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--weered-muted)",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>{label}</div>
          <input value={val} onChange={(e:any)=>set(e.target.value.slice(0,max))} placeholder={ph} style={iStyle} />
        </div>
      ))}
      {note&&<div style={{fontSize:11,color:"rgba(252,165,165,.8)"}}>{note}</div>}
      <button onClick={createCrew} disabled={creating||!newName.trim()} style={{
        padding:"10px",borderRadius:12,fontSize:13,fontWeight:700,cursor:"pointer",
        border:"1px solid rgba(212,160,23,.4)",
        background:"linear-gradient(135deg, rgba(88,0,229,.12), rgba(212,160,23,.12))",
        color:"#D4A017",
      }}>
        {creating?"Establishing…":"⚔ Establish Crew"}
      </button>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",flex:1}}>
      <div style={{padding:"10px 12px",borderBottom:"1px solid var(--weered-bd)",flexShrink:0}}>
        <button onClick={()=>setView("create")} style={{
          width:"100%",padding:"9px",borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",
          border:"1px solid rgba(212,160,23,.3)",
          background:"linear-gradient(135deg, rgba(88,0,229,.08), rgba(212,160,23,.08))",
          color:"#D4A017",
        }}>⚔ Establish Crew</button>
      </div>
      {/* Crew presence toast */}
      {presenceToast&&(
        <div style={{
          padding:"6px 12px",display:"flex",alignItems:"center",gap:6,
          background:presenceToast.online?"rgba(34,197,94,.08)":"rgba(255,255,255,.03)",
          borderBottom:"1px solid rgba(255,255,255,.04)",
          animation:"weeredFadeIn 0.2s ease-out",
        }}>
          <span style={{width:6,height:6,borderRadius:"50%",background:presenceToast.online?"#22c55e":"rgba(255,255,255,.2)",boxShadow:presenceToast.online?"0 0 6px rgba(34,197,94,.5)":"none"}} />
          <span style={{fontSize:11,color:presenceToast.online?"rgba(74,222,128,.8)":"rgba(255,255,255,.35)"}}>
            <strong style={{fontWeight:700}}>{presenceToast.name}</strong> {presenceToast.online?"came online":"went offline"}
          </span>
        </div>
      )}
      <div style={{flex:1,overflowY:"auto"}}>
        {!crews.length&&(
          <div style={{padding:32,textAlign:"center" as const,color:"var(--weered-muted)",fontSize:13}}>
            <div style={{fontSize:32,marginBottom:10,opacity:0.3}}>⚔</div>
            <div style={{fontWeight:700,marginBottom:4,color:"rgba(243,244,246,.6)"}}>No crew yet</div>
            <div style={{fontSize:11,opacity:0.4,lineHeight:1.5}}>Establish your crew and<br/>build your reputation together.</div>
          </div>
        )}
        {crews.map(crew=>{
          const isLeader=crew.myRole==="LEADER";
          const isOfficer=crew.myRole==="OFFICER";
          const canManage=isLeader||isOfficer;
          const members=crew.members||[];
          const onlineMembers=members.filter((m:any)=>m.online);
          const isExpanded=expandedCrew===crew.id;

          return (
            <div key={crew.id} style={{borderBottom:"1px solid var(--weered-bd)"}}>
              {/* Crew header card */}
              <div
                onClick={()=>setExpandedCrew(isExpanded?null:crew.id)}
                style={{
                  padding:"12px 14px",cursor:"pointer",
                  background:isExpanded?"rgba(88,0,229,.04)":"transparent",
                  transition:"background 0.15s",
                }}
              >
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  {/* Crew icon */}
                  <div style={{
                    width:38,height:38,borderRadius:10,flexShrink:0,
                    background:"linear-gradient(135deg, rgba(88,0,229,.2), rgba(212,160,23,.15))",
                    border:"1px solid rgba(212,160,23,.25)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:16,fontWeight:900,color:"#D4A017",fontFamily:"monospace",
                  }}>
                    {crew.tag?crew.tag.slice(0,2):crew.name.slice(0,1).toUpperCase()}
                  </div>

                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{fontWeight:800,fontSize:13,color:"rgba(243,244,246,.95)",letterSpacing:"-0.2px"}}>
                        {crew.name}
                      </span>
                      {crew.tag&&(
                        <span style={{
                          fontSize:9,padding:"2px 5px",borderRadius:5,fontFamily:"monospace",fontWeight:700,
                          background:"rgba(212,160,23,.1)",border:"1px solid rgba(212,160,23,.25)",color:"rgba(212,160,23,.7)",
                        }}>[{crew.tag}]</span>
                      )}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,fontSize:10}}>
                      <span style={{color:"var(--weered-muted)"}}>{members.length} members</span>
                      {onlineMembers.length>0&&(
                        <span style={{display:"flex",alignItems:"center",gap:3,color:"rgba(74,222,128,.7)"}}>
                          <span style={{width:5,height:5,borderRadius:999,background:"#22c55e",boxShadow:"0 0 4px rgba(34,197,94,.5)"}} />
                          {onlineMembers.length} online
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand chevron */}
                  <span style={{
                    fontSize:12,color:"var(--weered-muted)",transition:"transform 0.2s",
                    transform:isExpanded?"rotate(180deg)":"rotate(0deg)",
                  }}>▾</span>
                </div>

                {/* Avatar stack preview (collapsed) */}
                {!isExpanded&&members.length>0&&(
                  <div style={{display:"flex",marginTop:8,marginLeft:48}}>
                    {members.slice(0,6).map((m:any,i:number)=>{
                      const bg=m.avatarColor||avatarBg(m.name||"?");
                      return (
                        <div key={m.userId} style={{
                          width:28,height:28,borderRadius:999,
                          border:"2px solid rgba(15,17,23,.9)",
                          marginLeft:i>0?-6:0,zIndex:6-i,
                          background:m.avatar?`url(${m.avatar}) center/cover`:(bg||"rgba(255,255,255,.1)"),
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:10,fontWeight:700,color:"#fff",
                          position:"relative" as const,
                        }}>
                          {!m.avatar&&(m.name||"?")[0]?.toUpperCase()}
                          {m.online&&<span style={{position:"absolute",bottom:-1,right:-1,width:7,height:7,borderRadius:999,background:"#22c55e",border:"1.5px solid rgba(15,17,23,.9)"}} />}
                        </div>
                      );
                    })}
                    {members.length>6&&(
                      <div style={{
                        width:28,height:28,borderRadius:999,marginLeft:-6,
                        background:"rgba(255,255,255,.06)",border:"2px solid rgba(15,17,23,.9)",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:9,fontWeight:700,color:"rgba(255,255,255,.35)",fontFamily:"monospace",
                      }}>+{members.length-6}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Expanded member list + actions */}
              {isExpanded&&(
                <div style={{padding:"0 14px 12px"}}>
                  {/* Description */}
                  {crew.description&&(
                    <div style={{fontSize:11,color:"var(--weered-muted)",lineHeight:1.5,marginBottom:10,padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.04)"}}>
                      {crew.description}
                    </div>
                  )}

                  {/* Member list */}
                  <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:10}}>
                    {members.map((m:any)=>{
                      const badge=roleBadge(m.role);
                      const bg=m.avatarColor||avatarBg(m.name||"?");
                      return (
                        <div key={m.userId} style={{
                          display:"flex",alignItems:"center",gap:8,
                          padding:"6px 8px",borderRadius:8,
                          background:m.online?"rgba(34,197,94,.04)":"transparent",
                          transition:"background 0.15s",
                        }}>
                          {/* Avatar with online indicator */}
                          <div style={{position:"relative" as const,flexShrink:0}}>
                            <div style={{
                              width:28,height:28,borderRadius:999,overflow:"hidden",
                              background:m.avatar?"rgba(255,255,255,.08)":(bg||"rgba(255,255,255,.1)"),
                              display:"flex",alignItems:"center",justifyContent:"center",
                              fontSize:11,fontWeight:700,color:"#fff",
                            }}>
                              {m.avatar
                                ?<img src={m.avatar} alt={(m.name || "User") + " avatar"} style={{width:"100%",height:"100%",objectFit:"cover"}} />
                                :(m.name||"?")[0]?.toUpperCase()
                              }
                            </div>
                            <span style={{
                              position:"absolute" as const,bottom:-1,right:-1,
                              width:8,height:8,borderRadius:999,
                              background:m.online?"#22c55e":"rgba(255,255,255,.12)",
                              border:"2px solid rgba(15,17,23,.95)",
                            }} />
                          </div>

                          {/* Name + role + location */}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <span style={{fontSize:12,fontWeight:m.role==="LEADER"?800:600,color:m.role==="LEADER"?"rgba(243,244,246,.95)":"rgba(226,232,240,.8)"}}>
                                {m.name}
                              </span>
                              {badge&&(
                                <span style={{
                                  fontSize:8,fontWeight:700,letterSpacing:"0.06em",
                                  padding:"1px 5px",borderRadius:4,
                                  background:badge.bg,border:`1px solid ${badge.border}`,color:badge.color,
                                }}>{badge.label}</span>
                              )}
                              {m.userId===myId&&(
                                <span style={{fontSize:8,fontWeight:700,padding:"1px 4px",borderRadius:4,background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.25)"}}>YOU</span>
                              )}
                            </div>
                            {m.online&&m.roomName&&(
                              <div style={{fontSize:10,color:"rgba(74,222,128,.5)",marginTop:1}}>
                                in {m.roomName}
                              </div>
                            )}
                          </div>

                          {/* Join button */}
                          {m.online&&m.roomId&&m.userId!==myId&&(
                            <button onClick={()=>onJoin(m.roomId)} style={{
                              padding:"4px 10px",borderRadius:7,fontSize:10,fontWeight:700,cursor:"pointer",
                              border:"1px solid rgba(88,0,229,.35)",background:"rgba(88,0,229,.12)",color:"rgba(167,139,250,.9)",
                              transition:"all 0.15s",
                            }}>Join</button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Invite input (leaders/officers) */}
                  {canManage && (
                    <div style={{display:"flex",gap:6,marginBottom:6}}>
                      <input
                        value={inviteInput[crew.id]||""}
                        onChange={(e:any)=>setInviteInput(v=>({...v,[crew.id]:e.target.value}))}
                        placeholder="Invite by username…"
                        style={{flex:1,padding:"7px 10px",borderRadius:9,border:"1px solid var(--weered-bd2)",background:"rgba(255,255,255,.04)",color:"var(--weered-text)",outline:"none",fontSize:11}}
                        onKeyDown={(e:any)=>{if(e.key==="Enter")inviteMember(crew.id);}}
                      />
                      <button onClick={()=>inviteMember(crew.id)} style={{
                        padding:"7px 12px",borderRadius:9,fontSize:11,cursor:"pointer",fontWeight:700,
                        border:"1px solid rgba(88,0,229,.3)",background:"rgba(88,0,229,.1)",color:"rgba(167,139,250,.9)",
                      }}>+</button>
                    </div>
                  )}
                  {inviteNote[crew.id]&&<div style={{fontSize:10,marginBottom:4,color:inviteNote[crew.id]==="Invited!"?"rgba(74,222,128,.7)":"rgba(252,165,165,.7)"}}>{inviteNote[crew.id]}</div>}

                  {/* Crew Chat */}
                  <div style={{marginBottom:8,borderRadius:10,border:"1px solid rgba(255,255,255,.06)",overflow:"hidden",height:260}}>
                    <CrewChatPanel crewId={crew.id} crewName={crew.name} myId={myId} myName={myName} />
                  </div>

                  {/* Actions */}
                  <div style={{display:"flex",gap:6}}>
                    {isLeader
                      ?<button onClick={()=>disbandCrew(crew.id)} style={{padding:"5px 10px",borderRadius:7,border:"1px solid rgba(239,68,68,.25)",background:"rgba(239,68,68,.06)",color:"rgba(252,165,165,.7)",fontSize:10,cursor:"pointer",fontWeight:600}}>Disband Crew</button>
                      :<button onClick={()=>leaveCrew(crew.id)} style={{padding:"5px 10px",borderRadius:7,border:"1px solid var(--weered-bd)",background:"transparent",color:"var(--weered-muted)",fontSize:10,cursor:"pointer",fontWeight:600}}>Leave Crew</button>
                    }
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
