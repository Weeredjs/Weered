// Two switches that belong to this device, not the account: no animations, and
// Weered's own theme inside lobbies that have their own. They lived in Settings
// → Display; since 2026-11-02 they sit in Change your drip with the rest of
// "how Weered looks to you" (James: the appearance settings were doubled up).
// Same store as before, so nothing anyone set is lost; WeeredProvider and
// lib/lobbyChrome.ts listen for the events.
const KEY = "weered:settings:v0";
/** This device's answer to drawnInSoftware(), kept for the pre-paint script. */
const SW_KEY = "weered:sw-draw";

/** lightEffects: null follows the device (on where it draws in software). */
export type DisplaySwitches = {
  reduceMotion: boolean;
  keepDefaultTheme: boolean;
  lightEffects: boolean | null;
};

function readAll(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function switches(s: Record<string, any>): DisplaySwitches {
  return {
    reduceMotion: s.reduceMotion === true,
    keepDefaultTheme: s.keepDefaultTheme === true,
    lightEffects: typeof s.lightEffects === "boolean" ? s.lightEffects : null,
  };
}

export function readDisplay(): DisplaySwitches {
  return switches(readAll());
}

/** Does this browser draw without a graphics card (a VM, a missing driver)?
 *  The moving decoration costs most there (2026-11-06: a software-drawn Home
 *  kept a core busy), so Light effects comes on by itself. Asked once a visit. */
let swAnswer: boolean | null = null;
export function drawnInSoftware(): boolean {
  if (swAnswer !== null) return swAnswer;
  let sw = false;
  try {
    const gl = document.createElement("canvas").getContext("webgl") as WebGLRenderingContext | null;
    if (!gl) sw = true;
    else {
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
      sw = /swiftshader|basic render|llvmpipe|softpipe|software/i.test(name);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {}
  swAnswer = sw;
  try {
    localStorage.setItem(SW_KEY, sw ? "1" : "0");
  } catch {}
  return sw;
}

/** Light effects, as chosen on this device or as it draws. */
export function lightEffectsOn(s: { lightEffects?: boolean | null } | null | undefined): boolean {
  if (typeof s?.lightEffects === "boolean") return s.lightEffects;
  return drawnInSoftware();
}

export function setDisplay(patch: Partial<DisplaySwitches>): DisplaySwitches {
  const next = { ...readAll(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("weered:settings"));
    window.dispatchEvent(new CustomEvent("weered:settings:changed", { detail: next }));
  } catch {}
  return switches(next);
}
