// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { sizedImage } from "../lib/sizedImage";

// Home's carousel of every lobby (James 2026-11-06) and the pictures it loads.
vi.mock("next/link", () => ({
  default: React.forwardRef(({ children, ...p }: any, ref: any) => (
    <a ref={ref} {...p}>
      {children}
    </a>
  )),
}));
import LobbyCarousel, { type DriftLobby } from "../components/shell/LobbyCarousel";

const lobby = (id: string, extra: Partial<DriftLobby> = {}): DriftLobby => ({
  id,
  name: id.toUpperCase(),
  online: 0,
  members: 3,
  ...extra,
});

describe("sizedImage", () => {
  it("sends our uploads through the resizer and leaves the rest alone", () => {
    expect(sizedImage("https://api.weered.ca/banners/x.webp", 96)).toBe(
      "/_next/image?url=https%3A%2F%2Fapi.weered.ca%2Fbanners%2Fx.webp&w=96&q=75",
    );
    // Our /brand files load as they are, as do SVGs (the resizer refuses them).
    expect(sizedImage("/brand/lobbies/a.png")).toBe("/brand/lobbies/a.png");
    expect(sizedImage("https://weered.ca/brand/x.svg")).toBe("https://weered.ca/brand/x.svg");
    expect(sizedImage("https://images.unsplash.com/p.jpg")).toBe(
      "https://images.unsplash.com/p.jpg",
    );
    expect(sizedImage("not a url")).toBe("");
    expect(sizedImage(null)).toBe("");
  });
});

describe("LobbyCarousel", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function stubBrowser() {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});
  }

  const pics = { bannerUrl: "/b.png", logoUrl: "/l.png" };

  it("links every lobby, goes round more than once when short, and loads pictures as they near", () => {
    stubBrowser();
    const view = render(
      <LobbyCarousel
        lobbies={[
          lobby("gta6", { ...pics, online: 4 }),
          lobby("chess", pics),
          lobby("study", { ...pics, logoUrl: "https://x.example/l.png" }),
        ]}
      />,
    );
    const cards = view.container.querySelectorAll("a.weered-drift-card");
    // Three lobbies make a ring of at least 14 cards: 5 times round.
    expect(cards.length).toBe(15);
    expect(cards[0].getAttribute("href")).toBe("/lobby/gta6");
    // Only the first time round is in the tab order and read out.
    expect([...cards].filter((c) => c.getAttribute("tabindex") === "0")).toHaveLength(3);
    expect(cards[3].getAttribute("aria-hidden")).toBe("true");
    expect(view.getAllByText("4 online").length).toBeGreaterThan(0);
    // The middle card, painted once on mount, has its banner loading.
    const banner = cards[0].querySelector("img.weered-drift-banner") as HTMLImageElement;
    expect(banner.getAttribute("src")).toBe("/b.png");
  });

  it("shows only lobbies with a banner and a logo, and one joins when its pictures arrive", () => {
    // James 2026-11-11: "limit this just to the fully image spec'd ones". And
    // arriving at Home, the list can show the lobbies before their pictures
    // (James 2026-11-06).
    stubBrowser();
    const view = render(
      <LobbyCarousel
        lobbies={[
          lobby("gta6"),
          lobby("chess", { bannerUrl: "/b.png" }),
          lobby("news", { logoUrl: "/l.png" }),
        ]}
      />,
    );
    expect(view.container.querySelector(".weered-drift")).toBeNull();
    view.rerender(
      <LobbyCarousel lobbies={[lobby("gta6", pics), lobby("chess", { bannerUrl: "/b.png" })]} />,
    );
    const cards = view.container.querySelectorAll("a.weered-drift-card");
    expect([...cards].every((c) => c.getAttribute("href") === "/lobby/gta6")).toBe(true);
    const first = cards[0] as HTMLElement;
    expect(first.querySelector("img.weered-drift-banner")?.getAttribute("src")).toBe("/b.png");
    expect(first.querySelector("img.weered-drift-logo")?.getAttribute("src")).toBe("/l.png");
  });

  it("draws nothing without lobbies", () => {
    stubBrowser();
    const view = render(<LobbyCarousel lobbies={[]} />);
    expect(view.container.querySelector(".weered-drift")).toBeNull();
  });
});
