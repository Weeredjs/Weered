// Two voice basics a Discord regular reaches for first (2026-11-01): how loud
// each person is, and push to talk. Both stay on this device, like the mic.

export const VOLUME_KEY = "weered:voice-volume:v1";
export const PTT_KEY = "weered:voice-ptt:v1";

/** Push to talk: off, or the key (or mouse side button) that opens the mic. */
export type Ptt = { on: boolean; code: string; label: string };
export const DEFAULT_PTT: Ptt = { on: false, code: "Backquote", label: "`" };

/** A volume as the slider shows it: 0 to 1, in whole percent. */
export function clampVolume(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, Math.round(n * 100) / 100));
}

export function readVolumes(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(VOLUME_KEY) || "{}");
    const out: Record<string, number> = {};
    if (raw && typeof raw === "object")
      for (const [k, v] of Object.entries(raw)) if (k) out[k] = clampVolume(v);
    return out;
  } catch {
    return {};
  }
}

/** Save one person's volume; full volume is the default, so it's dropped. */
export function writeVolume(identity: string, v: number): Record<string, number> {
  const all = readVolumes();
  const c = clampVolume(v);
  if (c === 1) delete all[identity];
  else all[identity] = c;
  try {
    localStorage.setItem(VOLUME_KEY, JSON.stringify(all));
  } catch {}
  return all;
}

export function readPtt(): Ptt {
  try {
    const p = JSON.parse(localStorage.getItem(PTT_KEY) || "null");
    if (p && typeof p.code === "string" && p.code)
      return { on: p.on === true, code: p.code, label: String(p.label || p.code).slice(0, 12) };
  } catch {}
  return { ...DEFAULT_PTT };
}

export function writePtt(p: Ptt) {
  try {
    localStorage.setItem(PTT_KEY, JSON.stringify(p));
  } catch {}
}

/** The name people know a key or button by: "`", "V", "Space", "Mouse 4". */
export function keyLabel(e: { code: string; key?: string }): string {
  const m = /^Mouse(\d)$/.exec(e.code);
  if (m) return `Mouse ${m[1]}`;
  if (e.code === "Space") return "Space";
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3);
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
  const k = String(e.key || "");
  if (k.length === 1) return k.toUpperCase();
  return e.code.replace(/^(Arrow|Numpad)/, "$1 ").trim();
}

/** Keys that can't be push to talk: they'd fight typing, tabbing and closing. */
export function usableCode(code: string): boolean {
  return !!code && !/^(Escape|Tab|Enter|Backspace|Meta|OS)/.test(code);
}

/** Typing in a field never counts as a push. */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el !== "object") return false;
  if ((el as any).isContentEditable) return true;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(String(el.tagName || ""));
}
