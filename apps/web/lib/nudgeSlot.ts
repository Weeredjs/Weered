// One nudge on screen at a time. "Stay in the loop" (PushPrompt) and "Keep
// Weered close" (InstallPrompt) used to stack at the bottom middle of every
// page, over the chat box (James's walkthrough 2026-11-09). The first to claim
// the slot in a tab keeps it for that visit; the other waits for a later one.
const KEY = "weered:nudge";

export function claimNudge(who: string): boolean {
  try {
    const held = sessionStorage.getItem(KEY);
    if (held && held !== who) return false;
    sessionStorage.setItem(KEY, who);
    return true;
  } catch {
    return true;
  }
}

/** Desktop: under the top bar on the right, clear of every chat box. Phones
 *  keep the bottom, above the tab bar. */
export const NUDGE_DESKTOP_CSS = `
@media (min-width: 768px) {
  .weered-nudge {
    top: 76px !important;
    bottom: auto !important;
    left: auto !important;
    right: 76px !important;
    transform: none !important;
    animation-name: weeredNudgeIn !important;
  }
}
@keyframes weeredNudgeIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
`;
