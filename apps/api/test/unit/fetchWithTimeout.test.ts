import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "http";
import { fetchWithTimeout } from "../../src/lib/fetchWithTimeout";

// Spin a throwaway HTTP server per test so we exercise real fetch + AbortSignal,
// not a mock. Each server counts hits so we can assert retry COUNT, not just the
// final status.
let server: Server | null = null;
function listen(
  handler: (n: number) => { status: number; headers?: Record<string, string>; body?: string },
) {
  let hits = 0;
  server = createServer((req, res) => {
    hits += 1;
    const r = handler(hits);
    res.writeHead(r.status, r.headers || {});
    res.end(r.body ?? "");
  });
  return new Promise<{ url: string; hits: () => number }>((resolve) => {
    server!.listen(0, "127.0.0.1", () => {
      const addr = server!.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, hits: () => hits });
    });
  });
}

afterEach(() => {
  server?.close();
  server = null;
});

describe("fetchWithTimeout retry/backoff", () => {
  it("retries an idempotent GET through transient 503s and succeeds", async () => {
    const { url, hits } = await listen((n) =>
      n < 3 ? { status: 503 } : { status: 200, body: "ok" },
    );
    const res = await fetchWithTimeout(url, {}, 2000, { baseDelayMs: 1, maxDelayMs: 5 });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(hits()).toBe(3); // 2 failures + 1 success
  });

  it("does NOT retry a non-idempotent POST (no double-submit)", async () => {
    const { url, hits } = await listen(() => ({ status: 503 }));
    const res = await fetchWithTimeout(url, { method: "POST", body: "x" }, 2000, {
      baseDelayMs: 1,
    });
    expect(res.status).toBe(503);
    expect(hits()).toBe(1); // exactly one attempt
  });

  it("gives up after `retries` and returns the last retryable response", async () => {
    const { url, hits } = await listen(() => ({ status: 500 }));
    const res = await fetchWithTimeout(url, {}, 2000, {
      retries: 2,
      baseDelayMs: 1,
      maxDelayMs: 5,
    });
    expect(res.status).toBe(500);
    expect(hits()).toBe(3); // 1 + 2 retries
  });

  it("does not retry a successful 2xx", async () => {
    const { url, hits } = await listen(() => ({ status: 200, body: "first" }));
    const res = await fetchWithTimeout(url, {}, 2000);
    expect(res.status).toBe(200);
    expect(hits()).toBe(1);
  });

  it("aborts a hung upstream via the per-attempt timeout", async () => {
    // server never responds; timeout must reject (retries default 2, all time out)
    server = createServer(() => {});
    const url: string = await new Promise((resolve) => {
      server!.listen(0, "127.0.0.1", () => {
        const a = server!.address();
        resolve(`http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`);
      });
    });
    await expect(fetchWithTimeout(url, {}, 120, { retries: 0 })).rejects.toThrow();
  });
});
