import { isModOrOwner, type RoomState } from "./roomState";

/**
 * May this person put anything in front of the room right now? They're here,
 * not banned, not muted, and for chat (messages, edits, reactions, typing) the
 * chat isn't locked unless they moderate it. Mute and chat lock used to stop
 * only new messages: edits, reactions, the typing line and the media, canvas
 * and block relays went straight through (red team 2026-11-01, finding 11).
 * Slow mode stays with new messages.
 */
export function mayAct(
  room: RoomState,
  user: { id?: string; globalRole?: string } | null | undefined,
  opts: { chat?: boolean } = {},
): boolean {
  const id = user?.id;
  if (!id || !room?.users?.has(id)) return false;
  if (room.banned?.has(id)) return false;
  if ((room as any).muted?.has(id)) return false;
  if (opts.chat && (room as any).chatLocked && !isModOrOwner(room, id, user?.globalRole))
    return false;
  return true;
}

/**
 * A per-socket allowance: at most \`max\` of one kind of message per window.
 * The canvas and block relays each had their own; this is the shared one.
 */
export function withinBudget(ws: any, key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const all = (ws._budgets ||= {} as Record<string, { start: number; n: number }>);
  const w = (all[key] ||= { start: now, n: 0 });
  if (now - w.start > windowMs) {
    w.start = now;
    w.n = 0;
  }
  w.n++;
  return w.n <= max;
}
