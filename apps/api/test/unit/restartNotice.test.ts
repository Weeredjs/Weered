import { describe, it, expect } from "vitest";
import { sayRestarting, RESTART_CODE } from "../../src/lib/restartNotice";

// A deploy's restart closes every socket with 4012, so pages come straight
// back instead of backing off (James 2026-11-03).
describe("sayRestarting", () => {
  it("closes every socket with the restart code, past one that throws", async () => {
    const closed: Array<[number, string]> = [];
    const ok = { close: (code: number, reason: string) => void closed.push([code, reason]) };
    const broken = {
      close: () => {
        throw new Error("already gone");
      },
    };
    const n = await sayRestarting({ clients: [ok, broken, ok] });
    expect(n).toBe(2);
    expect(closed).toEqual([
      [RESTART_CODE, "restarting"],
      [RESTART_CODE, "restarting"],
    ]);
    expect(RESTART_CODE).toBe(4012);
  });

  it("is quick and harmless with no socket server yet", async () => {
    const t = Date.now();
    expect(await sayRestarting(undefined)).toBe(0);
    expect(await sayRestarting({ clients: [] })).toBe(0);
    expect(Date.now() - t).toBeLessThan(100);
  });
});
