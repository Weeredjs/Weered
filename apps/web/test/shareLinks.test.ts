import { describe, expect, it } from "vitest";
import { shareHref, shareText } from "../lib/shareLinks";
import { inviteCard, nameSize } from "../lib/shareCards";
import { guestLobbyId } from "../lib/guestSession";

// Sharing a lobby beyond the clipboard (James 2026-11-12: "Share it to
// facebook or whatsapp instead of just the link?").
const LINK = "https://weered.ca/invite/abc123";

describe("share links", () => {
  it("builds each service's own share address", () => {
    const text = shareText("Nyan Sakura Lounge", true);
    expect(text).toBe("Come into Nyan Sakura Lounge on Weered. No account needed, just your name:");
    expect(shareHref("whatsapp", LINK, text)).toBe(
      "https://wa.me/?text=" + encodeURIComponent(`${text} ${LINK}`),
    );
    // Facebook takes the link alone and reads the page's card.
    expect(shareHref("facebook", LINK, text)).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(LINK),
    );
    expect(shareHref("sms", LINK, text)).toBe(
      "sms:?&body=" + encodeURIComponent(`${text} ${LINK}`),
    );
    expect(shareHref("email", LINK, text)).toContain("mailto:?subject=" + encodeURIComponent(text));
  });

  it("says a lasting link plainly, and never leaves a name blank", () => {
    expect(shareText("The Wheel House", false)).toBe("Come into The Wheel House on Weered:");
    expect(shareText("  ", false)).toBe("Come into my lobby on Weered:");
  });
});

describe("what a shared link unfolds into", () => {
  it("names the inviter and the lobby, and that a guest needs no account", () => {
    expect(
      inviteCard({
        type: "GUEST",
        targetId: "nyan",
        targetName: "Nyan Sakura Lounge",
        creatorName: "kaede",
      }),
    ).toEqual({
      title: "Come into Nyan Sakura Lounge",
      description: "kaede invited you. Walk in with just a name: no account, no download.",
      lobbyId: "nyan",
    });
    expect(
      inviteCard({ type: "LOBBY", targetId: "chess", targetName: "Chess", creatorName: "unknown" }),
    ).toMatchObject({
      title: "Join Chess on Weered",
      description: "Voice, video and chat in the browser. No download.",
      lobbyId: "chess",
    });
  });

  it("stays generic for the office's links, a spent link and anything unknown", () => {
    const plain = { title: "You're invited · Weered", lobbyId: "" };
    expect(inviteCard(null)).toMatchObject(plain);
    expect(
      inviteCard({ type: "GUEST", targetId: "mtg-eceb", targetName: "mtg-eceb" }),
    ).toMatchObject(plain);
    expect(inviteCard({ type: "PLATFORM" })).toMatchObject(plain);
  });

  it("steps a long lobby name down so it fits the card", () => {
    expect(nameSize("Chess")).toBe(104);
    expect(nameSize("Nyan Sakura Lounge")).toBe(86);
    expect(nameSize("Medicine Hat Duplicate Bridge")).toBe(68);
    expect(nameSize("x".repeat(50))).toBe(54);
  });
});

describe("the lobby a guest is visiting", () => {
  it("reads it from the address", () => {
    expect(guestLobbyId("/lobby/nyan-sakura-lounge")).toBe("nyan-sakura-lounge");
    expect(guestLobbyId("/lobby/r%2Fall/admin")).toBe("r/all");
    expect(guestLobbyId("/home")).toBe("");
  });
});
