import { describe, it, expect } from "vitest";
import {
  clampVolume,
  isTypingTarget,
  keyLabel,
  readPtt,
  usableCode,
  DEFAULT_PTT,
} from "../lib/voicePrefs";

describe("voice basics on this device", () => {
  it("keeps a volume between silent and full, in whole percent", () => {
    expect(clampVolume(0.456)).toBe(0.46);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(3)).toBe(1);
    expect(clampVolume("nope")).toBe(1);
  });

  it("names keys and mouse buttons the way people do", () => {
    expect(keyLabel({ code: "Backquote", key: "`" })).toBe("`");
    expect(keyLabel({ code: "KeyV", key: "v" })).toBe("V");
    expect(keyLabel({ code: "Digit4", key: "4" })).toBe("4");
    expect(keyLabel({ code: "Space", key: " " })).toBe("Space");
    expect(keyLabel({ code: "Mouse4" })).toBe("Mouse 4");
    expect(keyLabel({ code: "ControlLeft", key: "Control" })).toBe("ControlLeft");
  });

  it("won't take keys that would fight typing or closing", () => {
    expect(usableCode("Escape")).toBe(false);
    expect(usableCode("Tab")).toBe(false);
    expect(usableCode("Enter")).toBe(false);
    expect(usableCode("KeyV")).toBe(true);
    expect(usableCode("Mouse5")).toBe(true);
  });

  it("never treats typing in a field as a push", () => {
    expect(isTypingTarget({ tagName: "INPUT" } as any)).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true } as any)).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON" } as any)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("starts with push to talk off", () => {
    expect(readPtt()).toEqual(DEFAULT_PTT);
  });
});
