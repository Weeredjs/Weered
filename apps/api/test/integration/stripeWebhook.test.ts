import { describe, it, expect, afterAll } from "vitest";
import { createHmac } from "crypto";
import billingRoutes from "../../src/routes/billing";
import { buildTestApp, testAuthFromHeader } from "../helpers/buildTestApp";
import { prisma } from "../../src/lib/prisma";

// The Stripe webhook is the money/fraud boundary: it must reject any body whose
// HMAC signature does not match the shared secret. The handler does its own
// timingSafeEqual verification, so we forge valid/invalid signatures directly.
const SECRET = "whsec_test_" + "a".repeat(24);
process.env.STRIPE_WEBHOOK_SECRET = SECRET; // read at billingRoutes() registration

function sign(payload: string, t = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", SECRET).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

async function makeApp() {
  return buildTestApp((app: any) => {
    // capture the raw body (Stripe signatures are over the exact bytes)
    app.removeContentTypeParser("application/json");
    app.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (req: any, body: Buffer, done: any) => {
        req.rawBody = body;
        try {
          done(null, JSON.parse(body.toString() || "{}"));
        } catch (e) {
          done(e, undefined);
        }
      },
    );
    const opts = new Proxy(
      { authFromHeader: testAuthFromHeader },
      { get: (t: any, p: string) => (p in t ? t[p] : () => Promise.resolve()) },
    );
    return billingRoutes(app, opts);
  });
}

function post(app: any, payload: string, sig?: string) {
  const headers: any = { "content-type": "application/json" };
  if (sig !== undefined) headers["stripe-signature"] = sig;
  return app.inject({ method: "POST", url: "/subscribe/webhook", headers, payload });
}

describe("stripe webhook - signature verification (fraud boundary)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("accepts a correctly-signed event (unhandled type -> 200 ok)", async () => {
    const app = await makeApp();
    const body = JSON.stringify({ type: "ping", data: {} });
    const r = await post(app, body, sign(body));
    expect(r.statusCode).toBe(200);
    expect(r.json().ok).toBe(true);
    await app.close();
  });

  it("rejects a missing signature header (400)", async () => {
    const app = await makeApp();
    const body = JSON.stringify({ type: "ping" });
    const r = await post(app, body);
    expect(r.json().error).toBe("missing_signature");
    await app.close();
  });

  it("rejects a forged signature (400 invalid_signature)", async () => {
    const app = await makeApp();
    const body = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { metadata: { tier: "GOD" } } },
    });
    const t = Math.floor(Date.now() / 1000);
    const r = await post(app, body, `t=${t},v1=${"f".repeat(64)}`);
    expect(r.json().error).toBe("invalid_signature");
    await app.close();
  });

  it("rejects a tampered body (sig of A, body B -> invalid_signature)", async () => {
    const app = await makeApp();
    const signed = JSON.stringify({ type: "ping", amount: 1 });
    const tampered = JSON.stringify({ type: "checkout.session.completed", amount: 9999 });
    const r = await post(app, tampered, sign(signed));
    expect(r.json().error).toBe("invalid_signature");
    await app.close();
  });

  it("rejects an expired timestamp (>300s) even with a valid signature", async () => {
    const app = await makeApp();
    const body = JSON.stringify({ type: "ping" });
    const oldT = Math.floor(Date.now() / 1000) - 400;
    const r = await post(app, body, sign(body, oldT));
    expect(r.json().error).toBe("timestamp_expired");
    await app.close();
  });
});
