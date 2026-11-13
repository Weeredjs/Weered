import vm from "node:vm";

/**
 * Tests text against a pattern a member wrote, with a time limit.
 *
 * JavaScript's own pattern matching has none. Some patterns take a time that
 * doubles with every extra character of the text they are tried on, and this
 * process has one thread: while it works on a pattern, nothing else on the API
 * or the chat socket is answered. A pattern written by a member (a forum
 * auto-moderation rule, a challenge's filter) must therefore never run bare.
 * Here it runs inside a script with a deadline; the engine stops it there.
 *
 * `timedOut` means the pattern is unusable: the caller should turn its rule off.
 */
export type TimedMatch = { matched: boolean; timedOut: boolean; invalid: boolean };

/** Flags a member's pattern may carry: case, multi-line, dot-all, unicode. */
export const MEMBER_FLAGS = /^[imsu]{0,4}$/;

/** The longest text a member's pattern is tried on. */
export const MEMBER_PATTERN_TEXT_MAX = 20_000;

// One context for the life of the process: making one costs about a
// millisecond, running a script in one a few microseconds.
const box: { re: RegExp | null; text: string } = { re: null, text: "" };
const context = vm.createContext(box);
const script = new vm.Script("re.test(text)");

export function testWithin(pattern: string, flags: string, text: string, ms = 100): TimedMatch {
  let re: RegExp;
  try {
    re = new RegExp(pattern, MEMBER_FLAGS.test(flags) ? flags : "i");
  } catch {
    return { matched: false, timedOut: false, invalid: true };
  }
  box.re = re;
  box.text = String(text ?? "").slice(0, MEMBER_PATTERN_TEXT_MAX);
  try {
    return {
      matched: script.runInContext(context, { timeout: ms }) === true,
      timedOut: false,
      invalid: false,
    };
  } catch (e: any) {
    if (e?.code === "ERR_SCRIPT_EXECUTION_TIMEOUT")
      return { matched: false, timedOut: true, invalid: false };
    return { matched: false, timedOut: false, invalid: true };
  } finally {
    box.re = null;
    box.text = "";
  }
}
