import { prisma } from "./prisma";
import { swallow } from "./logger";

// Last chat-message timestamp per room — one indexed groupBy for a whole
// lobby's room list ("active 2h ago" recency on the live room directory).
// Failure degrades to an empty map; recency is decoration, never a blocker.
export async function lastMessageMap(roomIds: string[]): Promise<Map<string, Date>> {
  const m = new Map<string, Date>();
  if (roomIds.length === 0) return m;
  try {
    const grouped = await prisma.roomMessage.groupBy({
      by: ["roomId"],
      where: { roomId: { in: roomIds } },
      _max: { ts: true },
    });
    for (const g of grouped) if (g._max.ts) m.set(g.roomId, g._max.ts);
  } catch (e) {
    swallow(e);
  }
  return m;
}
