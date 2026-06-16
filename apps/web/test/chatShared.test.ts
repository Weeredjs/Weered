import { describe, it, expect } from "vitest";
import {
  detectMentionAtCaret,
  nameStyleFor,
  URL_RE,
  IMG_EXT,
  TENOR_RE,
} from "../components/chat/chatShared";

describe("chatShared", () => {
  it("detectMentionAtCaret finds a mention being typed", () => {
    expect(detectMentionAtCaret("hi @al", 6)).toEqual({ query: "al", start: 3 });
    expect(detectMentionAtCaret("@bob", 4)).toEqual({ query: "bob", start: 0 });
    expect(detectMentionAtCaret("hi@al", 5)).toBeNull();
    expect(detectMentionAtCaret("hello", 5)).toBeNull();
    expect(detectMentionAtCaret("@al bob", 7)).toBeNull();
  });
  it("nameStyleFor returns role/tier styling, case-insensitive", () => {
    expect(nameStyleFor("GOD").color).toBe("#fcd34d");
    expect(nameStyleFor("staff").color).toBe("#60a5fa");
    expect(nameStyleFor("USER", "KINGPIN").color).toBe("#fcd34d");
    expect(nameStyleFor("USER", "INDICTED").color).toBe("#a78bfa");
    expect(nameStyleFor()).toEqual({});
  });
  it("regexes match urls/images/tenor", () => {
    expect("x https://a.com y".match(URL_RE)?.length).toBe(1);
    expect(IMG_EXT.test("https://x.com/a.png")).toBe(true);
    expect(IMG_EXT.test("https://x.com/a.txt")).toBe(false);
    expect(TENOR_RE.test("https://media.tenor.com/abc.gif")).toBe(true);
  });
});
