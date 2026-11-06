// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { isResting, onRestChange, watchRest } from "../lib/rest";

// The moving decoration rests while nobody is looking (2026-11-06: the desktop
// app, left open, burned most of a core for four days).
function fakeAnimation(iterations: number) {
  return {
    playState: "running",
    effect: { getTiming: () => ({ iterations }) },
    pause: vi.fn(function (this: any) {
      this.playState = "paused";
    }),
    play: vi.fn(function (this: any) {
      this.playState = "running";
    }),
  };
}

let hidden = false;
let focused = true;
let stop: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  focused = true;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  vi.spyOn(document, "hasFocus").mockImplementation(() => focused);
});
afterEach(() => {
  stop?.();
  stop = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete (document as any).getAnimations;
});

describe("rest", () => {
  it("rests after two minutes without a touch, and wakes at the next one", () => {
    stop = watchRest();
    vi.advanceTimersByTime(60_000);
    expect(isResting()).toBe(false);
    vi.advanceTimersByTime(65_000);
    expect(isResting()).toBe(true);
    expect(document.documentElement.getAttribute("data-weered-rest")).toBe("1");
    window.dispatchEvent(new Event("pointermove"));
    expect(isResting()).toBe(false);
    expect(document.documentElement.hasAttribute("data-weered-rest")).toBe(false);
  });

  it("rests soon after the window is left, and a pointer over it wakes it", () => {
    stop = watchRest();
    focused = false;
    window.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(10_000);
    expect(isResting()).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(isResting()).toBe(true);
    window.dispatchEvent(new Event("pointermove"));
    expect(isResting()).toBe(false);
    // Looking over it counts for a while, then it rests again.
    vi.advanceTimersByTime(25_000);
    expect(isResting()).toBe(true);
    focused = true;
    window.dispatchEvent(new Event("focus"));
    expect(isResting()).toBe(false);
  });

  it("rests at once when the page is hidden", () => {
    stop = watchRest();
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(isResting()).toBe(true);
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(isResting()).toBe(false);
  });

  it("pauses what loops forever and leaves one-off animations to finish", () => {
    const loop = fakeAnimation(Infinity);
    const once = fakeAnimation(1);
    (document as any).getAnimations = () => [loop, once];
    stop = watchRest();
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(loop.pause).toHaveBeenCalled();
    expect(once.pause).not.toHaveBeenCalled();
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(loop.play).toHaveBeenCalled();
    expect(once.play).not.toHaveBeenCalled();
  });

  it("tells the loops that listen, and stops cleanly", () => {
    const seen: boolean[] = [];
    const off = onRestChange((r) => seen.push(r));
    stop = watchRest();
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    stop();
    stop = null;
    expect(seen).toEqual([true, false]);
    off();
  });
});
