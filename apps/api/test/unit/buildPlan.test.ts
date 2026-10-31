import { describe, it, expect } from "vitest";
import { cleanDrip, cleanOps, cleanPlan, lobbyForModel } from "../../src/lib/buildPlan";

// The builder (routes/aiBuild.ts) hands the model's answer to a person's
// composer, Design mode or drip. Nothing it says is trusted: these are the
// checks between the model and the page.

describe("cleanPlan — a new lobby's plan", () => {
  it("falls back to real catalog values and the preset's own look", () => {
    const p = cleanPlan(
      {
        name: "  Crew  ",
        template: "NOT_A_GAME",
        look: { preset: "nope", accent: "red", effect: "lasers", font: "comic" },
        rooms: [],
        summary: "x",
      },
      "",
    );
    expect(p.template).toBe("NONE");
    expect(p.name).toBe("Crew");
    expect(p.look.preset).toBe("midnight");
    expect(p.look.accent).toBe("#7c3aed");
    expect(p.look.effect).toBe("stars");
    expect(p.look.font).toBe("default");
    expect(p.look.intensity).toBe(1);
    // An empty room list still opens two rooms.
    expect(p.rooms.map((r) => r.name)).toEqual(["General", "Hangout"]);
  });

  it("keeps a game's template, clamps intensity, and lowercases the accent", () => {
    const p = cleanPlan(
      {
        name: "Drop",
        template: "HELLDIVERS2",
        look: {
          preset: "ironclad",
          accent: "#FACC15",
          effect: "embers",
          font: "stencil",
          intensity: 9,
        },
        rooms: [{ name: "War Room", kind: "voice" }],
      },
      "",
    );
    expect(p.template).toBe("HELLDIVERS2");
    expect(p.look).toMatchObject({ preset: "ironclad", accent: "#facc15", intensity: 1.5 });
  });

  it("dedupes rooms, caps them at 8, and switches on what each room needs", () => {
    const rooms = [
      { name: "War Room", kind: "voice" },
      { name: "war room", kind: "video" },
      { name: "Cams", kind: "video" },
      { name: "Watch", kind: "youtube" },
      ...Array.from({ length: 10 }, (_, i) => ({ name: `Pod ${i}`, kind: "voice" })),
    ];
    const p = cleanPlan({ rooms, inside: { video: false, youtube: false } }, "");
    expect(p.rooms).toHaveLength(8);
    expect(p.rooms.filter((r) => r.name.toLowerCase() === "war room")).toHaveLength(1);
    expect(p.inside.video).toBe(true);
    expect(p.inside.youtube).toBe(true);
  });

  it("keeps only links, channels and dates the person gave", () => {
    const given = "our site is clan.example.com/join and we stream on twitch as divercrew";
    const p = cleanPlan(
      {
        extras: [
          {
            type: "links",
            items: [
              { label: "Join", url: "https://clan.example.com/join" },
              { label: "Made up", url: "https://invented.example.org" },
            ],
          },
          { type: "stream", channel: "divercrew" },
          { type: "stream", channel: "someoneelse" },
          { type: "countdown", label: "Way back", at: "1999-01-01T20:00:00Z" },
          { type: "rules", body: "Be kind\nNo spoilers" },
        ],
      },
      given,
    );
    const links = p.extras.find((e) => e.type === "links") as any;
    expect(links.items).toEqual([{ label: "Join", url: "https://clan.example.com/join" }]);
    expect(p.extras.filter((e) => e.type === "stream")).toEqual([
      { type: "stream", channel: "divercrew" },
    ]);
    expect(p.extras.some((e) => e.type === "countdown")).toBe(false);
    expect(p.extras.find((e) => e.type === "rules")).toMatchObject({
      title: "House rules",
      body: "Be kind\nNo spoilers",
    });
  });

  it("builds a door only when there is something on it, with ids and real choices", () => {
    expect(cleanPlan({ door: {} }, "").door).toBeNull();
    const p = cleanPlan(
      {
        door: {
          rules: ["Be 18+", ""],
          questions: [
            { q: "Who invited you?", kind: "text" },
            { q: "Pick one", kind: "choice", options: ["Only one"] },
          ],
        },
      },
      "",
    );
    expect(p.door).toMatchObject({
      on: true,
      title: "Before you come in",
      button: "Come in",
      rules: ["Be 18+"],
    });
    expect(p.door!.questions.map((q) => [q.id, q.kind])).toEqual([
      ["q1", "text"],
      ["q2", "text"],
    ]);
  });
});

describe("cleanOps — changes to a lobby in Design mode", () => {
  const blocks = new Map([
    ["b1", "welcome"],
    ["b2", "rooms"],
  ]);

  it("drops ops that point at blocks that aren't there", () => {
    const ops = cleanOps(
      {
        ops: [
          { op: "remove", id: "ghost" },
          { op: "move", id: "ghost", at: "start" },
          { op: "update", id: "ghost", props: { title: "x" } },
          { op: "remove", id: "b2" },
        ],
      },
      blocks,
      "",
    );
    expect(ops).toEqual([{ op: "remove", id: "b2" }]);
  });

  it("checks an update's props against the block's real type", () => {
    const [op] = cleanOps(
      {
        ops: [
          {
            op: "update",
            id: "b1",
            type: "rules",
            props: { title: "Hi", body: "Hello", align: "center" },
          },
        ],
      },
      blocks,
      "",
    );
    expect(op).toEqual({
      op: "update",
      id: "b1",
      props: { title: "Hi", body: "Hello", align: "center" },
    });
  });

  it("adds a media block only with a link the person gave", () => {
    const ops = cleanOps(
      {
        ops: [
          {
            op: "add",
            type: "video",
            props: { url: "https://youtube.com/watch?v=abc" },
            at: "end",
          },
          {
            op: "add",
            type: "video",
            props: { url: "https://youtube.com/watch?v=given" },
            at: "b1",
          },
          { op: "add", type: "rules", props: { title: "Rules" } },
          { op: "add", type: "rules", props: { body: "No griefing" }, at: "nowhere" },
        ],
      },
      blocks,
      "put youtube.com/watch?v=given after the welcome",
    );
    expect(ops).toHaveLength(2);
    expect(ops[0]).toMatchObject({ op: "add", type: "video", at: "b1" });
    expect(ops[1]).toMatchObject({
      op: "add",
      type: "rules",
      props: { body: "No griefing" },
      at: "end",
    });
  });

  it("keeps only real look values, and a look op with nothing in it is dropped", () => {
    const ops = cleanOps(
      {
        ops: [
          { op: "look", preset: "inferno", accent: "#FF0000", effect: "lasers", intensity: 0 },
          { op: "look", effect: "lasers" },
          { op: "hero", mode: "huge" },
          { op: "hero", mode: "compact" },
        ],
      },
      blocks,
      "",
    );
    expect(ops).toEqual([
      { op: "look", preset: "inferno", accent: "#ff0000", intensity: 0.2 },
      { op: "hero", mode: "compact" },
    ]);
  });
});

describe("cleanDrip — the person's own look", () => {
  it("switches to Nebula when a Nebula-only change is made under a Classic skin", () => {
    const r = cleanDrip(
      { look: { shape: "cut", fx: "snow" }, summary: "Sharp and snowy." },
      "press",
    );
    expect(r.look).toEqual({ shape: "cut", fx: "snow", theme: "nebula" });
  });

  it("needs a colour for a custom palette, and a real preset for a layout", () => {
    expect(cleanDrip({ look: { palette: "custom" } }, "nebula").look).toEqual({});
    expect(cleanDrip({ look: { accent: "#0EA5E9" } }, "nebula").look).toEqual({
      palette: "custom",
      accent: "#0ea5e9",
    });
    expect(cleanDrip({ look: {}, layout: "made-up" }, "nebula").layout).toBeUndefined();
    expect(cleanDrip({ look: {}, layout: "minimal" }, "nebula").layout).toBe("minimal");
  });
});

describe("lobbyForModel", () => {
  it("trims long text so a big Home stays a small prompt", () => {
    const v = lobbyForModel(
      { name: "L", moduleType: "EVE" },
      { blocks: [{ id: "b1", type: "rules", size: "m", props: { body: "x".repeat(1000) } }] },
    );
    expect(v.game).toBe("EVE");
    expect(v.blocks[0].props.body.length).toBeLessThan(310);
  });
});
