import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";
import { Readable } from "node:stream";
import {
  WRITE_BUDGETS,
  bodySize,
  budgetKeys,
  makeWriteBudget,
  registerWriteBudget,
  type Allowances,
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
  it("is the account's and its address's text allowance for an ordinary request", () => {
    expect(budgetKeys("1.2.3.4", "user1", 1800)).toEqual([
      ["ut:user1", WRITE_BUDGETS.text.account],
      ["at:1.2.3.4", WRITE_BUDGETS.text.address],
    ]);
    // A megabyte exactly is still text: it is all an ordinary route accepts.
    expect(budgetKeys("1.2.3.4", "user1", MB)[0][0]).toBe("ut:user1");
  });

  it("is the file allowance, counted apart, for a picture", () => {
    expect(budgetKeys("1.2.3.4", "user1", 6 * MB)).toEqual([
      ["uf:user1", WRITE_BUDGETS.files.account],
      ["af:1.2.3.4", WRITE_BUDGETS.files.address],
    ]);
  });

  it("is the address alone, and far less, when nobody is signed in", () => {
    for (const bytes of [900, 6 * MB])
      expect(budgetKeys("1.2.3.4", null, bytes)).toEqual([["s:1.2.3.4", WRITE_BUDGETS.signedOut]]);
    expect(WRITE_BUDGETS.signedOut).toBeLessThan(WRITE_BUDGETS.text.account);
  });

  it("leaves room for what people really send", () => {
    // Measured on live traffic: 1.8 KB the largest body, 4.3 KB the most one
    // address sent in ten minutes.
    expect(WRITE_BUDGETS.text.account).toBeGreaterThan(1000 * 4300);
    expect(WRITE_BUDGETS.signedOut).toBeGreaterThan(1000 * 4300);
    // A photo goes up as it is, up to 8 MB (about 11 MB once encoded for the
    // request): a club's evening of them, twenty at least, fits.
    expect(WRITE_BUDGETS.files.account).toBeGreaterThanOrEqual(20 * 11 * MB);
    // Everyone on one address shares its allowance, so it is the larger.
    expect(WRITE_BUDGETS.text.address).toBeGreaterThan(WRITE_BUDGETS.text.account);
    expect(WRITE_BUDGETS.files.address).toBeGreaterThan(WRITE_BUDGETS.files.account);
  });

  it("refuses a stranger's first 16 MB request outright, before it is read", () => {
    // The largest body any route takes is 16 MB; nobody signed out has a use
    // for one, and each used to be read in full before the route could refuse.
    expect(WRITE_BUDGETS.signedOut).toBeLessThan(16 * MB);
    const b = makeWriteBudget({ now: () => 0 });
    expect(b.spend(16 * MB, budgetKeys("6.6.6.6", null, 16 * MB))).toBeGreaterThan(0);
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

  // Small allowances, so the test sends kilobytes instead of megabytes. A body
  // over 4,000 bytes stands in for a file.
  const roomy = { account: 1_000_000, address: 1_000_000 };
  async function build(over: Partial<Allowances>) {
    const limits: Allowances = {
      fileOver: 4000,
      text: roomy,
      files: roomy,
      signedOut: 1_000_000,
      ...over,
    };
    app = Fastify({ logger: false });
    registerWriteBudget(
      app,
      (bearer) => (bearer.startsWith("user-") ? bearer : null),
      makeWriteBudget({ now: () => 0 }),
      limits,
    );
    let reached = 0;
    app.post("/store", async () => ({ ok: true, reached: ++reached }));
    app.get("/read", async () => ({ ok: true }));
    await app.ready();
    return (bytes: number, who?: string, ip = "9.9.9.9") =>
      app.inject({
        method: "POST",
        url: "/store",
        remoteAddress: ip,
        headers: who ? { authorization: `Bearer ${who}` } : {},
        payload: { text: "x".repeat(bytes) },
      });
  }

  it("refuses an account once it has sent its allowance, on any address", async () => {
    const post = await build({ text: { account: 5000, address: 1_000_000 } });
    expect((await post(3000, "user-1")).statusCode).toBe(200);
    const over = await post(3000, "user-1", "8.8.8.8"); // another address, same account
    expect(over.statusCode).toBe(429);
    expect(over.json().error).toBe("rate_limited");
    expect(over.json().message).toContain("Try again");
    expect(Number(over.headers["retry-after"])).toBeGreaterThan(0);
    // Someone else on the same address is untouched.
    expect((await post(3000, "user-2")).statusCode).toBe(200);
  });

  it("never reaches the route with a request that is over", async () => {
    const post = await build({ text: { account: 1000, address: 1_000_000 } });
    expect((await post(500, "user-1")).json().reached).toBe(1);
    expect((await post(900, "user-1")).statusCode).toBe(429);
    expect((await post(900, "user-1")).statusCode).toBe(429);
    // The route ran once: the two refused requests never got to it.
    expect((await post(10, "user-3")).json().reached).toBe(2);
  });

  it("counts pictures apart from text, so sharing photos doesn't stop the typing", async () => {
    const post = await build({
      text: { account: 3000, address: 1_000_000 },
      files: { account: 12_000, address: 1_000_000 },
    });
    // Two "pictures" (over 4,000 bytes each) fit the file allowance; a third doesn't.
    expect((await post(5000, "user-1")).statusCode).toBe(200);
    expect((await post(5000, "user-1")).statusCode).toBe(200);
    expect((await post(5000, "user-1")).statusCode).toBe(429);
    // Text still goes through, on its own allowance.
    expect((await post(2000, "user-1")).statusCode).toBe(200);
    expect((await post(2000, "user-1")).statusCode).toBe(429);
  });

  it("holds an address with nobody signed in to the small allowance", async () => {
    const post = await build({ signedOut: 2000 });
    expect((await post(1500)).statusCode).toBe(200);
    expect((await post(1500)).statusCode).toBe(429);
    // A different address starts from nothing, and so does an account here.
    expect((await post(1500, undefined, "7.7.7.7")).statusCode).toBe(200);
    expect((await post(1500, "user-1")).statusCode).toBe(200);
  });

  it("holds everyone on one address to the address's allowance together", async () => {
    const post = await build({ text: { account: 3500, address: 7000 } });
    expect((await post(3000, "user-1")).statusCode).toBe(200);
    expect((await post(3000, "user-2")).statusCode).toBe(200);
    expect((await post(3000, "user-3")).statusCode).toBe(429);
  });

  it("counts a body that came in chunks, with no length stated", async () => {
    await build({ signedOut: 3000 });
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
  });

  it("leaves a request with no body alone", async () => {
    await build({
      text: { account: 1, address: 1 },
      files: { account: 1, address: 1 },
      signedOut: 1,
    });
    for (let i = 0; i < 5; i++)
      expect(
        (await app.inject({ method: "GET", url: "/read", remoteAddress: "5.5.5.5" })).statusCode,
      ).toBe(200);
  });
});
