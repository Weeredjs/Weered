import { describe, expect, it } from "vitest";
import { FILM, INTRO, loopStart, pickFilm } from "../components/LandingFilm";

describe("loopStart", () => {
  it("skips the film's title card while muted (the headline above says it)", () => {
    expect(loopStart(true)).toBe(INTRO);
    expect(INTRO).toBeGreaterThan(4);
    expect(INTRO).toBeLessThan(6);
  });

  it("plays from the top with sound", () => {
    expect(loopStart(false)).toBe(0);
  });
});

describe("pickFilm", () => {
  it("plays the 1080p cut by itself on a big screen", () => {
    expect(pickFilm({ small: false, saveData: false, calm: false })).toEqual({
      src: FILM.hd,
      still: false,
    });
  });

  it("gives phones the 720p cut", () => {
    expect(pickFilm({ small: true, saveData: false, calm: false })).toEqual({
      src: FILM.sd,
      still: false,
    });
  });

  it("waits for a click when motion is reduced", () => {
    expect(pickFilm({ small: false, saveData: false, calm: true })).toEqual({
      src: FILM.hd,
      still: true,
    });
  });

  it("saves data: the small cut, and only on a click", () => {
    expect(pickFilm({ small: false, saveData: true, calm: false })).toEqual({
      src: FILM.sd,
      still: true,
    });
  });

  it("serves the films from Caddy's /media/film/, not from Next", () => {
    for (const f of Object.values(FILM)) expect(f.startsWith("/media/film/")).toBe(true);
  });
});
