import { describe, expect, it } from "vitest";
import {
  assignNames,
  buildClientScript,
  scriptFor,
  splitAddress,
  type BarConfig,
} from "../lib/bar/startScript";

const base: BarConfig = {
  map: "Supreme Isthmus v2.1",
  mode: "team",
  teams: 2,
  difficulty: "normal",
  hostUserId: "u1",
  hostAddress: "203.0.113.7:8452",
  password: "pw",
};
const players = [
  { userId: "u1", name: "James Stirling" },
  { userId: "u2", name: "Timbo!" },
  { userId: "u3", name: "timbo" },
];
const observers = [{ userId: "u4", name: "Watcher" }];

function host(cfg: Partial<BarConfig>) {
  const r = scriptFor({
    game: "Beyond All Reason test-1",
    cfg: { ...base, ...cfg },
    players,
    observers,
    myUserId: "u1",
  });
  if ("error" in r) throw new Error(r.error);
  return r.script;
}

const allyTeams = (s: string) =>
  (s.match(/AllyTeam=(\d+)/g) || []).map((m) => Number(m.split("=")[1]));
const allyBlocks = (s: string) => (s.match(/\[ALLYTEAM\d+\]/g) || []).length;

describe("BAR start scripts", () => {
  it("gives every roster entry a unique engine-safe name", () => {
    const names = [...assignNames(players).values()];
    expect(names).toEqual(["James_Stirling", "Timbo", "timbo_2"]);
    for (const n of names) expect(n).toMatch(/^[A-Za-z0-9_[\]-]{1,20}$/);
  });

  it("numbers ally teams without gaps in every mode", () => {
    for (const mode of ["team", "ffa", "coop-raptors", "coop-scavengers", "vs-ai"] as const) {
      const s = host({ mode });
      const used = [...new Set(allyTeams(s))].sort((a, b) => a - b);
      expect(used).toEqual(used.map((_, i) => i));
      expect(allyBlocks(s)).toBe(used.length);
    }
  });

  it("puts the whole crew on one side against the Raptors, with difficulty set", () => {
    const s = host({ mode: "coop-raptors", difficulty: "hard" });
    expect(s).toContain("ShortName=RaptorsAI;");
    expect(s).toContain("raptor_difficulty=hard;");
    expect(allyTeams(s)).toEqual([0, 0, 0, 1]);
  });

  it("marks observers as spectators and keeps the host's name in sync", () => {
    const s = host({});
    expect(s).toMatch(/Name=Watcher;\s+Password=pw;\s+Spectator=1;/);
    expect(s).toContain("MyPlayerName=James_Stirling;");
    expect(s).toContain("IsHost=1;");
  });

  it("gives joiners a minimal client script with the name the host expects", () => {
    const r = scriptFor({ game: "g", cfg: base, players, observers, myUserId: "u3" });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.role).toBe("client");
    expect(r.script).toBe(buildClientScript(base, "timbo_2"));
    expect(r.script).toContain("HostIP=203.0.113.7;");
  });

  it("refuses someone who is not in the launch", () => {
    const r = scriptFor({ game: "g", cfg: base, players, observers, myUserId: "stranger" });
    expect("error" in r).toBe(true);
  });

  it("defaults the port when the address has none", () => {
    expect(splitAddress("10.0.0.5")).toEqual({ host: "10.0.0.5", port: 8452 });
    expect(splitAddress("host.example:9000")).toEqual({ host: "host.example", port: 9000 });
  });
});
