// The lobby host's face in chat (lib/lobbyHost.ts): its emoji on a round tile,
// as an SVG data URL, so chat's avatar circle shows it like anyone's picture.
// No imports: lib/lobbyPost.ts and lib/roomState.ts (which rebuilds the host's
// messages on reload) both use it.

export function hostAvatar(emoji: string): string | undefined {
  const face = Array.from(String(emoji || "").replace(/[<>&"']/g, ""))
    .slice(0, 2)
    .join("");
  if (!face) return undefined;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>` +
    `<rect width='64' height='64' rx='32' fill='#2b1d4f'/>` +
    `<text x='32' y='43' font-size='32' text-anchor='middle'>${face}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
