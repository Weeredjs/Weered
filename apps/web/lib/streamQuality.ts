// Cams and screen share at the quality the lobby owner's plan pays for: the
// voice pass says which (api lib/tiers.ts streamQuality, 2026-11-02). They run
// through Weered's own server, the one per-use cost; free lobbies get standard,
// Felon HD, Condemned and up the best.
import {
  ScreenSharePresets,
  VideoPresets,
  type ScreenShareCaptureOptions,
  type VideoEncoding,
  type VideoResolution,
} from "livekit-client";

export type StreamQuality = "standard" | "hd" | "max";

type Settings = {
  camera: VideoResolution;
  cameraEncoding?: VideoEncoding;
  screen: NonNullable<ScreenShareCaptureOptions["resolution"]>;
  screenEncoding: VideoEncoding;
};

const res = (
  p: { width: number; height: number; encoding: VideoEncoding },
  frameRate?: number,
) => ({
  width: p.width,
  height: p.height,
  frameRate: frameRate ?? p.encoding.maxFramerate,
});

export const STREAM_SETTINGS: Record<StreamQuality, Settings> = {
  standard: {
    camera: { width: 640, height: 480, frameRate: 24 },
    screen: res(ScreenSharePresets.h720fps15),
    screenEncoding: ScreenSharePresets.h720fps15.encoding,
  },
  hd: {
    camera: res(VideoPresets.h720),
    cameraEncoding: VideoPresets.h720.encoding,
    screen: res(ScreenSharePresets.h1080fps30),
    screenEncoding: ScreenSharePresets.h1080fps30.encoding,
  },
  max: {
    camera: res(VideoPresets.h1080),
    cameraEncoding: VideoPresets.h1080.encoding,
    screen: { width: 1920, height: 1080, frameRate: 60 },
    screenEncoding: { maxBitrate: 8_000_000, maxFramerate: 60 },
  },
};

export function streamSettings(q: unknown): Settings {
  return STREAM_SETTINGS[q === "hd" || q === "max" ? q : "standard"];
}
