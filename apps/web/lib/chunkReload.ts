// A page loaded before a deploy can ask for code that only the new build has,
// or that the old one no longer serves. The click that needs it fails with a
// chunk error and React shows its bare "Application error" screen (James
// 2026-11-02: LFG in the GTA 6 lobby, clicked while a deploy finished at
// 18:57; the server refused the chunk with 400 for those seconds). The cure is
// a reload, which picks up the current build. Once only: never twice within a
// minute, so a real outage can't loop.
const KEY = "weered:chunk-reload";

export function isChunkError(e: unknown): boolean {
  const any = e as { name?: unknown; message?: unknown } | null;
  const text = `${String(any?.name ?? "")} ${String(any?.message ?? e ?? "")}`;
  return /ChunkLoadError|Loading (CSS )?chunk \S+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
    text,
  );
}

/** Reload to the current build; false when one was just tried, or when the
 *  browser won't let us remember that one was (blocked storage would loop). */
export function reloadForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
