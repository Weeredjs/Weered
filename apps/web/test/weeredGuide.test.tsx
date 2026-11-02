// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect, vi } from "vitest";
import React from "react";
import { cleanup, render, fireEvent } from "@testing-library/react";
import WeeredGuide from "../components/guide/WeeredGuide";

// The guide closes on a click on its backdrop and on Escape, never on a click
// inside it (2026-11-01: the panel's own click handler went, the backdrop now
// checks where the click landed).
describe("WeeredGuide", () => {
  // jsdom has no scrolling; the guide scrolls a chapter to its top.
  beforeAll(() => {
    Element.prototype.scrollTo = () => {};
  });
  afterEach(cleanup);

  function guide() {
    const onClose = vi.fn();
    const outside = vi.fn();
    render(
      <div onClick={outside}>
        <WeeredGuide
          open
          onClose={onClose}
          actions={{ look: () => {}, build: () => {}, href: () => {} }}
        />
      </div>,
    );
    const overlay = document.querySelector(".wg-overlay") as HTMLElement;
    const panel = document.querySelector(".wg") as HTMLElement;
    return { onClose, outside, overlay, panel };
  }

  it("stays open for clicks inside, and they go no further", () => {
    const { onClose, outside, panel } = guide();
    fireEvent.click(panel);
    fireEvent.click(panel.querySelectorAll(".wg-nav-btn")[1] as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
    expect(outside).not.toHaveBeenCalled();
  });

  it("closes on a backdrop click and on Escape", () => {
    const { onClose, overlay } = guide();
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
