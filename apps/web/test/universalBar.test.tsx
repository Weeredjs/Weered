// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";

// The bar at the top of every page and its one search (James 2026-11-06:
// "Just have that universal bar the same everywhere... Just search that taps
// into everything", then "I meant the home bar. But with the search. Keep the
// Hi <Username>").
const nav = vi.hoisted(() => ({ path: "/home", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.path,
  useRouter: () => ({ push: nav.push }),
}));
const weered = vi.hoisted(() => ({ value: {} as any, here: [] as any[] }));
vi.mock("../components/WeeredProvider", () => ({
  useWeered: () => weered.value,
  useRoomUsers: () => weered.here,
}));
const overlay = vi.hoisted(() => ({ openSheet: vi.fn() }));
vi.mock("../components/overlays/OverlayProvider", () => ({ useOverlay: () => overlay }));
const invites = vi.hoisted(() => ({ last: null as any }));
vi.mock("../components/InviteModal", () => ({
  default: (p: any) => {
    invites.last = p;
    return <div>invite modal</div>;
  },
}));
vi.mock("../components/guide/WeeredGuide", () => ({
  default: (p: any) => (p.open ? <div>the guide</div> : null),
}));
vi.mock("../components/BugReportButton", () => ({ FEEDBACK_EVENT: "weered:feedback" }));
vi.mock("../lib/shellDesign", () => ({ startDesign: vi.fn() }));

import UniversalBar from "../components/shell/UniversalBar";
import UniversalSearch, { goToFor } from "../components/search/UniversalSearch";

function answer(body: object) {
  const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, ...body })));
  vi.stubGlobal("fetch", f);
  return f;
}

beforeEach(() => {
  // jsdom has no scrolling; the list keeps the keys' pick in view with it.
  Element.prototype.scrollIntoView = vi.fn();
  nav.path = "/home";
  nav.push.mockClear();
  overlay.openSheet.mockClear();
  weered.value = { me: { id: "u1" } };
  weered.here = [];
  invites.last = null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the bar", () => {
  it("is Home's header: the time of day over Hey, you, and its two buttons", async () => {
    weered.value = { me: { id: "u1", name: "weered" } };
    nav.path = "/lobby/eve";
    const view = render(<UniversalBar />);
    expect(view.getByText("weered")).toBeTruthy();
    expect(view.container.querySelector(".weered-ubar-hey")?.textContent).toBe("Hey, weered");
    await waitFor(() =>
      expect(view.container.querySelector(".weered-ubar-hello")?.textContent).toMatch(
        /^(Good (morning|afternoon|evening)|Late night)$/,
      ),
    );
    expect(view.getByText("Desktop app").closest("a")?.getAttribute("href")).toBe("/desktop");
    // The search is in it, and no lobby's own buttons are.
    expect(view.getByRole("combobox")).toBeTruthy();
    expect(view.queryByLabelText("Report this lobby")).toBeNull();
    fireEvent.click(view.getByText("What can you do here?"));
    expect(view.getByText("the guide")).toBeTruthy();
  });

  it("says Hey, there until it knows who you are", () => {
    weered.value = {};
    const view = render(<UniversalBar />);
    expect(view.container.querySelector(".weered-ubar-hey")?.textContent).toBe("Hey, there");
  });

  it("invites a friend to Weered from the search", () => {
    const view = render(<UniversalBar />);
    fireEvent.focus(view.getByRole("combobox"));
    fireEvent.change(view.getByRole("combobox"), { target: { value: "invite" } });
    fireEvent.click(view.getByText("Invite a friend"));
    expect(invites.last).toMatchObject({ type: "PLATFORM" });
  });
});

describe("the search's own pages and actions", () => {
  it("offers five on an empty search, fewer to someone signed out", () => {
    expect(goToFor("").map((g) => g.id)).toEqual([
      "browse",
      "create",
      "change",
      "guide",
      "desktop",
    ]);
    expect(goToFor("", false).map((g) => g.id)).not.toContain("change");
  });

  it("finds them by name or by another word for them", () => {
    expect(goToFor("set")[0].id).toBe("settings");
    expect(goToFor("download")[0].id).toBe("desktop");
    expect(goToFor("what can")[0].id).toBe("guide");
    expect(goToFor("theme").map((g) => g.id)).toContain("look");
    expect(goToFor("settings", false)).toEqual([]);
  });
});

describe("the search", () => {
  it("finds lobbies, rooms, people, crews and posts in one go", async () => {
    const f = answer({
      lobbies: [{ id: "eve", name: "EVE Online", verified: true, members: 12 }],
      rooms: [{ id: "r1", name: "Night ops", lobby: { id: "eve", name: "EVE Online" } }],
      people: [{ id: "u2", name: "Nyx", usernameKey: "nyx" }],
      crews: [{ id: "c1", name: "Night Shift", tagKey: "NGHT", _count: { members: 7 } }],
      posts: [{ id: "p1", title: "Night raids", commentCount: 3 }],
    });
    const view = render(<UniversalSearch />);
    const box = view.getByRole("combobox");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "night" } });
    await waitFor(() => expect(view.getByText("Night Shift")).toBeTruthy());
    expect(String((f.mock.calls[0] as any[])[0])).toContain("/search?q=night");
    for (const label of ["Lobbies", "Rooms", "People", "Crews", "Posts"])
      expect(view.getByText(label)).toBeTruthy();
    expect(view.getByText("✓ Verified · 12 members")).toBeTruthy();
    expect(view.getByText("[NGHT] · 7 members")).toBeTruthy();
    expect(view.getByText("3 replies", { exact: false })).toBeTruthy();
  });

  it("puts the people in your room first", async () => {
    weered.value = { me: { id: "u1" }, activeRoomId: "r9" };
    weered.here = [{ id: "u7", name: "Nyxie" }];
    answer({ people: [{ id: "u2", name: "Nyx", usernameKey: "nyx" }] });
    const view = render(<UniversalSearch />);
    const box = view.getByRole("combobox");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "nyx" } });
    await waitFor(() => expect(view.getByText("Nyx")).toBeTruthy());
    const names = Array.from(document.querySelectorAll(".weered-find-name")).map(
      (n) => n.textContent,
    );
    expect(names.indexOf("Nyxie")).toBeLessThan(names.indexOf("Nyx"));
    expect(view.getByText("Here now")).toBeTruthy();
  });

  it("goes with the keys: down, then Enter", async () => {
    answer({
      lobbies: [
        { id: "eve", name: "EVE Online" },
        { id: "poe", name: "Path of Exile" },
      ],
    });
    const view = render(<UniversalSearch />);
    const box = view.getByRole("combobox");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "online" } });
    await waitFor(() => expect(view.getByText("Path of Exile")).toBeTruthy());
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(nav.push).toHaveBeenCalledWith("/lobby/poe");
  });

  it("opens a person's card, a crew by its tag and a post", async () => {
    answer({
      people: [{ id: "u2", name: "Nyx" }],
      crews: [{ id: "c1", name: "Night Shift", tagKey: "NGHT" }],
      posts: [{ id: "p1", title: "Nights" }],
    });
    const view = render(<UniversalSearch />);
    const box = view.getByRole("combobox");
    const find = async (text: string) => {
      fireEvent.focus(box);
      fireEvent.change(box, { target: { value: "ni" } });
      await waitFor(() => expect(view.getByText(text)).toBeTruthy());
      fireEvent.click(view.getByText(text));
    };
    await find("Nyx");
    expect(overlay.openSheet).toHaveBeenCalledWith("profile", { userId: "u2" });
    await find("Night Shift");
    expect(nav.push).toHaveBeenCalledWith("/crew/NGHT");
    await find("Nights");
    expect(nav.push).toHaveBeenCalledWith("/forum/p1");
  });

  it("opens the guide from the search too", async () => {
    nav.path = "/lobby/eve";
    const view = render(<UniversalBar />);
    const box = view.getByRole("combobox");
    fireEvent.focus(box);
    fireEvent.click(view.getByRole("option", { name: /What can you do here\?/ }));
    await waitFor(() => expect(view.getByText("the guide")).toBeTruthy());
  });

  it("says so when nothing matches", async () => {
    answer({});
    const view = render(<UniversalSearch />);
    const box = view.getByRole("combobox");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "zzqx" } });
    await waitFor(() =>
      expect(view.getByText("Nothing on Weered called “zzqx” yet.")).toBeTruthy(),
    );
  });

  it("closes on Escape", async () => {
    const view = render(<UniversalSearch />);
    const box = view.getByRole("combobox");
    fireEvent.focus(box);
    expect(view.getByText("Jump to")).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(box, { key: "Escape" });
    });
    expect(view.queryByText("Jump to")).toBeNull();
  });
});
