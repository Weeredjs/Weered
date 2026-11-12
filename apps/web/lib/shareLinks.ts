// Where a link can be sent from the page (James 2026-11-12: "What about share?
// Share it to facebook or whatsapp instead of just the link?"). Each target is
// that service's own public share address: nothing is sent anywhere until the
// person presses send in WhatsApp, Facebook, their messages or their mail.

export type ShareTarget = "whatsapp" | "facebook" | "sms" | "email";

/** Only our own pages are shared from here. */
export function shareable(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" && (u.hostname === "weered.ca" || u.hostname.endsWith(".weered.ca"))
    );
  } catch {
    return false;
  }
}

export function shareHref(target: ShareTarget, url: string, text: string): string {
  const both = `${text} ${url}`.trim();
  switch (target) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(both)}`;
    case "facebook":
      // Facebook takes the link alone and reads the page's own card for the rest.
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    case "sms":
      // "?&body=" is the form both iOS and Android accept.
      return `sms:?&body=${encodeURIComponent(both)}`;
    case "email":
      return `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(both)}`;
  }
}

/** What goes with the link. A guest link says they need no account. */
export function shareText(lobbyName: string, guest: boolean): string {
  const name = lobbyName.trim() || "my lobby";
  return guest
    ? `Come into ${name} on Weered. No account needed, just your name:`
    : `Come into ${name} on Weered:`;
}
