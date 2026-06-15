// Wrap fetch with a default timeout so a hung upstream can't block a handler
// indefinitely (Node's fetch has no default timeout). Preserves a caller-supplied
// signal if one is passed.
export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const signal = (opts as any).signal ?? AbortSignal.timeout(timeoutMs);
  return fetch(url, { ...opts, signal });
}
