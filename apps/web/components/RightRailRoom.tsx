"use client";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered } from "./WeeredProvider";
import { useCallback, useMemo, useState } from "react";

type Person = { id?: string; name?: string; handle?: string; role?: string };

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
function canMod(role: string) {
  return ["owner", "admin", "mod", "moderator", "staff", "god"].includes(normRole(role));
}
function bestMyRole(ctx: any) {
  // globalRole from provider takes priority — GOD/STAFF/ADMIN/SUPPORT beat room roles
  return String(ctx?.globalRole ?? ctx?.role ?? ctx?.me?.role ?? ctx?.me?.globalRole ?? ctx?.auth?.user?.role ?? ctx?.user?.role ?? "");
}

function extractParticipants(ctx: any, roomId: string): Person[] {
  // Primary: usersByRoom is the canonical source from WeeredProvider
  const primary = ctx?.usersByRoom?.[roomId];
  if (Array.isArray(primary) && primary.length) return primary.map(normUser).filter(Boolean);
  // Fallbacks for other possible shapes
  const tries = [
    ctx?.presence?.rooms?.[roomId]?.users,
    ctx?.presence?.rooms?.[roomId]?.members,
    ctx?.presence?.byRoom?.[roomId]?.users,
    ctx?.roomUsers?.[roomId],
    ctx?.roomMembers?.[roomId],
    ctx?.currentRoom?.id === roomId ? (ctx?.currentRoom?.members ?? ctx?.currentRoom?.users) : null,
  ];
  for (const v of tries) {
    if (!v) continue;
    const arr = Array.isArray(v) ? v : Object.values(v as any);
    if (arr.length) return arr.map(normUser).filter(Boolean);
  }
  const me = ctx?.me ?? ctx?.user ?? ctx?.auth?.user;
  return me ? [normUser(me)] : [];
}

function roleStyle(r: string) {
  if (r === "owner" || r === "admin") return { bg: "rgba(16,185,129,.12)", border: "rgba(16,185,129,.25)", color: "rgb(167,243,208)" };
  if (r === "staff" || r === "god")   return { bg: "rgba(245,158,11,.10)", border: "rgba(245,158,11,.25)", color: "rgb(253,230,138)" };
  if (r === "mod" || r === "moderator") return { bg: "rgba(124,58,237,.12)", border: "rgba(124,58,237,.25)", color: "rgb(216,180,254)" };
  return { bg: "rgba(255,255,255,.05)", border: "rgba(255,255,255,.10)", color: "rgba(255,255,255,.60)" };
}

export default function RightRailRoom({ roomId }: { roomId: string }) {
  const { replaceTop } = useOverlay();
  const ctx = useWeered() as any;

  const role    = useMemo(() => bestMyRole(ctx), [ctx]);
  const allowed = useMemo(() => canMod(role), [role]);

  const people = useMemo(() => {
    const arr = extractParticipants(ctx, roomId);
    const seen = new Set<string>();
    return arr.filter(p => {
      const k = String(p.id ?? p.name ?? "");
      if (!k || seen.has(k)) return !k;
      seen.add(k); return true;
    });
  }, [ctx, roomId]);

  const roomLabel = (() => {
    try { return decodeURIComponent(roomId || ""); } catch { return roomId || "unknown"; }
  })();

  // Mod state
  // locked derived from ctx.meta so it stays in sync with server broadcasts
  const metaLocked = Boolean(ctx?.meta?.locked ?? ctx?.metaByRoom?.[roomId]?.locked ?? false);
  const [lockedOverride, setLockedOverride] = useState<boolean | null>(null);
  const locked = lockedOverride ?? metaLocked;
  const [slowSec,     setSlowSec]     = useState(0);
  const [selectedId,  setSelectedId]  = useState("");
  const [confirm,     setConfirm]     = useState<{ kind: string; userId: string; name: string } | null>(null);
  const [note,        setNote]        = useState("");
  const [renameVal,   setRenameVal]   = useState("");
  const [renaming,    setRenaming]    = useState(false);
  const [chatDisabled, setChatDisabled] = useState(false);

  const selected = useMemo(() => {
    const id = selectedId || people[0]?.id || people[0]?.name || "";
    return people.find(p => (p.id ?? p.name) === id) ?? people[0] ?? null;
  }, [people, selectedId]);

  const copyText = useCallback(async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setNote(`Copied ${label}`); }
    catch { setNote(`Copy failed`); }
  }, []);

  const doAction = useCallback((kind: string) => {
    if (!selected && !["lock","unlock"].includes(kind)) { setNote("Select a user first."); return; }
    const userId = String(selected?.id ?? selected?.name ?? "");
    const userName = String(selected?.name ?? selected?.handle ?? userId);

    if (kind === "mute" || kind === "kick") {
      setConfirm({ kind, userId, name: userName });
      return;
    }
    try {
      if (kind === "promote") ctx?.promote?.(userId);
      if (kind === "demote")  ctx?.demote?.(userId);
      if (kind === "lock")   { ctx?.lockRoom?.();   setLockedOverride(true); }
      if (kind === "unlock") { ctx?.unlockRoom?.(); setLockedOverride(false); }
      setNote(`${kind} → ${userId ? userName : "room"}`);
    } catch { setNote(`${kind} failed`); }
  }, [ctx, selected]);

  const confirmYes = useCallback(() => {
    if (!confirm) return;
    try {
      if (confirm.kind === "kick") ctx?.kick?.(confirm.userId);
      if (confirm.kind === "mute") ctx?.mute?.(confirm.userId);
      setNote(`${confirm.kind} sent → ${confirm.name}`);
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

  const s = { // shared styles
    section: { marginTop: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: "10px 12px" } as React.CSSProperties,
    label:   { fontSize: 11, fontWeight: 700, opacity: 0.6, letterSpacing: ".6px", textTransform: "uppercase" as const, marginBottom: 8 },
    btn:     { padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.90)" } as React.CSSProperties,
    btnPrimary: { padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(124,58,237,.30)", background: "rgba(124,58,237,.14)", fontSize: 12, cursor: "pointer", color: "rgb(216,180,254)", fontWeight: 600 } as React.CSSProperties,
    input:   { width: "100%", padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.25)", fontSize: 12, color: "rgba(243,244,246,.90)", outline: "none", boxSizing: "border-box" as const },
    select:  { flex: 1, padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.25)", fontSize: 12, color: "rgba(243,244,246,.90)", outline: "none" } as React.CSSProperties,
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
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", padding: "3px 8px", borderRadius: 999, background: locked ? "rgba(245,158,11,.12)" : "rgba(16,185,129,.10)", border: `1px solid ${statusColor}30`, color: statusColor }}>
          {statusLabel}
        </span>
      </div>

      {/* Quick copy */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
        <button style={s.btn} onClick={() => { const base = typeof window !== "undefined" ? window.location.origin : ""; copyText("link", `${base}/room/${encodeURIComponent(roomId)}`); }}>Copy link</button>
        <button style={s.btn} onClick={() => copyText("id", roomId)}>Copy id</button>
      </div>

      {/* Participants */}
      <div style={s.section}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={s.label}>Participants</div>
          <span style={{ fontSize: 11, opacity: 0.55 }}>{people.length} online</span>
        </div>

        {people.length === 0 && <div style={{ fontSize: 12, opacity: 0.55 }}>No participants yet.</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {people.slice(0, 20).map((p, i) => {
            const key  = String(p.id ?? p.name ?? i);
            const name = String(p.name ?? p.handle ?? p.id ?? "?");
            const r    = normRole(p.role || "member");
            const rl   = r.includes("owner") ? "owner" : r.includes("admin") ? "admin" : r.includes("staff") || r.includes("god") ? "staff" : r.includes("mod") ? "mod" : "member";
            const rs   = roleStyle(rl);
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "6px 8px", borderRadius: 9, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
                <button
                  style={{ fontWeight: 600, fontSize: 12, background: "none", border: "none", color: "rgba(243,244,246,.92)", cursor: "pointer", textAlign: "left", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  onClick={() => replaceTop("profile", { userId: key })}
                >
                  {name}
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: rs.bg, border: `1px solid ${rs.border}`, color: rs.color }}>{rl}</span>
                  {allowed && (
                    <button style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", cursor: "pointer", color: "rgba(243,244,246,.70)" }}
                      onClick={() => setSelectedId(key)}>
                      sel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {people.length > 20 && <div style={{ fontSize: 11, opacity: 0.5, padding: "4px 0" }}>+{people.length - 20} more</div>}
        </div>
      </div>

      {/* Moderation — mods only */}
      {allowed && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ ...s.label, cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 13px", borderRadius: 10, border: "1px solid rgba(167,139,250,.55)", background: "rgba(124,58,237,.22)", marginBottom: 0, userSelect: "none" }}>
            <span style={{ color: "rgb(233,220,255)", fontWeight: 800 }}>Moderation</span>
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "rgba(167,139,250,.25)", border: "1px solid rgba(167,139,250,.50)", color: "rgb(233,220,255)", fontWeight: 700 }}>mod tools</span>
          </summary>

          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>

            {/* User picker */}
            <div style={s.section}>
              <div style={s.label}>Select user</div>
              <div style={{ display: "flex", gap: 6 }}>
                <select style={s.select} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                  <option value="">(auto — first)</option>
                  {people.map((p, i) => {
                    const id = String(p.id ?? p.name ?? i);
                    return <option key={id} value={id}>{String(p.name ?? p.handle ?? id)}</option>;
                  })}
                </select>
                <button style={s.btn} onClick={() => setSelectedId("")}>✕</button>
              </div>
              {selected && (
                <div style={{ marginTop: 6, fontSize: 11, opacity: 0.65 }}>
                  → {String(selected.name ?? selected.handle ?? selected.id ?? "?")} {selected.role ? `· ${selected.role}` : ""}
                </div>
              )}
            </div>

            {/* User actions */}
            <div style={s.section}>
              <div style={s.label}>User actions</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <button style={s.btn} onClick={() => doAction("mute")}>Mute</button>
                <button style={s.btn} onClick={() => doAction("kick")}>Kick</button>
                <button style={s.btn} onClick={() => doAction("promote")}>Promote MOD</button>
                <button style={s.btn} onClick={() => doAction("demote")}>Demote</button>
              </div>

              {confirm && (
                <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 9, background: "rgba(245,158,11,.10)", border: "1px solid rgba(245,158,11,.25)", fontSize: 12 }}>
                  <div style={{ marginBottom: 6, opacity: 0.9 }}>Confirm <strong>{confirm.kind}</strong> for <strong>{confirm.name}</strong>?</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ ...s.btn, flex: 1 }} onClick={confirmYes}>Yes</button>
                    <button style={{ ...s.btn, flex: 1 }} onClick={() => setConfirm(null)}>No</button>
                  </div>
                </div>
              )}
            </div>

            {/* Room controls */}
            <div style={s.section}>
              <div style={s.label}>Room</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <button style={s.btn} onClick={() => doAction("lock")}>Lock</button>
                <button style={s.btnPrimary} onClick={() => doAction("unlock")}>Unlock</button>
                <button
                  style={{ ...s.btn, gridColumn: "span 2", borderColor: chatDisabled ? "rgba(16,185,129,.30)" : "rgba(239,68,68,.25)", background: chatDisabled ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)", color: chatDisabled ? "rgb(167,243,208)" : "rgba(252,165,165,.90)" }}
                  onClick={doToggleChat}
                >
                  {chatDisabled ? "Enable Chat" : "Disable Chat"}
                </button>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ ...s.label, marginBottom: 4 }}>Rename room</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input style={s.input} placeholder="New room name…" value={renameVal} onChange={e => setRenameVal(e.target.value)} onKeyDown={e => e.key === "Enter" && doRename()} />
                  <button style={s.btn} onClick={doRename} disabled={renaming || !renameVal.trim()}>{renaming ? "…" : "Rename"}</button>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ ...s.label, marginBottom: 4 }}>Slow mode</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <select style={s.select} value={String(slowSec)} onChange={e => setSlowSec(parseInt(e.target.value || "0", 10))}>
                    <option value="0">Off</option>
                    <option value="5">5s</option>
                    <option value="10">10s</option>
                    <option value="30">30s</option>
                    <option value="60">60s</option>
                  </select>
                  <button style={s.btn} onClick={() => setSlowSec(0)}>Off</button>
                </div>
              </div>
            </div>

            {note && <div style={{ fontSize: 11, opacity: 0.65, padding: "4px 2px" }}>{note}</div>}
          </div>
        </details>
      )}

      {/* Debug — collapsed, mods only */}
      {allowed && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ ...s.label, cursor: "pointer", listStyle: "none", padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.06)", background: "transparent", opacity: 0.45 }}>
            debug tools
          </summary>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
            <button style={s.btn} onClick={async () => {
              const payload = { roomId, role, participants: people.map(p => ({ id: p.id, name: p.name, role: p.role })) };
              try { await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); setNote("Copied snapshot."); }
              catch { setNote("Copy failed."); }
            }}>Copy debug snapshot</button>
            <div style={{ fontSize: 11, opacity: 0.5 }}>role: {role || "unknown"} · participants: {people.length}</div>
          </div>
        </details>
      )}
    </div>
  );
}
