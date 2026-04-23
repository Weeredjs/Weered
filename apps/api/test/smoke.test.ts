import { describe, it, expect, beforeAll } from "vitest";

// Smoke tests for the live API. Run against prod by default; override
// with API_BASE=http://127.0.0.1:4000 for a local check.
//
// These exist to catch obvious regressions across parallel-instance
// commits. Each test is self-contained, makes one or two HTTP calls,
// and asserts only the shape that downstream callers actually rely on.
//
// Usage (from apps/api):
//   pnpm vitest run                                   # against prod
//   API_BASE=http://127.0.0.1:4000 pnpm vitest run    # against local

const API_BASE = process.env.API_BASE || "https://api.weered.ca";

async function getJSON(path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(`${API_BASE}${path}`, init);
  let body: any = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

describe("smoke: core surface", () => {
  beforeAll(() => {
    console.log(`[smoke] API_BASE = ${API_BASE}`);
  });

  it("/health returns ok with db ok", async () => {
    const { status, body } = await getJSON("/health");
    expect(status).toBe(200);
    expect(body?.ok).toBe(true);
    expect(body?.db).toBe("ok");
  });

  it("/lobbies returns a non-empty array of lobbies with expected shape", async () => {
    const { status, body } = await getJSON("/lobbies");
    expect(status).toBe(200);
    expect(body?.ok).toBe(true);
    expect(Array.isArray(body?.lobbies)).toBe(true);
    expect(body.lobbies.length).toBeGreaterThan(0);
    const sample = body.lobbies[0];
    for (const k of ["id", "name", "moduleType"]) {
      expect(sample).toHaveProperty(k);
    }
  });

  it("/featured returns either ok+lobby or ok with no lobby (don't 500)", async () => {
    const { status, body } = await getJSON("/featured");
    expect(status).toBe(200);
    expect(body?.ok).toBe(true);
  });
});

describe("smoke: extracted route modules answer", () => {
  it("/mlb/scoreboard returns ok shape", async () => {
    const { status, body } = await getJSON("/mlb/scoreboard");
    expect(status).toBe(200);
    expect(body?.ok).toBe(true);
    expect(Array.isArray(body?.games)).toBe(true);
  });

  it("/pga/news returns ok+articles array", async () => {
    const { status, body } = await getJSON("/pga/news?limit=3");
    expect(status).toBe(200);
    expect(body?.ok).toBe(true);
    expect(Array.isArray(body?.articles)).toBe(true);
  });

  it("/league/champions returns ok+champions array (cached, fast)", async () => {
    const { status, body } = await getJSON("/league/champions");
    expect(status).toBe(200);
    expect(body?.ok).toBe(true);
    expect(Array.isArray(body?.champions)).toBe(true);
    expect(body.champions.length).toBeGreaterThan(50);
  });

  it("/bungie/manifest/status returns loaded:true (manifest synced at boot)", async () => {
    const { status, body } = await getJSON("/bungie/manifest/status");
    expect(status).toBe(200);
    expect(body?.ok).toBe(true);
    expect(body?.loaded).toBe(true);
  });

  it("/windrose/launch returns ok+milestones (curated static)", async () => {
    const { status, body } = await getJSON("/windrose/launch");
    expect(status).toBe(200);
    expect(body?.ok).toBe(true);
    expect(Array.isArray(body?.milestones)).toBe(true);
    expect(body.milestones.length).toBeGreaterThan(0);
  });

  it("/desktop/latest returns release info (Tauri installer pipeline)", async () => {
    const { status, body } = await getJSON("/desktop/latest");
    expect(status).toBe(200);
    expect(body?.ok).toBe(true);
    expect(body?.release).toBeTruthy();
    expect(body.release).toHaveProperty("version");
    expect(body.release.downloads).toHaveProperty("windows-x86_64");
  });
});

describe("smoke: auth gating works", () => {
  // Body shape on 401 isn't standardized across endpoints (some return
  // {ok:false,error}, others {error}, others bare strings) — only
  // status code matters for the regression check.
  it("/dm/conversations rejects unauthenticated callers with 401", async () => {
    const { status } = await getJSON("/dm/conversations");
    expect(status).toBe(401);
  });

  it("/notifications rejects unauthenticated callers with 401", async () => {
    const { status } = await getJSON("/notifications");
    expect(status).toBe(401);
  });

  it("/profile/me/presence rejects bogus bearer token with 401", async () => {
    const { status } = await getJSON("/profile/me/presence", {
      headers: { Authorization: "Bearer not-a-real-token" },
    });
    expect(status).toBe(401);
  });
});
