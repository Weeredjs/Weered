import type { FastifyInstance } from "fastify";
import { allowBuild, nowLine, promptOf } from "../lib/build/allowance";
import { hasLobbyPerm } from "../lib/lobbyPerms";
import { runBuilder } from "../lib/buildAi";
import {
  BUILD_SYSTEM,
  BUILD_TOOL,
  DRIP_SYSTEM,
  DRIP_TOOL,
  EDIT_SYSTEM,
  EDIT_TOOL,
  clip,
  cleanDrip,
  cleanOps,
  cleanPlan,
  lobbyForModel,
} from "../lib/buildPlan";

// Describe it (James 2026-10-31: "Ok, so we have a pretty simple advantage.
// Build it."). A sentence becomes a lobby, a change to one, or your drip.
//
//   POST /ai/build/lobby           {prompt, current?, tz?}  -> {plan}
//   POST /ai/build/lobby/:id/edit  {prompt, layout, tz?}    -> {ops, summary}
//   POST /ai/build/drip            {prompt, look?}          -> {look, layout?, summary}
//
// Nothing is saved here: the composer, Design mode and Change your drip apply
// the result to their drafts, and the person launches or saves it as before.
// One daily allowance covers all three: paid accounts 60, free ones 10 (a free
// account can describe, preview and launch a lobby: lobbies are free since 2026-11-02).
// The site has its own daily ceiling too, AI_BUILD_SITE_DAILY.

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getAI: () => Promise<any | null>;
  lobbyAdminAccess: (req: any, reply: any, minLevel?: number) => Promise<any>;
};

const LOOK_KEYS = [
  "theme",
  "palette",
  "accent",
  "font",
  "shape",
  "lines",
  "texture",
  "backdrop",
  "fx",
  "fxIntensity",
  "fxSymbol",
  "stars",
  "density",
];

export default async function aiBuildRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getAI, lobbyAdminAccess } = opts;

  app.post(
    "/ai/build/lobby",
    { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body: any = (req as any).body || {};
      const prompt = promptOf(body);
      if (prompt.length < 3) return reply.code(400).send({ ok: false, error: "prompt_required" });
      const ai = await getAI();
      if (!ai) return reply.code(503).send({ ok: false, error: "ai_unavailable" });
      if (!(await allowBuild(u.id, reply))) return;

      const cur =
        body.current && typeof body.current === "object"
          ? cleanPlan(body.current, JSON.stringify(body.current))
          : null;
      const curJson = cur ? JSON.stringify({ ...cur, summary: undefined }) : "";
      const user = [
        nowLine(body.tz),
        cur ? `Their current plan (change what they ask for, keep the rest):\n${curJson}` : "",
        `<request>\n${prompt}\n</request>`,
      ]
        .filter(Boolean)
        .join("\n\n");
      const out = await runBuilder(ai, {
        kind: "lobby",
        system: BUILD_SYSTEM,
        tool: BUILD_TOOL,
        user,
        maxTokens: 3000,
      });
      if (!out) return reply.code(502).send({ ok: false, error: "build_failed" });
      return reply.send({ ok: true, plan: cleanPlan(out.input, `${prompt}\n${curJson}`) });
    },
  );

  app.post(
    "/ai/build/lobby/:id/edit",
    { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const ctx = await lobbyAdminAccess(req, reply, 4);
      if (!ctx) return;
      const level = ctx.member?.roleLevel ?? (ctx.overrideRole ? 5 : 1);
      if (!hasLobbyPerm(level, "edit_branding", ctx.overrideRole))
        return reply.code(403).send({ ok: false, error: "no_permission" });
      const body: any = (req as any).body || {};
      const prompt = promptOf(body);
      if (prompt.length < 3) return reply.code(400).send({ ok: false, error: "prompt_required" });
      // The Design mode draft, which can be ahead of what's saved.
      const layout =
        body.layout && typeof body.layout === "object" && !Array.isArray(body.layout)
          ? body.layout
          : ctx.lobby.layout || {};
      const layoutJson = JSON.stringify(layout);
      if (layoutJson.length > 60_000)
        return reply.code(413).send({ ok: false, error: "layout_too_large" });
      const ai = await getAI();
      if (!ai) return reply.code(503).send({ ok: false, error: "ai_unavailable" });
      if (!(await allowBuild(ctx.user.id, reply))) return;

      const view = lobbyForModel(
        {
          name: typeof body.name === "string" ? body.name : ctx.lobby.name,
          description:
            typeof body.description === "string" ? body.description : ctx.lobby.description,
          moduleType: ctx.lobby.moduleType,
          logoUrl: ctx.lobby.logoUrl,
        },
        layout,
      );
      const user = [
        nowLine(body.tz),
        `The lobby:\n${JSON.stringify(view)}`,
        `<request>\n${prompt}\n</request>`,
      ].join("\n\n");
      const out = await runBuilder(ai, {
        kind: "edit",
        system: EDIT_SYSTEM,
        tool: EDIT_TOOL,
        user,
        maxTokens: 3000,
      });
      if (!out) return reply.code(502).send({ ok: false, error: "build_failed" });
      const blocks = new Map(view.blocks.map((b) => [b.id, String(b.type)]));
      const ops = cleanOps(out.input, blocks, `${prompt}\n${layoutJson}`);
      return reply.send({ ok: true, ops, summary: clip(out.input?.summary, 240) });
    },
  );

  app.post(
    "/ai/build/drip",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const u = authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const body: any = (req as any).body || {};
      const prompt = promptOf(body);
      if (prompt.length < 3) return reply.code(400).send({ ok: false, error: "prompt_required" });
      const ai = await getAI();
      if (!ai) return reply.code(503).send({ ok: false, error: "ai_unavailable" });
      if (!(await allowBuild(u.id, reply))) return;

      const look: Record<string, unknown> = {};
      const raw = body.look && typeof body.look === "object" ? body.look : {};
      for (const k of LOOK_KEYS) if (raw[k] !== undefined) look[k] = raw[k];
      const user = [
        `Their current look:\n${JSON.stringify(look).slice(0, 2000)}`,
        `<request>\n${prompt}\n</request>`,
      ].join("\n\n");
      const out = await runBuilder(ai, {
        kind: "drip",
        system: DRIP_SYSTEM,
        tool: DRIP_TOOL,
        user,
        maxTokens: 1200,
      });
      if (!out) return reply.code(502).send({ ok: false, error: "build_failed" });
      return reply.send({ ok: true, ...cleanDrip(out.input, String(look.theme || "nebula")) });
    },
  );
}
