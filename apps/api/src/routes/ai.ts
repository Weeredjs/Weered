import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h?: string) => { id: string } | null;
  isAIAvailable: () => boolean;
  getAI: () => Promise<any | null>;
  rooms: Map<string, { users: Map<string, any> }>;
};

export default async function aiRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, isAIAvailable, getAI, rooms } = opts;

  app.get("/ai/status", async (_req, reply) => {
    const available = isAIAvailable();
    return reply.send({ ok: true, available });
  });

  app.get("/ai/search", async (req, reply) => {
    const ai = await getAI();
    if (!ai) return reply.send({ ok: true, results: [], answer: null });

    const q = String((req.query as any).q || "").trim();
    if (!q) return reply.send({ ok: true, results: [], answer: null });

    const [lobbyList, onlineCount] = await Promise.all([
      prisma.lobby.findMany({
        select: { id: true, name: true, description: true, moduleType: true, pinned: true, verified: true },
        orderBy: { name: "asc" },
      }),
      Promise.resolve((() => {
        const ids = new Set<string>();
        for (const [, r] of rooms) {
          for (const [uid] of r.users) ids.add(uid);
        }
        return ids.size;
      })()),
    ]);

    const lobbyContext = lobbyList.map((l: any) => `${l.name} (${l.moduleType || "general"})${l.verified ? " [verified]" : ""}: ${l.description || "no description"}`).join("\n");

    try {
      const response = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: `You are the search engine for Weered, a gaming/social platform. Given a user query, analyze their intent and return a JSON response with:
- "answer": a short natural language answer (1-2 sentences, casual tone)
- "lobbies": array of lobby IDs that match (from the available list)
- "action": optional action suggestion — one of: "browse", "join_lobby", "open_dm", "go_home", "go_store", null

Available lobbies:
${lobbyContext}

Currently ${onlineCount} users online.

RESPOND ONLY WITH VALID JSON. No markdown, no explanation.`,
        messages: [{ role: "user", content: q }],
      });

      const rawText = response?.content?.[0]?.text || "{}";
      const text = rawText
        .replace(/^\s*```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      let parsed: any = {};
      try { parsed = JSON.parse(text); } catch { parsed = { answer: text.slice(0, 300) }; }

      const wanted = Array.isArray(parsed.lobbies) ? parsed.lobbies.map((x: any) => String(x).toLowerCase()) : [];
      const matchedLobbies = lobbyList.filter((l: any) =>
        wanted.includes(String(l.id).toLowerCase()) || wanted.includes(String(l.name).toLowerCase())
      );

      return reply.send({
        ok: true,
        answer: parsed.answer || null,
        lobbies: matchedLobbies,
        action: parsed.action || null,
      });
    } catch (e: any) {
      console.error("[ai/search]", e);
      return reply.send({ ok: true, results: [], answer: "The Operator is offline right now." });
    }
  });

  app.post("/ai/quiz", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false });

    const ai = await getAI();
    if (!ai) return reply.send({ ok: false, error: "AI not available" });

    const { content, numQuestions = 10, questionTypes = "mixed" } = (req as any).body || {};
    if (!content || typeof content !== "string" || content.trim().length < 50) {
      return reply.code(400).send({ ok: false, error: "Content must be at least 50 characters" });
    }

    const text = content.trim().slice(0, 8000);
    const num = Math.min(Math.max(Number(numQuestions) || 10, 3), 20);

    try {
      const response = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: `You are a quiz generator for students. Given study material, create a practice test. Return ONLY valid JSON array of question objects. Each question has:
- "type": "multiple_choice" | "true_false" | "fill_blank"
- "question": the question text
- "options": array of 4 strings (for multiple_choice) or ["True", "False"] (for true_false) or null (for fill_blank)
- "answer": the correct answer (must match one of the options exactly, or the fill-in answer)
- "explanation": brief explanation of why this is correct

Generate exactly ${num} questions. Mix question types if "mixed" is specified. Focus on key concepts, definitions, and application. Make questions challenging but fair.`,
        messages: [{ role: "user", content: `Generate ${num} ${questionTypes} practice questions from this material:\n\n${text}` }],
      });

      const raw = response?.content?.[0]?.text || "[]";
      let questions: any[] = [];
      try {
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        questions = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      } catch {
        return reply.send({ ok: false, error: "Failed to generate valid quiz" });
      }

      return reply.send({ ok: true, questions });
    } catch (e: any) {
      console.error("[ai/quiz]", e);
      return reply.send({ ok: false, error: "Quiz generation failed" });
    }
  });
}
