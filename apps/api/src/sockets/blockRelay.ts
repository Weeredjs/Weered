import { prisma } from "../lib/prisma";
import { swallow } from "../lib/logger";
import { mayAct } from "../lib/roomGate";

// Custom blocks and games talking live (web lib/blockSandbox.ts weered.send /
// weered.on): "block:send" {blockId, data} from one viewer reaches everyone
// else in the lobby's chat room as "block:event" {blockId, data, from}. Only a
// block that belongs to the lobby the socket is in; small frames, and a game
// sends a few a second at most (a host pushing state, players buzzing in).

export const BLOCK_FRAME_MAX = 4_096;
const WINDOW_MS = 2_000;
const MAX_PER_WINDOW = 16;

const lobbyOf = new Map<string, { lobbyId: string | null; at: number }>();

async function blockLobby(blockId: string): Promise<string | null> {
  const hit = lobbyOf.get(blockId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.lobbyId;
  const row = await prisma.customBlock
    .findUnique({ where: { id: blockId }, select: { lobbyId: true } })
    .catch(() => null);
  const lobbyId = row?.lobbyId ?? null;
  lobbyOf.set(blockId, { lobbyId, at: Date.now() });
  if (lobbyOf.size > 5000) lobbyOf.clear();
  return lobbyId;
}

function allowed(ws: any): boolean {
  const now = Date.now();
  const w = (ws._blockWindow ||= { start: now, n: 0 });
  if (now - w.start > WINDOW_MS) {
    w.start = now;
    w.n = 0;
  }
  w.n++;
  return w.n <= MAX_PER_WINDOW;
}

export function handleBlockRelay(
  ws: any,
  msg: any,
  snap: { room: any; roomId: string },
  opts: { send: (ws: any, m: any) => void },
): boolean {
  if (msg.type !== "block:send") return false;
  const { room, roomId } = snap;
  const blockId = String(msg.blockId || "").slice(0, 40);
  if (!blockId || !room?.lobbyId || room.lobbyId !== roomId) return true;
  if (!mayAct(room, ws.user) || !allowed(ws)) return true;
  let data: string;
  try {
    data = JSON.stringify(msg.data ?? null);
  } catch {
    return true;
  }
  if (data.length > BLOCK_FRAME_MAX) return true;
  const frame = {
    type: "block:event",
    roomId,
    blockId,
    data: JSON.parse(data),
    from: { id: ws.user.id, name: String(ws.user.name || "").slice(0, 40) },
  };
  void blockLobby(blockId)
    .then((lobbyId) => {
      if (lobbyId !== roomId) return;
      for (const s of room.sockets) if (s !== ws) opts.send(s, frame);
    })
    .catch(swallow);
  return true;
}
