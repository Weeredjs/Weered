import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// Where a new account came from (2026-11-04, ahead of the outreach): the web
// keeps the first ?ref= a visitor arrives with (web lib/signupSource.ts) and,
// once they have an account, reports it here. Only a new account takes one,
// once: an old account or a second report changes nothing. Ops shows it.
//
// Since 2026-11-12 it also keeps the site that sent them and the page they
// first landed on: nine of the ten accounts made after 11-04 carried no ?ref=,
// while the logs showed Google, GitHub and Reddit sending people in.
const NEW_ACCOUNT_MS = 48 * 3600_000;

/** A ref is a short slug: "sept-organizers", "reddit-gta6". */
export function cleanRef(v: unknown): string | null {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,39}$/.test(s) ? s : null;
}

/** The referring site: a bare host ("google.com"), or "direct". */
export function cleanFrom(v: unknown): string | null {
  const s = String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  if (s === "direct") return s;
  return /^[a-z0-9][a-z0-9.-]{0,79}$/.test(s) && s.includes(".") ? s : null;
}

/** The first page: a path, without its query, at most 120 characters. */
export function cleanLanding(v: unknown): string | null {
  const s = String(v ?? "")
    .trim()
    .split(/[?#]/)[0];
  return /^\/[\w\-./%~]{0,119}$/.test(s) ? s : null;
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
      const body = (req as any).body || {};
      const ref = cleanRef(body.ref);
      const from = cleanFrom(body.from);
      const landing = cleanLanding(body.landing);
      if (!ref && !from && !landing) return reply.code(400).send({ ok: false, error: "bad_ref" });
      // First touch, once: an account that already has any of it keeps what it has.
      const r = await prisma.user.updateMany({
        where: {
          id: u.id,
          signupSource: null,
          signupFrom: null,
          signupLanding: null,
          createdAt: { gte: new Date(Date.now() - NEW_ACCOUNT_MS) },
        },
        data: {
          ...(ref ? { signupSource: ref } : {}),
          ...(from ? { signupFrom: from } : {}),
          ...(landing ? { signupLanding: landing } : {}),
        },
      });
      return reply.send({ ok: true, saved: r.count === 1 });
    },
  );
}
