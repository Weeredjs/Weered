import { log } from "./logger";
import { prisma } from "./prisma";
import { getAI } from "./ai";
import { buildOperatorSystemPrompt } from "./operatorPrompt";
import { takeAiBudget } from "./aiBudget";
import { dmDeliver, getOperatorUserId } from "./notifications";

/**
 * The Operator answers its DMs the way it answers @operator in a room. The
 * welcome DM invites people to reply, and until 2026-10-03 nothing did: a new
 * member's first DM to it went unanswered. Same model and the same daily
 * allowance as the room path (the "operator" bucket); guests never cost a call.
 */
const HISTORY = 8;

type Turn = { role: "user" | "assistant"; content: string };

/** A DM thread (oldest first) as model turns: same-side runs merged, starting
 *  and ending on the member. Empty when there is nothing to answer. */
export function toTurns(
  rows: Array<{ fromId: string; body: string | null }>,
  operatorId: string,
): Turn[] {
  const turns: Turn[] = [];
  for (const r of rows) {
    const text = String(r.body || "").trim();
    if (!text) continue;
    const role = r.fromId === operatorId ? "assistant" : "user";
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content += "\n\n" + text;
    else turns.push({ role, content: text });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return [];
  return turns;
}

async function deliver(operatorId: string, toUserId: string, body: string): Promise<void> {
  const dm = await prisma.directMessage.create({
    data: { fromId: operatorId, toId: toUserId, body },
    select: { id: true, fromId: true, toId: true, body: true, createdAt: true },
  });
  dmDeliver(toUserId, {
    type: "dm:message",
    message: { ...dm, createdAt: dm.createdAt.toISOString() },
  });
}

export async function answerOperatorDm(
  fromId: string,
  toId: string,
  isGuest: boolean,
): Promise<void> {
  try {
    const operatorId = await getOperatorUserId();
    if (toId !== operatorId || fromId === operatorId || isGuest) return;
    if (!takeAiBudget(fromId, "operator")) {
      await deliver(
        operatorId,
        fromId,
        "I've answered all your questions for today. Try me again tomorrow.",
      );
      return;
    }
    const ai = await getAI();
    if (!ai) return;
    const rows = await prisma.directMessage.findMany({
      where: {
        deletedAt: null,
        OR: [
          { fromId, toId: operatorId },
          { fromId: operatorId, toId: fromId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: HISTORY,
      select: { fromId: true, body: true },
    });
    const messages = toTurns(rows.reverse(), operatorId);
    if (!messages.length) return;
    const response = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        buildOperatorSystemPrompt("") +
        "\n\nYou are replying in a private direct message, not a room chat. Keep it short.",
      messages,
    });
    const reply = String(response?.content?.[0]?.text || "").trim();
    if (reply) await deliver(operatorId, fromId, reply);
  } catch (e) {
    log.error("[operatorDm]", e);
  }
}
