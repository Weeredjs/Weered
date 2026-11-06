// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";

// The bar at the top of every page and its one search (James 2026-11-06:
// "Just have that universal bar the same everywhere... Just search that taps
// into everything").
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
vi.mock("../components/SteamLobbyHeader", () => ({ default: () => null }));
vi.mock("../components/guide/WeeredGuide", () => ({
  default: (p: any) => (p.open ? <div>the guide</div> : null),
}));
vi.mock("../components/BugReportButton", () => ({ FEEDBACK_EVENT: "weered:feedback" }));
vi.mock("../lib/shellDesign", () => ({ startDesign: vi.fn() }));

import UniversalBar from "../components/shell/UniversalBar";
import UniversalSearch, { goToFor } from "../components/search/UniversalSearch";
import { placeForPath, useShellPlace, type ShellPlace } from "../lib/shellPlace";

function Page({ place }: { place: ShellPlace }) {
  useShellPlace(place);
  return null;
}

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

describe("where the bar says you are", () => {
  it("names a page from its address", () => {
    expect(placeForPath("/home")).toEqual({ kind: "home", title: "Home" });
    expect(placeForPath("/lobby/eve")).toMatchObject({ kind: "lobby", lobbyId: "eve" });
    expect(placeForPath("/lobby/create").title).toBe("Create a lobby");
    expect(placeForPath("/forum/abc").title).toBe("Forum");
    expect(placeForPath("/forum/bookmarks").title).toBe("Saved posts");
    expect(placeForPath("/somewhere-new").title).toBe("Weered");
  });

  it("shows the place a page names, and lets go when the page goes", () => {
    nav.path = "/lobby/eve";
    const view = render(
      <>
        <UniversalBar />
        <Page place={{ kind: "lobby", title: "EVE Online", lobbyId: "eve", verified: true }} />
      </>,
    );
    expect(view.getByText("EVE Online")).toBeTruthy();
    expect(view.getByText("VERIFIED")).toBeTruthy();
    expect(view.getByLabelText("Report this lobby")).toBeTruthy();
    view.rerender(<UniversalBar />);
    // From the address alone: the id.
    expect(view.getByText("eve")).toBeTruthy();
  });

  it("has nothing to report on Home and invites to Weered from there", () => {
    const view = render(<UniversalBar />);
    expect(view.getByText("Home")).toBeTruthy();
    expect(view.queryByLabelText("Report this lobby")).toBeNull();
    fireEvent.click(view.getByLabelText("Invite"));
    expect(invites.last).toMatchObject({ type: "PLATFORM" });
  });

  it("invites to the lobby in a lobby, and to the room in a room", () => {
    const view = render(
      <>
        <UniversalBar />
        <Page place={{ kind: "lobby", title: "EVE Online", lobbyId: "eve" }} />
      </>,
    );
    fireEvent.click(view.getByLabelText("Invite"));
    expect(invites.last).toMatchObject({
      type: "LOBBY",
      targetId: "eve",
      targetName: "EVE Online",
    });
    cleanup();
    const room = render(
      <>
        <UniversalBar />
        <Page
          place={{
            kind: "room",
            title: "EVE Online",
            href: "/lobby/eve",
            lobbyId: "eve",
            roomId: "r1",
            roomName: "Fleet ops",
          }}
        />
      </>,
    );
    // The way back to the lobby, and nothing to report in a room.
    expect(room.getByTitle("Back to EVE Online").getAttribute("href")).toBe("/lobby/eve");
    expect(room.queryByLabelText("Report this lobby")).toBeNull();
    fireEvent.click(room.getByLabelText("Invite"));
    expect(invites.last).toMatchObject({ type: "ROOM", targetId: "r1", targetName: "Fleet ops" });
  });

  it("treats The Lobby as Weered's own: an invite to Weered, nothing to report", () => {
    const view = render(
      <>
        <UniversalBar />
        <Page place={{ kind: "lobby", title: "The Lobby", lobbyId: "lobby" }} />
      </>,
    );
    expect(view.queryByLabelText("Report this lobby")).toBeNull();
    fireEvent.click(view.getByLabelText("Invite"));
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

  it("opens the guide from anywhere the bar is", async () => {
    nav.path = "/lobby/eve";
    const view = render(<UniversalBar />);
    const box = view.getByRole("combobox");
    fireEvent.focus(box);
    fireEvent.click(view.getByText("What can you do here?"));
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
