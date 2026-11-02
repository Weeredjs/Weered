// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import MyLookSync from "../components/MyLookSync";
import { hotStore } from "../components/WeeredProvider";

// Your colour changed: your messages already on screen wear it at once, and
// nobody else's change (2026-11-01: James's chat kept the colour he dropped).
describe("MyLookSync", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("recolours your messages on screen, and only yours", () => {
    localStorage.setItem("weered_user", JSON.stringify({ id: "me" }));
    hotStore.set("msgsByRoom", {
      lobby: [
        { id: "1", user: { id: "me", name: "me", avatarColor: "#14b8a6" }, body: "hi", ts: 1 },
        { id: "2", user: { id: "you", name: "you", avatarColor: "#22c55e" }, body: "yo", ts: 2 },
      ],
    } as any);
    render(<MyLookSync />);

    act(() => {
      window.dispatchEvent(new CustomEvent("weered:avatarColor", { detail: "" }));
    });
    const [mine, theirs] = (hotStore.state.msgsByRoom as any).lobby;
    expect(mine.user.avatarColor).toBeUndefined();
    expect(theirs.user.avatarColor).toBe("#22c55e");

    act(() => {
      window.dispatchEvent(new CustomEvent("weered:avatarColor", { detail: "#ec4899" }));
    });
    expect((hotStore.state.msgsByRoom as any).lobby[0].user.avatarColor).toBe("#ec4899");
  });
});
