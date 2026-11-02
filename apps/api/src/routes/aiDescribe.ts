import type { FastifyInstance } from "fastify";
import { hasLobbyPerm } from "../lib/lobbyPerms";
import { runBuilder } from "../lib/buildAi";
import { allowBuild, nowLine, promptOf } from "../lib/build/allowance";
import { clip } from "../lib/build/common";
import type { BuildJob, JobCtx } from "../lib/build/job";
import { DESCRIBE_JOBS } from "../lib/build/jobs";
import { ownerBuildsModules } from "../lib/moduleGate";

// Describe anything (James 2026-10-31: "Do everything."). One route for every
// "describe it" job in lib/build/jobs: events, rooms, roles, chat rules, the
// crew look, the stream overlay, the lobby's host, scheduled posts, alerts,
// feeds, custom blocks, games and pages.
//
//   POST /ai/describe/:job          {prompt, tz?, ...}  the caller's own things
//   POST /ai/describe/:job/:id      {prompt, tz?, ...}  lobby :id, by its staff
//   -> {ok, result, summary}
//
// Nothing is saved here; the person saves the result through the feature's own
// route. Shares the builders' daily allowance (lib/build/allowance.ts).

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getAI: () => Promise<any | null>;
  lobbyAdminAccess: (req: any, reply: any, minLevel?: number) => Promise<any>;
};

const CODE_JOBS = new Set(["block", "game"]);

export default async function aiDescribeRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getAI, lobbyAdminAccess } = opts;
  const jobs = new Map<string, BuildJob<any>>(DESCRIBE_JOBS.map((j) => [j.id, j]));

  async function run(req: any, reply: any, lobbyId?: string) {
    const job = jobs.get(String(req.params?.job || ""));
    if (!job) return reply.code(404).send({ ok: false, error: "no_such_job" });
    const body: any = req.body && typeof req.body === "object" ? req.body : {};
    let ctx: JobCtx;
    if (job.scope === "lobby") {
      if (!lobbyId) return reply.code(400).send({ ok: false, error: "lobby_required" });
      const access = await lobbyAdminAccess(req, reply, job.minLevel ?? 4);
      if (!access) return;
      const level = access.member?.roleLevel ?? (access.overrideRole ? 5 : 1);
      if (job.perm && !hasLobbyPerm(level, job.perm, access.overrideRole))
        return reply.code(403).send({ ok: false, error: "no_permission" });
      // Blocks and games are the lobby's custom modules, on its owner's plan
      // (lib/moduleGate.ts); no build is spent on code that couldn't be saved.
      if (
        CODE_JOBS.has(job.id) &&
        !access.overrideRole &&
        !(await ownerBuildsModules(access.lobby?.ownerId))
      )
        return reply.code(402).send({ ok: false, error: "paid_feature" });
      ctx = { user: access.user, body, prompt: "", lobby: access.lobby, level };
    } else {
      const u = authFromHeader(req.headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      ctx = { user: u, body, prompt: "" };
    }
    ctx.prompt = promptOf(body);
    if (ctx.prompt.length < 3) return reply.code(400).send({ ok: false, error: "prompt_required" });
    const ai = await getAI();
    if (!ai) return reply.code(503).send({ ok: false, error: "ai_unavailable" });
    if (!(await allowBuild(ctx.user.id, reply))) return;

    const state = job.context ? await job.context(ctx) : "";
    const user = [nowLine(body.tz), state, `<request>\n${ctx.prompt}\n</request>`]
      .filter(Boolean)
      .join("\n\n");
    const out = await runBuilder(ai, {
      kind: job.id,
      system: job.system,
      tool: job.tool,
      user,
      maxTokens: job.maxTokens,
      timeoutMs: job.timeoutMs,
    });
    if (!out) return reply.code(502).send({ ok: false, error: "build_failed" });
    const result = await job.clean(out.input, { ...ctx, given: `${ctx.prompt}\n${state}` });
    return reply.send({ ok: true, result, summary: clip((out.input as any)?.summary, 240) });
  }

  const limit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };
  app.post("/ai/describe/:job", limit, (req, reply) => run(req, reply));
  app.post("/ai/describe/:job/:id", limit, (req, reply) =>
    run(req, reply, String((req.params as any)?.id || "")),
  );
}
