// "Dial In": a room's or lobby's chat takes the whole stage. It belongs to the
// place it was dialed in on (James 2026-11-01: "the chat should collapse from
// full screen when you navigate away from the room or lobby you have it dialed
// in on"). It used to be one switch for every chat, so dialing in on one room
// opened Home's lobby chat fullscreen too, and in the desktop app its Collapse
// sat under the title bar. A reload keeps it; leaving drops it.
const KEY = "weered_chat_fullscreen";

/** Was the chat dialed in on this room or lobby? */
export function dialedInHere(id: string): boolean {
  try {
    return !!id && localStorage.getItem(KEY) === id;
  } catch {
    return false;
  }
}

/** Dial in on this room or lobby, or drop it (only if it is this one's). */
export function setDialedIn(id: string, on: boolean): void {
  try {
    if (on && id) localStorage.setItem(KEY, id);
    else if (localStorage.getItem(KEY) === id) localStorage.removeItem(KEY);
  } catch {}
}
