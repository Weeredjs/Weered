import { describe, expect, it } from "vitest";
import {
  chromeFor,
  FORCED_THEME_LOBBIES,
  NO_SHELL_ROUTES,
  THEMEABLE_LOBBY_IDS,
} from "../lib/lobbyThemes";

const decide = (path: string, keep = false, cache: any = null, search = "") =>
  chromeFor(path, search, keep, cache, THEMEABLE_LOBBY_IDS, FORCED_THEME_LOBBIES, NO_SHELL_ROUTES);

describe("one rule for skin and chrome", () => {
  it("forced lobbies wear their skin for everyone, without minimal chrome", () => {
    expect(decide("/lobby/vocn")).toEqual(["vocn", false]);
    expect(decide("/lobby/timbos")).toEqual(["timbos", false]);
  });
  it("member-only skins need the member's cached skin; otherwise minimal chrome", () => {
    expect(decide("/lobby/dnd")).toEqual([null, true]);
    expect(decide("/lobby/dnd", false, { lobbies: { dnd: 1 } })).toEqual(["dnd", false]);
    expect(decide("/lobby/division2")).toEqual([null, true]);
  });
  it("rooms take their lobby's skin from the cache or a forced lobby's id prefix", () => {
    expect(decide("/room/vocn-dispatch")).toEqual(["vocn", false]);
    expect(decide("/room/abc", false, { rooms: { abc: "dnd" } })).toEqual(["dnd", false]);
    expect(decide("/room/random")).toEqual([null, true]);
  });
  it("Keep default theme wins over every skin", () => {
    expect(decide("/lobby/vocn", true)).toEqual([null, true]);
    expect(decide("/room/vocn-dispatch", true)).toEqual([null, true]);
  });
  it("bare pages and ?chrome=full get neither; sub-pages of a lobby are plain", () => {
    expect(decide("/")).toEqual([null, false]);
    expect(decide("/about")).toEqual([null, false]);
    expect(decide("/home")).toEqual([null, true]);
    expect(decide("/lobby/vocn", false, null, "?chrome=full")).toEqual([null, false]);
    expect(decide("/lobby/vocn/admin")).toEqual([null, true]);
  });
  it("keeps every bare marketing and legal page out of the shell", () => {
    for (const r of [
      "/verify-email",
      "/media-policy",
      "/safety",
      "/features",
      "/blog",
      "/terms",
      "/reset-password",
    ]) {
      expect(NO_SHELL_ROUTES, r).toContain(r);
      expect(decide(r), r).toEqual([null, false]);
    }
  });
  it("its source runs on its own, as the pre-paint script inlines it", () => {
    const standalone = new Function(`return (${chromeFor.toString()});`)();
    expect(
      standalone(
        "/lobby/vocn",
        "",
        false,
        null,
        THEMEABLE_LOBBY_IDS,
        FORCED_THEME_LOBBIES,
        NO_SHELL_ROUTES,
      ),
    ).toEqual(["vocn", false]);
  });
});
