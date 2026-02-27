"use client";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered } from "./WeeredProvider";
import { useMemo } from "react";


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
    if (Array.isArray(vv) && vv.length) return vv as any;
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

  return (
    <div className="sticky top-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Room Panel</div>
          <div className="text-xs opacity-70 truncate">context: {contextLabel}</div>
        </div>
        <span className="text-xs rounded-full border border-white/10 px-2 py-0.5 opacity-80">tools</span>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold opacity-80 mb-2">Participants</div>

        {people.length ? (
          <div className="space-y-2 text-sm">
            {people.slice(0, 20).map((p, i) => (
              <div key={(p.id ?? p.name ?? i).toString()} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <button type="button" className="truncate text-left hover:underline" onClick={() => replaceTop("profile", { userId: (p.id ?? p.name ?? "unknown").toString() })}>{p.name ?? "unknown"}</button>
                  <span className="text-xs opacity-70">{p.role ?? "member"}</span>
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

      <div className="mt-4">
        <div className="text-xs font-semibold opacity-80 mb-2">Moderator / Admin</div>
        <div className="flex flex-col gap-2">
          <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10" type="button">
            Pin message (placeholder)
          </button>
          <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10" type="button">
            Mute user (placeholder)
          </button>
        </div>
      </div>
    </div>
  );
}