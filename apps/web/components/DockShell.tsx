"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWeered } from "./WeeredProvider";
import { avatarBg } from "../lib/avatarColor";
import CrewChatPanel from "./CrewChatPanel";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import GroupsTab from "./GroupsTab";
import LinkPreviewCard from "./LinkPreviewCard";
import { weeredConfirm } from "../lib/confirm";

type DmReaction = { emoji: string; count: number; users: string[] };
type DmReplyTo = { id: string; userName: string; body: string };
type DmMsg = { id: string; fromId: string; toId: string; body: string; createdAt: string; readAt?: string | null; editedAt?: string | null; deletedAt?: string | null; reactions?: DmReaction[]; replyToId?: string | null; replyToUserId?: string | null; replyToUserName?: string | null; replyToBody?: string | null };
type DmThread = { peerId: string; peerName: string; peerAvatar?: string | null; peerAvatarColor?: string | null; peerOnline?: boolean; msgs: DmMsg[]; unread: number };
type GroupMemberLite = { id: string; name: string; avatar?: string | null };
type GroupThreadLite = {
  id: string; name: string | null; createdById: string; role: "OWNER" | "MEMBER";
  unread: number; lastMessageAt: string; members: GroupMemberLite[];
  lastMessage: { id: string; senderId: string; body: string; createdAt: string; deleted?: boolean } | null;
};

const IMG_RE = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;
const TENOR_DM_RE = /https?:\/\/media\.tenor\.com\/[^\s]+/i;

function linkify(text: string): React.ReactNode {
  const urlRx = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRx);
  const nodes: React.ReactNode[] = [];
  const images: string[] = [];
  const previews: string[] = [];

  parts.forEach((p, i) => {
    if (urlRx.test(p)) {
      nodes.push(<a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: "rgb(167,139,250)", textDecoration: "underline", wordBreak: "break-all" }}>{p}</a>);
      if (IMG_RE.test(p) || TENOR_DM_RE.test(p)) images.push(p);
      else previews.push(p);
    } else {
      nodes.push(p);
    }
  });

  return (
    <>
      <div>{nodes}</div>
      {images.map((src, i) => (
        <img key={`dm-img-${i}`} src={src} alt="Chat image" loading="lazy" style={{
          maxWidth: 200, maxHeight: 160, borderRadius: 8, marginTop: 4,
          border: "1px solid rgba(255,255,255,.1)", display: "block",
        }} onError={e => (e.currentTarget.style.display = "none")} />
      ))}
      {previews.slice(0, 1).map((url, i) => (
        <LinkPreviewCard key={`dm-lp-${i}`} url={url} />
      ))}
    </>
  );
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
  const t = WEERED_THEMES[name] || WEERED_THEMES.press;
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
const ROLE_DISPLAY_DOCK_WINDROSE: Record<string, string> = {
  GOD: "ADMIRAL", ADMIN: "FIRST MATE", STAFF: "BOATSWAIN", SUPPORT: "LOOKOUT",
  MOD: "QUARTERMASTER", OWNER: "CAPTAIN",
};
function roleDisplayDock(dbRole: string, lobbyTheme?: string | null): string {
  if (lobbyTheme === "windrose" && ROLE_DISPLAY_DOCK_WINDROSE[dbRole]) return ROLE_DISPLAY_DOCK_WINDROSE[dbRole];
  return ROLE_DISPLAY_DOCK[dbRole] || dbRole;
}

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

function Avatar({ name, size=32, color, isMe, chosenColor, src }: { name: string; size?: number; color?: string; isMe?: boolean; chosenColor?: string; src?: string | null }) {
  const bg = color || avatarBg(name, isMe, chosenColor);
  const common: React.CSSProperties = {
    width: size, height: size, borderRadius: 999,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, userSelect: "none" as const, overflow: "hidden",
  };
  if (src) {
    return (
      <div style={{ ...common, background: bg }}>
        <img src={src} alt={name + " avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      </div>
    );
  }
  return (
    <div style={{ ...common, background: bg, fontSize: size * 0.38, fontWeight: 700, color: "#fff" }}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function StatusDot({ online }: { online: boolean }) {
  return <span style={{ width:8, height:8, borderRadius:999, background: online ? "#22c55e" : "rgba(255,255,255,.2)", display:"inline-block", flexShrink:0 }} />;
}

function GroupAvatarStack({ members }: { members: { id: string; name: string; avatar?: string | null }[] }) {
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;
  return (
    <div style={{ position:"relative", width:42, height:42, flexShrink:0 }}>
      {shown.map((m, i) => (
        <div key={m.id} style={{
          position:"absolute", left:i*10, top:i*6,
          width:26, height:26, borderRadius:"50%", overflow:"hidden",
          border:"2px solid var(--weered-panel2, #15121d)",
          background: m.avatar ? `url(${m.avatar}) center/cover` : avatarBg(m.name||"?"),
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:11, fontWeight:800, color:"#fff",
          zIndex: shown.length - i,
        }}>
          {!m.avatar && (m.name||"?").charAt(0).toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <div style={{
          position:"absolute", left:shown.length*10, top:shown.length*6,
          width:26, height:26, borderRadius:"50%",
          border:"2px solid var(--weered-panel2, #15121d)",
          background:"var(--weered-accent-bg)", color:"var(--weered-accent-text)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:9, fontWeight:800, zIndex:0,
        }}>+{extra}</div>
      )}
    </div>
  );
}

function UnreadBadge({ count, floating, tone }: { count: number; floating?: boolean; tone?: "red" | "blue" }) {
  if (!count) return null;
  const bg = tone === "blue" ? "#3b82f6" : "#ef4444";
  if (floating) {
    return <span style={{
      position:"absolute", top:-6, right:-6, minWidth:16, height:16, borderRadius:999,
      background:bg, color:"#fff", fontSize:9, fontWeight:800,
      display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"0 4px",
      boxShadow:"0 0 0 3px var(--weered-panel, #0f0f15)",
      pointerEvents:"none", zIndex:2,
    }}>{count > 99 ? "99+" : count}</span>;
  }
  return <span style={{ minWidth:18, height:18, borderRadius:999, background:bg, color:"#fff", fontSize:10, fontWeight:800, display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"0 5px" }}>{count > 99 ? "99+" : count}</span>;
}

function SegmentedControl({ tabs, active, onChange }: { tabs: {id:string;label:string;badge?:number;tone?:"red"|"blue"}[]; active:string; onChange:(id:string)=>void }) {
  return (
    <div className="weered-dock-tabs" style={{ display:"flex", background:"rgba(255,255,255,.06)", borderRadius:10, padding:3, gap:2 }}>
      {tabs.map(t => (
        <button key={t.id} className={`weered-dock-tab${active===t.id?" weered-dock-tab-active":""}`} onClick={() => onChange(t.id)} style={{
          position:"relative", flex:1, minWidth:0, padding:"6px 8px", borderRadius:8, border:"none",
          background: active===t.id ? "var(--weered-accent-bg, rgba(124,157,255,.18))" : "transparent",
          color: active===t.id ? "var(--weered-accent-text, var(--weered-text))" : "var(--weered-muted)",
          boxShadow: active===t.id ? "inset 0 0 0 1px var(--weered-accent-ring, rgba(124,157,255,.35))" : "none",
          fontSize:12, fontWeight: active===t.id ? 700 : 500,
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          transition:"all .15s",
        }}>
          {t.label}
          {!!t.badge && <UnreadBadge count={t.badge} floating tone={t.tone || "red"} />}
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
  const [theme, setTheme] = useState<WeeredThemeName>("press");
  const [themeHydrated, setThemeHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = String(localStorage.getItem(WEERED_THEME_KEY) || "").trim();
      if (["slate","zinc","stone","gray","ishimura","broadcast","press"].includes(v)) setTheme(v as WeeredThemeName);
    } catch {}
    setThemeHydrated(true);
  }, []);

  useEffect(() => {
    if (!themeHydrated) return;
    try { localStorage.setItem(WEERED_THEME_KEY, theme); } catch {}
    applyWeeredTheme(theme);
  }, [theme, themeHydrated]);

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

  const [dmThreads, setDmThreads] = useState<DmThread[]>([]);
  const [dmActivePeerId, setDmActivePeerId] = useState("");
  const [dmPeer, setDmPeer] = useState("");
  const [dmDraft, setDmDraft] = useState("");
  const [dmLoading, setDmLoading] = useState(false);
  const [dmEditingMsgId, setDmEditingMsgId] = useState("");
  const [dmEditDraft, setDmEditDraft] = useState("");
  const [dmHoveredMsgId, setDmHoveredMsgId] = useState("");
  const [dmPickerMsgId, setDmPickerMsgId] = useState("");
  const [dmReplyingTo, setDmReplyingTo] = useState<{ id: string; userName: string; body: string } | null>(null);
  const DM_QUICK_REACTIONS = ["👍","❤️","😂","🔥","🎉","😢","😮","🙌"];

  const [groupThreads, setGroupThreads] = useState<GroupThreadLite[]>([]);
  const [dmActiveGroupId, setDmActiveGroupId] = useState("");
  const [groupCompose, setGroupCompose] = useState(false);

  const reloadGroups = useCallback(() => {
    if (!apiBase || !tokenMaybe) return;
    fetch(`${apiBase}/groups`, { headers: { Authorization: `Bearer ${tokenMaybe}` } })
      .then(r => r.json())
      .then(j => { if (j?.ok && Array.isArray(j.threads)) setGroupThreads(j.threads); })
      .catch(() => {});
  }, [apiBase, tokenMaybe]);

  useEffect(() => { reloadGroups(); }, [reloadGroups]);
  useEffect(() => {
    const onMsg = (e: Event) => {
      const m = (e as CustomEvent).detail?.message;
      if (!m?.threadId) { reloadGroups(); return; }
      setGroupThreads(cur => cur.map(t => {
        if (t.id !== m.threadId) return t;
        const mine = m.senderId === String(me?.id || "");
        const isOpen = dmActiveGroupId === t.id;
        return {
          ...t,
          lastMessage: { id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt },
          lastMessageAt: m.createdAt,
          unread: (isOpen || mine) ? t.unread : (t.unread || 0) + 1,
        };
      }).sort((a, b) => (b.lastMessageAt > a.lastMessageAt ? 1 : -1)));
    };
    const onStruct = () => reloadGroups();
    window.addEventListener("weered:group:message", onMsg);
    window.addEventListener("weered:group:created", onStruct);
    window.addEventListener("weered:group:renamed", onStruct);
    window.addEventListener("weered:group:members:added", onStruct);
    window.addEventListener("weered:group:members:removed", onStruct);
    return () => {
      window.removeEventListener("weered:group:message", onMsg);
      window.removeEventListener("weered:group:created", onStruct);
      window.removeEventListener("weered:group:renamed", onStruct);
      window.removeEventListener("weered:group:members:added", onStruct);
      window.removeEventListener("weered:group:members:removed", onStruct);
    };
  }, [reloadGroups, me, dmActiveGroupId]);

  useEffect(() => {
    if (!dmActiveGroupId) return;
    setGroupThreads(cur => cur.map(t => t.id === dmActiveGroupId ? { ...t, unread: 0 } : t));
  }, [dmActiveGroupId]);

  useEffect(() => {
    if (dmActivePeerId) { setDmActiveGroupId(""); setGroupCompose(false); }
  }, [dmActivePeerId]);

  useEffect(() => {
    if (!dmPickerMsgId) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (t && t.closest?.("[data-reaction-ui]")) return;
      setDmPickerMsgId("");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [dmPickerMsgId]);
  const dmEndRef = useRef<HTMLDivElement|null>(null);
  const dmInputRef = useRef<HTMLInputElement|null>(null);
  const roomInputRef = useRef<HTMLInputElement|null>(null);

  useEffect(()=>{
    if (!tokenMaybe||!apiBase) return;
    fetch(`${apiBase}/dm/conversations`,{headers:{Authorization:`Bearer ${tokenMaybe}`}}).then(r=>r.json()).then(j=>{
      if (!Array.isArray(j?.conversations)) return;
      setDmThreads(cur=>{
        const byId=new Map(cur.map((t:DmThread)=>[t.peerId,t]));
        const merged:DmThread[]=[];
        for (const t of cur) {
          const c=j.conversations.find((x:any)=>(x.id||x.peerId)===t.peerId);
          if (c) merged.push({...t, peerName:c.name||c.usernameKey||t.peerName, peerAvatar:c.avatar??t.peerAvatar??null, peerAvatarColor:c.avatarColor??t.peerAvatarColor??null, peerOnline:!!c.online, unread:c.unread??t.unread});
          else merged.push(t);
        }
        for (const c of j.conversations) {
          const id=c.id||c.peerId;
          if (byId.has(id)) continue;
          merged.push({peerId:id, peerName:c.name||c.usernameKey||id, peerAvatar:c.avatar??null, peerAvatarColor:c.avatarColor??null, peerOnline:!!c.online, msgs:[], unread:c.unread||0});
        }
        return merged;
      });
    }).catch(()=>{});
  },[tokenMaybe,apiBase]);

  useEffect(()=>{
    if (!tokenMaybe||!apiBase) return;
    function pollUnread() {
      fetch(`${apiBase}/dm/unread`,{headers:{Authorization:`Bearer ${tokenMaybe}`}}).then(r=>r.json()).then(j=>{
        if (!j?.counts) return;
        const newPeerIds = Object.keys(j.counts).filter(pid=>!dmThreads.find(t=>t.peerId===pid));
        if (newPeerIds.length) {
          fetch(`${apiBase}/dm/conversations`,{headers:{Authorization:`Bearer ${tokenMaybe}`}}).then(r=>r.json()).then(conv=>{
            if (!Array.isArray(conv?.conversations)) return;
            setDmThreads(cur=>{
              const existing=new Set(cur.map((t:DmThread)=>t.peerId));
              const incoming=conv.conversations.filter((c:any)=>!existing.has(c.id||c.peerId)).map((c:any)=>({peerId:c.id||c.peerId,peerName:c.name||c.usernameKey||c.id,peerAvatar:c.avatar??null,peerAvatarColor:c.avatarColor??null,peerOnline:!!c.online,msgs:[],unread:c.unread||0}));
              return [...cur,...incoming];
            });
          }).catch(()=>{});
        }
        setDmThreads(cur=>cur.map(t=>({...t,unread:j.counts[t.peerId]??0})));
      }).catch(()=>{});
    }
    pollUnread();
    const t = setInterval(pollUnread, 60000);
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

    const editHandler=(ev:any)=>{
      const d=ev?.detail; if (!d) return;
      const msgId=String(d.msgId||""); const newBody=String(d.body||"");
      const editedAt=d.editedAt; if (!msgId) return;
      const meId=String(me?.id||"");
      const peerId=d.fromId===meId?d.toId:d.fromId;
      setDmThreads(cur=>cur.map(t=>t.peerId===peerId?{...t,msgs:t.msgs.map(m=>m.id===msgId?{...m,body:newBody,editedAt} as any:m)}:t));
    };
    const delHandler=(ev:any)=>{
      const d=ev?.detail; if (!d) return;
      const msgId=String(d.msgId||""); const deletedAt=d.deletedAt; if (!msgId) return;
      const meId=String(me?.id||"");
      const peerId=d.fromId===meId?d.toId:d.fromId;
      setDmThreads(cur=>cur.map(t=>t.peerId===peerId?{...t,msgs:t.msgs.map(m=>m.id===msgId?{...m,body:"",deletedAt} as any:m)}:t));
    };
    const rxHandler=(ev:any)=>{
      const d=ev?.detail; if (!d) return;
      const msgId=String(d.msgId||""); const reactions=Array.isArray(d.reactions)?d.reactions:[];
      if (!msgId) return;
      const meId=String(me?.id||"");
      const peerId=d.fromId===meId?d.toId:d.fromId;
      setDmThreads(cur=>cur.map(t=>t.peerId===peerId?{...t,msgs:t.msgs.map(m=>m.id===msgId?{...m,reactions} as any:m)}:t));
    };

    window.addEventListener("weered:dm:edited",editHandler as any);
    window.addEventListener("weered:dm:deleted",delHandler as any);
    window.addEventListener("weered:dm:reaction",rxHandler as any);

    return ()=>{
      window.removeEventListener("weered:dm:message",handler as any);
      window.removeEventListener("weered:dm:edited",editHandler as any);
      window.removeEventListener("weered:dm:deleted",delHandler as any);
      window.removeEventListener("weered:dm:reaction",rxHandler as any);
    };
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
      if (!d) return;
      if (typeof d.tab === "string") {
        const t = String(d.tab).toLowerCase();
        if (t === "room" || t === "dms" || t === "friends" || t === "crew") {
          setTab(t as any);
          setOpen(true);
          return;
        }
      }
      if (d.mode!=="dm") return;
      const peerName=pickFirstString(d?.peer?.name,d?.peerName,d?.peer,"");
      const peerId=pickFirstString(d?.peer?.id,d?.peerId,"");
      if (!peerName&&!peerId) return;
      setTab("dms");
      setOpen(true);
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
  const groupUnread = useMemo(()=>groupThreads.reduce((s,t)=>s+(t.unread||0),0),[groupThreads]);
  const totalUnread = useMemo(()=>dmThreads.reduce((s,t)=>s+t.unread,0)+groupUnread,[dmThreads,groupUnread]);

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
    const body=dmDraft.trim();
    const replyToId = dmReplyingTo?.id;
    setDmDraft("");
    setDmReplyingTo(null);
    const meId=String(me?.id||"");
    const optimistic:DmMsg={id:__id(),fromId:meId,toId:dmActive.peerId,body,createdAt:new Date().toISOString(),readAt:null};
    if (replyToId && dmReplyingTo) {
      (optimistic as any).replyToId = replyToId;
      (optimistic as any).replyToUserName = dmReplyingTo.userName;
      (optimistic as any).replyToBody = dmReplyingTo.body.slice(0, 120);
    }
    setDmThreads(cur=>cur.map(t=>t.peerId===dmActive.peerId?{...t,msgs:[...t.msgs,optimistic]}:t));
    try {
      if(typeof (ctx as any)?.sendRaw==="function") (ctx as any).sendRaw({type:"dm:send",toId:dmActive.peerId,body, ...(replyToId?{replyToId}:{})});
      else await fetch(`${apiBase}/dm/${dmActive.peerId}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${tokenMaybe}`},body:JSON.stringify({body, replyToId})});
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

      <div className="weered-dock-header" style={{ padding:"10px 14px 0", borderBottom:"1px solid var(--weered-bd)", flexShrink:0 }}>
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

        <SegmentedControl
          tabs={[
            {id:"dms",label:"Messages",badge:totalUnread,tone:"red"},
            {id:"friends",label:"Friends"},
            {id:"crew",label:"Crew"},
          ]}
          active={tab}
          onChange={id=>setTab(id as any)}
        />
      </div>

      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>

        {tab==="room" ? (
          <div style={{ display:"flex", flexDirection:"column", flex:1, height:"100%" }}>
            {needJoin && (
              <div style={{ margin:"12px 14px 0", padding:"10px 12px", borderRadius:12, background:"var(--weered-accent-bg)", border:"1px solid var(--weered-accent-ring)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                <span style={{ fontSize:12, color:"var(--weered-accent-text)", fontWeight:600 }}>Not joined yet</span>
                {typeof knock==="function" && <button onClick={()=>call(knock,viewId)} style={{ padding:"5px 12px",borderRadius:8,border:"1px solid var(--weered-accent-ring)",background:"transparent",color:"var(--weered-accent-text)",fontSize:12,cursor:"pointer",fontWeight:700 }}>Knock</button>}
              </div>
            )}

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
                <EmptyState title="Quiet in here." hint="Be the one who breaks the silence." />
              )}
            </div>

            <div style={{ padding:"10px 12px", borderTop:"1px solid var(--weered-bd)", display:"flex", gap:8, flexShrink:0 }}>
              <input ref={roomInputRef} value={text} onChange={e=>setText((e.target as any).value||"")} placeholder="Message..." style={inputStyle}
                onKeyDown={e=>{if((e as any).key==="Enter"){sendRoomChat(text);setText("");}}} />
              <button style={sendBtn} onClick={()=>{sendRoomChat(text);setText("");}}>↑</button>
            </div>

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
          <div style={{ display:"flex", flexDirection:"column", flex:1, height:"100%", position:"relative" }}>

            {(dmActiveGroupId || groupCompose) ? (
              <GroupsTab
                apiBase={apiBase}
                token={tokenMaybe || ""}
                meId={String(me?.id || "")}
                initialThreadId={dmActiveGroupId || undefined}
                initialCreate={groupCompose && !dmActiveGroupId}
                onExitToInbox={()=>{ setDmActiveGroupId(""); setGroupCompose(false); reloadGroups(); }}
              />
            ) : dmActive ? (
              <>
                <div className="weered-dock-conv-header" style={{ padding:"8px 12px", borderBottom:"1px solid var(--weered-bd)", display:"flex", alignItems:"center", gap:10, flexShrink:0, background:"rgba(255,255,255,.02)" }}>
                  <button onClick={()=>setDmActivePeerId("")} style={{ background:"none",border:"none",color:"var(--weered-muted)",cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1,display:"flex",alignItems:"center" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  <div style={{ position:"relative" }}>
                    <Avatar name={dmActive.peerName} size={30} src={dmActive.peerAvatar} chosenColor={dmActive.peerAvatarColor || undefined} />
                    {dmActive.peerOnline && (
                      <span style={{ position:"absolute",bottom:-1,right:-1,width:9,height:9,borderRadius:999,background:"#22c55e",border:"2px solid var(--weered-panel2)" }} />
                    )}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <span style={{ fontWeight:700, fontSize:14, color:"var(--weered-text)" }}>{dmActive.peerName}</span>
                  </div>
                </div>

                <div style={{ flex:1, overflowY:"auto", padding:"10px 14px", display:"flex", flexDirection:"column", gap:3 }}>
                  {dmLoading ? (
                    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <LoadingState compact label="Tuning in" />
                    </div>
                  ) : dmActive.msgs.length ? dmActive.msgs.map((m,i,arr)=>{
                    const isMe=m.fromId===String(me?.id||"");
                    const prevMsg=i>0?arr[i-1]:null;
                    const sameSender=prevMsg&&prevMsg.fromId===m.fromId;
                    const msgDate=fmtDateSep(m.createdAt);
                    const prevDate=prevMsg?fmtDateSep(prevMsg.createdAt):"";
                    const showDateSep=msgDate!==prevDate;
                    const nextMsg=i<arr.length-1?arr[i+1]:null;
                    const sameNext=nextMsg&&nextMsg.fromId===m.fromId;
                    const timeDiff=nextMsg?new Date(nextMsg.createdAt).getTime()-new Date(m.createdAt).getTime():Infinity;
                    const showTime=!sameNext||timeDiff>300_000;
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
                        {(() => {
                          const isDeleted=!!(m as any).deletedAt;
                          const isEdited=!!(m as any).editedAt && !isDeleted;
                          const createdTs=new Date(m.createdAt).getTime();
                          const editable=isMe && !isDeleted && (Date.now()-createdTs) < 15*60*1000;
                          const deletable=isMe && !isDeleted;
                          const isEditing=dmEditingMsgId===m.id;
                          const isHovered=dmHoveredMsgId===m.id;

                          const commitDmEdit=()=>{
                            const next=dmEditDraft.trim();
                            if (!next || next===m.body) { setDmEditingMsgId(""); setDmEditDraft(""); return; }
                            try { (ctx as any)?.sendRaw?.({ type:"dm:edit", msgId:m.id, body:next }); } catch {}
                            setDmEditingMsgId(""); setDmEditDraft("");
                          };
                          const handleDmDelete=async ()=>{
                            const { weeredConfirm } = await import("../lib/confirm");
                            const ok=await weeredConfirm({ title:"Delete this message?", body:"Gone for you and them.", confirmLabel:"Delete", destructive:true });
                            if (!ok) return;
                            try { (ctx as any)?.sendRaw?.({ type:"dm:delete", msgId:m.id }); } catch {}
                          };

                          return (
                            <div
                              onMouseEnter={()=>setDmHoveredMsgId(m.id)}
                              onMouseLeave={()=>setDmHoveredMsgId(cur=>cur===m.id?"":cur)}
                              data-msg-id={m.id}
                              style={{ display:"flex", flexDirection:"column", alignItems:isMe?"flex-end":"flex-start", marginTop:sameSender&&!showDateSep?1:8, position:"relative", maxWidth:"82%", alignSelf:isMe?"flex-end":"flex-start" }}
                            >
                              {(m as any).replyToId && !isDeleted && (
                                <button
                                  type="button"
                                  onClick={()=>{
                                    try {
                                      const el = document.querySelector(`[data-msg-id="${(m as any).replyToId}"]`) as HTMLElement | null;
                                      if (el) {
                                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                                        const prev = el.style.background;
                                        el.style.transition = "background 0.2s";
                                        el.style.background = "rgba(124,58,237,0.10)";
                                        setTimeout(()=>{ el.style.background = prev; }, 900);
                                      }
                                    } catch {}
                                  }}
                                  style={{
                                    display:"flex", alignItems:"center", gap:6,
                                    padding:"2px 8px 2px 6px",
                                    marginBottom:3,
                                    fontSize:10,
                                    background:"transparent", border:"none",
                                    borderLeft:"2px solid var(--weered-accent-ring)",
                                    color:"var(--weered-muted)",
                                    cursor:"pointer", fontFamily:"inherit",
                                    maxWidth:"100%", overflow:"hidden",
                                  }}
                                >
                                  <span style={{ color:"var(--weered-accent-text)", fontWeight:700 }}>↩ {(m as any).replyToUserName || "?"}</span>
                                  <span style={{ opacity:0.75, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{(m as any).replyToBody || ""}</span>
                                </button>
                              )}
                              {isDeleted ? (
                                <div style={{ padding:"7px 13px", borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px", background:"rgba(255,255,255,.03)", border:"1px dashed var(--weered-bd)", fontSize:12, fontStyle:"italic", color:"var(--weered-muted)" }}>[message deleted]</div>
                              ) : isEditing ? (
                                <div style={{ width:"100%", minWidth:220 }}>
                                  <textarea autoFocus value={dmEditDraft} onChange={e=>setDmEditDraft(e.target.value)}
                                    onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); commitDmEdit(); } if(e.key==="Escape"){ e.preventDefault(); setDmEditingMsgId(""); setDmEditDraft(""); } }}
                                    style={{ width:"100%", minHeight:56, padding:"7px 11px", borderRadius:12, border:"1px solid var(--weered-bd2)", background:"var(--weered-panel2)", color:"var(--weered-text)", fontFamily:"inherit", fontSize:13, outline:"none", resize:"vertical" }} />
                                  <div style={{ display:"flex", gap:6, justifyContent:"flex-end", marginTop:4, fontSize:10, color:"var(--weered-muted)" }}>
                                    <button type="button" onClick={()=>{ setDmEditingMsgId(""); setDmEditDraft(""); }} style={{ padding:"3px 8px", fontSize:10, fontWeight:700, background:"transparent", border:"1px solid var(--weered-bd)", borderRadius:6, color:"var(--weered-muted)", cursor:"pointer" }}>Cancel</button>
                                    <button type="button" onClick={commitDmEdit} style={{ padding:"3px 10px", fontSize:10, fontWeight:800, background:"var(--weered-accent-bg)", border:"1px solid var(--weered-accent-ring)", borderRadius:6, color:"var(--weered-accent-text)", cursor:"pointer" }}>Save</button>
                                  </div>
                                </div>
                              ) : (
                                <div className={`weered-dock-bubble${isMe?" weered-dock-bubble-me":""}`} style={{ padding:"9px 13px", borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px", background:isMe?"var(--weered-accent-bg)":"rgba(255,255,255,.07)", border:isMe?"1px solid var(--weered-accent-ring)":"1px solid var(--weered-bd)" }}>
                                  <div style={{ fontSize:13, lineHeight:"19px", color:"var(--weered-text)" }}>{linkify(String(m.body||""))}</div>
                                </div>
                              )}
                              {showTime && (
                                <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2, padding:"0 4px" }}>
                                  <span style={{ fontSize:10, color:"var(--weered-muted)" }}>{fmtTime(m.createdAt)}</span>
                                  {isEdited && <span title={(m as any).editedAt ? new Date((m as any).editedAt).toLocaleString() : undefined} style={{ fontSize:9, color:"var(--weered-muted)" }}>(edited)</span>}
                                  {isLastSent && !isDeleted && m.readAt && <span style={{ fontSize:9, color:"var(--weered-accent-text)", fontWeight:600 }}>Read</span>}
                                  {isLastSent && !isDeleted && !m.readAt && <span style={{ fontSize:9, color:"var(--weered-muted)" }}>Sent</span>}
                                </div>
                              )}
                              {isHovered && !isEditing && !isDeleted && (
                                <div data-reaction-ui style={{ position:"absolute", top:-6, [isMe?"left":"right" as any]:-4, display:"flex", gap:2, padding:3, borderRadius:7, background:"var(--weered-panel2)", border:"1px solid var(--weered-bd)", boxShadow:"0 4px 12px rgba(0,0,0,.35)", zIndex:2 }}>
                                  <button type="button" title="React" onClick={(e)=>{ e.stopPropagation(); setDmPickerMsgId(cur=>cur===m.id?"":m.id); }} style={{ width:22, height:22, borderRadius:5, border:"none", background:"transparent", color:"var(--weered-muted)", cursor:"pointer", fontSize:11 }}>😊</button>
                                  <button type="button" title="Reply" onClick={(e)=>{ e.stopPropagation(); const peerName = dmActive?.peerName || "user"; const senderName = isMe ? (me?.name || "you") : peerName; setDmReplyingTo({ id: m.id, userName: senderName, body: String(m.body || "") }); try { dmInputRef.current?.focus(); } catch {} }} style={{ width:22, height:22, borderRadius:5, border:"none", background:"transparent", color:"var(--weered-muted)", cursor:"pointer", fontSize:11 }}>↩</button>
                                  {editable && <button type="button" title="Edit" onClick={()=>{ setDmEditingMsgId(m.id); setDmEditDraft(String(m.body||"")); }} style={{ width:22, height:22, borderRadius:5, border:"none", background:"transparent", color:"var(--weered-muted)", cursor:"pointer", fontSize:11 }}>✎</button>}
                                  {deletable && <button type="button" title="Delete" onClick={handleDmDelete} style={{ width:22, height:22, borderRadius:5, border:"none", background:"transparent", color:"var(--weered-muted)", cursor:"pointer", fontSize:11 }}>🗑</button>}
                                </div>
                              )}
                              {dmPickerMsgId===m.id && (
                                <div data-reaction-ui onClick={e=>e.stopPropagation()} style={{ position:"absolute", top:16, [isMe?"left":"right" as any]:0, display:"flex", gap:2, padding:5, borderRadius:8, background:"var(--weered-panel2)", border:"1px solid var(--weered-bd)", boxShadow:"0 6px 20px rgba(0,0,0,.5)", zIndex:3 }}>
                                  {DM_QUICK_REACTIONS.map(e=>(
                                    <button key={e} type="button" onClick={()=>{ try { (ctx as any)?.sendRaw?.({ type:"dm:react", msgId:m.id, emoji:e }); } catch {} setDmPickerMsgId(""); }} style={{ width:28, height:28, borderRadius:5, border:"none", background:"transparent", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>{e}</button>
                                  ))}
                                </div>
                              )}
                              {Array.isArray((m as any).reactions) && (m as any).reactions.length>0 && !isDeleted && (
                                <div data-reaction-ui style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:4, justifyContent:isMe?"flex-end":"flex-start" }}>
                                  {(m as any).reactions.map((r:any)=>{
                                    const mine=Array.isArray(r.users) && r.users.includes(String(me?.id||""));
                                    return (
                                      <button key={r.emoji} type="button" onClick={(e)=>{ e.stopPropagation(); try { (ctx as any)?.sendRaw?.({ type:"dm:react", msgId:m.id, emoji:r.emoji }); } catch {} }} style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"1px 6px", borderRadius:10, border:`1px solid ${mine?"var(--weered-accent-ring)":"var(--weered-bd)"}`, background:mine?"var(--weered-accent-bg)":"rgba(255,255,255,.04)", color:mine?"var(--weered-accent-text)":"var(--weered-muted)", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit", lineHeight:1.1 }}>
                                        <span style={{ fontSize:12 }}>{r.emoji}</span>
                                        <span style={{ fontVariantNumeric:"tabular-nums" }}>{r.count}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </React.Fragment>
                    );
                  }) : (
                    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
                      <Avatar name={dmActive.peerName} size={56} src={dmActive.peerAvatar} chosenColor={dmActive.peerAvatarColor || undefined} />
                      <span style={{ fontSize:14, fontWeight:700, color:"var(--weered-text)" }}>{dmActive.peerName}</span>
                      <span style={{ color:"var(--weered-muted)", fontSize:12 }}>Start the conversation</span>
                    </div>
                  )}
                  <div ref={dmEndRef} />
                </div>

                <div style={{ padding:"8px 12px 10px", borderTop:"1px solid var(--weered-bd)", flexShrink:0 }}>
                  {dmReplyingTo && (
                    <div style={{
                      display:"flex", alignItems:"center", gap:8,
                      padding:"5px 10px", marginBottom:6,
                      borderRadius:7,
                      borderLeft:"2px solid var(--weered-accent-ring)",
                      background:"var(--weered-accent-bg)",
                      fontSize:11,
                    }}>
                      <span style={{ color:"var(--weered-accent-text)", fontWeight:700, flexShrink:0 }}>↩ Replying to <strong>{dmReplyingTo.userName}</strong></span>
                      <span style={{ flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"var(--weered-muted)" }}>{dmReplyingTo.body}</span>
                      <button type="button" onClick={()=>setDmReplyingTo(null)} title="Cancel reply" style={{ width:18, height:18, borderRadius:4, border:"none", background:"transparent", color:"var(--weered-muted)", cursor:"pointer", fontSize:12, flexShrink:0 }}>×</button>
                    </div>
                  )}
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
                <div style={{ padding:"10px 12px", borderBottom:"1px solid var(--weered-bd)", flexShrink:0 }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <div style={{ flex:1, position:"relative", display:"flex", alignItems:"center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ position:"absolute", left:10, opacity:.4, pointerEvents:"none" }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
                      <input value={dmPeer} onChange={e=>setDmPeer((e.target as any).value||"")} placeholder="Search or start new chat..."
                        style={{ ...inputStyle, paddingLeft:32, borderRadius:22, fontSize:12 }}
                        onKeyDown={e=>{if((e as any).key==="Enter") void dmCreateThread();}} />
                    </div>
                    <button className="weered-dock-compose" title="New direct message" style={{ width:36, height:36, borderRadius:999, border:"1px solid var(--weered-accent-ring)", background:"var(--weered-accent-bg)", color:"var(--weered-accent-text)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18, fontWeight:700 }} onClick={()=>void dmCreateThread()}>+</button>
                    <button title="New group" onClick={()=>{ setGroupCompose(true); setDmActiveGroupId(""); setDmActivePeerId(""); }} style={{ width:36, height:36, borderRadius:999, border:"1px solid var(--weered-bd2)", background:"rgba(255,255,255,.05)", color:"var(--weered-text)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                    </button>
                  </div>
                </div>

                {(() => {
                  const q = dmPeer.trim().toLowerCase();
                  const dmItems = dmThreads
                    .filter(t=>!q||t.peerName.toLowerCase().includes(q))
                    .map(t=>{
                      const lastMsg=t.msgs.length?t.msgs[t.msgs.length-1]:null;
                      return { kind:"dm" as const, id:t.peerId, ts:lastMsg?new Date(lastMsg.createdAt).getTime():0, dm:t, lastMsg };
                    });
                  const groupItems = groupThreads
                    .filter(t=>{
                      if (!q) return true;
                      const nm=(t.name||t.members.map(m=>m.name).join(", ")).toLowerCase();
                      return nm.includes(q);
                    })
                    .map(t=>({ kind:"group" as const, id:t.id, ts:t.lastMessageAt?new Date(t.lastMessageAt).getTime():0, group:t }));
                  const merged=[...dmItems,...groupItems].sort((a,b)=>b.ts-a.ts);

                  if (merged.length===0) {
                    return (
                      <EmptyState
                        icon={<img src="/brand/logo/weered-logo-64.png" alt="" style={{ width:44, height:44, opacity:.35, borderRadius:10 }} />}
                        title="Nobody on the line."
                        hint="Search a username up top, or start a group."
                      />
                    );
                  }

                  return (
                    <div style={{ flex:1, overflowY:"auto" }}>
                      {merged.map(item=>{
                        if (item.kind==="dm") {
                          const t=item.dm; const lastMsg=item.lastMsg;
                          const isMyLastMsg=lastMsg&&lastMsg.fromId===String(me?.id||"");
                          const preview=lastMsg?(isMyLastMsg?"You: ":"")+lastMsg.body.slice(0,40)+(lastMsg.body.length>40?"...":""):"Tap to start chatting";
                          const time=lastMsg?fmtRelative(lastMsg.createdAt):"";
                          return (
                            <button key={`dm-${t.peerId}`} className="weered-dock-thread" onClick={()=>setDmActivePeerId(t.peerId)} style={{ width:"100%",textAlign:"left",padding:"12px 14px",border:"none",borderBottom:"1px solid rgba(255,255,255,.04)",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"background .1s" }}
                              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,.04)";}}
                              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}
                            >
                              <div style={{ position:"relative", flexShrink:0 }}>
                                <Avatar name={t.peerName} size={42} src={t.peerAvatar} chosenColor={t.peerAvatarColor || undefined} />
                                {t.peerOnline && (
                                  <span style={{ position:"absolute",bottom:0,right:0,width:10,height:10,borderRadius:999,background:"#22c55e",border:"2px solid var(--weered-panel2)" }} />
                                )}
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
                        }
                        const g=item.group;
                        const others=g.members.filter(m=>m.id!==String(me?.id||""));
                        const memberCount=g.members.length;
                        const roster=others.map(m=>(m.name||"").split(/\s+/)[0]).filter(Boolean);
                        const rosterLine=roster.length?(roster.slice(0,3).join(", ")+(roster.length>3?` +${roster.length-3}`:"")):"Just you";
                        const title=g.name||(others.length?others.slice(0,3).map(m=>m.name).join(", "):"Group");
                        const last=g.lastMessage;
                        const senderFirst=last?(others.find(m=>m.id===last.senderId)?.name||"").split(/\s+/)[0]:"";
                        const preview=last
                          ? (last.deleted?"[deleted]":`${last.senderId===String(me?.id||"")?"You: ":senderFirst?`${senderFirst}: `:""}${last.body.slice(0,40)}${last.body.length>40?"...":""}`)
                          : rosterLine;
                        const time=g.lastMessageAt?fmtRelative(g.lastMessageAt):"";
                        return (
                          <button key={`group-${g.id}`} className="weered-dock-thread" onClick={()=>{ setDmActiveGroupId(g.id); setGroupCompose(false); setDmActivePeerId(""); }} style={{ width:"100%",textAlign:"left",padding:"12px 14px",border:"none",borderBottom:"1px solid rgba(255,255,255,.04)",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"background .1s" }}
                            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,.04)";}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}
                          >
                            <GroupAvatarStack members={others.length?others:g.members} />
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <span style={{ fontWeight:600, fontSize:13, color:"var(--weered-text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", minWidth:0 }}>{title}</span>
                                <span title={`${memberCount} members`} style={{ flexShrink:0, display:"inline-flex", alignItems:"center", gap:3, padding:"1px 6px", borderRadius:999, background:"var(--weered-accent-bg)", border:"1px solid var(--weered-accent-ring)", color:"var(--weered-accent-text)", fontSize:9, fontWeight:800, lineHeight:1.4 }}>
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                                  {memberCount}
                                </span>
                                <span style={{ flex:1 }} />
                                {time && <span style={{ fontSize:10, color:"var(--weered-muted)", flexShrink:0 }}>{time}</span>}
                              </div>
                              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginTop:2 }}>
                                <span style={{ fontSize:12, color:"var(--weered-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{preview}</span>
                                {g.unread>0 && <UnreadBadge count={g.unread} />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
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

      <div style={{
        flexShrink:0, padding:"8px 14px", borderTop:"1px solid var(--weered-bd)",
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:8,
        fontSize:11, color:"var(--weered-muted)",
      }}>
        <a href="/lobby" style={{ color:"inherit", textDecoration:"none", opacity:.75, transition:"opacity .15s" }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="1";}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity=".75";}}
        >Browse lobbies</a>
        <span style={{ opacity:.3 }}>·</span>
        <a href="#" onClick={(e)=>{e.preventDefault(); setTab("friends");}} style={{ color:"inherit", textDecoration:"none", opacity:.75, transition:"opacity .15s" }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="1";}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity=".75";}}
        >Add friends</a>
        <span style={{ opacity:.3 }}>·</span>
        <a href="#" onClick={(e)=>{e.preventDefault(); setTab("crew");}} style={{ color:"inherit", textDecoration:"none", opacity:.75, transition:"opacity .15s" }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="1";}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity=".75";}}
        >Crews</a>
        <span style={{ flex:1 }} />
        <span style={{ fontSize:9, opacity:.4, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase" }}>BURNER</span>
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
  React.useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [apiBase, tokenMaybe]);

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
          ?<EmptyState title="Inbox is clean." hint="When someone wants to connect, they'll land here." />
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
          ?<EmptyState title="Riding solo." hint="Search a name up top to pull someone in." />
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

const FRIEND_TIER_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  KINGPIN:  { label: "KINGPIN",  color: "#fde68a", bg: "rgba(252,211,77,.15)" },
  FELON:    { label: "FELON",    color: "#fdba74", bg: "rgba(249,115,22,.15)" },
  INDICTED: { label: "INDICTED", color: "rgba(243,244,246,.85)", bg: "rgba(88,0,229,.15)" },
};
const FRIEND_ROLE_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  GOD:     { label: "GOD",     color: "#fde68a", bg: "rgba(234,179,8,.18)" },
  ADMIN:   { label: "ADMIN",   color: "#fca5a5", bg: "rgba(239,68,68,.14)" },
  STAFF:   { label: "STAFF",   color: "#93c5fd", bg: "rgba(59,130,246,.14)" },
  SUPPORT: { label: "SUPPORT", color: "#6ee7b7", bg: "rgba(16,185,129,.14)" },
  MOD:     { label: "MOD",     color: "rgba(216,180,254,.95)", bg: "rgba(124,58,237,.14)" },
};

function lastSeenAgo(iso?: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "";
  const m = Math.floor(ms / 60000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function FriendRow({ f, onMessage, onJoin, onRemove }: { f:any; onMessage:(n:string,i:string)=>void; onJoin:(r:string)=>void; onRemove:(id:string)=>void }) {
  const role = String(f.globalRole || "").toUpperCase();
  const tier = String(f.tier || "").toUpperCase();
  const roleChip = FRIEND_ROLE_LABEL[role];
  const tierChip = FRIEND_TIER_LABEL[tier];
  const crewTag = f.primaryCrew?.tag ? `[${f.primaryCrew.tag}]` : "";
  const crewAccent = f.primaryCrew?.accentColor || "rgba(124,58,237,.85)";
  const tagShape = String(f.primaryCrew?.tagShape || "rounded");
  const tagRadius = tagShape === "square" ? 0 : tagShape === "pill" ? 999 : 4;
  const validPillBg = f.pillBgColor && /^#[0-9a-f]{6}$/i.test(f.pillBgColor) ? f.pillBgColor : null;

  const [pillIntensity, setPillIntensity] = React.useState<number>(60);
  React.useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("weered:pillBgIntensity");
        const n = raw == null ? 60 : Math.max(0, Math.min(100, Number(raw)));
        if (Number.isFinite(n)) setPillIntensity(n);
      } catch {}
    };
    read();
    const onChange = () => read();
    window.addEventListener("weered:pillBgIntensity", onChange);
    return () => window.removeEventListener("weered:pillBgIntensity", onChange);
  }, []);

  const pillTint = (() => {
    if (!validPillBg) return undefined;
    const r = parseInt(validPillBg.slice(1, 3), 16);
    const g = parseInt(validPillBg.slice(3, 5), 16);
    const b = parseInt(validPillBg.slice(5, 7), 16);
    const a = pillIntensity / 100;
    if (a <= 0.01) return undefined;
    return `linear-gradient(90deg, rgba(${r},${g},${b},${a.toFixed(3)}) 0%, rgba(${r},${g},${b},${(a * 0.45).toFixed(3)}) 60%, transparent 100%)`;
  })();

  const secondary = (() => {
    if (f.online) {
      if (f.isAway) return f.roomName ? `lying low in ${f.roomName}` : "lying low";
      return f.roomName ? `in ${f.roomName}` : "online";
    }
    if (f.lastSeenLocation && f.lastSeenAt) {
      return `last seen in ${f.lastSeenLocation} · ${lastSeenAgo(f.lastSeenAt)}`;
    }
    if (f.lastSeenAt) return `last seen ${lastSeenAgo(f.lastSeenAt)}`;
    return "offline";
  })();

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      padding:"7px 14px",
      borderBottom:"1px solid var(--weered-bd)",
      background: pillTint,
    }}>
      <div style={{ position:"relative" as const }}>
        <Avatar name={f.name||"?"} size={32} chosenColor={f.avatarColor} src={f.avatar} />
        <span style={{ position:"absolute" as const, bottom:0, right:0, width:9, height:9, borderRadius:999, background:f.online?(f.isAway?"#facc15":"#22c55e"):"rgba(255,255,255,.2)", border:"2px solid var(--weered-panel2)" }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:0 }}>
          <span style={{ fontWeight:700, fontSize:13, color:"var(--weered-text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{f.name}</span>
          {crewTag && (
            <span title={f.primaryCrew?.name || ""}
              style={{ fontSize:9, fontWeight:900, padding:"1px 5px", borderRadius:tagRadius, color:crewAccent, background:`${crewAccent}1f`, border:`1px solid ${crewAccent}40`, letterSpacing:".05em", flexShrink:0, fontFamily:"ui-monospace, 'JetBrains Mono', monospace" }}>
              {crewTag}
            </span>
          )}
          {roleChip && (
            <span style={{ fontSize:9, fontWeight:900, padding:"1px 5px", borderRadius:4, color:roleChip.color, background:roleChip.bg, letterSpacing:".06em", flexShrink:0 }}>
              {roleChip.label}
            </span>
          )}
          {tierChip && (
            <span style={{ fontSize:9, fontWeight:900, padding:"1px 5px", borderRadius:4, color:tierChip.color, background:tierChip.bg, letterSpacing:".06em", flexShrink:0 }}>
              {tierChip.label}
            </span>
          )}
        </div>
        <div style={{ fontSize:11, color:"var(--weered-muted)", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{secondary}</div>
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
  React.useEffect(()=>{const t=setInterval(load,60000);return()=>clearInterval(t);},[apiBase,tokenMaybe]);

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

  async function leaveCrew(crewId:string){
    const ok = await weeredConfirm({ title:"Leave this crew?", body:"You'll stop seeing crew chat and presence. You can be re-invited later.", confirmLabel:"Leave", destructive:true });
    if(!ok)return;
    await fetch(`${apiBase}/crews/${crewId}/members/${myId}`,{method:"DELETE",headers:{Authorization:`Bearer ${tokenMaybe}`}});
    void load();
  }
  async function disbandCrew(crewId:string){
    const ok = await weeredConfirm({ title:"Disband this crew?", body:"Everyone gets removed and the crew is gone. This can't be undone.", confirmLabel:"Disband", destructive:true });
    if(!ok)return;
    await fetch(`${apiBase}/crews/${crewId}`,{method:"DELETE",headers:{Authorization:`Bearer ${tokenMaybe}`}});
    void load();
  }

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
          <EmptyState icon="⚔" title="No crew yet." hint="Start one, or get invited. Reputation compounds." />
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
              <div
                onClick={()=>setExpandedCrew(isExpanded?null:crew.id)}
                style={{
                  padding:"12px 14px",cursor:"pointer",
                  background:isExpanded?"rgba(88,0,229,.04)":"transparent",
                  transition:"background 0.15s",
                }}
              >
                <div style={{display:"flex",alignItems:"center",gap:10}}>
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

                  <span style={{
                    fontSize:12,color:"var(--weered-muted)",transition:"transform 0.2s",
                    transform:isExpanded?"rotate(180deg)":"rotate(0deg)",
                  }}>▾</span>
                </div>

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

              {isExpanded&&(
                <div style={{padding:"0 14px 12px"}}>
                  {crew.description&&(
                    <div style={{fontSize:11,color:"var(--weered-muted)",lineHeight:1.5,marginBottom:10,padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.04)"}}>
                      {crew.description}
                    </div>
                  )}

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

                  <div style={{marginBottom:8,borderRadius:10,border:"1px solid rgba(255,255,255,.06)",overflow:"hidden",height:260}}>
                    <CrewChatPanel crewId={crew.id} crewName={crew.name} myId={myId} myName={myName} />
                  </div>

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
