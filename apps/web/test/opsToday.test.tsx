// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// The ops rebuild (2026-11-02): Today, and Subscriptions as the tier list.
const apiFetch = vi.fn();
vi.mock("../lib/apiClient", () => ({
  API: "",
  authHeaders: () => ({}),
  apiFetch: (...a: any[]) => apiFetch(...a),
}));
import { TodayTab, type TodayData } from "../app/staff/TodayTab";
import { SubsTab } from "../app/staff/SubsTab";

afterEach(() => {
  cleanup();
  apiFetch.mockReset();
});

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const base: TodayData = {
  ok: true,
  role: "SUPPORT",
  queue: {
    reports: {
      open: 2,
      latest: [
        { id: "r1", targetType: "MESSAGE", reason: "HATE_SPEECH", createdAt: iso(3_600_000) },
      ],
    },
    appeals: { pending: 0, oldest: [] },
    bugs: { open: 0, latest: [] },
  },
};

describe("ops Today", () => {
  it("shows what's waiting, says so plainly when nothing is, and opens the tab", () => {
    const onOpen = vi.fn();
    render(
      <TodayTab data={base} error="" onOpen={onOpen} onRefresh={() => {}} updatedAt={Date.now()} />,
    );
    expect(screen.getByText("Hate speech")).toBeTruthy();
    expect(screen.getByText("No one is waiting.")).toBeTruthy();
    expect(screen.getByText("No open bugs.")).toBeTruthy();
    // Support sees no pulse, outreach or staff actions.
    expect(screen.queryByText("Pulse")).toBeNull();
    expect(screen.queryByText("Follow-ups")).toBeNull();
    fireEvent.click(screen.getByText(/Open reports/));
    expect(onOpen).toHaveBeenCalledWith("reports");
  });

  it("reads a follow-up as a calendar date, never a day early", () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const date = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
    const data: TodayData = {
      ...base,
      role: "ADMIN",
      outreach: { due: 1, list: [{ id: "c1", name: "Ada", company: "Club", date }] },
    };
    render(
      <TodayTab
        data={data}
        error=""
        onOpen={() => {}}
        onRefresh={() => {}}
        updatedAt={Date.now()}
      />,
    );
    const label = y.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    expect(screen.getByText(`overdue since ${label}`)).toBeTruthy();
  });

  it("warns when maintenance mode is on", () => {
    const data: TodayData = {
      ...base,
      role: "GOD",
      site: {
        maintenanceMode: true,
        registrationOpen: true,
        registrationCap: 0,
        waitlist: 0,
        aiEnabled: true,
      },
    };
    render(
      <TodayTab
        data={data}
        error=""
        onOpen={() => {}}
        onRefresh={() => {}}
        updatedAt={Date.now()}
      />,
    );
    expect(screen.getByRole("status").textContent).toMatch(/Maintenance mode is on/);
  });
});

describe("ops Subscriptions", () => {
  const members = [
    {
      id: "u-paid",
      name: "Payer",
      usernameKey: "payer",
      tier: "FELON",
      paying: true,
      status: "active",
      renews: iso(-86_400_000 * 20),
      cancelAtPeriodEnd: false,
      stripeUrl: "https://dashboard.stripe.com/customers/cus_1",
    },
    {
      id: "u-given",
      name: "Given",
      usernameKey: "given",
      tier: "KINGPIN",
      paying: false,
      status: null,
      renews: null,
      cancelAtPeriodEnd: false,
      stripeUrl: null,
    },
  ];

  it("lists everyone with a tier, and leaves a paying member's tier to Stripe", async () => {
    apiFetch.mockResolvedValueOnce({ ok: true, members });
    render(<SubsTab />);
    await waitFor(() => expect(screen.getByText("Payer")).toBeTruthy());
    expect(screen.getByText("Pays · Felon")).toBeTruthy();
    expect(screen.getByText("Stripe").closest("a")?.getAttribute("href")).toContain("cus_1");
    // Only the staff-given member has tier buttons.
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe("Tier for Given");
  });

  it("changes a tier by the person's id", async () => {
    apiFetch
      .mockResolvedValueOnce({ ok: true, members })
      .mockResolvedValueOnce({ ok: true, tier: "FELON" });
    render(<SubsTab />);
    await waitFor(() => expect(screen.getByText("Given")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Felon" }));
    await waitFor(() => expect(screen.getByText("Given is now Felon.")).toBeTruthy());
    expect(apiFetch.mock.calls[1][0]).toBe("/staff/users/u-given/tier");
    expect(JSON.parse(apiFetch.mock.calls[1][1].body)).toEqual({ tier: "FELON" });
  });
});
