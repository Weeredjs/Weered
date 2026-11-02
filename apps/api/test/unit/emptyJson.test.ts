import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { allowEmptyJsonBody } from "../../src/lib/emptyJson";

// A bodiless POST or DELETE labelled application/json used to fail with 400,
// so kick, unban, delete and leave did nothing (2026-11-01 ops audit).
async function app() {
  const a = Fastify();
  allowEmptyJsonBody(a);
  a.post("/x", async (req) => ({ got: req.body }));
  a.delete("/x", async (req) => ({ got: req.body }));
  await a.ready();
  return a;
}
const JSON_HEADERS = { "content-type": "application/json" };

describe("allowEmptyJsonBody", () => {
  it("reads an empty JSON body as {} on POST and DELETE", async () => {
    const a = await app();
    for (const method of ["POST", "DELETE"] as const) {
      const r = await a.inject({ method, url: "/x", headers: JSON_HEADERS, payload: "" });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toEqual({ got: {} });
    }
    await a.close();
  });

  it("still parses a real body, and still refuses bad JSON and prototype poisoning", async () => {
    const a = await app();
    const ok = await a.inject({
      method: "POST",
      url: "/x",
      headers: JSON_HEADERS,
      payload: '{"a":1}',
    });
    expect(ok.json()).toEqual({ got: { a: 1 } });
    const bad = await a.inject({
      method: "POST",
      url: "/x",
      headers: JSON_HEADERS,
      payload: "{nope",
    });
    expect(bad.statusCode).toBe(400);
    const proto = await a.inject({
      method: "POST",
      url: "/x",
      headers: JSON_HEADERS,
      payload: '{"__proto__":{"admin":true}}',
    });
    expect(proto.statusCode).toBe(400);
    await a.close();
  });
});
