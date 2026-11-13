import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";
import { Readable } from "node:stream";
import {
  WRITE_BUDGETS,
  bodySize,
  budgetKeys,
  makeWriteBudget,
  registerWriteBudget,
} from "../../src/lib/writeBudget";

// How much one account, or one address, may send the API in ten minutes
// (hardening pass 2026-11-13). Before it, a megabyte per request and 600
// requests a minute added up to tens of gigabytes an hour at any route that
// stores what it is given.
const MB = 1024 * 1024;

describe("the ledger", () => {
  it("lets a key spend up to its allowance and no further", () => {
    const b = makeWriteBudget({ now: () => 0 });
    expect(b.spend(6 * MB, [["k", 10 * MB]])).toBe(0);
    expect(b.spend(4 * MB, [["k", 10 * MB]])).toBe(0); // exactly at it
    expect(b.spend(1, [["k", 10 * MB]])).toBeGreaterThan(0);
  });

  it("says how long until the window starts over, then starts over", () => {
    let t = 0;
    const b = makeWriteBudget({ now: () => t, windowMs: 600_000 });
    b.spend(10, [["k", 5]]);
    t = 100_000;
    expect(b.spend(1, [["k", 5]])).toBe(500); // seconds left of the ten minutes
    t = 600_000;
    expect(b.spend(5, [["k", 5]])).toBe(0);
  });

  it("counts each key on its own", () => {
    const b = makeWriteBudget({ now: () => 0 });
    expect(b.spend(9, [["a", 10]])).toBe(0);
    expect(b.spend(9, [["b", 10]])).toBe(0);
    expect(b.spend(9, [["a", 10]])).toBeGreaterThan(0);
  });

  it("charges every key a request belongs to, and refuses on the first one over", () => {
    const b = makeWriteBudget({ now: () => 0 });
    // Two accounts on one address: each within its own, the address over.
    expect(
      b.spend(6, [
        ["u:1", 10],
        ["a:ip", 10],
      ]),
    ).toBe(0);
    expect(
      b.spend(6, [
        ["u:2", 10],
        ["a:ip", 10],
      ]),
    ).toBeGreaterThan(0);
  });

  it("treats a nonsense size as nothing", () => {
    const b = makeWriteBudget({ now: () => 0 });
    for (const bad of [Number.NaN, -5, Number.POSITIVE_INFINITY])
      expect(b.spend(bad, [["k", 1]])).toBe(0);
  });

  it("never holds more rows than its limit, however many keys it is shown", () => {
    const b = makeWriteBudget({ now: () => 0, maxKeys: 100 });
    for (let i = 0; i < 5000; i++) b.spend(1, [[`k${i}`, 10]]);
    expect(b.size).toBe(100);
  });
});

describe("whose allowance a request counts against", () => {
  it("is the account and its address when someone is signed in", () => {
    expect(budgetKeys("1.2.3.4", "user1")).toEqual([
      ["u:user1", WRITE_BUDGETS.account],
      ["a:1.2.3.4", WRITE_BUDGETS.address],
    ]);
  });

  it("is the address alone, and far less, when nobody is", () => {
    expect(budgetKeys("1.2.3.4", null)).toEqual([["s:1.2.3.4", WRITE_BUDGETS.signedOut]]);
    expect(WRITE_BUDGETS.signedOut).toBeLessThan(WRITE_BUDGETS.account);
  });

  it("leaves room for what people really send", () => {
    // Measured on live traffic: 1.8 KB the largest body, 4.3 KB the most one
    // address sent in ten minutes. A picture is up to 8 MB.
    expect(WRITE_BUDGETS.account).toBeGreaterThanOrEqual(6 * 8 * MB);
    expect(WRITE_BUDGETS.address).toBeGreaterThan(WRITE_BUDGETS.account);
    expect(WRITE_BUDGETS.signedOut).toBeGreaterThan(1000 * 4300);
  });
});

describe("the size of a body that stated none", () => {
  it("is its length as text", () => {
    expect(bodySize(null)).toBe(0);
    expect(bodySize(undefined)).toBe(0);
    expect(bodySize("abcd")).toBe(4);
    expect(bodySize(Buffer.from("abcdef"))).toBe(6);
    expect(bodySize({ a: "xyz" })).toBe(JSON.stringify({ a: "xyz" }).length);
  });
});

describe("in front of every route", () => {
  let app: any;
  afterEach(async () => {
    await app?.close();
  });

  // A small allowance, so the test sends kilobytes instead of megabytes.
  async function build(limits: { account: number; address: number; signedOut: number }) {
    app = Fastify({ logger: false });
    const ledger = makeWriteBudget({ now: () => 0 });
    registerWriteBudget(
      app,
      (bearer) => (bearer.startsWith("user-") ? bearer : null),
      ledger,
      limits,
    );
    let reached = 0;
    app.post("/store", async () => ({ ok: true, reached: ++reached }));
    app.get("/read", async () => ({ ok: true }));
    await app.ready();
    return {
      restore: () => {},
      post: (bytes: number, who?: string, ip = "9.9.9.9") =>
        app.inject({
          method: "POST",
          url: "/store",
          remoteAddress: ip,
          headers: who ? { authorization: `Bearer ${who}` } : {},
          payload: { text: "x".repeat(bytes) },
        }),
    };
  }

  it("refuses an account once it has sent its allowance, on any address", async () => {
    const t = await build({ account: 5000, address: 1_000_000, signedOut: 1_000_000 });
    try {
      expect((await t.post(3000, "user-1")).statusCode).toBe(200);
      const over = await t.post(3000, "user-1", "8.8.8.8"); // another address, same account
      expect(over.statusCode).toBe(429);
      expect(over.json().error).toBe("rate_limited");
      expect(Number(over.headers["retry-after"])).toBeGreaterThan(0);
      // Someone else on the same address is untouched.
      expect((await t.post(3000, "user-2")).statusCode).toBe(200);
    } finally {
      t.restore();
    }
  });

  it("never reaches the route with a request that is over", async () => {
    const t = await build({ account: 1000, address: 1_000_000, signedOut: 1_000_000 });
    try {
      const first = await t.post(500, "user-1");
      expect(first.json().reached).toBe(1);
      expect((await t.post(5000, "user-1")).statusCode).toBe(429);
      expect((await t.post(5000, "user-1")).statusCode).toBe(429);
      // The route ran once: the two refused requests never got to it.
      const other = await t.post(10, "user-3");
      expect(other.json().reached).toBe(2);
    } finally {
      t.restore();
    }
  });

  it("holds an address with nobody signed in to the small allowance", async () => {
    const t = await build({ account: 1_000_000, address: 1_000_000, signedOut: 2000 });
    try {
      expect((await t.post(1500)).statusCode).toBe(200);
      expect((await t.post(1500)).statusCode).toBe(429);
      // A different address starts from nothing, and so does an account here.
      expect((await t.post(1500, undefined, "7.7.7.7")).statusCode).toBe(200);
      expect((await t.post(1500, "user-1")).statusCode).toBe(200);
    } finally {
      t.restore();
    }
  });

  it("holds everyone on one address to the address's allowance together", async () => {
    const t = await build({ account: 4000, address: 7000, signedOut: 1_000_000 });
    try {
      expect((await t.post(3000, "user-1")).statusCode).toBe(200);
      expect((await t.post(3000, "user-2")).statusCode).toBe(200);
      expect((await t.post(3000, "user-3")).statusCode).toBe(429);
    } finally {
      t.restore();
    }
  });

  it("counts a body that came in chunks, with no length stated", async () => {
    const t = await build({ account: 1_000_000, address: 1_000_000, signedOut: 3000 });
    try {
      const chunked = () =>
        app.inject({
          method: "POST",
          url: "/store",
          remoteAddress: "6.6.6.6",
          headers: { "content-type": "application/json" },
          payload: Readable.from([Buffer.from(JSON.stringify({ text: "y".repeat(2000) }))]),
        });
      expect((await chunked()).statusCode).toBe(200);
      expect((await chunked()).statusCode).toBe(429);
    } finally {
      t.restore();
    }
  });

  it("leaves a request with no body alone", async () => {
    const t = await build({ account: 1, address: 1, signedOut: 1 });
    try {
      for (let i = 0; i < 5; i++)
        expect(
          (await app.inject({ method: "GET", url: "/read", remoteAddress: "5.5.5.5" })).statusCode,
        ).toBe(200);
    } finally {
      t.restore();
    }
  });
});
