// A member's first paint after a full page load (James 2026-11-10: "GUEST" on
// signing in and on changing lobbies, "fairly often").
//
// The server can't read localStorage, so every page it sends is the signed-out
// shell: "Guest" on the card, "Hey, there", "No users". That stood until the
// scripts loaded and the provider signed the member in: 2 s on a warm cache,
// ~10 s straight after a deploy.
//
// app/layout.tsx's pre-paint script marks <html data-weered-booting> on a device
// with a saved user and puts its name in --weered-boot-name and
// --weered-boot-initial. styles/44-boot.css then hides the signed-out words
// (data-boot-text, data-boot-hide) and shows the saved name (data-boot-alt).
// WeeredProvider ends it the moment it signs the member in; the pre-paint
// script ends it after 15 s regardless, so a page that never loads its scripts
// still shows everything.
export const BOOT_ATTR = "data-weered-booting";

export function endBoot(): void {
  try {
    document.documentElement.removeAttribute(BOOT_ATTR);
  } catch {}
}
