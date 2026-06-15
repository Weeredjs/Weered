// Wrap fetch with a per-attempt timeout (Node's fetch has none) plus optional
// retry/backoff for transient upstream failures. Auto-retry is conservative:
// it only fires for IDEMPOTENT requests (GET/HEAD, no body) so a retried call
// can never double-submit a mutation (token grants, item transfers, etc.).
//
// Backward compatible: existing callers using (url, opts, timeoutMs) keep their
// behavior and additionally gain transient-failure retries on GETs.

export interface RetryOpts {
  /** Number of RETRIES after the first attempt. Default: 2 for idempotent, 0 otherwise. */
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

// Status codes worth retrying: rate-limit + transient server/gateway errors.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function isIdempotent(opts: RequestInit): boolean {
  const m = (opts.method || "GET").toUpperCase();
  return (m === "GET" || m === "HEAD") && opts.body == null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// exponential backoff with full jitter, capped.
function backoff(base: number, max: number, attempt: number): number {
  const ceil = Math.min(max, base * 2 ** attempt);
  return Math.floor(Math.random() * ceil);
}

// Honor a server-provided Retry-After (seconds, or HTTP-date) when present.
function retryAfterMs(res: Response): number | null {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(h);
  return Number.isNaN(when) ? null : Math.max(0, when - Date.now());
}

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 8000,
  retryOpts: RetryOpts = {},
): Promise<Response> {
  const callerSignal = opts.signal ?? undefined;
  const retries = retryOpts.retries ?? (isIdempotent(opts) ? 2 : 0);
  const base = retryOpts.baseDelayMs ?? 300;
  const maxDelay = retryOpts.maxDelayMs ?? 4000;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // fresh timeout each attempt; combine with the caller signal so an
    // upstream-cancel still aborts the in-flight request.
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;
    try {
      const res = await fetch(url, { ...opts, signal });
      if (attempt < retries && RETRYABLE_STATUS.has(res.status)) {
        await sleep(retryAfterMs(res) ?? backoff(base, maxDelay, attempt));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      // a caller-initiated abort is intentional — never retry past it.
      if (callerSignal?.aborted) throw err;
      if (attempt < retries) {
        await sleep(backoff(base, maxDelay, attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
