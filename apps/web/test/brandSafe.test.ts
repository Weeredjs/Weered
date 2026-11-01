import { describe, it, expect } from "vitest";
import { onAccent, safeAccent, safeImage } from "../lib/brandSafe";

describe("owner-supplied colours and pictures (red team 2026-11-01, finding 5)", () => {
  it("keeps a real colour and replaces anything else", () => {
    expect(safeAccent("#7C3AED")).toBe("#7C3AED");
    expect(safeAccent("red;background:url(x)")).toBe("#d4920a");
    expect(safeAccent(undefined, "#000000")).toBe("#000000");
  });

  it('keeps https and site paths, encoded so they can\'t leave a url("...")', () => {
    expect(safeImage("https://upload.wikimedia.org/a.png")).toBe(
      "https://upload.wikimedia.org/a.png",
    );
    expect(safeImage("/brand/eceb.png")).toBe("/brand/eceb.png");
    expect(safeImage('https://x.example/a.png")<img src=x onerror=alert(1)>')).not.toContain('"');
    expect(safeImage('/a.png" onmouseover="alert(1)')).not.toContain('"');
  });

  it("picks text that reads on the accent", () => {
    expect(onAccent("#FFD700")).toBe("#0b0b0f");
    expect(onAccent("#7c3aed")).toBe("#fff");
    expect(onAccent("nope")).toBe("#fff");
  });

  it("drops scripts, data and protocol-relative addresses", () => {
    expect(safeImage("javascript:alert(1)")).toBe("");
    expect(safeImage("data:image/svg+xml,<svg/onload=alert(1)>")).toBe("");
    expect(safeImage("//evil.example/x.png")).toBe("");
    expect(safeImage("http://x.example/a.png")).toBe("");
  });
});
