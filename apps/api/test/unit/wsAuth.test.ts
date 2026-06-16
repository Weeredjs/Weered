import { describe, it, expect, beforeEach } from "vitest";
import { handleAuthHello } from "../../src/sockets/connection";

// The WS auth handshake (auth:hello): a socket is anonymous until it presents a
// valid token. Driven via the mock-socket harness.
let sent: any[];
let closed: { code: number; reason: string } | null;
function mkWs(): any {
  return {
    close: (code: number, reason: string) => {
      closed = { code, reason };
    },
  };
}
function mkOpts(over: any = {}) {
  return {
    verifyToken: (t?: string) => (t === "good" ? { id: "u1", name: "U1" } : null),
    hydrateGlobalRole: async (u: any) => ({ ...u, globalRole: "USER", tier: "INNOCENT" }),
    isGloballyBanned: async () => false,
    send: (_ws: any, m: any) => sent.push(m),
    awardNotoriety: async () => null,
    wss: { clients: new Set() },
    ...over,
  } as any;
}

beforeEach(() => {
  sent = [];
  closed = null;
});

describe("ws handleAuthHello - socket authentication", () => {
  it("rejects an invalid token with auth:fail (socket stays anonymous)", async () => {
    const ws = mkWs();
    await handleAuthHello(ws, { type: "auth:hello", token: "bad" }, mkOpts());
    expect(sent.find((m) => m.type === "auth:fail")?.reason).toBe("Invalid token");
    expect(ws.user).toBeUndefined();
  });

  it("authenticates a valid token with auth:ok and binds ws.user", async () => {
    const ws = mkWs();
    await handleAuthHello(ws, { type: "auth:hello", token: "good" }, mkOpts());
    const ok = sent.find((m) => m.type === "auth:ok");
    expect(ok?.user.id).toBe("u1");
    expect(ws.user.id).toBe("u1");
    expect(closed).toBeNull();
  });

  it("refuses + closes a globally-banned account (4003)", async () => {
    const ws = mkWs();
    await handleAuthHello(
      ws,
      { type: "auth:hello", token: "good" },
      mkOpts({ isGloballyBanned: async () => true }),
    );
    expect(sent.find((m) => m.type === "auth:fail")?.reason).toContain("suspended");
    expect(closed?.code).toBe(4003);
  });
});
