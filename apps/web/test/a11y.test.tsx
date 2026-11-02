// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { cleanup, render, fireEvent } from "@testing-library/react";
import { onActivate } from "../lib/a11y";

// A pop-up's backdrop closes on Enter or Space (lib/a11y.ts) and holds the
// pop-up's whole form, so a key typed into one of its fields reaches it too.
// Typing a space in a title must not close the pop-up (2026-11-01).
describe("onActivate", () => {
  afterEach(cleanup);

  function popup() {
    const close = vi.fn();
    const view = render(
      <div data-testid="backdrop" tabIndex={0} role="button" onKeyDown={onActivate(close)}>
        <input aria-label="Title" />
      </div>,
    );
    return { close, view };
  }

  it("fires on Enter or Space pressed on the element itself", () => {
    const { close, view } = popup();
    fireEvent.keyDown(view.getByTestId("backdrop"), { key: "Enter" });
    fireEvent.keyDown(view.getByTestId("backdrop"), { key: " " });
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("ignores keys typed into a field inside it, and lets the field have them", () => {
    const { close, view } = popup();
    const field = view.getByLabelText("Title");
    const space = fireEvent.keyDown(field, { key: " " });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(close).not.toHaveBeenCalled();
    // fireEvent returns false when something called preventDefault.
    expect(space).toBe(true);
  });
});
