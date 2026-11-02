import { describe, it, expect } from "vitest";
import { streamSettings } from "../lib/streamQuality";

// A call's cams and screen share follow the lobby owner's plan (api lib/tiers.ts).
describe("stream quality", () => {
  it("is standard unless the voice pass says more", () => {
    expect(streamSettings(undefined).screen).toMatchObject({
      width: 1280,
      height: 720,
      frameRate: 15,
    });
    expect(streamSettings("nonsense").camera).toMatchObject({ width: 640, height: 480 });
  });

  it("is 1080p for a Felon lobby and 60 fps for Condemned", () => {
    expect(streamSettings("hd").screen).toMatchObject({ width: 1920, height: 1080, frameRate: 30 });
    expect(streamSettings("max").screen).toMatchObject({ frameRate: 60 });
    expect(streamSettings("max").screenEncoding.maxFramerate).toBe(60);
  });
});
