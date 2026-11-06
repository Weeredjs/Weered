// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";

// Light effects (2026-11-06): the sky holds still and the snow, the glows and
// the carousel stop; on by itself where the device draws in software.
function gpu(renderer: string | null) {
  const gl =
    renderer === null
      ? null
      : {
          RENDERER: 0x1f01,
          getExtension: (name: string) =>
            name === "WEBGL_debug_renderer_info"
              ? { UNMASKED_RENDERER_WEBGL: 0x9246 }
              : name === "WEBGL_lose_context"
                ? { loseContext: () => {} }
                : null,
          getParameter: () => renderer,
        };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(gl as any);
}

async function fresh() {
  vi.resetModules();
  return import("../lib/displaySettings");
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute("data-weered-light");
  document.documentElement.removeAttribute("data-weered-reduce-motion");
});

describe("drawnInSoftware", () => {
  it("knows a browser drawing without a graphics card", async () => {
    gpu("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)");
    expect((await fresh()).drawnInSoftware()).toBe(true);
    gpu("ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0)");
    expect((await fresh()).drawnInSoftware()).toBe(true);
    gpu("llvmpipe (LLVM 15.0.7, 256 bits)");
    expect((await fresh()).drawnInSoftware()).toBe(true);
    // No WebGL at all: the graphics card is off or blocked.
    gpu(null);
    expect((await fresh()).drawnInSoftware()).toBe(true);
  });

  it("leaves a real graphics card alone, and remembers the answer for the next load", async () => {
    gpu("ANGLE (NVIDIA, NVIDIA GeForce GTX 760 Direct3D11 vs_5_0 ps_5_0, D3D11)");
    const m = await fresh();
    expect(m.drawnInSoftware()).toBe(false);
    expect(localStorage.getItem("weered:sw-draw")).toBe("0");
  });
});

describe("lightEffectsOn", () => {
  it("follows the device unless this device chose", async () => {
    gpu("SwiftShader");
    const m = await fresh();
    expect(m.lightEffectsOn(null)).toBe(true);
    expect(m.lightEffectsOn({ lightEffects: false })).toBe(false);
    gpu("NVIDIA GeForce GTX 760");
    const n = await fresh();
    expect(n.lightEffectsOn({})).toBe(false);
    expect(n.lightEffectsOn({ lightEffects: true })).toBe(true);
  });

  it("is kept with this device's other switches", async () => {
    gpu("NVIDIA GeForce GTX 760");
    const m = await fresh();
    expect(m.readDisplay().lightEffects).toBeNull();
    expect(m.setDisplay({ lightEffects: true }).lightEffects).toBe(true);
    expect(m.readDisplay()).toMatchObject({ lightEffects: true, reduceMotion: false });
  });
});

describe("motionOff under Light effects", () => {
  it("holds even a lobby's forced effect still", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const { motionOff } = await import("../lib/motion");
    expect(motionOff(true)).toBe(false);
    document.documentElement.setAttribute("data-weered-light", "1");
    expect(motionOff(true)).toBe(true);
    expect(motionOff()).toBe(true);
    vi.unstubAllGlobals();
  });
});
