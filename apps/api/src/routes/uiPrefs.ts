import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { mergeUiPrefs, sanitizeUiPrefs, shellRejected } from "../lib/uiPrefs";

// GET/PATCH /profile/me/ui: the signed-in account's UI preferences (theme,
// colour, the viewer's own layout, first-run setup state). See lib/uiPrefs.ts.
type Opts = { authFromHeader: (h?: string) => { id: string } | null };

export default async function uiPrefsRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader } = opts;

  app.get("/profile/me/ui", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { uiPrefs: true } });
    if (!row) return reply.code(404).send({ ok: false, error: "not_found" });
    return reply.send({ ok: true, prefs: row.uiPrefs ? sanitizeUiPrefs(row.uiPrefs) : null });
  });

  app.patch("/profile/me/ui", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const body: any = (req as any).body || {};
    if (!body.prefs || typeof body.prefs !== "object") {
      return reply.code(400).send({ ok: false, error: "prefs_required" });
    }
    // A layout the whitelist can't keep is refused, not dropped: Design mode
    // would otherwise show "Saved" while the account kept the old one.
    if (shellRejected(body.prefs)) {
      return reply.code(413).send({ ok: false, error: "layout_too_large" });
    }
    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { uiPrefs: true } });
    if (!row) return reply.code(404).send({ ok: false, error: "not_found" });
    const prefs = mergeUiPrefs(row.uiPrefs, body.prefs);
    await prisma.user.update({ where: { id: u.id }, data: { uiPrefs: prefs as any } });
    return reply.send({ ok: true, prefs });
  });
}
