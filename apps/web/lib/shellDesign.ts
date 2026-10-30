"use client";

// Design mode for the viewer's own Weered: the sidebars and Home, the way a
// lobby has Design mode. A working draft (layout + look) with undo and redo,
// painted live on the real shell, then saved to the account or thrown away.
// One store, so the left rail, the right panel, Home and the design panels
// all draw the same draft.

import { useSyncExternalStore } from "react";
import {
  railFromShell,
  sanitizeShell,
  shellFromPrefs,
  stockShell,
  type ShellLayout,
} from "./shellLayout";
import {
  PREFS_EVENT,
  PREFS_KEY,
  isHexColour,
  isSiteTheme,
  paintUiPrefs,
  readUiPrefs,
  saveUiPrefsToAccount,
  NEBULA_FONT_IDS,
  PALETTE_IDS,
  type NebulaFont,
  type Palette,
  type SiteThemeId,
  type UiPrefs,
} from "./uiPrefs";

export type ShellLook = {
  theme: SiteThemeId;
  palette: Palette;
  accent: string;
  font: NebulaFont;
  stars: boolean;
  density: "comfortable" | "compact";
};
export type ShellSnap = { layout: ShellLayout; look: ShellLook };

export type ShellDesignState = {
  designing: boolean;
  draft: ShellSnap | null;
  /** What was saved when this session started; Discard goes back to it. */
  base: ShellSnap | null;
  selected: string | null;
  saving: "idle" | "saving" | "saved" | "error";
  canUndo: boolean;
  canRedo: boolean;
  /** The saved layout: what the shell draws outside Design mode. */
  saved: ShellLayout;
};

const DRAFT_KEY = "weered:shell-draft:v1";
let past: ShellSnap[] = [];
let future: ShellSnap[] = [];
const INITIAL: ShellDesignState = {
  designing: false,
  draft: null,
  base: null,
  selected: null,
  saving: "idle",
  canUndo: false,
  canRedo: false,
  saved: stockShell(),
};
let state: ShellDesignState = INITIAL;
const listeners = new Set<() => void>();

function set(patch: Partial<ShellDesignState>) {
  state = { ...state, ...patch, canUndo: past.length > 0, canRedo: future.length > 0 };
  listeners.forEach((l) => l());
}

let started = false;
function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  const refresh = () => {
    const saved = shellFromPrefs(readUiPrefs());
    if (JSON.stringify(saved) !== JSON.stringify(state.saved)) set({ saved });
  };
  refresh();
  window.addEventListener(PREFS_EVENT, refresh);
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key === PREFS_KEY) refresh();
  });
}

function subscribe(cb: () => void) {
  ensureStarted();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** The whole Design mode state. The server render (and hydration) sees the
 *  stock layout; the viewer's own arrives right after. */
export function useShellDesign(): ShellDesignState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}

/** The layout the shell draws right now: the draft while designing, else
 *  the saved one. */
export function useShellLayout(): ShellLayout {
  const s = useShellDesign();
  return s.designing && s.draft ? s.draft.layout : s.saved;
}

function lookFromPrefs(p: UiPrefs): ShellLook {
  let theme: SiteThemeId = "press";
  if (p.theme && isSiteTheme(p.theme)) theme = p.theme;
  else {
    const attr = document.documentElement.getAttribute("data-weered-theme");
    if (isSiteTheme(attr)) theme = attr;
  }
  return {
    theme,
    palette: p.palette || "violet",
    accent: isHexColour(p.accent) ? p.accent : "#8b5cf6",
    font: p.font || "default",
    stars: p.stars !== false,
    density: p.density || "comfortable",
  };
}

function cleanLook(raw: any, base: ShellLook): ShellLook {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    theme: isSiteTheme(r.theme) ? r.theme : base.theme,
    palette:
      r.palette === "custom" || (PALETTE_IDS as string[]).includes(r.palette)
        ? r.palette
        : base.palette,
    accent: isHexColour(r.accent) ? r.accent : base.accent,
    font: (NEBULA_FONT_IDS as string[]).includes(r.font) ? r.font : base.font,
    stars: typeof r.stars === "boolean" ? r.stars : base.stars,
    density: r.density === "compact" || r.density === "comfortable" ? r.density : base.density,
  };
}

const paintLook = (l: ShellLook) => paintUiPrefs({ ...l });

export function startDesign() {
  if (typeof window === "undefined" || state.designing) return;
  ensureStarted();
  const prefs = readUiPrefs();
  const base: ShellSnap = { layout: shellFromPrefs(prefs), look: lookFromPrefs(prefs) };
  // Resume a draft left unsaved in this browser.
  let draft = base;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const j = raw ? JSON.parse(raw) : null;
    const layout = sanitizeShell(j?.layout);
    if (layout) draft = { layout, look: cleanLook(j.look, base.look) };
  } catch {}
  past = [];
  future = [];
  document.documentElement.setAttribute("data-weered-shell-design", "1");
  set({ designing: true, base, draft, selected: null, saving: "idle" });
  paintLook(draft.look);
}

/** Leave Design mode. Unsaved work stays as a draft in this browser; the
 *  look goes back to what is saved. */
export function stopDesign() {
  if (!state.designing) return;
  document.documentElement.removeAttribute("data-weered-shell-design");
  if (state.base) paintLook(state.base.look);
  set({ designing: false, selected: null });
}

function commit(next: ShellSnap, persist = true) {
  if (!state.draft || JSON.stringify(next.look) !== JSON.stringify(state.draft.look))
    paintLook(next.look);
  if (persist) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {}
  }
  set({ draft: next, saving: "idle" });
}

let lastMerge: { key: string; at: number } | null = null;

/** Change the draft. Changes sharing a `merge` key within a second and a
 *  half (a colour picker being dragged, a field being typed in) make one
 *  undo step. */
export function editDraft(fn: (s: ShellSnap) => ShellSnap, merge?: string) {
  const cur = state.draft;
  if (!cur) return;
  const next = fn(cur);
  if (next === cur) return;
  const now = Date.now();
  const joined = !!merge && lastMerge?.key === merge && now - lastMerge.at < 1500;
  lastMerge = merge ? { key: merge, at: now } : null;
  if (!joined) {
    past.push(cur);
    if (past.length > 80) past.shift();
  }
  future = [];
  commit(next);
}

export const editLayout = (fn: (l: ShellLayout) => ShellLayout, merge?: string) =>
  editDraft((s) => {
    const layout = fn(s.layout);
    return layout === s.layout ? s : { ...s, layout };
  }, merge);

export const editLook = (patch: Partial<ShellLook>, merge?: string) =>
  editDraft((s) => ({ ...s, look: { ...s.look, ...patch } }), merge);

export function undo() {
  const prev = past.pop();
  if (!prev || !state.draft) return;
  future.push(state.draft);
  commit(prev);
}

export function redo() {
  const next = future.pop();
  if (!next || !state.draft) return;
  past.push(state.draft);
  commit(next);
}

export function selectItem(key: string | null) {
  if (state.selected !== key) set({ selected: key });
}

export function isDirty(s: ShellDesignState = state): boolean {
  return !!(s.designing && s.draft && s.base && JSON.stringify(s.draft) !== JSON.stringify(s.base));
}

/** Save the draft to the account. True when the account confirmed it. */
export async function saveDesign(): Promise<boolean> {
  const raw = state.draft;
  if (!raw) return false;
  // Settings are kept as typed while designing; what's saved is cleaned
  // (a half-written link goes), and the draft becomes exactly that.
  const d: ShellSnap = { ...raw, layout: sanitizeShell(raw.layout) ?? raw.layout };
  set({ saving: "saving" });
  const ok = await saveUiPrefsToAccount({
    shell: d.layout,
    rail: railFromShell(d.layout),
    theme: d.look.theme,
    palette: d.look.palette,
    accent: d.look.accent,
    font: d.look.font,
    stars: d.look.stars,
    density: d.look.density,
  });
  if (ok) {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    set({ base: d, draft: d, saved: d.layout, saving: "saved" });
  } else set({ saving: "error" });
  return ok;
}

export function discardDesign() {
  if (!state.base) return;
  past = [];
  future = [];
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
  commit(state.base, false);
  set({ selected: null });
}
