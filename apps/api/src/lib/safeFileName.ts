/**
 * The name of a stored file, as asked for in an address: letters, digits, dot,
 * dash and underscore, 120 characters at most, and never dots alone. With
 * everything else stripped a name can't leave its folder, but ".." still named
 * the folder above, which the routes then tried to read as a file and answered
 * with a server error (hardening pass, 2026-11-13). Empty means "not a name".
 */
export function safeFileName(v: unknown): string {
  const name = String(v ?? "")
    .replaceAll(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 120);
  return /^\.*$/.test(name) ? "" : name;
}
