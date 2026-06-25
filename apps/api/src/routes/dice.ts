import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  broadcastToLobby: (lobbyId: string, event: any) => void;
};

type Parsed = {
  count: number;
  sides: number;
  modifier: number;
  advantage?: boolean;
  disadvantage?: boolean;
};
type Rolled = {
  rolls: number[];
  kept: number[];
  dropped: number[];
  modifier: number;
  total: number;
  sides: number;
  advantage?: boolean;
  disadvantage?: boolean;
  isNat20?: boolean;
  isNat1?: boolean;
};

function parseDice(expr: string): Parsed | null {
  const clean = String(expr || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "");
  if (!clean || clean.length > 32) return null;
  let adv = false,
    dis = false;
  let working = clean;
  if (working.includes("adv")) {
    adv = true;
    working = working.replace(/adv(antage)?/, "");
  }
  if (working.includes("dis")) {
    dis = true;
    working = working.replace(/dis(advantage)?/, "");
  }
  const m = working.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!m) return null;
  const count = m[1] ? Number.parseInt(m[1], 10) : 1;
  const sides = Number.parseInt(m[2], 10);
  const modifier = m[3] ? Number.parseInt(m[3], 10) : 0;
  if (!Number.isFinite(count) || count < 1 || count > 100) return null;
  if (!Number.isFinite(sides) || sides < 2 || sides > 1000) return null;
  if (!Number.isFinite(modifier) || modifier < -1000 || modifier > 1000) return null;
  if ((adv || dis) && count !== 1) return null;
  return { count, sides, modifier, advantage: adv, disadvantage: dis };
}

function rollDice(parsed: Parsed): Rolled {
  if (parsed.advantage || parsed.disadvantage) {
    const r1 = Math.floor(Math.random() * parsed.sides) + 1;
    const r2 = Math.floor(Math.random() * parsed.sides) + 1;
    const keep = parsed.advantage ? Math.max(r1, r2) : Math.min(r1, r2);
    const drop = parsed.advantage ? Math.min(r1, r2) : Math.max(r1, r2);
    const isNat20 = parsed.sides === 20 && keep === 20;
    const isNat1 = parsed.sides === 20 && keep === 1;
    return {
      rolls: [r1, r2],
      kept: [keep],
      dropped: [drop],
      modifier: parsed.modifier,
      total: keep + parsed.modifier,
      sides: parsed.sides,
      advantage: parsed.advantage,
      disadvantage: parsed.disadvantage,
      isNat20,
      isNat1,
    };
  }
  const rolls: number[] = [];
  for (let i = 0; i < parsed.count; i++) rolls.push(Math.floor(Math.random() * parsed.sides) + 1);
  const sum = rolls.reduce((a, b) => a + b, 0);
  const isNat20 = parsed.sides === 20 && parsed.count === 1 && rolls[0] === 20;
  const isNat1 = parsed.sides === 20 && parsed.count === 1 && rolls[0] === 1;
  return {
    rolls,
    kept: rolls,
    dropped: [],
    modifier: parsed.modifier,
    total: sum + parsed.modifier,
    sides: parsed.sides,
    isNat20,
    isNat1,
  };
}

const ROLL_WINDOW_MS = 60_000;
const ROLL_MAX_PER_WINDOW = 12;
const rollWindow = new Map<string, number[]>();

function rateLimitOk(
  userId: string,
  lobbyId: string,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const key = `${userId}:${lobbyId}`;
  const now = Date.now();
  const window = (rollWindow.get(key) || []).filter((t) => now - t < ROLL_WINDOW_MS);
  if (window.length >= ROLL_MAX_PER_WINDOW) {
    const oldest = window[0];
    return { ok: false, retryAfterMs: ROLL_WINDOW_MS - (now - oldest) };
  }
  window.push(now);
  rollWindow.set(key, window);
  return { ok: true };
}

export default async function diceRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, broadcastToLobby } = opts;

  app.post("/lobbies/:lobbyId/dice/roll", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u)
      return reply
        .code(401)
        .send({ ok: false, error: "unauthorized", message: "Sign in to roll public dice." });

    const lobbyId = String((req as any).params?.lobbyId || "");
    if (!lobbyId) return reply.code(400).send({ ok: false, error: "lobby_required" });

    const body: any = (req as any).body || {};
    const expr = String(body.expression || body.expr || "").slice(0, 32);
    const parsed = parseDice(expr);
    if (!parsed)
      return reply.code(400).send({
        ok: false,
        error: "invalid_expression",
        message: "Try 1d20, d6+3, 2d8, 4d6, d20adv, etc.",
      });

    const intent = (() => {
      const v = String(body.intent || "").toLowerCase();
      return ["attack", "damage", "save", "skill", "check"].includes(v) ? v : "";
    })();
    const attackName = String(body.attackName || "").slice(0, 60) || undefined;
    const damageExpression = String(body.damageExpression || "").slice(0, 32) || undefined;
    const characterId = String(body.characterId || "").slice(0, 30) || undefined;

    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) return reply.code(404).send({ ok: false, error: "lobby_not_found" });

    const rl = rateLimitOk(u.id, lobbyId);
    if (!rl.ok) {
      return reply.code(429).send({
        ok: false,
        error: "rate_limited",
        message: `Slow down — ${ROLL_MAX_PER_WINDOW} public rolls per minute. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`,
        retryAfterMs: rl.retryAfterMs,
      });
    }

    const result = rollDice(parsed);

    const event = {
      type: "dice:roll",
      userId: u.id,
      userName: u.name,
      expression: expr,
      total: result.total,
      rolls: result.rolls,
      kept: result.kept,
      dropped: result.dropped,
      modifier: result.modifier,
      sides: result.sides,
      advantage: !!result.advantage,
      disadvantage: !!result.disadvantage,
      isNat20: !!result.isNat20,
      isNat1: !!result.isNat1,
      intent: intent || undefined,
      attackName,
      damageExpression,
      characterId,
      time: Date.now(),
    };
    broadcastToLobby(lobbyId, event);

    return reply.send({ ok: true, ...event });
  });
}
