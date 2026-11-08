// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import {
  ForumViewToggle,
  PostCardPreview,
  PostThumb,
  useForumView,
} from "../components/forum/PostPreview";

// The forum list's cards (James 2026-11-08: the forum with expanded
// "Thumbnail and previews", as Reddit's card view).
const PIC = "https://api.weered.ca/forum-img/cmmgisqb-1794170998957-b816d816b5cb3d40.webp";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("a post's card", () => {
  it("shows its opening words, then its picture large", () => {
    const { container } = render(
      <PostCardPreview preview="The streets got a remodel." image={PIC} />,
    );
    expect(container.querySelector(".weered-forum-excerpt")?.textContent).toBe(
      "The streets got a remodel.",
    );
    const img = container.querySelector(".weered-forum-media img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(PIC);
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("shows words alone when there's no picture, and nothing when there's neither", () => {
    const words = render(<PostCardPreview preview="Just words." image={null} />);
    expect(words.container.querySelector("img")).toBeNull();
    expect(words.container.textContent).toBe("Just words.");
    cleanup();
    expect(render(<PostCardPreview preview="" image={null} />).container.innerHTML).toBe("");
  });

  it("puts only a picture beside a compact row", () => {
    expect(render(<PostThumb image={null} />).container.innerHTML).toBe("");
    cleanup();
    const { container } = render(<PostThumb image={PIC} />);
    expect(container.querySelector("img.weered-forum-thumb")?.getAttribute("src")).toBe(PIC);
  });
});

function Board() {
  const [view, setView] = useForumView();
  return (
    <>
      <ForumViewToggle view={view} onChange={setView} />
      <output>{view}</output>
    </>
  );
}

describe("Cards or Compact", () => {
  it("starts on Cards, and this device keeps Compact once it's picked", () => {
    const first = render(<Board />);
    expect(first.container.querySelector("output")?.textContent).toBe("cards");
    const compact = first.getByTitle("Compact: titles");
    act(() => {
      fireEvent.click(compact);
    });
    expect(compact.getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem("weered:forum-view")).toBe("compact");
    cleanup();
    expect(render(<Board />).container.querySelector("output")?.textContent).toBe("compact");
  });
});
