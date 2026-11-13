// How much one account, or one address, may send the API in ten minutes.
//
// A request body may be a megabyte (sixteen for a picture) and one address may
// make 600 requests a minute. Nothing tied the two together, so one free
// account could send tens of gigabytes an hour at any route that stores what
// it is given, and only one of those routes has to lack a size check
// (hardening pass 2026-11-13: the lobby and event routes did).
//
// Measured on three days of live traffic before choosing the numbers: the
// largest real request body was 1.8 KB, and no address sent more than 4.3 KB
// in ten minutes. A picture is the big legitimate case, up to 8 MB each. So:
//
// - an account gets 64 MB per ten minutes, whatever address it is on;
// - an address gets 256 MB per ten minutes across everyone on it (a club
//   signing up together on one Wi-Fi shares an address);
// - an address with nobody signed in gets 8 MB (sign-up, sign-in, the contact
//   form: all under a kilobyte each).
//
// Each is thousands of times what anyone has used. Together they turn "fill
// the disk in an hour" into days from one address, with every route covered
// whether or not it checks its own input.

const MB = 1024 * 1024;
export const WRITE_BUDGETS = {
  windowMs: 10 * 60_000,
  account: 64 * MB,
  address: 256 * MB,
  signedOut: 8 * MB,
} as const;

type Row = { since: number; bytes: number };
/** Bytes per window for an account, an address, and an address with nobody signed in. */
export type Allowances = { account: number; address: number; signedOut: number };

/** A ledger of bytes spent per key in the current window. */
export function makeWriteBudget(
  opts: { windowMs?: number; now?: () => number; maxKeys?: number } = {},
) {
  const windowMs = opts.windowMs ?? WRITE_BUDGETS.windowMs;
  const now = opts.now ?? Date.now;
  // One row per key. A flood of made-up keys must not grow the table without
  // limit, so the oldest row goes when it is full.
  const maxKeys = opts.maxKeys ?? 50_000;
  const spent = new Map<string, Row>();

  function row(key: string): Row {
    const t = now();
    const had = spent.get(key);
    if (had && t - had.since < windowMs) return had;
    if (!had && spent.size >= maxKeys) {
      const oldest = spent.keys().next().value;
      if (oldest !== undefined) spent.delete(oldest);
    }
    const fresh = { since: t, bytes: 0 };
    spent.delete(key); // so a renewed key counts as new, not as the oldest
    spent.set(key, fresh);
    return fresh;
  }

  return {
    /**
     * Count `bytes` against each `[key, allowance]`. Returns how many seconds
     * until the first key that is now over its allowance starts afresh, or 0
     * when every key is within it.
     */
    spend(bytes: number, keys: ReadonlyArray<readonly [string, number]>): number {
      const size = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
      let wait = 0;
      for (const [key, allowance] of keys) {
        const r = row(key);
        r.bytes += size;
        if (r.bytes > allowance && !wait)
          wait = Math.max(1, Math.ceil((r.since + windowMs - now()) / 1000));
      }
      return wait;
    },
    /** Rows held, for tests and the health page. */
    get size() {
      return spent.size;
    },
  };
}

/** The keys a request is counted against: the account and its address, or the
 *  address alone when nobody is signed in. */
export function budgetKeys(
  ip: string,
  userId: string | null,
  limits: Allowances = WRITE_BUDGETS,
): Array<[string, number]> {
  return userId
    ? [
        [`u:${userId}`, limits.account],
        [`a:${ip}`, limits.address],
      ]
    : [[`s:${ip}`, limits.signedOut]];
}

/** Roughly how big a parsed body was, for a request that came without a
 *  Content-Length to count before parsing. */
export function bodySize(body: unknown): number {
  if (body == null) return 0;
  if (typeof body === "string") return body.length;
  if (Buffer.isBuffer(body)) return body.length;
  try {
    return JSON.stringify(body)?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Put the allowance in front of every route. `userIdOf` turns a session token
 * into an account id (null when it isn't one); register this after the hook
 * that copies the session cookie into the Authorization header.
 */
export function registerWriteBudget(
  app: { addHook: (name: any, fn: (req: any, reply: any) => Promise<unknown>) => unknown },
  userIdOf: (bearer: string) => string | null,
  ledger = makeWriteBudget(),
  limits: Allowances = WRITE_BUDGETS,
) {
  const keysFor = (req: any) => {
    const bearer = String(req.headers?.authorization || "")
      .replace("Bearer ", "")
      .trim();
    return budgetKeys(String(req.ip || ""), bearer ? userIdOf(bearer) : null, limits);
  };
  const refuse = (reply: any, wait: number) =>
    reply.code(429).header("Retry-After", String(wait)).send({
      ok: false,
      statusCode: 429,
      error: "rate_limited",
      message: "That is a lot of data in a short time. Try again in a few minutes.",
      retryAfterSec: wait,
    });
  // Counted from the length the request states, before the body is read.
  app.addHook("onRequest", async (req, reply) => {
    const declared = Number(req.headers?.["content-length"]);
    if (!(declared > 0)) return;
    const wait = ledger.spend(declared, keysFor(req));
    if (wait) return refuse(reply, wait);
  });
  // A body sent in chunks states no length: counted once it has been read.
  app.addHook("preValidation", async (req, reply) => {
    if (req.headers?.["content-length"] || req.body == null) return;
    const wait = ledger.spend(bodySize(req.body), keysFor(req));
    if (wait) return refuse(reply, wait);
  });
}
