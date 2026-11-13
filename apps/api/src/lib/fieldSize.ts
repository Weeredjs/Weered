// A size limit for each field a route stores.
//
// Routes written before this stored whatever they were sent: an event's
// description or a challenge's objectives could be a megabyte, and whoever
// made a free lobby could make as many as they liked (hardening pass
// 2026-11-13). The limits here are sized from what the live rows hold, with
// room to spare, and anything over is refused with the reason. Nothing is cut.

/** A refusal: `error` for the client's code, `message` for the person. */
export type SizeProblem = { error: "too_long"; field: string; message: string };

const count = (n: number) => n.toLocaleString("en-CA");

/**
 * The first field in `body` that is over its limit, if any. A text field is
 * measured in characters; a list or an object by its size as JSON. A field
 * that wasn't sent is skipped, so the same limits serve a create and an edit.
 */
export function sizeProblem(
  body: Record<string, unknown> | null | undefined,
  limits: Readonly<Record<string, number>>,
): SizeProblem | null {
  if (!body || typeof body !== "object") return null;
  for (const [field, max] of Object.entries(limits)) {
    const v = body[field];
    if (v == null) continue;
    let size: number;
    if (typeof v === "string") size = v.length;
    else {
      try {
        size = JSON.stringify(v)?.length ?? 0;
      } catch {
        size = Number.POSITIVE_INFINITY; // not something that can be stored
      }
    }
    if (size > max)
      return {
        error: "too_long",
        field,
        message: Number.isFinite(size)
          ? `"${field}" can be ${count(max)} characters at most. This is ${count(size)}.`
          : `"${field}" can't be saved as sent.`,
      };
  }
  return null;
}

/** Is this something `new Date()` reads as a real moment? */
export function isRealDate(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (typeof v !== "string" && typeof v !== "number" && !(v instanceof Date)) return false;
  if (typeof v === "string" && v.length > 64) return false;
  return !Number.isNaN(new Date(v as string | number | Date).getTime());
}
