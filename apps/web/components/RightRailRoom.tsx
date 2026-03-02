"use client";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered } from "./WeeredProvider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
type Person = {
  id?: string;
  name?: string;
  handle?: string;
  role?: string;
  flags?: any;
};

function normUser(u: any): Person {
  if (!u) return {};
  if (typeof u === "string") return { id: u, name: u };
  return {
    id: u.id ?? u.userId ?? u.uid,
    name: u.name ?? u.handle ?? u.username ?? u.displayName ?? u.id ?? "unknown",
    handle: u.handle ?? u.username,
    role: u.role ?? u.kind ?? u.badge,
    flags: u.flags ?? u.meta,
  };
}

function normRole(r: any) {
  return String(r ?? "").toLowerCase();
}
function canMod(role: string) {
  return ["owner", "admin", "mod", "moderator", "staff", "god"].includes(normRole(role));
}

function bestWsStatus(ctx: any): { label: string; ok: boolean } {
  // Try a few plausible provider shapes (we keep this resilient while schema evolves)
  const wsReady = !!(ctx?.wsReady ?? ctx?.socketReady ?? ctx?.connected);
  const rs = ctx?.ws?.readyState ?? ctx?.socket?.readyState;
  if (wsReady) return { label: "connected", ok: true };
  if (typeof rs === "number") {
    // WebSocket readyState: 0=CONNECTING 1=OPEN 2=CLOSING 3=CLOSED
    if (rs === 1) return { label: "connected", ok: true };
    if (rs === 0) return { label: "connecting", ok: false };
    if (rs === 2) return { label: "closing", ok: false };
    if (rs === 3) return { label: "closed", ok: false };
  }
  return { label: "unknown", ok: false };
}

function bestMyRole(ctx: any): string {
  return String(
    ctx?.role ??
      ctx?.me?.role ??
      ctx?.me?.globalRole ??
      ctx?.auth?.user?.role ??
      ctx?.user?.role ??
      ""
  );
}

/**
 * Try multiple plausible shapes of context to find participants for roomId.
 * This keeps us resilient while we iterate on the provider schema.
 */
function extractParticipants(ctx: any, roomId: string): Person[] {
  const tries: any[] = [];

  // presence / room state maps
  tries.push(ctx?.presence?.rooms?.[roomId]?.users);
  tries.push(ctx?.presence?.rooms?.[roomId]?.members);
  tries.push(ctx?.presence?.byRoom?.[roomId]?.users);
  tries.push(ctx?.presence?.byRoom?.[roomId]?.members);
  tries.push(ctx?.presence?.state?.[roomId]?.users);
  tries.push(ctx?.presence?.state?.[roomId]?.members);

  // direct maps
  tries.push(ctx?.roomUsers?.[roomId]);
  tries.push(ctx?.roomMembers?.[roomId]);
  tries.push(ctx?.rooms?.byId?.[roomId]?.members);
  tries.push(ctx?.rooms?.byId?.[roomId]?.users);

  // current room object
  tries.push(ctx?.currentRoom?.id === roomId ? (ctx?.currentRoom?.members ?? ctx?.currentRoom?.users) : null);

  // if presence stores a flat list with roomId attached
  if (Array.isArray(ctx?.presence?.users)) {
    tries.push(ctx.presence.users.filter((x: any) => x?.roomId === roomId || x?.room === roomId));
  }

  for (const v of tries) {
    // normalize: arrays pass through; object-maps become Object.values(...)
    const vv: any = Array.isArray(v) ? v : (v && typeof v === "object" ? Object.values(v as any) : null);
    if (Array.isArray(vv) && vv.length) return vv.map(normUser).filter(Boolean);
    if (!v) continue;
    if (Array.isArray(v)) return v.map(normUser).filter(Boolean);
    if (typeof v === "object") {
      // object map -> array
      return Object.values(v).map(normUser).filter(Boolean);
    }
  }

  // fallback: just show "me" if available
  const me = ctx?.me ?? ctx?.user ?? ctx?.auth?.user;
  if (me) return [normUser(me)];
  return [];
}

export default function RightRailRoom({ roomId }: { roomId: string }) {
  const { replaceTop } = useOverlay();
  const ctx = useWeered() as any;

  if (process.env.NODE_ENV !== "production") (globalThis as any).__weeredRoomCtx = ctx;

  const role = useMemo(() => bestMyRole(ctx), [ctx]);
  const allowed = useMemo(() => canMod(role), [role]);

  const people = useMemo(() => {
    const arr = extractParticipants(ctx, roomId);
    // de-dupe by id/name
    const seen = new Set<string>();
    return arr.filter((p) => {
      const k = (p.id ?? p.name ?? "").toString();
      if (!k) return true;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [ctx, roomId]);

  const contextLabel = (() => {
    try { return decodeURIComponent(roomId || ""); } catch { return roomId || "unknown"; }
  })();

  const ws = useMemo(() => bestWsStatus(ctx), [ctx]);

  const wired = useMemo(() => {
    return {
      mute: typeof ctx?.mute === "function",
      kick: typeof ctx?.kick === "function",
      promote: typeof ctx?.promote === "function",
      demote: typeof ctx?.demote === "function",
      lock: typeof ctx?.lockRoom === "function",
      unlock: typeof ctx?.unlockRoom === "function",
    };
  }, [ctx]);
const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<{ kind: "mute"|"kick"|""; userId: string; userName: string }>({ kind: "", userId: "", userName: "" });
  const [slowModeSec, setSlowModeSec] = useState<number>(0);
  const slowMode = slowModeSec > 0;
  const [pinned, setPinned] = useState<string>("");
  const [lockReason, setLockReason] = useState<string>("");
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectUser, setInspectUser] = useState<Person | null>(null);
  const inspectFirstBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!inspectOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setInspectOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    // best-effort focus after mount
    setTimeout(() => {
      try { inspectFirstBtnRef.current?.focus(); } catch {}
    }, 0);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inspectOpen]);
  const [locked, setLocked] = useState(false);
  const [activity, setActivity] = useState<{ at: string; text: string }[]>([]);
  const log = useCallback((text: string) => {
    const at = new Date().toLocaleTimeString();
    setActivity((cur) => [{ at, text }, ...cur].slice(0, 20));
  }, []);

  const copyText = useCallback(async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote(`Copied ${label}.`);
      log(`Copied ${label}`);
    } catch {
      setNote(`Copy ${label} failed (clipboard blocked).`);
      log(`Copy ${label} failed`);
    }
  }, [log]);

  const copyRoomId = useCallback(() => {
    copyText("room id", roomId);
  }, [copyText, roomId]);

  const copyRoomLink = useCallback(() => {
    const base =
      (typeof window !== "undefined" && window.location && window.location.origin)
        ? window.location.origin
        : "";
    const link = base ? `${base}/room/${encodeURIComponent(roomId)}` : `/room/${encodeURIComponent(roomId)}`;
    copyText("room link", link);
  }, [copyText, roomId]);

  const copyParticipants = useCallback(() => {
    const lines = people.map((p) => (p.name ?? p.handle ?? p.id ?? "unknown")).join("\n");
    copyText("participants", lines || "(none)");
  }, [copyText, people]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => {
      const a = (p.name ?? "").toLowerCase();
      const b = (p.handle ?? "").toLowerCase();
      const c = (p.id ?? "").toLowerCase();
      return a.includes(q) || b.includes(q) || c.includes(q);
    });
  }, [people, query]);

  const selected = useMemo(() => {
    const id = selectedId || (filtered[0]?.id ?? filtered[0]?.name ?? "");
    if (!id) return null;
    return filtered.find((p) => (p.id ?? p.name ?? "") === id) ?? null;
  }, [filtered, selectedId]);

  

  const openInspect = useCallback((p: Person) => {
    setInspectUser(p);
    setInspectOpen(true);
    try {
      log(`inspect → ${p.name ?? p.handle ?? p.id ?? "unknown"}`);
    } catch {}
  }, [log]);

  const closeInspect = useCallback(() => {
    setInspectOpen(false);
  }, []);const copySnapshot = useCallback(async () => {
    const payload = {
      at: new Date().toISOString(),
      roomId,
      ws: ws.label,
      wsOk: ws.ok,
      me: { id: ctx?.me?.id ?? ctx?.auth?.user?.id ?? ctx?.user?.id, name: ctx?.me?.name ?? ctx?.auth?.user?.name ?? ctx?.user?.name, role },
      counts: { participants: people.length },
      participants: people.slice(0, 50).map((p) => ({ id: p.id, name: p.name, handle: p.handle, role: p.role })),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setNote("Copied debug snapshot.");
    } catch {
      setNote("Copy failed (clipboard blocked).");
    }
  }, [ctx, people, role, roomId, ws.label, ws.ok]);

  const doAction = useCallback((kind: "mute"|"kick"|"promote"|"demote"|"lock"|"unlock") => {
    const u = selected;
    if (!u && (kind === "mute" || kind === "kick" || kind === "promote" || kind === "demote")) {
      setNote("Select a user first.");
      return;
    }

    const userId = (u?.id ?? u?.name ?? "").toString();
    const userName = (u?.name ?? u?.handle ?? userId ?? "unknown").toString();

    // destructive needs confirm
    if (kind === "mute" || kind === "kick") {
      setConfirm({ kind, userId, userName });
      return;
    }

    // non-destructive: best-effort call if provider has it; otherwise UI-only
    try {
      const isWired =
        (kind === "promote" && wired.promote) ||
        (kind === "demote" && wired.demote) ||
        (kind === "lock" && wired.lock) ||
        (kind === "unlock" && wired.unlock);

      if (kind === "promote") ctx?.promote?.(userId);
      if (kind === "demote") ctx?.demote?.(userId);
      if (kind === "lock") ctx?.lockRoom?.();
      if (kind === "unlock") ctx?.unlockRoom?.();

      if (kind === "lock") setLocked(true);
      if (kind === "unlock") setLocked(false);

      const baseMsg = isWired ? `${kind} sent` : `${kind} not wired (UI-only)`;
      const extra = (kind === "lock" || kind === "unlock") && lockReason.trim() ? ` (reason: ${lockReason.trim()})` : "";
      const msg = baseMsg + extra;
      setNote(msg);
      log(`${msg}${u ? " → " + userName : ""}`);
    } catch {
      setNote(`${kind} failed`);
      log(`${kind} failed${u ? " → " + userName : ""}`);
    }
  }, [ctx, selected, lockReason, wired, log]);

  const confirmYes = useCallback(() => {
    const { kind, userId, userName } = confirm;
    if (!kind || !userId) return;
    try {
      const isWired =
        (kind === "kick" && wired.kick) ||
        (kind === "mute" && wired.mute);

      if (kind === "kick") ctx?.kick?.(userId);
      if (kind === "mute") ctx?.mute?.(userId);

      const baseMsg = isWired ? `${kind} sent` : `${kind} not wired (UI-only)`;
      const extra = (kind === "lock" || kind === "unlock") && lockReason.trim() ? ` (reason: ${lockReason.trim()})` : "";
      const msg = baseMsg + extra;
      setNote(`${msg} → ${userName}`);
      log(`${msg} → ${userName}`);
    } catch {
      setNote(`${kind} failed`);
      log(`${kind} failed → ${userName}`);
    } finally {
      setConfirm({ kind: "", userId: "", userName: "" });
    }
  }, [confirm, ctx]);

  const confirmNo = useCallback(() => setConfirm({ kind: "", userId: "", userName: "" }), []);

  return (
    <div className="sticky top-4 overflow-x-hidden rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Room Panel</div>
          <div className="text-xs opacity-70 truncate">context: {contextLabel}</div>
        </div>
        <span className="text-xs rounded-full border border-white/10 px-2 py-0.5 opacity-80">tools</span>
      </div>


      {/* Status badges */}
      <div className="mt-2 flex flex-wrap gap-2">
        {locked ? (
          <span className="text-[11px] rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-0.5 text-amber-200">
            LOCKED
          </span>
        ) : null}
        {(slowModeSec > 0) ? (
          <span className="text-[11px] rounded-full border border-sky-300/25 bg-sky-500/10 px-2 py-0.5 text-sky-200">
            SLOW MODE
          </span>
        ) : null}
        {pinned.trim() ? (
          <span className="text-[11px] rounded-full border border-violet-300/25 bg-violet-500/10 px-2 py-0.5 text-violet-200">
            PINNED
          </span>
        ) : null}
        {!locked && !slowMode && !pinned.trim() ? (
          <span className="text-[11px] rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
            UNLOCKED
          </span>
        ) : null}
      </div>
      {/* Diagnostics (gated) */}
      {allowed ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold opacity-90">Diagnostics</div>
            <button
              type="button"
              onClick={copySnapshot}
              className="text-xs rounded-lg border border-white/10 bg-black/20 px-2 py-1 hover:bg-black/30"
              title="Copy JSON snapshot"
            >
              Copy debug snapshot
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={copyRoomId}
              className="text-xs rounded-lg border border-white/10 bg-black/20 px-2 py-1 hover:bg-black/30"
              title="Copy room id"
            >
              Copy room id
            </button>
            <button
              type="button"
              onClick={copyRoomLink}
              className="text-xs rounded-lg border border-white/10 bg-black/20 px-2 py-1 hover:bg-black/30"
              title="Copy room link"
            >
              Copy room link
            </button>
            <button
              type="button"
              onClick={copyParticipants}
              className="text-xs rounded-lg border border-white/10 bg-black/20 px-2 py-1 hover:bg-black/30"
              title="Copy participant list"
            >
              Copy participants
            </button>
          </div>
          <div className="mt-2 space-y-1 text-xs opacity-80">
            <div className="flex items-center justify-between gap-3">
              <span>WS</span>
              <span className={ws.ok ? "text-emerald-300" : "text-amber-300"}>{ws.label}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>role</span>
              <span className="opacity-90">{role || "unknown"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>participants</span>
              <span className="opacity-90">{people.length}</span>
            </div>
          </div>

          {note ? <div className="mt-2 text-xs opacity-70">{note}</div> : null}
        </div>
      ) : null}


      {/* Activity (gated) */}
      {allowed ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold opacity-90">Admin activity</div>
            <button
              type="button"
              onClick={() => { setActivity([]); setNote("Cleared activity."); }}
              className="text-xs rounded-lg border border-white/10 bg-black/20 px-2 py-1 hover:bg-black/30"
              title="Clear activity log"
            >
              Clear
            </button>
          </div>

          <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/10 p-2">
            {activity.length ? (
              <div className="space-y-1 text-xs">
                {activity.map((a, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="opacity-60 shrink-0">{a.at}</span>
                    <span className="opacity-90">{a.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs opacity-60">No actions yet.</div>
            )}
          </div>
        </div>
      ) : null}
      {/* Participants */}
      <div className="mt-4">
        <div className="text-xs font-semibold opacity-80 mb-2">Participants</div>

        {people.length ? (
          <div className="space-y-2 text-sm">
            {people.slice(0, 20).map((p, i) => (
              <div key={(p.id ?? p.name ?? i).toString()} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="truncate text-left hover:underline"
                    onClick={() => replaceTop("profile", { userId: (p.id ?? p.name ?? "unknown").toString() })}
                  >
                    {p.name ?? "unknown"}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-70">{p.role ?? "member"}</span>
                    {allowed ? (
                      <button
                        type="button"
                        className="text-[11px] rounded-md border border-white/10 bg-black/20 px-2 py-1 hover:bg-black/30 opacity-90"
                        onClick={() => openInspect(p)}
                        title="Open admin inspect"
                      >
                        Admin
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {people.length > 20 ? (
              <div className="text-xs opacity-60">+ {people.length - 20} more</div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm opacity-70">No participants found (yet).</div>
        )}
      </div>

      {/* Admin Tools (gated) */}
      <div className="mt-4">
        <div className="text-xs font-semibold opacity-80 mb-2">Admin Tools</div>
        {!allowed ? (
          <div className="text-sm opacity-70">Visible to moderators/owners only.</div>
        ) : (
          <div className="space-y-3">
            {/* User picker */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-semibold opacity-90 mb-2">User picker</div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users…"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/20"
              />

              <div className="mt-2 flex gap-2">
                <select
                  value={selectedId || ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <option value="">(auto)</option>
                  {filtered.slice(0, 50).map((p, i) => {
                    const id = (p.id ?? p.name ?? i).toString();
                    return (
                      <option key={id} value={id}>
                        {(p.name ?? p.handle ?? id).toString()}
                      </option>
                    );
                  })}
                </select>

                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                  onClick={() => setQuery("")}
                >
                  Clear
                </button>
              </div>

              <div className="mt-2 text-xs opacity-75">
                selected:{" "}
                <span className="opacity-90">
                  {selected ? (selected.name ?? selected.handle ?? selected.id ?? "unknown") : "none"}
                </span>
                {selected?.role ? <span className="opacity-70"> · {selected.role}</span> : null}
              </div>

              {/* Quick actions */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                  onClick={() => doAction("mute")}
                >
                  Mute
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                  onClick={() => doAction("kick")}
                >
                  Kick
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                  onClick={() => doAction("promote")}
                >
                  Promote MOD
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                  onClick={() => doAction("demote")}
                >
                  Demote
                </button>
              </div>

              {/* Confirm row */}
              {confirm.kind ? (
                <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-500/10 p-2 text-sm">
                  <div className="text-xs opacity-90">
                    Confirm <span className="font-semibold">{confirm.kind}</span> for{" "}
                    <span className="font-semibold">{confirm.userName}</span>?
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                      onClick={confirmYes}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                      onClick={confirmNo}
                    >
                      No
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Room controls */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-semibold opacity-90 mb-2">Room controls</div>

              
              <div className="mb-2 rounded-lg border border-white/10 bg-black/10 p-2">
                <div className="text-xs font-semibold opacity-80">Room settings</div>

                <div className="mt-2">
                  <div className="text-xs opacity-80 mb-1">Lock reason (UI-only)</div>
                  <input
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    placeholder="e.g. maintenance, spam wave, admin test…"
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                  />
                </div>

                <div className="mt-2">
                  <div className="text-xs opacity-80 mb-1">Pinned preview</div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm opacity-90">
                    {pinned.trim() ? pinned : <span className="opacity-60">Nothing pinned.</span>}
                  </div>
                </div>
              </div>
<div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                  onClick={() => doAction("lock")}
                >
                  Lock
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                  onClick={() => doAction("unlock")}
                >
                  UnLock
                </button>
              </div>

              <div className="mt-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm">Slow mode</div>
                  <div className="text-xs opacity-70">{slowModeSec > 0 ? `${slowModeSec}s` : "off"}</div>
                </div>

                <div className="mt-2 flex gap-2">
                  <select
                    value={String(slowModeSec)}
                    onChange={(e) => {
                      const next = parseInt(e.target.value || "0", 10);
                      setSlowModeSec(next);
                      setNote(`slow mode → ${next > 0 ? next + "s" : "off"} (UI-only)`);
                      log(`slow mode → ${next > 0 ? next + "s" : "off"}`);
                    }}
                    className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                  >
                    <option value="0">Off</option>
                    <option value="5">5s</option>
                    <option value="10">10s</option>
                    <option value="30">30s</option>
                    <option value="60">60s</option>
                  </select>

                  <button
                    type="button"
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                    onClick={() => {
                      setSlowModeSec(0);
                      setNote("slow mode → off (UI-only)");
                      log("slow mode → off");
                    }}
                  >
                    Off
                  </button>
                </div>
              </div>
<div className="mt-2">
                <div className="text-xs opacity-80 mb-1">Pin message (UI-only for now)</div>
                <div className="flex gap-2 flex flex-wrap gap-2 items-center flex flex-wrap gap-2 items-center flex flex-wrap gap-2 items-center">
                  <input
                    value={pinned}
                    onChange={(e) => setPinned(e.target.value)}
                    placeholder="Pinned message text…"
                    className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                    onClick={() => { if (pinned) { setNote("Pinned (UI-only)"); log("pinned message"); } else { setNote("Nothing to pin"); log("pin attempted (empty)"); } }}
                  >
                    Pin
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                    onClick={() => { setPinned(""); setNote("Cleared pin (UI-only)"); log("cleared pin"); }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {note ? <div className="mt-2 text-xs opacity-70">{note}</div> : null}
            </div>
          </div>
        )}
      </div>
          {/* Inspect drawer (gated) */}
      {allowed && inspectOpen && inspectUser ? (
        <div
          onClick={closeInspect}
          style={{ position: "fixed", inset: 0, zIndex: 9999 }}
          className="bg-black/50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", right: 16, top: 88, width: 360, maxWidth: "92vw" }}
            className="rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {inspectUser.name ?? inspectUser.handle ?? inspectUser.id ?? "unknown"}
                </div>
                <div className="text-xs opacity-70 truncate">
                  {inspectUser.id ? `id: ${inspectUser.id}` : "id: (unknown)"}{inspectUser.role ? ` · ${inspectUser.role}` : ""}
                </div>
              </div>
              <button
                type="button"
                className="text-xs rounded-lg border border-white/10 bg-black/20 px-2 py-1 hover:bg-black/30"
                onClick={closeInspect}
              >
                Close
              </button>
            
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="flex-1 text-xs rounded-lg border border-white/10 bg-black/20 px-2 py-1 hover:bg-black/30"
                  onClick={() => {
                    const uid = (inspectUser.id ?? inspectUser.name ?? "unknown").toString();
                    replaceTop("profile", { userId: uid });
                    log(`profile → ${inspectUser.name ?? inspectUser.id ?? "unknown"}`);
                  }}
                >
                  View profile
                </button>
                <button
                  type="button"
                  className="flex-1 text-xs rounded-lg border border-white/10 bg-black/20 px-2 py-1 hover:bg-black/30"
                  onClick={() => {
                    const uid = (inspectUser.id ?? inspectUser.name ?? "unknown").toString();
                    const uname = (inspectUser.name ?? inspectUser.handle ?? uid).toString();
                    try {
                      window.dispatchEvent(new CustomEvent("weered:dock:open", { detail: { mode: "dm", userId: uid, name: uname } }));
                    } catch {}
                    log(`dm → ${uname}`);
                  }}
                >
                  Message
                </button>
              </div>
</div>

            <div className="p-4 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-semibold opacity-90">Quick actions</div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    ref={inspectFirstBtnRef}
                    disabled={!wired.mute}
                    className={"rounded-lg border border-white/10 px-3 py-2 text-sm " + (wired.mute ? "bg-black/20 hover:bg-black/30" : "bg-white/5 opacity-50 cursor-not-allowed")}
                    onClick={() => { setSelectedId((inspectUser.id ?? inspectUser.name ?? "") as any); doAction("mute"); }}
                    title={wired.mute ? "Send mute (if wired)" : "Not wired yet"}
                  >
                    {wired.mute ? "Mute" : "Mute (not wired)"}
                  </button>

                  <button
                    type="button"
                    disabled={!wired.kick}
                    className={"rounded-lg border border-white/10 px-3 py-2 text-sm " + (wired.kick ? "bg-black/20 hover:bg-black/30" : "bg-white/5 opacity-50 cursor-not-allowed")}
                    onClick={() => { setSelectedId((inspectUser.id ?? inspectUser.name ?? "") as any); doAction("kick"); }}
                    title={wired.kick ? "Send kick (if wired)" : "Not wired yet"}
                  >
                    {wired.kick ? "Kick" : "Kick (not wired)"}
                  </button>

                  <button
                    type="button"
                    disabled={!wired.promote}
                    className={"rounded-lg border border-white/10 px-3 py-2 text-sm " + (wired.promote ? "bg-black/20 hover:bg-black/30" : "bg-white/5 opacity-50 cursor-not-allowed")}
                    onClick={() => { setSelectedId((inspectUser.id ?? inspectUser.name ?? "") as any); doAction("promote"); }}
                    title={wired.promote ? "Promote (if wired)" : "Not wired yet"}
                  >
                    {wired.promote ? "Promote MOD" : "Promote (not wired)"}
                  </button>

                  <button
                    type="button"
                    disabled={!wired.demote}
                    className={"rounded-lg border border-white/10 px-3 py-2 text-sm " + (wired.demote ? "bg-black/20 hover:bg-black/30" : "bg-white/5 opacity-50 cursor-not-allowed")}
                    onClick={() => { setSelectedId((inspectUser.id ?? inspectUser.name ?? "") as any); doAction("demote"); }}
                    title={wired.demote ? "Demote (if wired)" : "Not wired yet"}
                  >
                    {wired.demote ? "Demote" : "Demote (not wired)"}
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 text-xs rounded-lg border border-white/10 bg-black/20 px-2 py-2 hover:bg-black/30"
                    onClick={() => {
                      const id = (inspectUser.id ?? inspectUser.name ?? "").toString();
                      if (id) copyText("user id", id);
                    }}
                  >
                    Copy user id
                  </button>
                  <button
                    type="button"
                    className="flex-1 text-xs rounded-lg border border-white/10 bg-black/20 px-2 py-2 hover:bg-black/30"
                    onClick={() => {
                      const n = (inspectUser.name ?? inspectUser.handle ?? "").toString();
                      if (n) copyText("user name", n);
                    }}
                  >
                    Copy name
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-semibold opacity-90">Activity (filtered)</div>
                <div className="mt-2 max-h-44 overflow-auto rounded-lg border border-white/10 bg-black/10 p-2">
                  {activity.length ? (
                    <div className="space-y-1 text-xs">
                      {activity
                        .filter((a) => {
                          const k1 = (inspectUser.name ?? "").toString();
                          const k2 = (inspectUser.id ?? "").toString();
                          return (k1 && a.text.includes(k1)) || (k2 && a.text.includes(k2));
                        })
                        .slice(0, 20)
                        .map((a, idx) => (
                          <div key={idx} className="flex gap-2">
                            <span className="opacity-60 shrink-0">{a.at}</span>
                            <span className="opacity-90">{a.text}</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-xs opacity-60">No actions yet.</div>
                  )}
                </div>
              </div>

              <div className="text-[11px] opacity-60">
                Tip: click outside the drawer to close.
              </div>
            </div>
          </div>
        </div>
      ) : null}
</div>
  );
}










