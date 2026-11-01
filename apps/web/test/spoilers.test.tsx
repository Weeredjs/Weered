// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { renderInline } from "../components/chat/messageRender";

// ||like this|| in chat: hidden until tapped, and nothing inside it unfolds into
// a link preview or an image that would give it away (2026-11-01).
function draw(text: string) {
  const images: string[] = [];
  const links: string[] = [];
  const embeds: any[] = [];
  const view = render(<div>{renderInline(text, images, links, embeds)}</div>);
  return { view, images, links, embeds };
}

describe("chat spoilers", () => {
  it("hides a spoiler until it's tapped, and keeps the words around it", () => {
    const { view } = draw("the ending ||Lucia makes it|| wow");
    const hidden = view.getByRole("button", { name: "Spoiler. Tap to show." });
    expect(view.container.textContent).toContain("the ending");
    expect(view.container.textContent).toContain("wow");
    fireEvent.click(hidden);
    expect(view.queryByRole("button", { name: "Spoiler. Tap to show." })).toBeNull();
    expect(view.getByText("Lucia makes it")).toBeTruthy();
  });

  it("never turns a link inside a spoiler into a preview or an image", () => {
    const { links, images } = draw("||https://example.com/ending.png|| and https://weered.ca");
    expect(images).toEqual([]);
    expect(links).toEqual(["https://weered.ca"]);
  });
});
