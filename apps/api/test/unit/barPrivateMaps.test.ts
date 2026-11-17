import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Private BAR maps are served from <cwd>/uploads/bar-maps/<token>/<file>.sd7,
// where the 32-hex token is the only key. Nothing outside that shape is served.
const TOKEN = "0123456789abcdef0123456789abcdef";
let dir = "";
let cwd = "";
let app: ReturnType<typeof Fastify>;

beforeAll(async () => {
  cwd = process.cwd();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "barmaps-"));
  fs.mkdirSync(path.join(dir, "uploads", "bar-maps", TOKEN), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "uploads", "bar-maps", TOKEN, "four_keeps_siege_v1.sd7"),
    "7z-bytes",
  );
  fs.writeFileSync(path.join(dir, "secret.txt"), "nope");
  process.chdir(dir);
  const { default: barRoutes } = await import("../../src/routes/bar");
  app = Fastify();
  await app.register(barRoutes, { authFromHeader: () => null });
  await app.ready();
});

afterAll(async () => {
  await app?.close();
  process.chdir(cwd);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("GET /bar/private-maps/:token/:file", () => {
  it("serves the map as a download with no caching or indexing", async () => {
    const r = await app.inject({ url: `/bar/private-maps/${TOKEN}/four_keeps_siege_v1.sd7` });
    expect(r.statusCode).toBe(200);
    expect(r.body).toBe("7z-bytes");
    expect(r.headers["content-disposition"]).toContain("attachment");
    expect(r.headers["cache-control"]).toContain("no-store");
    expect(r.headers["x-robots-tag"]).toBe("noindex");
  });

  it("404s a wrong token, a missing file, and anything that isn't a plain .sd7 name", async () => {
    const bad = [
      `/bar/private-maps/${"f".repeat(32)}/four_keeps_siege_v1.sd7`,
      `/bar/private-maps/${TOKEN}/missing.sd7`,
      `/bar/private-maps/${TOKEN}/..%2F..%2F..%2Fsecret.txt`,
      `/bar/private-maps/${TOKEN}/four_keeps_siege_v1.SD7`,
      `/bar/private-maps/short/four_keeps_siege_v1.sd7`,
    ];
    for (const url of bad) expect((await app.inject({ url })).statusCode, url).toBe(404);
  });
});
