import { z } from "zod";

// Lists in a request, checked in one step.
//
// z.array() checks every element and keeps an issue for each one that's wrong,
// with no limit, and the API's error reply carried them all. A megabyte of
// [1,1,1,...] sent to POST /groups made 480,000 issues: 0.4 s of the API's one
// thread, a few hundred megabytes of memory, and a 66 MB reply. The schema is
// checked before the handler asks who's calling, so it needed no sign-in.
// (GHSA-mrhx-c7xc-m3w5; reproduced here in the hardening pass of 2026-11-12.
// The fix upstream is zod 4.6.6, a major version away.)
//
// So no schema in the API uses z.array(): test/unit/zodSafe.test.ts fails the
// build if one appears. A list goes through here and is refused once, whole.

/** A list of strings, at most `max` long. */
export const shortStringList = (max: number) =>
  z.custom<string[]>(
    (v) => Array.isArray(v) && v.length <= max && v.every((x) => typeof x === "string"),
    { message: `Expected a list of at most ${max} text values` },
  );

/** What a validation error says back, held to a length a person would read. */
export function shortMessage(message: unknown, max = 300): string {
  const s = String(message || "Invalid request");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
