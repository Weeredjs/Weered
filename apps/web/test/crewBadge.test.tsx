// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import CrewBadge, { crewBadgeStyle } from "../components/crew/CrewBadge";
import { CrewFlair } from "../components/chat/flair";

// The crew badge (James 2026-11-08: "The crew badge should be a small decorative
// rectangle"): the tag on a plate in the crew's colour and chosen corners,
// the same everywhere a crew's tag is shown.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("crew badge", () => {
  it("keeps the corners the crew picked", () => {
    expect(crewBadgeStyle({ tagShape: "square" }, 13).borderRadius).toBe(0);
    expect(crewBadgeStyle({ tagShape: "pill" }, 13).borderRadius).toBe(13);
    for (const shape of ["rounded", null, "hexagon"]) {
      const r = crewBadgeStyle({ tagShape: shape }, 13).borderRadius as number;
      expect(r).toBeGreaterThanOrEqual(2);
      expect(r).toBeLessThan(13 / 2);
    }
  });

  it("is a rectangle at any size: wider than tall, letters inside it", () => {
    for (const size of [10, 11, 13, 20, 28]) {
      const s = crewBadgeStyle({ tag: "8MTR" }, size);
      expect(s.height).toBe(size);
      expect(s.minWidth as number).toBeGreaterThan(size);
      expect(s.fontSize as number).toBeLessThanOrEqual(Math.max(8, size));
    }
  });

  it("wears the crew's colour, with letters that read on it", () => {
    expect(crewBadgeStyle({ accentColor: "#ff4f9a" }, 13).background).toContain("#ff4f9a");
    expect(crewBadgeStyle({ accentColor: "#111827" }, 13).color).toBe("#fff");
    expect(crewBadgeStyle({ accentColor: "#fde68a" }, 13).color).not.toBe("#fff");
    // No colour, or a broken one: the crew editor's default.
    for (const bad of [null, "", "pink", "#fff", "url(x)"])
      expect(crewBadgeStyle({ accentColor: bad }, 13).background).toContain("#7c3aed");
  });

  it("shows the tag and names the crew on hover", () => {
    render(<CrewBadge crew={{ tag: " 8mtr ", name: "The 8 Meter", tagShape: "square" }} />);
    const b = screen.getByText("8MTR");
    expect(b.getAttribute("title")).toBe("Crew: The 8 Meter [8MTR]");
    expect(b.style.borderRadius).toBe("0px");
    // The values styles/56-looks.css keeps where a theme strips fills and corners.
    expect(b.style.getPropertyValue("--cb-radius")).toBe("0px");
    for (const v of ["--cb-bg", "--cb-edge", "--cb-shadow", "--cb-ink"])
      expect(b.style.getPropertyValue(v)).not.toBe("");
  });

  it("is kept by the stylesheet wherever a theme strips its surroundings", () => {
    const css = readFileSync(join(__dirname, "../app/styles/56-looks.css"), "utf8");
    const rule = css.match(/html:not\(#look-a\):not\(#look-b\) \.weered-crew-badge \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    for (const [prop, v] of [
      ["background", "--cb-bg"],
      ["border", "--cb-edge"],
      ["border-radius", "--cb-radius"],
      ["box-shadow", "--cb-shadow"],
      ["color", "--cb-ink"],
    ])
      expect(rule![1]).toMatch(new RegExp(`\\b${prop}: [^;]*var\\(${v}\\) !important`));
  });

  it("is still a plate when the crew has no tag", () => {
    const { container } = render(<CrewBadge crew={{ name: "q" }} />);
    const b = container.querySelector(".weered-crew-badge") as HTMLElement;
    expect(b.textContent).toBe("");
    expect(b.getAttribute("title")).toBe("Crew: q");
  });
});

describe("the crew badge in chat", () => {
  it("is the plate, never the crew's logo squeezed into a square", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          primaryCrew: {
            id: "c1",
            name: "The 8 Meter",
            tag: "8MTR",
            logoUrl: "https://api.weered.ca/banners/crew-logo.webp",
            accentColor: "#ff4f9a",
            tagShape: "square",
          },
        }),
      })),
    );
    const { container } = render(<CrewFlair userId="crew-badge-test-user" size={13} />);
    const b = await screen.findByText("8MTR");
    expect(b.className).toBe("weered-crew-badge");
    expect(b.style.height).toBe("13px");
    expect(container.innerHTML).not.toContain("crew-logo.webp");
  });
});

// Every place that shows a crew's tag beside a name draws it with CrewBadge.
// Brackets around a tag are left only where the tag is words: the badge's own
// tooltip, a search result's line, the rap sheet's typed record, sentences (the
// Windrose log, "[TAG] is free"), a tooltip, the share picture and the page
// titles. A new one fails here.
describe("one crew badge", () => {
  const WEB = join(__dirname, "..");
  const TEXT_ONLY: Record<string, number> = {
    "components/crew/CrewBadge.tsx": 1,
    "components/dock/CrewTab.tsx": 1,
    "components/search/UniversalSearch.tsx": 1,
    "components/rap/RapSheetCard.tsx": 1,
    "components/WrFlagship.tsx": 1,
    "components/UserHoverCard.tsx": 1,
    "app/og/rap/[name]/route.tsx": 1,
    "app/rap/[name]/page.tsx": 1,
    "app/crew/[crewId]/page.tsx": 1,
  };
  const BRACKETED_TAG = /\[(?:\{|\$\{)[^}\n]*[tT]ag\w*[^}\n]*\}\]/g;

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sources(path);
      return /\.tsx?$/.test(name) ? [path] : [];
    });
  }

  it("no screen draws a crew tag its own way", () => {
    const found: Record<string, number> = {};
    for (const file of ["components", "app", "lib"].flatMap((d) => sources(join(WEB, d)))) {
      const n = (readFileSync(file, "utf8").match(BRACKETED_TAG) || []).length;
      if (n) found[relative(WEB, file).replace(/\\/g, "/")] = n;
    }
    expect(found).toEqual(TEXT_ONLY);
  });
});
