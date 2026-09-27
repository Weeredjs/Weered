/**
 * A lobby's moduleConfig as the public may see it.
 *
 * The `va` block holds a virtual airline's crew- and staff-only links, its
 * dispatch room and system user, and the seed that regenerates its gated
 * roster and PIREPs offline. routes/va.ts serves each piece only to the
 * audience allowed to see it, but GET /lobbies/:id and the lobby lists sent the
 * whole block to anonymous callers (found 2026-09-26 on vocn). Everything else
 * in moduleConfig (demoData, startgg.ref, steamAppId, acServers) is public by
 * design and is left alone.
 */
export function publicModuleConfig(cfg: unknown): unknown {
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return cfg ?? null;
  const { va: _va, ...rest } = cfg as Record<string, unknown>;
  return rest;
}
