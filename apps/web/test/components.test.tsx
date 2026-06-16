// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Avatar,
  StatusDot,
  GroupAvatarStack,
  UnreadBadge,
  SegmentedControl,
} from "../components/dock/shellHelpers";

describe("dock atoms render", () => {
  it("Avatar renders initials and image variants", () => {
    expect(render(<Avatar name="Alice" />).container.textContent).toContain("A");
    expect(
      render(<Avatar name="Bob" src="https://x/y.png" size={40} />).container.querySelector("img"),
    ).toBeTruthy();
  });
  it("StatusDot renders online and offline", () => {
    expect(render(<StatusDot online={true} />).container.firstChild).toBeTruthy();
    expect(render(<StatusDot online={false} />).container.firstChild).toBeTruthy();
  });
  it("GroupAvatarStack renders members", () => {
    const { container } = render(
      <GroupAvatarStack
        members={[
          { id: "1", name: "Al" },
          { id: "2", name: "Bo", avatar: "https://x/a.png" },
        ]}
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });
  it("UnreadBadge hides at 0, shows count, caps at 99+", () => {
    expect(render(<UnreadBadge count={0} />).container.firstChild).toBeNull();
    expect(render(<UnreadBadge count={5} />).container.textContent).toContain("5");
    expect(render(<UnreadBadge count={150} />).container.textContent).toContain("99+");
  });
  it("SegmentedControl renders a button per tab", () => {
    const { container } = render(
      <SegmentedControl
        tabs={[
          { id: "a", label: "Aye" },
          { id: "b", label: "Bee", badge: 3, tone: "red" },
        ]}
        active="a"
        onChange={() => {}}
      />,
    );
    expect(container.querySelectorAll("button").length).toBe(2);
    expect(container.textContent).toContain("Aye");
  });
});
