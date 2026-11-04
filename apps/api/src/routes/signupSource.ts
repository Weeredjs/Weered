import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// Where a new account came from (2026-11-04, ahead of the outreach): the web
// keeps the first ?ref= a visitor arrives with (web lib/signupSource.ts) and,
// once they have an account, reports it here. Only a new account takes one,
// once: an old account or a second report changes nothing. Ops shows it.
const NEW_ACCOUNT_MS = 48 * 3600_000;

/** A ref is a short slug: "sept-organizers", "reddit-gta6". */
export function cleanRef(v: unknown): string | null {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,39}$/.test(s) ? s : null;
}

export default async function signupSourceRoutes(
  app: FastifyInstance,
  opts: { authFromHeader: (h?: string) => { id: string } | null },
) {
  app.post(
    "/profile/source",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const u = opts.authFromHeader((req as any).headers?.authorization);
      if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
      const ref = cleanRef((req as any).body?.ref);
      if (!ref) return reply.code(400).send({ ok: false, error: "bad_ref" });
      const r = await prisma.user.updateMany({
        where: {
          id: u.id,
          signupSource: null,
          createdAt: { gte: new Date(Date.now() - NEW_ACCOUNT_MS) },
        },
        data: { signupSource: ref },
      });
      return reply.send({ ok: true, saved: r.count === 1 });
    },
  );
}
