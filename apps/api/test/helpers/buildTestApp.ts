import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { readCookieToken } from "../../src/lib/authCookie";

// Test secret: tests mint their own tokens with this and the harness verifies
// them, so route auth is exercised for real (no live JWT_SECRET needed).
const TEST_JWT_SECRET = "weered-integration-test-secret";

/** Mint a Bearer token a test client sends as a logged-in user. */
export function testToken(userId: string): string {
  return jwt.sign({ sub: userId }, TEST_JWT_SECRET, { expiresIn: "10m" });
}

/** Mirrors the prod authFromHeader contract: Bearer -> verified user id. */
export function testAuthFromHeader(authHeader?: string): { id: string; name: string } | null {
  if (!authHeader) return null;
  const m = String(authHeader).match(/^Bearer\s+(.+)$/i);
  const raw = m ? m[1] : String(authHeader);
  try {
    const d: any = jwt.verify(raw, TEST_JWT_SECRET);
    return d?.sub ? { id: String(d.sub), name: String(d.name || d.sub) } : null;
  } catch {
    return null;
  }
}

type Helpers = { authFromHeader: typeof testAuthFromHeader };

/**
 * Builds a Fastify app with the SAME global cookie->Authorization backfill hook
 * as production main(), then lets the caller register the real route module(s)
 * under test with real opts. Each test composes exactly the routes it needs and
 * drives them with app.inject() — no live server, no prod DB (DATABASE_URL must
 * point at the test database; enforced by test/integration/setup.ts).
 */
export async function buildTestApp(
  register: (app: any, helpers: Helpers) => Promise<void> | void,
): Promise<any> {
  const app = Fastify({ logger: false });
  app.addHook("onRequest", async (req: any) => {
    if (!req.headers.authorization) {
      const c = readCookieToken(req);
      if (c) req.headers.authorization = "Bearer " + c;
    }
  });
  await register(app, { authFromHeader: testAuthFromHeader });
  await app.ready();
  return app;
}
