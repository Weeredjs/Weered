// How much one account, or one address, may send the API in ten minutes.
//
// A request body may be a megabyte (sixteen for a picture) and one address may
// make 600 requests a minute. Nothing tied the two together, so one free
// account could send tens of gigabytes an hour at any route that stores what
// it is given, and only one of those routes has to lack a size check
// (hardening pass 2026-11-13: the lobby and event routes did). And a body is
// read in full before a route can say "sign in first", so a stranger's 16 MB
// request was read, every time.
//
// Measured on three days of live traffic before choosing the numbers: the
// largest real request body was 1.8 KB, and no address sent more than 4.3 KB
// in ten minutes. Pictures are the big legitimate case: the browser sends a
// photo as it is, up to 8 MB, and a club may share an evening's worth at once.
// So text and files are counted apart:
//
// - text (a body of a megabyte or less, all any ordinary route accepts):
//   32 MB per account, 128 MB per address;
// - files (a body over a megabyte: pictures and maps, which are re-encoded
//   smaller before they are kept): 256 MB per account, 1 GB per address;
// - an address with nobody signed in: 8 MB of anything. Sign-up, sign-in and
//   the contact form are under a kilobyte each, and nothing bigger is taken
//   from a stranger.
//
// An account is counted wherever it is, and the address's own allowance is
// shared by everyone on it (a club signing up together on one Wi-Fi shares an
// address). The text allowance is thousands of times what anyone has sent. It
// turns "fill the disk in an hour" into weeks, on every route, whether or not
// the route checks its own input.

const MB = 1024 * 1024;
/** Bytes per window: for an account, and for everyone on one address. */
export type Allowance = { account: number; address: number };
export type Allowances = {
  /** A body over this many bytes is a file; no text route accepts one. */
  fileOver: number;
  text: Allowance;
  files: Allowance;
  /** An address with nobody signed in, text and files together. */
  signedOut: number;
};
export const WRITE_BUDGETS: Allowances & { windowMs: number } = {
  windowMs: 10 * 60_000,
  fileOver: MB,
  text: { account: 32 * MB, address: 128 * MB },
  files: { account: 256 * MB, address: 1024 * MB },
  signedOut: 8 * MB,
};

type Row = { since: number; bytes: number };

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
    /** Rows held, for tests. */
    get size() {
      return spent.size;
    },
  };
}

/** The keys a request of `bytes` is counted against: the account and its
 *  address, as text or as a file; or the address alone when nobody is signed
 *  in. */
export function budgetKeys(
  ip: string,
  userId: string | null,
  bytes: number,
  limits: Allowances = WRITE_BUDGETS,
): Array<[string, number]> {
  if (!userId) return [[`s:${ip}`, limits.signedOut]];
  const file = bytes > limits.fileOver;
  const of = file ? limits.files : limits.text;
  const kind = file ? "f" : "t";
  return [
    [`u${kind}:${userId}`, of.account],
    [`a${kind}:${ip}`, of.address],
  ];
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
  const keysFor = (req: any, bytes: number) => {
    const bearer = String(req.headers?.authorization || "")
      .replace("Bearer ", "")
      .trim();
    return budgetKeys(String(req.ip || ""), bearer ? userIdOf(bearer) : null, bytes, limits);
  };
  const refuse = (reply: any, wait: number) =>
    reply.code(429).header("Retry-After", String(wait)).send({
      ok: false,
      statusCode: 429,
      error: "rate_limited",
      message: "That is a lot to send in a short time. Try again in a few minutes.",
      retryAfterSec: wait,
    });
  // Counted from the length the request states, before the body is read.
  app.addHook("onRequest", async (req, reply) => {
    const declared = Number(req.headers?.["content-length"]);
    if (!(declared > 0)) return;
    const wait = ledger.spend(declared, keysFor(req, declared));
    if (wait) return refuse(reply, wait);
  });
  // A body sent in chunks states no length: counted once it has been read.
  app.addHook("preValidation", async (req, reply) => {
    if (req.headers?.["content-length"] || req.body == null) return;
    const size = bodySize(req.body);
    const wait = ledger.spend(size, keysFor(req, size));
    if (wait) return refuse(reply, wait);
  });
}
