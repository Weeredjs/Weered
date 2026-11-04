// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import NewsStage from "../components/NewsStage";

// A lobby's news (James 2026-11-04): one story at a time with its picture or
// trailer, cycling, beside the headlines; a headline features its story.
const stories = [
  {
    title: "Crimson Harvest Intensifies",
    url: "https://store.steampowered.com/news/1",
    date: "2026-10-27T10:00:00.000Z",
    source: "Official",
    snippet: "The harvest grows.",
    image: "https://clan.akamai.steamstatic.com/images/1.jpg",
    video: "abcDEF12345",
    official: true,
  },
  {
    title: "EVE Online gets a new expansion",
    url: "https://www.ign.com/articles/eve",
    date: "2026-10-26T10:00:00.000Z",
    source: "IGN",
    snippet: "New space.",
    image: "https://assets.ign.com/eve.jpg",
  },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ json: async () => ({ ok: true, items: stories }) })),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const headline = () => document.querySelector(".weered-news-words h3")?.textContent;

describe("the news stage", () => {
  it("shows a story, cycles to the next, and a headline brings one back", async () => {
    render(<NewsStage game="eve" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(headline()).toBe("Crimson Harvest Intensifies");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(headline()).toBe("EVE Online gets a new expansion");
    // On the second story, the first is only in the headlines.
    fireEvent.click(screen.getByText("Crimson Harvest Intensifies").closest("button")!);
    expect(headline()).toBe("Crimson Harvest Intensifies");
  });

  it("holds still while a trailer plays", async () => {
    render(<NewsStage game="eve" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByLabelText(/Play the video/));
    expect(document.querySelector("iframe")?.getAttribute("src")).toContain(
      "youtube-nocookie.com/embed/abcDEF12345",
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(headline()).toBe("Crimson Harvest Intensifies");
  });

  it("lists the module's own headlines beside the stories, opening ones it doesn't feature", async () => {
    render(
      <NewsStage
        game="eve"
        listTitle="Across the web"
        list={[
          { title: "A press piece", url: "https://example.com/p", date: "", source: "PC Gamer" },
        ]}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const row = screen.getByText("A press piece").closest("a");
    expect(row?.getAttribute("href")).toBe("https://example.com/p");
    expect(row?.getAttribute("target")).toBe("_blank");
  });
});
