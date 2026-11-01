import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";

// A lobby's own domain serves that lobby and its rooms; sign-in and the rest of
// Weered are on weered.ca (red team 2026-11-01, finding 4). The API's
// /domains/resolve is stubbed: club.example.com is lobby "club", joe.weered.ca
// is the place "u-joe", and a flaky.* host gets the API failing.
beforeAll(() => {
  vi.stubGlobal("fetch", async (url: string) => {
    const host = new URL(url).searchParams.get("host");
    if (host?.startsWith("flaky.")) return new Response("{}", { status: 502 });
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

  it("sends sign-in to weered.ca wearing the lobby's brand, and everything else there", async () => {
    expect((await visit("https://club.example.com/login?next=/lobby/club")).to).toBe(
      "https://weered.ca/login?next=%2Flobby%2Fclub&lobby=club",
    );
    expect((await visit("https://club.example.com/login")).to).toBe(
      "https://weered.ca/login?lobby=club&next=%2Flobby%2Fclub",
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

  it("sends a <label>.weered.ca that is nobody's place to weered.ca, on any path", async () => {
    expect((await visit("https://nobody.weered.ca/")).to).toBe("https://weered.ca/");
    expect((await visit("https://nobody.weered.ca/home")).to).toBe("https://weered.ca/home");
    expect((await visit("https://nobody.weered.ca/login?next=/dm")).to).toBe(
      "https://weered.ca/login?next=/dm",
    );
  });

  it("lets a place fall through while the API can't answer, but never a club's domain", async () => {
    expect((await visit("https://flaky.weered.ca/home")).next).toBe(true);
    expect((await visit("https://flaky.example.com/")).to).toBe("https://weered.ca/");
  });

  it("gives a place's sign-in its brand, on its own subdomain", async () => {
    expect((await visit("https://joe.weered.ca/login")).to).toBe(
      "https://joe.weered.ca/login?lobby=u-joe&next=%2Flobby%2Fu-joe",
    );
    expect((await visit("https://joe.weered.ca/login?lobby=u-joe")).next).toBe(true);
  });
});
