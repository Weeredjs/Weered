import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OPERATOR_FACE, OPERATOR_PRESENCE } from "../../src/lib/roomState";

// The Operator's robot is gold line art on a transparent ground; avatarColor is
// the disc behind it. A gold disc hid the robot entirely (James 2026-11-02).
describe("The Operator's face", () => {
  it("sits on a disc that isn't the robot's own colour", () => {
    const svg = readFileSync(
      join(__dirname, "../../../web/public/brand/roles/operator.svg"),
      "utf8",
    ).toLowerCase();
    const inks = new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/g)].map((m) => m[1]));
    expect(inks.size).toBeGreaterThan(0);
    expect(inks.has(OPERATOR_FACE.avatarColor.toLowerCase())).toBe(false);
  });

  it("is the face presence shows", () => {
    expect(OPERATOR_PRESENCE).toMatchObject(OPERATOR_FACE);
  });
});
