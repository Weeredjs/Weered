import { describe, it, expect } from "vitest";
import { assertSafeUrl } from "../../src/lib/ssrfGuard";

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
