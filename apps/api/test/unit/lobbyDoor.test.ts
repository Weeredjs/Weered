import { describe, expect, it } from "vitest";
import { passDoor, readDoor } from "../../src/lib/lobbyDoor";

const NOW = new Date("2026-10-30T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const layout = (door: unknown) => ({ v: 1, tabs: [], door });

describe("the front door's requirements", () => {
  it("is nothing unless switched on", () => {
    expect(readDoor(null)).toBeNull();
    expect(readDoor({})).toBeNull();
    expect(readDoor(layout({ on: false, rules: ["Be nice"] }))).toBeNull();
    expect(readDoor(layout("yes"))).toBeNull();
  });

  it("keeps rules and questions trimmed and capped", () => {
    const d = readDoor(
      layout({
        on: true,
        rules: ["  Be nice  ", "", 7, "x".repeat(400), ...Array(20).fill("more")],
        questions: [
          { id: "ign", q: "In-game name?", required: true },
          { id: "plat", q: "Platform?", kind: "choice", options: ["PC", "PS5", ""] },
          { id: "one", q: "Only one choice?", kind: "choice", options: ["Yes"] },
          { id: "", q: "No id" },
          { id: "blank", q: "   " },
        ],
        age18: true,
        minAccountDays: "7",
      }),
    )!;
    expect(d.rules[0]).toBe("Be nice");
    expect(d.rules[1]).toHaveLength(200);
    expect(d.rules).toHaveLength(12);
    // A choice needs two options; a question needs an id and words.
    expect(d.questions.map((q) => q.id)).toEqual(["ign", "plat"]);
    expect(d.questions[1].options).toEqual(["PC", "PS5"]);
    expect(d.questions[1].required).toBe(false);
    expect(d.age18).toBe(true);
    expect(d.minAccountDays).toBe(7);
  });

  it("clamps the account age", () => {
    expect(readDoor(layout({ on: true, minAccountDays: -3 }))!.minAccountDays).toBe(0);
    expect(readDoor(layout({ on: true, minAccountDays: 9999 }))!.minAccountDays).toBe(365);
    expect(readDoor(layout({ on: true, minAccountDays: "soon" }))!.minAccountDays).toBe(0);
  });
});

describe("getting through the door", () => {
  const door = readDoor(
    layout({
      on: true,
      rules: ["Be nice"],
      questions: [
        { id: "ign", q: "In-game name?", required: true },
        { id: "plat", q: "Platform?", kind: "choice", options: ["PC", "PS5"], required: true },
        { id: "why", q: "Why join?" },
      ],
      age18: true,
      minAccountDays: 3,
    }),
  )!;
  const good = {
    acceptRules: true,
    age18: true,
    answers: { ign: "  Guardian7 ", plat: "PC", why: "" },
  };

  it("lets in someone who did everything, keeping questions with answers", () => {
    const r = passDoor(door, good, daysAgo(10), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry).toEqual({
      at: NOW.toISOString(),
      rulesAccepted: true,
      age18: true,
      answers: [
        { q: "In-game name?", a: "Guardian7" },
        { q: "Platform?", a: "PC" },
      ],
    });
  });

  it("turns away a new account, the under-18 box, the rules and a missing answer", () => {
    expect(passDoor(door, good, daysAgo(1), NOW)).toMatchObject({
      ok: false,
      error: "account_too_new",
    });
    expect(passDoor(door, good, null, NOW)).toMatchObject({ ok: false, error: "account_too_new" });
    expect(passDoor(door, { ...good, age18: false }, daysAgo(10), NOW)).toMatchObject({
      ok: false,
      error: "age_required",
    });
    expect(passDoor(door, { ...good, acceptRules: "yes" }, daysAgo(10), NOW)).toMatchObject({
      ok: false,
      error: "rules_required",
    });
    expect(
      passDoor(door, { ...good, answers: { ign: "   ", plat: "PC" } }, daysAgo(10), NOW),
    ).toMatchObject({ ok: false, error: "answers_required" });
  });

  it("refuses a choice that wasn't offered", () => {
    expect(
      passDoor(door, { ...good, answers: { ign: "A", plat: "Xbox" } }, daysAgo(10), NOW),
    ).toMatchObject({ ok: false, error: "answers_required" });
  });

  it("cleans answers: control characters out, 500 characters at most, inherited keys ignored", () => {
    const open = readDoor(layout({ on: true, questions: [{ id: "toString", q: "Anything?" }] }))!;
    const r = passDoor(open, { answers: {} }, null, NOW);
    expect(r).toMatchObject({ ok: true, entry: { answers: [] } });
    const d2 = readDoor(layout({ on: true, questions: [{ id: "a", q: "Say hi" }] }))!;
    const r2 = passDoor(d2, { answers: { a: "hi\u0000there\n" + "x".repeat(900) } }, null, NOW);
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.entry.answers[0].a.startsWith("hi there")).toBe(true);
      expect(r2.entry.answers[0].a.length).toBe(500);
    }
  });

  it("asks nothing of a door with no rules, questions or gates", () => {
    const bare = readDoor(layout({ on: true, title: "Hi" }))!;
    expect(passDoor(bare, {}, null, NOW)).toEqual({
      ok: true,
      entry: { at: NOW.toISOString(), answers: [] },
    });
  });
});
