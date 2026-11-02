import { afterEach, describe, expect, it, vi } from "vitest";
import { isChunkError, reloadForNewBuild } from "../lib/chunkReload";

// A page left open across a deploy asks for code the server no longer has
// (James 2026-11-02, LFG in the GTA 6 lobby). Those errors reload once onto
// the new build; real crashes don't, and a reload never loops.
describe("isChunkError", () => {
  it("knows the ways a missing code file shows up", () => {
    const named = new Error(
      "Loading chunk 6513 failed.\n(error: https://weered.ca/_next/static/chunks/6513.js)",
    );
    named.name = "ChunkLoadError";
    expect(isChunkError(named)).toBe(true);
    expect(isChunkError(new Error("Loading chunk app/lobby/[id]/page failed."))).toBe(true);
    expect(isChunkError(new Error("Loading CSS chunk 812 failed."))).toBe(true);
    expect(
      isChunkError(new TypeError("Failed to fetch dynamically imported module: https://x/a.js")),
    ).toBe(true);
    expect(isChunkError(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(isChunkError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkError("ChunkLoadError: Loading chunk 9 failed")).toBe(true);
  });

  it("leaves real crashes alone", () => {
    expect(isChunkError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(
      false,
    );
    expect(isChunkError(new Error("Failed to fetch"))).toBe(false);
    expect(isChunkError(null)).toBe(false);
    expect(isChunkError(undefined)).toBe(false);
  });
});

describe("reloadForNewBuild", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stub = () => {
    const store = new Map<string, string>();
    const reload = vi.fn();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    vi.stubGlobal("window", { location: { reload } });
    return reload;
  };

  it("reloads once, then holds off for a minute", () => {
    const reload = stub();
    expect(reloadForNewBuild()).toBe(true);
    expect(reloadForNewBuild()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("never reloads when the browser blocks storage (it couldn't stop a loop)", () => {
    const reload = vi.fn();
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    });
    vi.stubGlobal("window", { location: { reload } });
    expect(reloadForNewBuild()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("tries again after the minute is up", () => {
    const reload = stub();
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    reloadForNewBuild();
    now.mockReturnValue(1_000_000 + 61_000);
    expect(reloadForNewBuild()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });
});
