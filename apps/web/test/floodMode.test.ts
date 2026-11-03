import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Timed refreshes in a flood (lib/floodMode.ts, 2026-11-02): an idle Home tab
// made ~16 API calls a minute, so a thousand open tabs were ~275 a second.
describe("poll", () => {
  let visibility = "visible";
  const listeners = new Map<string, () => void>();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5); // the spread lands mid-range
    visibility = "visible";
    listeners.clear();
    vi.stubGlobal("document", {
      get visibilityState() {
        return visibility;
      },
      addEventListener: (k: string, fn: () => void) => listeners.set(k, fn),
      removeEventListener: (k: string) => listeners.delete(k),
    });
    vi.stubGlobal("window", { dispatchEvent: () => true });
    vi.stubGlobal("CustomEvent", class {});
  });
  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    (await import("../lib/floodMode")).setFloodFlag(false);
  });

  it("runs on its interval, skips a hidden tab and catches up when it's seen again", async () => {
    const { poll } = await import("../lib/floodMode");
    const fn = vi.fn();
    const stop = poll(fn, 10_000);
    vi.advanceTimersByTime(10_000);
    expect(fn).toHaveBeenCalledTimes(1);
    visibility = "hidden";
    vi.advanceTimersByTime(30_000);
    expect(fn).toHaveBeenCalledTimes(1);
    visibility = "visible";
    listeners.get("visibilitychange")?.();
    expect(fn).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("waits four times as long in flood mode", async () => {
    const { poll, setFloodFlag } = await import("../lib/floodMode");
    setFloodFlag(true);
    const fn = vi.fn();
    const stop = poll(fn, 10_000);
    vi.advanceTimersByTime(30_000);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
  });
});
