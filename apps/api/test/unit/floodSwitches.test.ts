import { afterEach, describe, expect, it } from "vitest";
import { passesShutDoor, _setFloodStateForTest } from "../../src/lib/flood";
import { registrationBlock } from "../../src/lib/registration";
import { levelOf, makeWatch, type Pressure } from "../../src/lib/pressure";
import {
  admitSocket,
  socketAddress,
  SOCKETS_PER_ADDRESS,
  _openSockets,
} from "../../src/lib/socketGate";
import { handleAuthHello } from "../../src/sockets/connection";

// James 2026-11-02: "We have 5 minutes before it crashes. What is the plan".
// The flood switches, the pressure watch that can throw the first one by
// itself, and the limits on sockets.

afterEach(() => _setFloodStateForTest({ flood: "off", door: "open" }));

describe("flood mode", () => {
  it("sends newcomers to the waitlist", async () => {
    const read = (flood: string) => async (k: string) =>
      // No cap here, so nothing counts accounts (no database in a unit test).
      k === "floodMode" ? flood : k === "registrationCap" ? "0" : null;
    expect(await registrationBlock(read("on"))).toBe("registration_full");
    expect(await registrationBlock(read("auto"))).toBe("registration_full");
    expect(await registrationBlock(read("off"))).toBeNull();
  });
});

describe("lights off", () => {
  it("keeps health, the door's status, the waitlist, sign-in, Ops and Stripe reachable", () => {
    for (const p of [
      "/health",
      "/site/status",
      "/waitlist",
      "/subscribe/webhook",
      "/auth/login",
      "/staff/config",
      "/staff/today?x=1",
    ])
      expect(passesShutDoor(p)).toBe(true);
    for (const p of ["/lobbies", "/profile/me", "/rooms", "/live/rooms"])
      expect(passesShutDoor(p)).toBe(false);
  });

  it("tells a member why and lets them go with a close the web won't retry; staff stay", async () => {
    _setFloodStateForTest({ door: "capacity" });
    const run = async (globalRole: string) => {
      const sent: any[] = [];
      const ws: any = { closeCode: 0, close: (c: number) => (ws.closeCode = c) };
      await handleAuthHello(
        ws,
        { type: "auth:hello", token: "t" },
        {
          verifyToken: () => ({ id: "u1", name: "u1" }),
          hydrateGlobalRole: async (u: any) => ({ ...u, globalRole }),
          isGloballyBanned: async () => false,
          send: (_w: any, m: any) => sent.push(m),
          awardNotoriety: async () => null,
          wss: { clients: new Set() },
        },
      );
      return { sent, ws };
    };
    const member = await run("USER");
    expect(member.sent[0]).toMatchObject({ type: "site:closed", door: "capacity" });
    expect(member.ws.closeCode).toBe(4010);
    const staff = await run("ADMIN");
    expect(staff.sent.find((m) => m.type === "auth:ok")).toBeTruthy();
    expect(staff.ws.closeCode).toBe(0);
  });
});

describe("the pressure watch", () => {
  const reading = (level: Pressure["level"], sockets = 500): Pressure => ({
    at: 0,
    loopMs: 0,
    loadPerCore: 0,
    memLeftPct: 50,
    sockets,
    level,
  });

  it("reads hot, busy and calm", () => {
    expect(levelOf({ loopMs: 300, loadPerCore: 0.2, memLeftPct: 60, sockets: 1 })).toBe("hot");
    expect(levelOf({ loopMs: 20, loadPerCore: 1.7, memLeftPct: 60, sockets: 1 })).toBe("hot");
    expect(levelOf({ loopMs: 20, loadPerCore: 0.2, memLeftPct: 5, sockets: 1 })).toBe("hot");
    expect(levelOf({ loopMs: 150, loadPerCore: 0.2, memLeftPct: 60, sockets: 1 })).toBe("busy");
    expect(levelOf({ loopMs: 20, loadPerCore: 0.2, memLeftPct: 60, sockets: 1 })).toBe("calm");
  });

  it("throws flood mode on after 30 hot seconds, and off after 15 calm minutes", async () => {
    let mode: "off" | "on" | "auto" = "off";
    const alerts: string[] = [];
    const watch = makeWatch({
      flood: () => mode,
      setFlood: async (m) => (mode = m),
      alert: async (s) => void alerts.push(s),
    });
    await watch(reading("hot"));
    await watch(reading("hot"));
    expect(mode).toBe("off");
    await watch(reading("hot"));
    expect(mode).toBe("auto");
    for (let i = 0; i < 89; i++) await watch(reading("calm"));
    expect(mode).toBe("auto");
    await watch(reading("calm"));
    expect(mode).toBe("off");
    expect(alerts).toHaveLength(2);
  });

  it("a hot box with no crowd (a build on the shared server) never throws it", async () => {
    // 2026-11-02: Fathom's build took the memory with 5 people on Weered.
    let mode: "off" | "on" | "auto" = "off";
    const watch = makeWatch({
      flood: () => mode,
      setFlood: async (m) => (mode = m),
      alert: async () => {},
    });
    for (let i = 0; i < 10; i++) await watch(reading("hot", 5));
    expect(mode).toBe("off");
  });

  it("never switches off a flood someone threw by hand", async () => {
    let mode: "off" | "on" | "auto" = "on";
    const watch = makeWatch({
      flood: () => mode,
      setFlood: async (m) => (mode = m),
      alert: async () => {},
    });
    for (let i = 0; i < 120; i++) await watch(reading("calm"));
    expect(mode).toBe("on");
  });
});

describe("sockets per address", () => {
  const req = (fwd?: string, remote = "127.0.0.1") =>
    ({ headers: fwd ? { "x-forwarded-for": fwd } : {}, socket: { remoteAddress: remote } }) as any;
  const fakeWs = () => {
    const ws: any = { code: 0, onClose: [] as any[] };
    ws.close = (c: number) => (ws.code = c);
    ws.on = (ev: string, fn: any) => ev === "close" && ws.onClose.push(fn);
    return ws;
  };

  it("reads the address Caddy saw, and doesn't count local tools", () => {
    expect(socketAddress(req("6.6.6.6, 1.2.3.4"))).toBe("1.2.3.4");
    expect(socketAddress(req())).toBeNull();
  });

  it(`lets ${SOCKETS_PER_ADDRESS} in from one address, then closes with 4029, and frees a slot on close`, () => {
    _openSockets.clear();
    const socks = Array.from({ length: SOCKETS_PER_ADDRESS }, () => fakeWs());
    for (const s of socks) expect(admitSocket(s, req("9.9.9.9"))).toBe(true);
    const extra = fakeWs();
    expect(admitSocket(extra, req("9.9.9.9"))).toBe(false);
    expect(extra.code).toBe(4029);
    socks[0].onClose[0]();
    expect(admitSocket(fakeWs(), req("9.9.9.9"))).toBe(true);
    expect(admitSocket(fakeWs(), req("8.8.8.8"))).toBe(true);
  });
});
