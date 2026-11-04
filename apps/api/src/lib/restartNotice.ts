// A deploy restarts the API (pm2 sends SIGINT). Every socket is closed with
// 4012 first, so the page comes straight back to the new process instead of
// backing off for up to 15 s; the proxy holds that reconnect until the new
// process listens (Caddyfile, lb_try_duration). James 2026-11-03: patch every
// day without kicking anyone off.
export const RESTART_CODE = 4012;

type Closable = { close: (code: number, reason: string) => void };

/** Tells every socket the server is restarting; resolves once the close frames
 *  have had a moment to leave (pm2 allows 1.6 s before it kills). */
export async function sayRestarting(wss?: { clients: Iterable<Closable> }): Promise<number> {
  let n = 0;
  for (const ws of wss?.clients ?? []) {
    try {
      ws.close(RESTART_CODE, "restarting");
      n++;
    } catch {
      // One dead socket must not hold up the rest.
    }
  }
  if (n) await new Promise((r) => setTimeout(r, 200));
  return n;
}
