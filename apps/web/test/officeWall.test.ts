// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { officeYt, officeYtNow, resetOfficeYt, youtubeId } from "../app/foyer/OfficeWall";

// The office's screen (2026-11-12): any YouTube link James pastes, and the
// state a visitor walking in is brought to.
describe("office screen", () => {
  it("reads every common YouTube link and refuses the rest", () => {
    const id = "dQw4w9WgXcQ";
    for (const link of [
      id,
      `https://www.youtube.com/watch?v=${id}&t=42s`,
      `https://youtu.be/${id}?si=abc`,
      `youtube.com/shorts/${id}`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}?feature=share`,
    ])
      expect(youtubeId(link)).toBe(id);
    for (const bad of ["", "hello", "https://vimeo.com/123", "https://youtube.com/watch?v=short"])
      expect(youtubeId(bad)).toBeNull();
  });

  it("keeps the room's latest state for whoever mounts the screen later", () => {
    resetOfficeYt();
    expect(officeYtNow()).toBeNull();
    // Handed over on arrival: playing, 30 s in.
    officeYt({
      type: "youtube:state",
      videoId: "abcdefghijk",
      playing: true,
      position: 30,
      updatedAt: 1,
    });
    expect(officeYtNow()).toMatchObject({
      videoId: "abcdefghijk",
      playing: true,
      position: 30,
      updatedAt: 1,
    });
    // The host pauses at 95 s.
    officeYt({ type: "youtube:pause", position: 95 });
    expect(officeYtNow()).toMatchObject({ videoId: "abcdefghijk", playing: false, position: 95 });
    // Not a screen frame: nothing changes.
    officeYt({ type: "chat:new" } as any);
    expect(officeYtNow()).toMatchObject({ position: 95 });
    // A new video starts paused at 0, and a play can't come before a video.
    officeYt({ type: "youtube:load", videoId: "bcdefghijkl" });
    expect(officeYtNow()).toMatchObject({ videoId: "bcdefghijkl", playing: false, position: 0 });
    officeYt({ type: "youtube:stop" });
    expect(officeYtNow()).toBeNull();
    officeYt({ type: "youtube:play", position: 5 });
    expect(officeYtNow()).toBeNull();
  });
});
