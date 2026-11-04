// Chat sent while the socket is down for a restart's few seconds (a deploy,
// James 2026-11-03) used to vanish: sendChat returned without a word and the
// box was already cleared. Now it waits here and goes out once the room is
// back (presence:state). Twenty at most, and nothing older than a minute.
export type HeldChat = { roomId: string; at: number; env: Record<string, unknown> };

export function holdChat(box: { current: HeldChat[] }, env: { roomId: string }): void {
  box.current = [...box.current, { roomId: env.roomId, at: Date.now(), env }].slice(-20);
}

/** Send what's held for this room, oldest first; the rest stays. */
export function releaseChat(
  box: { current: HeldChat[] },
  roomId: string,
  send: (raw: string) => void,
): number {
  const mine = box.current.filter((h) => h.roomId === roomId);
  if (!mine.length) return 0;
  box.current = box.current.filter((h) => h.roomId !== roomId);
  let n = 0;
  for (const h of mine) {
    if (Date.now() - h.at > 60_000) continue;
    try {
      send(JSON.stringify(h.env));
      n++;
    } catch {
      // The socket went again; the message is lost, as it was before.
    }
  }
  return n;
}
