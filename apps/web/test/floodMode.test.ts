import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Whether anyone is looking (lib/rest.ts), set by hand here.
const rest = vi.hoisted(() => ({
  resting: false,
  listeners: new Set<(resting: boolean) => void>(),
}));
vi.mock("../lib/rest", () => ({
  isResting: () => rest.resting,
  onRestChange: (fn: (resting: boolean) => void) => {
    rest.listeners.add(fn);
    return () => rest.listeners.delete(fn);
  },
}));
function setResting(on: boolean) {
  rest.resting = on;
  rest.listeners.forEach((fn) => fn(on));
}

// Timed refreshes in a flood (lib/floodMode.ts, 2026-11-02): an idle Home tab
// made ~16 API calls a minute, so a thousand open tabs were ~275 a second.
describe("poll", () => {
  let visibility = "visible";
  const listeners = new Map<string, () => void>();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5); // the spread lands mid-range
    visibility = "visible";
    rest.resting = false;
    rest.listeners.clear();
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

  // 2026-11-12: two tabs left open made most of a quiet week's 300,000 calls.
  it("asks a third as often on a page nobody has touched, and catches up at the first touch", async () => {
    const { poll } = await import("../lib/floodMode");
    const fn = vi.fn();
    const stop = poll(fn, 10_000);
    vi.advanceTimersByTime(10_000);
    expect(fn).toHaveBeenCalledTimes(1);

    // Nobody's looking. The next wait is three times the usual.
    setResting(true);
    vi.advanceTimersByTime(10_000); // the turn already booked still runs
    expect(fn).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(29_000);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1_000);
    expect(fn).toHaveBeenCalledTimes(3);

    // Someone touches the page past its usual turn: fresh at once, then the usual pace.
    vi.advanceTimersByTime(12_000);
    setResting(false);
    expect(fn).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(10_000);
    expect(fn).toHaveBeenCalledTimes(5);

    // A touch just after a refresh asks for nothing more.
    setResting(true);
    setResting(false);
    expect(fn).toHaveBeenCalledTimes(5);
    stop();
    setResting(true);
    setResting(false);
    vi.advanceTimersByTime(60_000);
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it("keeps its pace for something a person may sit and watch, and still skips a hidden tab", async () => {
    const { pollLive } = await import("../lib/floodMode");
    const fn = vi.fn();
    const stop = pollLive(fn, 10_000);
    setResting(true);
    vi.advanceTimersByTime(30_000);
    expect(fn).toHaveBeenCalledTimes(3);
    visibility = "hidden";
    vi.advanceTimersByTime(30_000);
    expect(fn).toHaveBeenCalledTimes(3);
    visibility = "visible";
    listeners.get("visibilitychange")?.();
    expect(fn).toHaveBeenCalledTimes(4);
    stop();
  });
});
