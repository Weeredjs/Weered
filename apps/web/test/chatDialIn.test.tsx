// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { dialedInHere, setDialedIn } from "../lib/chatDialIn";

// Dial In belongs to the room or lobby it was dialed in on (2026-11-01: dialing
// in on the Dev room opened Home's lobby chat fullscreen, and it stayed).
vi.mock("../components/WeeredProvider", () => ({ useWeered: () => ({}) }));
vi.mock("../components/LobbyChatPanel", () => ({ default: () => <div>chat</div> }));
import LobbyChatDrawer from "../components/LobbyChatDrawer";

const full = () => !!document.querySelector(".lobby-chat-drawer.weered-chat-fullscreen");

describe("Dial In", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("is remembered for one room or lobby, not every chat", () => {
    setDialedIn("dev", true);
    expect(dialedInHere("dev")).toBe(true);
    expect(dialedInHere("lobby")).toBe(false);
    // Another chat can't drop it; its own can.
    setDialedIn("lobby", false);
    expect(dialedInHere("dev")).toBe(true);
    setDialedIn("dev", false);
    expect(dialedInHere("dev")).toBe(false);
    // The old one-switch-for-everything value means nothing now.
    localStorage.setItem("weered_chat_fullscreen", "1");
    expect(dialedInHere("lobby")).toBe(false);
  });

  it("opens Home's lobby chat normally after dialing in on a room", () => {
    setDialedIn("dev", true);
    render(<LobbyChatDrawer roomId="room:lobby" defaultOpen />);
    expect(full()).toBe(false);
  });

  it("answers only its own lobby's Dial In, and collapses on leaving", () => {
    const view = render(<LobbyChatDrawer roomId="acme" defaultOpen={false} />);
    act(() => {
      window.dispatchEvent(new CustomEvent("weered:chat:dialin", { detail: { roomId: "other" } }));
    });
    expect(full()).toBe(false);
    act(() => {
      window.dispatchEvent(new CustomEvent("weered:chat:dialin", { detail: { roomId: "acme" } }));
    });
    expect(full()).toBe(true);
    expect(dialedInHere("acme")).toBe(true);
    // Moving to another lobby collapses it.
    view.rerender(<LobbyChatDrawer roomId="beta" defaultOpen={false} />);
    expect(full()).toBe(false);
    expect(dialedInHere("acme")).toBe(false);
  });

  it("forgets it when the chat goes away", () => {
    setDialedIn("acme", true);
    const view = render(<LobbyChatDrawer roomId="acme" defaultOpen />);
    expect(full()).toBe(true);
    view.unmount();
    expect(dialedInHere("acme")).toBe(false);
  });
});
