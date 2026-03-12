"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWeered } from "./WeeredProvider";
import { avatarBg } from "../lib/avatarColor";

type DmMsg = { id: string; fromId: string; toId: string; body: string; createdAt: string; readAt?: string | null };
type DmThread = { peerId: string; peerName: string; msgs: DmMsg[]; unread: number };

const WEERED_THEME_KEY = "weered_theme_v1";
type WeeredThemeName = "slate" | "zinc" | "stone" | "gray";

const WEERED_THEMES: Record<WeeredThemeName, any> = {
  slate: { bg:"rgb(2,6,23)", panel:"rgba(15,23,42,.92)", panel2:"rgba(17,24,39,.94)", bd:"rgba(148,163,184,.14)", bd2:"rgba(148,163,184,.26)", text:"rgba(229,231,235,.96)", muted:"rgba(148,163,184,.75)", accentBg:"rgba(14,165,233,.18)", accentRing:"rgba(14,165,233,.35)", accentText:"rgba(56,189,248,.95)" },
  zinc:  { bg:"rgb(9,9,11)", panel:"rgba(24,24,27,.92)", panel2:"rgba(24,24,27,.94)", bd:"rgba(161,161,170,.18)", bd2:"rgba(161,161,170,.28)", text:"rgba(244,244,245,.96)", muted:"rgba(161,161,170,.78)", accentBg:"rgba(34,197,94,.16)", accentRing:"rgba(34,197,94,.34)", accentText:"rgba(74,222,128,.95)" },
  stone: { bg:"rgb(12,10,9)", panel:"rgba(28,25,23,.92)", panel2:"rgba(28,25,23,.94)", bd:"rgba(168,162,158,.18)", bd2:"rgba(168,162,158,.28)", text:"rgba(245,245,244,.96)", muted:"rgba(168,162,158,.78)", accentBg:"rgba(245,158,11,.16)", accentRing:"rgba(245,158,11,.34)", accentText:"rgba(251,191,36,.95)" },
  gray:  { bg:"rgb(3,7,18)", panel:"rgba(17,24,39,.92)", panel2:"rgba(17,24,39,.94)", bd:"rgba(156,163,175,.18)", bd2:"rgba(156,163,175,.28)", text:"rgba(243,244,246,.96)", muted:"rgba(156,163,175,.78)", accentBg:"rgba(20,184,166,.16)", accentRing:"rgba(20,184,166,.34)", accentText:"rgba(45,212,191,.95)" },
};

function applyWeeredTheme(name: WeeredThemeName) {
  if (typeof document === "undefined") return;
  const t = WEERED_THEMES[name] || WEERED_THEMES.slate;
  const root = document.documentElement;
  Object.entries({ "--weered-bg":t.bg,"--weered-panel":t.panel,"--weered-panel2":t.panel2,"--weered-bd":t.bd,"--weered-bd2":t.bd2,"--weered-text":t.text,"--weered-muted":t.muted,"--weered-accent-bg":t.accentBg,"--weered-accent-ring":t.accentRing,"--weered-accent-text":t.accentText }).forEach(([k,v]) => root.style.setProperty(k, v));
  root.setAttribute("data-weered-theme", name);
}

function __id() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function pickFirstString(...vals: any[]): string { for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim(); return ""; }
function normRole(v: any): string { const s = String(v||"").trim(); return s ? s.toUpperCase() : ""; }

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
    <div style={{ display:"flex", background:"rgba(255,255,255,.06)", borderRadius:10, padding:3, gap:2 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
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
  const [tab, setTab] = useState<"room"|"dms"|"friends">("room");
  const [text, setText] = useState("");
  const [dockMode, setDockMode] = useState<"rail"|"floating">(props.forceMode || "floating");
  const [theme, setTheme] = useState<WeeredThemeName>(() => {
    try { const v = String(localStorage.getItem(WEERED_THEME_KEY)||"").trim(); if(["slate","zinc","stone","gray"].includes(v)) return v as WeeredThemeName; } catch {}
    return "stone";
  });

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

  useEffect(()=>{
    if (!tokenMaybe||!apiBase) return;
    fetch(`${apiBase}/dm/unread`,{headers:{Authorization:`Bearer ${tokenMaybe}`}}).then(r=>r.json()).then(j=>{
      if (!j?.counts) return;
      setDmThreads(cur=>cur.map(t=>({...t,unread:j.counts[t.peerId]??0})));
    }).catch(()=>{});
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
    <div style={{...panel, display:"flex", flexDirection:"column"}}>

      {/* ── Header ── */}
      <div style={{ padding:"14px 16px 10px", borderBottom:"1px solid var(--weered-bd)", flexShrink:0 }}>
        {/* Top row */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <Avatar name={meName} size={34} isMe />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:14, lineHeight:1.2 }}>{meName}</div>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
              <StatusDot online={wsUp} />
              <span style={{ fontSize:11, color:"var(--weered-muted)" }}>
                {wsUp ? (roomTitle ? roomTitle : "online") : "offline"}
              </span>
              {globalRole && <span style={{ fontSize:10, color:"var(--weered-accent-text)", background:"var(--weered-accent-bg)", padding:"1px 6px", borderRadius:999, fontWeight:700 }}>{globalRole}</span>}
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <select value={theme} onChange={e=>setTheme(e.target.value as any)} style={{ background:"rgba(255,255,255,.07)",color:"var(--weered-muted)",border:"1px solid var(--weered-bd)",borderRadius:8,padding:"4px 6px",fontSize:11,outline:"none",cursor:"pointer" }}>
              <option value="slate">Slate</option>
              <option value="zinc">Zinc</option>
              <option value="stone">Stone</option>
              <option value="gray">Gray</option>
            </select>
            {typeof logout==="function" && <button onClick={()=>call(logout)} style={{ padding:"5px 10px",borderRadius:8,border:"1px solid var(--weered-bd)",background:"transparent",color:"var(--weered-muted)",fontSize:11,cursor:"pointer",fontWeight:600 }}>Out</button>}
            <button onClick={()=>{try{window.dispatchEvent(new CustomEvent("weered:dock:close"));}catch{}}} style={{ width:26,height:26,borderRadius:999,border:"none",background:"rgba(255,255,255,.08)",color:"var(--weered-muted)",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <SegmentedControl
          tabs={[
            {id:"room",label:"Room"},
            {id:"dms",label:"Messages",badge:totalUnread},
            {id:"friends",label:"People"},
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
                      <div style={{ fontSize:13, lineHeight:"18px", color:"var(--weered-text)" }}>{body}</div>
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
          // ── DMS TAB ──
          <div style={{ display:"flex", flexDirection:"column", flex:1, height:"100%" }}>
            {/* Thread list */}
            <div style={{ padding:"10px 12px", borderBottom:"1px solid var(--weered-bd)", flexShrink:0 }}>
              <div style={{ display:"flex", gap:6 }}>
                <input value={dmPeer} onChange={e=>setDmPeer((e.target as any).value||"")} placeholder="New message..." style={inputStyle}
                  onKeyDown={e=>{if((e as any).key==="Enter") void dmCreateThread();}} />
                <button style={sendBtn} onClick={()=>void dmCreateThread()}>+</button>
              </div>
            </div>

            {dmThreads.length>0 && !dmActive && (
              <div style={{ flex:1, overflowY:"auto" }}>
                {dmThreads.map(t=>(
                  <button key={t.peerId} onClick={()=>setDmActivePeerId(t.peerId)} style={{ width:"100%",textAlign:"left",padding:"12px 16px",border:"none",borderBottom:"1px solid var(--weered-bd)",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:10 }}>
                    <Avatar name={t.peerName} size={36} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13, color:"var(--weered-text)" }}>@{t.peerName}</div>
                      <div style={{ fontSize:11, color:"var(--weered-muted)", marginTop:1 }}>{t.msgs.length ? t.msgs[t.msgs.length-1].body.slice(0,35)+"..." : "No messages"}</div>
                    </div>
                    {t.unread>0 && <UnreadBadge count={t.unread} />}
                  </button>
                ))}
              </div>
            )}

            {dmActive ? (
              <>
                {/* Thread header */}
                <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--weered-bd)", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                  <button onClick={()=>setDmActivePeerId("")} style={{ background:"none",border:"none",color:"var(--weered-muted)",cursor:"pointer",fontSize:18,padding:"0 4px",lineHeight:1 }}>←</button>
                  <Avatar name={dmActive.peerName} size={30} />
                  <span style={{ fontWeight:700, fontSize:14 }}>@{dmActive.peerName}</span>
                  <button onClick={()=>{setDmThreads(cur=>cur.filter(t=>t.peerId!==dmActive.peerId));setDmActivePeerId("");}} style={{ marginLeft:"auto",background:"none",border:"none",color:"var(--weered-muted)",cursor:"pointer",fontSize:12 }}>Delete</button>
                </div>

                {/* Messages */}
                <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                  {dmLoading ? (
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", flex:1 }}>
                      <span style={{ color:"var(--weered-muted)", fontSize:13 }}>Loading...</span>
                    </div>
                  ) : dmActive.msgs.length ? dmActive.msgs.map(m=>{
                    const isMe=m.fromId===String(me?.id||"");
                    return (
                      <div key={m.id} style={{ display:"flex", flexDirection:"column", alignItems:isMe?"flex-end":"flex-start" }}>
                        <div style={{ maxWidth:"82%", padding:"9px 13px", borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px", background:isMe?"var(--weered-accent-bg)":"rgba(255,255,255,.07)", border:isMe?"1px solid var(--weered-accent-ring)":"1px solid var(--weered-bd)" }}>
                          <div style={{ fontSize:13, lineHeight:"19px", color:"var(--weered-text)" }}>{m.body}</div>
                        </div>
                        <span style={{ fontSize:10, color:"var(--weered-muted)", marginTop:3 }}>{fmtTime(m.createdAt)}</span>
                      </div>
                    );
                  }) : (
                    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ color:"var(--weered-muted)", fontSize:13 }}>Say hello 👋</span>
                    </div>
                  )}
                  <div ref={dmEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding:"10px 12px", borderTop:"1px solid var(--weered-bd)", display:"flex", gap:8, flexShrink:0 }}>
                  <input ref={dmInputRef} value={dmDraft} onChange={e=>setDmDraft((e.target as any).value||"")} placeholder="Message..." style={inputStyle}
                    onKeyDown={e=>{if((e as any).key==="Enter"){e.preventDefault();void dmSend();}}} />
                  <button style={sendBtn} onClick={()=>void dmSend()}>↑</button>
                </div>
              </>
            ) : dmThreads.length===0 ? (
              <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, padding:24 }}>
                <span style={{ fontSize:28 }}>💬</span>
                <span style={{ fontSize:13, color:"var(--weered-muted)", textAlign:"center" as const }}>No conversations yet.<br/>Search for someone above.</span>
              </div>
            ) : null}
          </div>

        ) : tab==="friends" ? (
          <FriendsTab dmThreads={dmThreads} rooms={userArr}
            onMessage={(peerName,peerId)=>{
              setTab("dms");
              setDmThreads(cur=>{const ex=cur.find(t=>t.peerId===peerId||t.peerName.toLowerCase()===peerName.toLowerCase()); if(ex){setDmActivePeerId(ex.peerId);return cur;} setDmActivePeerId(peerId); return [{peerId,peerName,msgs:[],unread:0},...cur];});
            }}
            onJoin={roomId=>{try{(ctx as any)?.join?.(roomId);}catch{}}}
          />
        ) : null}
      </div>
    </div>
  );
}

function FriendsTab({ dmThreads, rooms, onMessage, onJoin }: { dmThreads:DmThread[]; rooms:any[]; onMessage:(pn:string,pi:string)=>void; onJoin:(r:string)=>void }) {
  const friends = dmThreads.map(t=>({ thread:t, online:rooms.find((u:any)=>String(u?.name??u?.username??"").toLowerCase()===t.peerName.toLowerCase()||(t.peerId&&String(u?.id??"")===t.peerId))??null }));
  const online = friends.filter(f=>f.online);
  const offline = friends.filter(f=>!f.online);

  const render = (f:{thread:DmThread;online:any}) => {
    const {thread,online:o}=f;
    const roomId=String(o?.roomId??o?.activeRoom??o?.room??"");
    const roomName=String(o?.roomName??o?.room??roomId??"");
    return (
      <div key={thread.peerId} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:"1px solid var(--weered-bd)" }}>
        <div style={{ position:"relative" as const }}>
          <Avatar name={thread.peerName} size={36} />
          <span style={{ position:"absolute" as const, bottom:0, right:0, width:10, height:10, borderRadius:999, background:o?"#22c55e":"rgba(255,255,255,.2)", border:"2px solid var(--weered-panel2)" }} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:600, fontSize:13 }}>@{thread.peerName}</div>
          <div style={{ fontSize:11, color:"var(--weered-muted)", marginTop:1 }}>{o?(roomName?`in ${roomName}`:"online"):"offline"}</div>
        </div>
        <div style={{ display:"flex", gap:5 }}>
          <button onClick={()=>onMessage(thread.peerName,thread.peerId??"")} style={{ padding:"5px 10px",borderRadius:8,border:"1px solid var(--weered-bd2)",background:"rgba(255,255,255,.05)",color:"var(--weered-text)",fontSize:11,cursor:"pointer",fontWeight:600 }}>DM</button>
          {o&&roomId&&<button onClick={()=>onJoin(roomId)} style={{ padding:"5px 10px",borderRadius:8,border:"1px solid var(--weered-accent-ring)",background:"var(--weered-accent-bg)",color:"var(--weered-accent-text)",fontSize:11,cursor:"pointer",fontWeight:600 }}>Join</button>}
        </div>
      </div>
    );
  };

  if (!friends.length) return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:24 }}>
      <span style={{ fontSize:28 }}>👥</span>
      <span style={{ fontSize:13,color:"var(--weered-muted)",textAlign:"center" as const }}>No contacts yet.<br/>Message someone to add them.</span>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column" }}>
      {online.length>0&&<><div style={{ padding:"10px 14px 4px",fontSize:11,fontWeight:700,color:"var(--weered-muted)",textTransform:"uppercase" as const,letterSpacing:.5 }}>Online · {online.length}</div>{online.map(render)}</>}
      {offline.length>0&&<><div style={{ padding:"10px 14px 4px",fontSize:11,fontWeight:700,color:"var(--weered-muted)",textTransform:"uppercase" as const,letterSpacing:.5,marginTop:4 }}>Offline · {offline.length}</div>{offline.map(render)}</>}
    </div>
  );
}
