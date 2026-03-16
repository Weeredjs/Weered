"use client";
import InviteModal from "./InviteModal";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered } from "./WeeredProvider";
import React, { useCallback, useMemo, useState } from "react";

type Person = { id?: string; name?: string; handle?: string; role?: string };
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
function normUser(u: any): Person {
  if (!u) return {};
  if (typeof u === "string") return { id: u, name: u };
  return {
    id: u.id ?? u.userId ?? u.uid,
    name: u.name ?? u.handle ?? u.username ?? u.displayName ?? u.id ?? "unknown",
    handle: u.handle ?? u.username,
    role: u.role ?? u.kind ?? u.badge,
  };
}

function normRole(r: any) { return String(r ?? "").toLowerCase(); }

function bestMyRole(ctx: any) {
  return String(ctx?.globalRole ?? ctx?.role ?? ctx?.me?.role ?? ctx?.me?.globalRole ?? "");
}

function canMod(role: string) {
  return ["owner", "mod", "moderator", "staff", "admin", "god", "support"].includes(normRole(role));
}
function canPromote(globalRole: string, roomRole: string) {
  const g = normRole(globalRole);
  const r = normRole(roomRole);
  return g === "god" || g === "staff" || g === "admin" || r === "owner";
}

function extractParticipants(ctx: any, roomId: string): Person[] {
  const primary = ctx?.usersByRoom?.[roomId];
  if (Array.isArray(primary) && primary.length) return primary.map(normUser).filter(Boolean);
  const tries = [
    ctx?.presence?.rooms?.[roomId]?.users,
    ctx?.roomUsers?.[roomId],
    ctx?.currentRoom?.id === roomId ? ctx?.currentRoom?.members : null,
  ];
  for (const v of tries) {
    if (!v) continue;
    const arr = Array.isArray(v) ? v : Object.values(v as any);
    if (arr.length) return arr.map(normUser).filter(Boolean);
  }
  const me = ctx?.me ?? ctx?.user;
  return me ? [normUser(me)] : [];
}
function FriendsPanel() {
  const [friends, setFriends] = React.useState<any[]>([]);
  const [open, setOpen] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  async function load() {
    try {
      const t = localStorage.getItem("weered_token") || "";
      const r = await fetch(`${API_BASE}/friends`, { headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } });
      const j = await r.json();
      setFriends(Array.isArray(j?.friends) ? j.friends : []);
    } catch {}
  }
  React.useEffect(() => { if (mounted) void load(); }, [mounted]);
  React.useEffect(() => { if (!mounted) return; const t = setInterval(load, 8000); return () => clearInterval(t); }, [mounted]);
  if (!mounted || !friends.length) return null;
  const online = friends.filter(f => f.online);
  const offline = friends.filter(f => !f.online);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Friends · {online.length} Online
        <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 11 }}>{open ? "▲" : "▼"}</button>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {online.map(f => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 9, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              {f.roomName && <span style={{ fontSize: 10, opacity: 0.4, fontFamily: "monospace", whiteSpace: "nowrap" }}>{f.roomName}</span>}
            </div>
          ))}
          {offline.map(f => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 9, opacity: 0.4 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
              <span style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CrewPanel() {
  const [crews, setCrews] = React.useState<any[]>([]);
  const [open, setOpen] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  async function load() {
    try {
      const t = localStorage.getItem("weered_token") || "";
      const r = await fetch(`${API_BASE}/crews/mine`, { headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } });
      const j = await r.json();
      setCrews(Array.isArray(j?.crews) ? j.crews : []);
    } catch {}
  }
  React.useEffect(() => { if (mounted) void load(); }, [mounted]);
  React.useEffect(() => { if (!mounted) return; const t = setInterval(load, 8000); return () => clearInterval(t); }, [mounted]);
  if (!mounted || !crews.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Crew
        <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 11 }}>{open ? "▲" : "▼"}</button>
      </div>
      {open && crews.map(crew => {
        const online = (crew.members || []).filter((m: any) => m.online);
        return (
          <div key={crew.id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, marginBottom: 4 }}>{crew.name} {crew.tag ? `[${crew.tag}]` : ""} · {online.length} online</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {(crew.members || []).map((m: any) => (
                <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 8, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", opacity: m.online ? 1 : 0.4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: m.online ? "#a78bfa" : "rgba(255,255,255,0.2)", boxShadow: m.online ? "0 0 5px #a78bfa" : "none", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                  {m.online && m.roomName && <span style={{ fontSize: 10, opacity: 0.4, fontFamily: "monospace", whiteSpace: "nowrap" }}>{m.roomName}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
export default function RightRailRoom({ roomId }: { roomId: string }) {
  const { replaceTop } = useOverlay();
  const ctx = useWeered() as any;

  const myGlobalRole    = useMemo(() => bestMyRole(ctx), [ctx]);
  const myRoomRole      = useMemo(() => String(ctx?.role ?? "member"), [ctx]);
  const allowed         = useMemo(() => canMod(myGlobalRole) || canMod(myRoomRole), [myGlobalRole, myRoomRole]);
  const canPromoteUsers = useMemo(() => canPromote(myGlobalRole, myRoomRole), [myGlobalRole, myRoomRole]);

  const people = useMemo(() => {
    const arr = extractParticipants(ctx, roomId);
    const seen = new Set<string>();
    return arr.filter(p => {
      const k = String(p.id ?? p.name ?? "");
      if (!k || seen.has(k)) return false;
      seen.add(k); return true;
    });
  }, [ctx, roomId]);

  const admin    = ctx?.admin ?? ctx?.adminByRoom?.[roomId] ?? null;
  const knocks   = useMemo((): Array<{ userId: string; name: string; ts: number }> => admin?.knocks ?? [], [admin]);
  const banned   = useMemo((): string[] => admin?.banned ?? [], [admin]);
  const muted    = useMemo((): string[] => admin?.muted  ?? [], [admin]);
  const auditLog = useMemo(() => (admin?.audit ?? []).slice().reverse().slice(0, 40), [admin]);

  const roomLabel = (() => {
    const n = ctx?.meta?.name || ctx?.metaByRoom?.[roomId]?.name;
    if (n && n !== roomId) return n;
    try { return decodeURIComponent(roomId || ""); } catch { return roomId || "unknown"; }
  })();

  const metaLocked = Boolean(ctx?.meta?.locked ?? ctx?.metaByRoom?.[roomId]?.locked ?? false);
  const [lockedOverride, setLockedOverride] = useState<boolean | null>(null);
  const locked = lockedOverride ?? metaLocked;

  const [slowSec,      setSlowSec     ] = useState(0);
  const [selectedId,   setSelectedId  ] = useState("");
  const [confirm,      setConfirm     ] = useState<{ kind: string; userId: string; name: string } | null>(null);
  const [note,         setNote        ] = useState("");
  const [renameVal,    setRenameVal   ] = useState("");
  const [renaming,     setRenaming    ] = useState(false);
  const [chatDisabled, setChatDisabled] = useState(false);
  const [tab,          setTab         ] = useState<"users"|"knocks"|"banned"|"audit">("users");
  const [showInvite,   setShowInvite  ] = useState(false);

  const selected = useMemo(() => {
    const id = selectedId || people[0]?.id || people[0]?.name || "";
    return people.find(p => (p.id ?? p.name) === id) ?? people[0] ?? null;
  }, [people, selectedId]);

  const copyText = useCallback(async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setNote(`Copied ${label}`); }
    catch { setNote("Copy failed"); }
  }, []);

  const doAction = useCallback((kind: string, overrideId?: string) => {
    const targetId   = overrideId ?? String(selected?.id ?? selected?.name ?? "");
    const targetName = overrideId
      ? (people.find(p => p.id === overrideId)?.name ?? knocks.find(k => k.userId === overrideId)?.name ?? overrideId)
      : String(selected?.name ?? selected?.handle ?? targetId);

    if (!targetId && !["lock","unlock"].includes(kind)) { setNote("Select a user first."); return; }
    if (["kick","ban"].includes(kind)) { setConfirm({ kind, userId: targetId, name: targetName }); return; }

    try {
      if (kind === "mute")    ctx?.mute?.(targetId);
      if (kind === "unmute")  ctx?.unmute?.(targetId);
      if (kind === "promote") ctx?.promote?.(targetId);
      if (kind === "demote")  ctx?.demote?.(targetId);
      if (kind === "unban")   ctx?.unban?.(targetId);
      if (kind === "admit")   ctx?.admit?.(targetId);
      if (kind === "deny")    ctx?.deny?.(targetId);
      if (kind === "lock")    { ctx?.lockRoom?.();   setLockedOverride(true); }
      if (kind === "unlock")  { ctx?.unlockRoom?.(); setLockedOverride(false); }
      setNote(`${kind} \u2192 ${targetId ? targetName : "room"}`);
    } catch { setNote(`${kind} failed`); }
  }, [ctx, selected, people, knocks]);

  const confirmYes = useCallback(() => {
    if (!confirm) return;
    try {
      if (confirm.kind === "kick") ctx?.kick?.(confirm.userId);
      if (confirm.kind === "ban")  ctx?.ban?.(confirm.userId);
      setNote(`${confirm.kind} \u2192 ${confirm.name}`);
    } catch { setNote(`${confirm.kind} failed`); }
    setConfirm(null);
  }, [ctx, confirm]);

  const doRename = useCallback(async () => {
    const name = renameVal.trim();
    if (!name) return;
    setRenaming(true);
    try { ctx?.renameRoom?.(name); setNote(`Renamed to "${name}"`); setRenameVal(""); }
    catch { setNote("Rename failed."); }
    finally { setRenaming(false); }
  }, [ctx, renameVal]);

  const doToggleChat = useCallback(() => {
    const next = !chatDisabled;
    setChatDisabled(next);
    try { ctx?.sendAdmin?.("room:chat:" + (next ? "disable" : "enable"), {}); setNote(next ? "Chat disabled." : "Chat enabled."); }
    catch { setNote("Toggle failed."); }
  }, [ctx, chatDisabled]);

  const s = {
    section:    { marginTop: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: "10px 12px" } as React.CSSProperties,
    label:      { fontSize: 10, fontWeight: 700, opacity: 0.55, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 7 },
    btn:        { padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 11, cursor: "pointer", color: "rgba(243,244,246,.85)" } as React.CSSProperties,
    btnPrimary: { padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(124,58,237,.30)", background: "rgba(124,58,237,.14)", fontSize: 11, cursor: "pointer", color: "rgb(216,180,254)", fontWeight: 600 } as React.CSSProperties,
    btnGreen:   { padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(16,185,129,.30)",  background: "rgba(16,185,129,.10)",  fontSize: 11, cursor: "pointer", color: "rgb(167,243,208)" } as React.CSSProperties,
    btnRed:     { padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(239,68,68,.25)",   background: "rgba(239,68,68,.08)",   fontSize: 11, cursor: "pointer", color: "rgba(252,165,165,.90)" } as React.CSSProperties,
    input:      { width: "100%", padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.25)", fontSize: 12, color: "rgba(243,244,246,.90)", outline: "none", boxSizing: "border-box" as const },
    select:     { flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.25)", fontSize: 11, color: "rgba(243,244,246,.90)", outline: "none" } as React.CSSProperties,
    tabBtn:     (active: boolean, alert?: boolean) => ({
      padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: ".4px",
      border: active ? "1px solid rgba(124,58,237,.45)" : alert ? "1px solid rgba(245,158,11,.4)" : "1px solid rgba(255,255,255,.08)",
      background: active ? "rgba(124,58,237,.18)" : "transparent",
      color: active ? "rgb(216,180,254)" : alert ? "rgb(253,230,138)" : "rgba(255,255,255,.40)",
    } as React.CSSProperties),
  };

  const statusColor = locked ? "rgba(245,158,11,.85)" : "rgba(16,185,129,.85)";
  const statusLabel = locked ? "LOCKED" : slowSec > 0 ? `SLOW ${slowSec}s` : "UNLOCKED";

  return (
    <div style={{ fontSize: 13, color: "rgba(243,244,246,.92)", padding: "14px 14px 20px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Control Panel</div>
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>context: {roomLabel}</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", padding: "3px 8px", borderRadius: 999, background: locked ? "rgba(245,158,11,.12)" : "rgba(16,185,129,.10)", border: `1px solid ${statusColor}40`, color: statusColor }}>
          {statusLabel}
        </span>
      </div>

      {/* Quick copy */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
        <button style={s.btn} onClick={() => { const base = typeof window !== "undefined" ? window.location.origin : ""; copyText("link", `${base}/room/${encodeURIComponent(roomId)}`); }}>Copy link</button>
        <button style={s.btn} onClick={() => copyText("id", roomId)}>Copy id</button>
        <button style={{ ...s.btn, gridColumn: "span 2", borderColor: "rgba(124,58,237,.30)", color: "rgb(216,180,254)", background: "rgba(124,58,237,.08)" }} onClick={() => setShowInvite(true)}>Invite</button>
      </div>

      {/* ── Mod panel ── */}
      {allowed && (
        <details open style={{ marginTop: 10 }}>
          <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(167,139,250,.45)", background: "rgba(124,58,237,.18)", userSelect: "none" }}>
            <span style={{ color: "rgb(233,220,255)", fontWeight: 800, fontSize: 11, letterSpacing: ".5px" }}>MODERATION</span>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {knocks.length > 0 && (
                <span style={{ fontSize: 9, fontWeight: 900, background: "rgba(245,158,11,.85)", color: "#000", borderRadius: 5, padding: "1px 5px" }}>
                  {knocks.length} KNOCK{knocks.length > 1 ? "S" : ""}
                </span>
              )}
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "rgba(167,139,250,.25)", border: "1px solid rgba(167,139,250,.45)", color: "rgb(233,220,255)", fontWeight: 700 }}>mod tools</span>
            </div>
          </summary>

          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button style={s.tabBtn(tab === "users")}  onClick={() => setTab("users")}>Users ({people.length})</button>
              <button style={s.tabBtn(tab === "knocks", knocks.length > 0)} onClick={() => setTab("knocks")}>
                Knocks{knocks.length > 0 ? ` (${knocks.length})` : ""}
              </button>
              <button style={s.tabBtn(tab === "banned")} onClick={() => setTab("banned")}>Banned ({banned.length})</button>
              <button style={s.tabBtn(tab === "audit")}  onClick={() => setTab("audit")}>Audit</button>
            </div>

            {/* ─── Users tab ─── */}
            {tab === "users" && (<>
              <div style={s.section}>
                <div style={s.label}>Select user</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <select style={s.select} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                    <option value="">(first in list)</option>
                    {people.map((p, i) => {
                      const id = String(p.id ?? p.name ?? i);
                      const isMuted  = muted.includes(id);
                      const isBanned = banned.includes(id);
                      return <option key={id} value={id}>{String(p.name ?? id)}{isMuted ? " [muted]" : ""}{isBanned ? " [banned]" : ""}</option>;
                    })}
                  </select>
                  <button style={s.btn} onClick={() => setSelectedId("")}>&#x2715;</button>
                </div>
                {selected && (
                  <div style={{ marginTop: 6, fontSize: 11, opacity: 0.65, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span>{String(selected.name ?? selected.id ?? "?")} {selected.role ? `· ${selected.role}` : ""}</span>
                    {muted.includes(String(selected.id ?? ""))  && <span style={{ fontSize: 9, background: "rgba(245,158,11,.18)", border: "1px solid rgba(245,158,11,.35)", borderRadius: 4, padding: "1px 5px", color: "rgb(253,230,138)" }}>MUTED</span>}
                    {banned.includes(String(selected.id ?? "")) && <span style={{ fontSize: 9, background: "rgba(239,68,68,.15)",  border: "1px solid rgba(239,68,68,.3)",  borderRadius: 4, padding: "1px 5px", color: "rgba(252,165,165,.9)" }}>BANNED</span>}
                  </div>
                )}
              </div>

              <div style={s.section}>
                <div style={s.label}>User actions</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {selected && muted.includes(String(selected?.id ?? ""))
                    ? <button style={s.btnGreen} onClick={() => doAction("unmute")}>Unmute</button>
                    : <button style={s.btn}      onClick={() => doAction("mute")}>Mute</button>
                  }
                  <button style={s.btn}    onClick={() => doAction("kick")}>Kick</button>
                  <button style={s.btnRed} onClick={() => doAction("ban")}>Ban</button>
                  <button style={s.btn}    onClick={() => { const uid = String(selected?.id ?? ""); if (uid) replaceTop("profile", { userId: uid }); }}>View profile</button>
                  {canPromoteUsers && <>
                    <button style={s.btnPrimary} onClick={() => doAction("promote")}>Promote MOD</button>
                    <button style={s.btn}        onClick={() => doAction("demote")}>Demote</button>
                  </>}
                </div>

                {confirm && (
                  <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 9, background: "rgba(245,158,11,.10)", border: "1px solid rgba(245,158,11,.25)", fontSize: 12 }}>
                    <div style={{ marginBottom: 6 }}>Confirm <strong>{confirm.kind}</strong> for <strong>{confirm.name}</strong>?</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={{ ...s.btnRed, flex: 1 }} onClick={confirmYes}>Yes, {confirm.kind}</button>
                      <button style={{ ...s.btn,    flex: 1 }} onClick={() => setConfirm(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              <div style={s.section}>
                <div style={s.label}>Room</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  <button style={locked ? s.btn : s.btnRed}   onClick={() => doAction("lock")}>Lock</button>
                  <button style={locked ? s.btnGreen : s.btn} onClick={() => doAction("unlock")}>Unlock</button>
                  <button
                    style={{ ...s.btn, gridColumn: "span 2", borderColor: chatDisabled ? "rgba(16,185,129,.30)" : "rgba(239,68,68,.25)", background: chatDisabled ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)", color: chatDisabled ? "rgb(167,243,208)" : "rgba(252,165,165,.90)" }}
                    onClick={doToggleChat}
                  >{chatDisabled ? "Enable Chat" : "Disable Chat"}</button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ ...s.label, marginBottom: 4 }}>Rename</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input style={s.input} placeholder="New name…" value={renameVal} onChange={e => setRenameVal(e.target.value)} onKeyDown={e => e.key === "Enter" && doRename()} />
                    <button style={s.btn} onClick={doRename} disabled={renaming || !renameVal.trim()}>{renaming ? "…" : "OK"}</button>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ ...s.label, marginBottom: 4 }}>Slow mode</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select style={s.select} value={String(slowSec)} onChange={e => setSlowSec(parseInt(e.target.value || "0", 10))}>
                      <option value="0">Off</option><option value="5">5s</option><option value="10">10s</option><option value="30">30s</option><option value="60">60s</option>
                    </select>
                    <button style={s.btn} onClick={() => setSlowSec(0)}>Off</button>
                  </div>
                </div>
              </div>
            </>)}

            {/* ─── Knocks tab ─── */}
            {tab === "knocks" && (
              <div style={s.section}>
                <div style={s.label}>Waiting to enter ({knocks.length})</div>
                {knocks.length === 0
                  ? <div style={{ fontSize: 12, opacity: 0.4 }}>No one knocking.</div>
                  : <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {knocks.map(k => (
                        <div key={k.userId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 9, background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.18)" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.name}</span>
                          <button style={s.btnGreen} onClick={() => doAction("admit", k.userId)}>Admit</button>
                          <button style={s.btnRed}   onClick={() => doAction("deny",  k.userId)}>Deny</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
                      <button style={{ ...s.btnGreen, flex: 1 }} onClick={() => knocks.forEach(k => doAction("admit", k.userId))}>Admit all</button>
                      <button style={{ ...s.btnRed,   flex: 1 }} onClick={() => knocks.forEach(k => doAction("deny",  k.userId))}>Deny all</button>
                    </div>
                  </>
                }
              </div>
            )}

            {/* ─── Banned tab ─── */}
            {tab === "banned" && (
              <div style={s.section}>
                <div style={s.label}>Banned ({banned.length})</div>
                {banned.length === 0
                  ? <div style={{ fontSize: 12, opacity: 0.4 }}>No bans.</div>
                  : <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {banned.map(uid => (
                      <div key={uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 9, background: "rgba(239,68,68,.05)", border: "1px solid rgba(239,68,68,.14)" }}>
                        <span style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.7, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{uid}</span>
                        <button style={s.btnGreen} onClick={() => doAction("unban", uid)}>Unban</button>
                      </div>
                    ))}
                  </div>
                }
              </div>
            )}

            {/* ─── Audit tab ─── */}
            {tab === "audit" && (
              <div style={s.section}>
                <div style={s.label}>Recent actions</div>
                {auditLog.length === 0
                  ? <div style={{ fontSize: 12, opacity: 0.4 }}>No events yet.</div>
                  : <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 300, overflowY: "auto" }}>
                    {auditLog.map((a: any) => (
                      <div key={a.id} style={{ padding: "5px 8px", borderRadius: 7, background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)", fontSize: 11 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 9, opacity: 0.4 }}>{new Date(a.ts).toLocaleTimeString()}</span>
                          <span style={{ fontWeight: 700, color: "rgba(167,139,250,.8)" }}>{a.type}</span>
                        </div>
                        <div style={{ opacity: 0.6, marginTop: 1 }}>
                          {a.actorName}{a.targetId ? ` \u2192 ${String(a.targetId).slice(0,12)}\u2026` : ""}
                          {a.note ? ` "${a.note}"` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </div>
            )}

            {note && <div style={{ fontSize: 11, opacity: 0.65, padding: "2px" }}>{note}</div>}
          </div>
        </details>
      )}

      {/* Debug */}
      {allowed && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ ...s.label, cursor: "pointer", listStyle: "none", padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.06)", opacity: 0.4 }}>
            debug tools
          </summary>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
            <button style={s.btn} onClick={async () => {
              const snap = { roomId, myGlobalRole, myRoomRole, users: people.map(p => ({ id: p.id, name: p.name, role: p.role })), muted, banned, knocks: knocks.length };
              try { await navigator.clipboard.writeText(JSON.stringify(snap, null, 2)); setNote("Copied."); }
              catch { setNote("Copy failed."); }
            }}>Copy debug snapshot</button>
            <div style={{ fontSize: 11, opacity: 0.45 }}>
              globalRole: {myGlobalRole||"?"} · roomRole: {myRoomRole} · users: {people.length} · muted: {muted.length} · knocks: {knocks.length}
            </div>
          </div>
        </details>
      )}

      {/* ── Friends ── */}
      <FriendsPanel />

      {/* ── Crew ── */}
      <CrewPanel />
      {showInvite && (
        <InviteModal
          type="ROOM"
          targetId={roomId}
          targetName={ctx?.meta?.name || ctx?.metaByRoom?.[roomId]?.name || roomId}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  );
}
