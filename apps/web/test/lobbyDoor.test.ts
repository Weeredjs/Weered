import { describe, expect, it } from "vitest";
import {
  newBlock,
  sanitizeDoor,
  sanitizeLayout,
  stockLayout,
  type LobbyLayout,
} from "../lib/lobbyLayout";
import { applyFeatures, featuresOf, type Features } from "../lib/lobbyFeatures";

describe("the front door, cleaned", () => {
  it("keeps what an owner set and drops what can't be shown", () => {
    const d = sanitizeDoor({
      on: true,
      title: "  Welcome, pilots  ",
      body: "x".repeat(900),
      image: "javascript:alert(1)",
      button: "Board the plane, please, right now",
      rules: ["  Be nice ", "", "Fly safe"],
      questions: [
        { id: "cs", q: "Callsign?", required: true },
        { id: "ac", q: "Aircraft?", kind: "choice", options: ["A330", " ", "737"] },
        { id: "x", q: "Only one?", kind: "choice", options: ["Yes"] },
        { id: "y", q: "  " },
      ],
      age18: "yes",
      minAccountDays: 400,
      lock: true,
    })!;
    expect(d.on).toBe(true);
    expect(d.title).toBe("Welcome, pilots");
    expect(d.body).toHaveLength(600);
    expect(d.image).toBe("");
    expect(d.button).toHaveLength(24);
    expect(d.rules).toEqual(["Be nice", "Fly safe"]);
    expect(d.questions.map((q) => q.id)).toEqual(["cs", "ac"]);
    expect(d.questions[1].options).toEqual(["A330", "737"]);
    expect(d.age18).toBe(false);
    expect(d.minAccountDays).toBe(365);
    expect(d.lock).toBe(true);
  });

  it("takes https pictures only", () => {
    expect(sanitizeDoor({ image: "https://example.com/a.png" })!.image).toBe(
      "https://example.com/a.png",
    );
    expect(sanitizeDoor({ image: "http://example.com/a.png" })!.image).toBe("");
  });

  it("travels with the layout, and the theme's always-on flag too", () => {
    const L = sanitizeLayout({
      tabs: [],
      door: { on: true, rules: ["Hi"] },
      theme: { effect: "snow", fxForced: true },
    })!;
    expect(L.door?.on).toBe(true);
    expect(L.door?.rules).toEqual(["Hi"]);
    expect(L.theme.fxForced).toBe(true);
    expect(
      sanitizeLayout({ tabs: [], theme: { fxForced: "yes" } })!.theme.fxForced,
    ).toBeUndefined();
    expect(sanitizeLayout({ tabs: [] })!.door).toBeUndefined();
  });
});

describe("What's inside, read and written where it lives", () => {
  const all: Features = {
    voice: true,
    video: true,
    screen: true,
    youtube: true,
    twitch: true,
    events: true,
    requests: true,
    home: true,
  };

  it("reads a never-designed lobby as the stock tabs", () => {
    const f = featuresOf(["voice", "youtube", "reddit"], null);
    expect(f).toMatchObject({ voice: true, youtube: true, video: false, twitch: false });
    // Stock: Events shown; Home and Requests hidden.
    expect(f).toMatchObject({ events: true, home: false, requests: false });
  });

  it("switching Events and Requests off hides their tabs and takes their blocks off Home", () => {
    const L: LobbyLayout = {
      ...stockLayout(),
      tabs: stockLayout().tabs.map((t) => ({ ...t, hidden: false })),
      landing: "events",
      blocks: [newBlock("welcome"), newBlock("events"), newBlock("requests")],
    };
    const out = applyFeatures(L, all, { ...all, events: false, requests: false }, false);
    expect(out.tabs.find((t) => t.id === "events")?.hidden).toBe(true);
    expect(out.tabs.find((t) => t.id === "requests")?.hidden).toBe(true);
    expect(out.blocks.map((b) => b.type)).toEqual(["welcome"]);
    expect(out.landing).toBe("rooms");
  });

  it("switching them back on puts a block back, once", () => {
    const L: LobbyLayout = { ...stockLayout(), blocks: [newBlock("welcome")] };
    const off = { ...all, events: false, requests: false };
    const out = applyFeatures(L, off, all, false);
    expect(out.blocks.map((b) => b.type)).toEqual(["welcome", "events", "requests"]);
    // Saved again with nothing changed: nothing added.
    expect(applyFeatures(out, all, all, false).blocks).toHaveLength(3);
  });

  it("leaves a block the owner removed on purpose when another switch changes", () => {
    const L: LobbyLayout = { ...stockLayout(), blocks: [newBlock("welcome")] };
    const out = applyFeatures(L, all, { ...all, twitch: false }, false);
    expect(out.blocks.map((b) => b.type)).toEqual(["welcome"]);
  });

  it("Home on: starter blocks for an empty canvas, and visitors land there; off: they land in the rooms", () => {
    const L = stockLayout();
    const noHome = { ...all, home: false };
    const on = applyFeatures(L, noHome, all, true);
    expect(on.landing).toBe("home");
    expect(on.tabs.find((t) => t.id === "home")?.hidden).toBe(false);
    expect(on.blocks.map((b) => b.type)).toContain("game");
    const off = applyFeatures(on, all, noHome, true);
    expect(off.landing).toBe("rooms");
    expect(off.tabs.find((t) => t.id === "home")?.hidden).toBe(true);
  });
});
