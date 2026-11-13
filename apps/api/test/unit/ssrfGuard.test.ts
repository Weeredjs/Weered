import { describe, it, expect, vi, afterEach } from "vitest";
import {
  assertSafeUrl,
  fetchSafe,
  fetchSafeTransport,
  pinnedLookup,
} from "../../src/lib/ssrfGuard";

// Security-critical: assertSafeUrl gates every client-influenced outbound fetch.
// These cases need no network (literal IPs / bad schemes are decided before DNS).
describe("assertSafeUrl (SSRF guard)", () => {
  it("rejects non-http(s) schemes", async () => {
    await expect(assertSafeUrl("ftp://example.com")).rejects.toThrow("bad_protocol");
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow("bad_protocol");
    await expect(assertSafeUrl("gopher://x")).rejects.toThrow("bad_protocol");
  });

  it("rejects malformed URLs", async () => {
    await expect(assertSafeUrl("not a url")).rejects.toThrow("invalid_url");
    await expect(assertSafeUrl("")).rejects.toThrow("invalid_url");
  });

  it("rejects the cloud-metadata endpoint", async () => {
    await expect(assertSafeUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
      "private_host",
    );
  });

  it("rejects loopback / private / CGNAT IPv4", async () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.0.1",
      "172.16.0.1",
      "172.31.255.255",
      "100.64.0.1",
      "0.0.0.0",
    ]) {
      await expect(assertSafeUrl(`http://${ip}/`), ip).rejects.toThrow("private_host");
    }
  });

  it("rejects private IPv6 (loopback / ULA / link-local)", async () => {
    for (const ip of ["[::1]", "[fc00::1]", "[fd12::3456]", "[fe80::1]"]) {
      await expect(assertSafeUrl(`http://${ip}/`), ip).rejects.toThrow("private_host");
    }
  });

  it("allows public literal IPs (no DNS needed)", async () => {
    await expect(assertSafeUrl("http://1.1.1.1/")).resolves.toBeInstanceOf(URL);
    await expect(assertSafeUrl("https://8.8.8.8/path?q=1")).resolves.toBeInstanceOf(URL);
    await expect(assertSafeUrl("http://172.32.0.1/")).resolves.toBeInstanceOf(URL); // just outside 172.16-31
  });
});

// fetchSafe follows redirects by hand so each hop is re-checked. Literal public
// IPs keep these off the network; fetch itself is stubbed.
describe("fetchSafe (redirects re-checked hop by hop)", () => {
  afterEach(() => fetchSafeTransport.reset());

  function redirectingFetch(to: string) {
    const calls: { url: string; auth: string | null }[] = [];
    fetchSafeTransport.set(
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url: String(url), auth: new Headers(init?.headers).get("authorization") });
        if (calls.length === 1)
          return new Response(null, { status: 302, headers: { location: to } });
        return new Response("{}", { status: 200 });
      }),
    );
    return calls;
  }

  it("refuses a public URL that redirects into loopback or metadata", async () => {
    for (const to of ["http://127.0.0.1:2019/config/", "http://169.254.169.254/metadata/v1.json"]) {
      redirectingFetch(to);
      await expect(fetchSafe("http://203.0.113.10/status"), to).rejects.toThrow("private_host");
    }
  });

  it("does not carry credentials to a different host", async () => {
    const calls = redirectingFetch("http://198.51.100.20/elsewhere");
    await fetchSafe("http://203.0.113.10/status", { headers: { Authorization: "Bearer k" } });
    expect(calls[0].auth).toBe("Bearer k");
    expect(calls[1].url).toBe("http://198.51.100.20/elsewhere");
    expect(calls[1].auth).toBeNull();
  });

  it("keeps credentials on a same-origin redirect", async () => {
    const calls = redirectingFetch("/moved");
    await fetchSafe("http://203.0.113.10/status", { headers: { Authorization: "Bearer k" } });
    expect(calls[1].url).toBe("http://203.0.113.10/moved");
    expect(calls[1].auth).toBe("Bearer k");
  });
});

// The connection itself is made to an address that was checked: a name that
// answers a public address to the first lookup and an inward one to the next
// (DNS rebinding) never reaches the inward one (fan-out audit, 2026-11-13).
describe("pinnedLookup", () => {
  const ask = (host: string, all = false) =>
    new Promise<{ err: any; address: any }>((resolve) =>
      pinnedLookup(host, { all }, (err, address) => resolve({ err, address })),
    );

  it("refuses names and literals that are inside", async () => {
    for (const h of ["localhost", "127.0.0.1", "169.254.169.254", "[::1]", "10.0.0.5"]) {
      const r = await ask(h);
      expect(r.err?.message, h).toBe("private_host");
    }
  });

  it("passes a public literal through as itself", async () => {
    expect((await ask("203.0.113.10")).address).toBe("203.0.113.10");
    expect((await ask("203.0.113.10", true)).address).toEqual([
      { address: "203.0.113.10", family: 4 },
    ]);
  });
});
