"use client";
import { useCallback, useEffect, useRef } from "react";

/**
 * Keeps a scrolling message list pinned to the newest message.
 *
 * The bug this replaces: every chat panel scrolled to `el.scrollHeight` inside a
 * single requestAnimationFrame. That measures the list ONE frame after render —
 * before avatars, link cards and embeds have loaded. Those elements have no
 * intrinsic height until their content arrives, so at measurement time the list
 * is genuinely shorter than it is about to be. The scroll lands on that stale
 * bottom, the images then resolve and push the content down, and the view is
 * left sitting slightly short of the newest message. Quiet chats hide it; a busy
 * one makes it obvious.
 *
 * So instead of measuring once, this re-pins for a short settling window and
 * again whenever a descendant finishes loading.
 *
 * The other half is knowing when NOT to scroll. The old code scrolled on every
 * message-count change unconditionally, which yanks a reader out of the history
 * they were scrolled up reading the moment anyone says anything. Here, a reader
 * who has scrolled away is left alone until they come back to the bottom.
 */

/** How close to the bottom still counts as "at the bottom". A couple of lines:
 *  small enough that being genuinely scrolled up is respected, large enough to
 *  survive sub-pixel rounding and a partially visible last row. */
export const AT_BOTTOM_SLOP = 48;

/**
 * Whether a scroll position counts as "at the bottom".
 *
 * Pulled out as a pure function because it is the one piece here with a real
 * off-by-one risk, and because getting it wrong is invisible in one direction:
 * too tight and the list silently stops following new messages; too loose and
 * it drags a reader out of the history they are reading.
 */
export function isAtBottom(scrollTop: number, clientHeight: number, scrollHeight: number): boolean {
  // A list shorter than its viewport does not scroll at all — it is always at
  // the bottom, and the arithmetic below would otherwise go negative.
  if (scrollHeight <= clientHeight) return true;
  return scrollTop + clientHeight >= scrollHeight - AT_BOTTOM_SLOP;
}

/** How long to keep re-pinning after a jump. Covers avatars and link cards on a
 *  normal connection; the load listener catches anything slower. */
const SETTLE_MS = 700;

export function useStickToBottom(
  ref: React.RefObject<HTMLElement | null>,
  /** Changing this is a CONTEXT switch (different room/thread): jump instantly. */
  resetKey: unknown,
  /** Changing this is NEW CONTENT in the same context: follow only if pinned. */
  growKey: unknown,
) {
  const pinned = useRef(true);
  const settleUntil = useRef(0);
  const rafId = useRef<number | null>(null);

  const jump = useCallback(
    (smooth: boolean) => {
      const el = ref.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    },
    [ref],
  );

  /** Re-pin every frame until the settle window expires. Cheap: it is a handful
   *  of frames, and it stops early the moment the reader scrolls away. */
  const startSettling = useCallback(
    (smooth: boolean) => {
      settleUntil.current = Date.now() + SETTLE_MS;
      if (rafId.current != null) return; // a loop is already running
      const step = () => {
        rafId.current = null;
        if (!pinned.current || Date.now() > settleUntil.current) return;
        jump(false); // always instant while settling — a smooth animation would
        // chase a target that is still moving, and land short again
        rafId.current = requestAnimationFrame(step);
      };
      jump(smooth);
      rafId.current = requestAnimationFrame(step);
    },
    [jump],
  );

  // Track whether the reader is at the bottom. This is what makes it safe to
  // follow new messages without stealing scroll from someone reading history.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      pinned.current = isAtBottom(el.scrollTop, el.clientHeight, el.scrollHeight);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [ref]);

  // Late-loading media. `load` does not bubble, but it does capture — so one
  // listener on the container catches every img/iframe/video inside it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onLoad = () => {
      if (pinned.current) jump(false);
    };
    el.addEventListener("load", onLoad, true);
    return () => el.removeEventListener("load", onLoad, true);
  }, [ref, jump]);

  // Context switch: we are always pinned on arrival, and the jump is instant —
  // smooth-scrolling a fresh room is both slow and visibly wrong.
  useEffect(() => {
    pinned.current = true;
    startSettling(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // New content in the same room: follow it only if the reader is at the bottom.
  useEffect(() => {
    if (!pinned.current) return;
    startSettling(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [growKey]);

  useEffect(
    () => () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    },
    [],
  );

  return { jumpToBottom: () => startSettling(true), isPinned: () => pinned.current };
}
