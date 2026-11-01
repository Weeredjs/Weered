// Spoilers in chat (2026-11-01, for GTA VI's story launch): ||like this|| is
// blurred until tapped (web components/chat/messageRender.tsx). Anything that
// shows a message outside the chat, a notification or a push, shows the spoiler
// as [spoiler] instead, or the preview would give it away.
const SPOILER_RE = /\|\|[^|\n]+?\|\|/g;

/** A message's text for a preview, its spoilers hidden. */
export function hideSpoilers(text: string): string {
  return String(text || "").replace(SPOILER_RE, "[spoiler]");
}
