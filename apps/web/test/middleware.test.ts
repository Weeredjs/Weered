import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";

// A lobby's own domain serves that lobby and its rooms; sign-in and the rest of
// Weered are on weered.ca (red team 2026-11-01, finding 4). The API's
// /domains/resolve is stubbed: club.example.com is lobby "club", joe.weered.ca
// is the place "u-joe".
beforeAll(() => {
  vi.stubGlobal("fetch", async (url: string) => {
    const host = new URL(url).searchParams.get("host");
    const lobbyId =
      host === "club.example.com" ? "club" : host === "joe.weered.ca" ? "u-joe" : null;
    return new Response(JSON.stringify(lobbyId ? { ok: true, lobbyId } : { ok: false }), {
      status: lobbyId ? 200 : 404,
    });
  });
});

async function visit(url: string) {
  const { middleware } = await import("../middleware");
  const u = new URL(url);
  const res = await middleware(new NextRequest(url, { headers: { host: u.host } }));
  return {
    status: res.status,
    to: res.headers.get("location"),
    next: res.headers.get("x-middleware-next") === "1",
  };
}

describe("hosts in the web middleware", () => {
  it("leaves Weered's own hosts alone", async () => {
    expect((await visit("https://weered.ca/home")).next).toBe(true);
    expect((await visit("https://weered.ca/login?next=/lobby/club")).next).toBe(true);
  });

  it("opens a lobby's own domain on its lobby, and serves that lobby and rooms", async () => {
    expect(await visit("https://club.example.com/")).toMatchObject({
      status: 307,
      to: "https://club.example.com/lobby/club",
    });
    expect((await visit("https://club.example.com/lobby/club")).next).toBe(true);
    expect((await visit("https://club.example.com/room/abc123")).next).toBe(true);
  });

  it("sends sign-in and everything else there to weered.ca", async () => {
    expect((await visit("https://club.example.com/login?next=/lobby/club")).to).toBe(
      "https://weered.ca/login?next=/lobby/club",
    );
    expect((await visit("https://club.example.com/lobby/someone-else")).to).toBe(
      "https://weered.ca/lobby/someone-else",
    );
    expect((await visit("https://club.example.com/dm")).to).toBe("https://weered.ca/dm");
  });

  it("sends a name that isn't live to weered.ca", async () => {
    expect((await visit("https://pending.example.org/")).to).toBe("https://weered.ca/");
  });

  it("keeps a place's subdomain as Weered's own beyond its root", async () => {
    expect((await visit("https://joe.weered.ca/")).to).toBe("https://joe.weered.ca/lobby/u-joe");
    expect((await visit("https://joe.weered.ca/home")).next).toBe(true);
  });
});
