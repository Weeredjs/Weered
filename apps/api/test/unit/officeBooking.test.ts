import { describe, expect, it } from "vitest";
import {
  book,
  cleanSettings,
  defaultSettings,
  icsCalendar,
  icsEvent,
  localToUtc,
  openSlots,
  whenText,
  type Store,
} from "../../src/lib/officeBooking";

const store = (): Store => ({ settings: defaultSettings(), bookings: [] });
// Monday 2026-11-16, 08:00 Halifax (UTC-4 in November) = 12:00 UTC.
const MON_8AM = Date.parse("2026-11-16T12:00:00Z");

describe("office follow-up bookings", () => {
  it("turns Halifax wall-clock times into the right instant, across daylight time", () => {
    expect(new Date(localToUtc("2026-11-16", "09:00")).toISOString()).toBe(
      "2026-11-16T13:00:00.000Z",
    );
    expect(new Date(localToUtc("2026-07-15", "09:00")).toISOString()).toBe(
      "2026-07-15T12:00:00.000Z",
    );
    // The morning the clocks go back (Nov 1 2026) and forward (Mar 8 2026).
    expect(new Date(localToUtc("2026-11-01", "09:00")).toISOString()).toBe(
      "2026-11-01T13:00:00.000Z",
    );
    expect(new Date(localToUtc("2026-03-08", "09:00")).toISOString()).toBe(
      "2026-03-08T12:00:00.000Z",
    );
  });

  it("opens weekday half hours from nine to five, past the lead time", () => {
    const slots = openSlots(store(), MON_8AM);
    // Lead 12 h: nothing Monday (ends 17:00, 9 h away); Tuesday starts at 09:00.
    expect(slots[0]).toBe("2026-11-17T13:00:00.000Z");
    const tuesday = slots.filter((s) => s.startsWith("2026-11-17"));
    expect(tuesday).toHaveLength(16);
    // No weekend.
    expect(slots.some((s) => s.startsWith("2026-11-21") || s.startsWith("2026-11-22"))).toBe(false);
  });

  it("takes a booked time off the calendar and refuses it twice", () => {
    const s = store();
    const start = "2026-11-17T13:00:00.000Z";
    const a = book(s, { start, name: "Pat", email: "pat@example.com", by: "visitor" }, MON_8AM);
    expect(a.ok).toBe(true);
    expect(openSlots(s, MON_8AM)).not.toContain(start);
    const b = book(s, { start, name: "Sam", email: "sam@example.com", by: "visitor" }, MON_8AM);
    expect(b).toEqual({ ok: false, error: "slot_taken" });
  });

  it("holds a visitor to two upcoming follow-ups; James books freely", () => {
    const s = store();
    const slots = openSlots(s, MON_8AM);
    const go = (i: number, by: "host" | "visitor") =>
      book(s, { start: slots[i], name: "Pat", email: "Pat@Example.com", by }, MON_8AM);
    expect(go(0, "visitor").ok).toBe(true);
    expect(go(2, "visitor").ok).toBe(true);
    expect(go(4, "visitor")).toEqual({ ok: false, error: "already_booked" });
    expect(go(4, "host").ok).toBe(true);
  });

  it("needs a name and a real address", () => {
    const s = store();
    const start = openSlots(s, MON_8AM)[0];
    expect(book(s, { start, name: " ", email: "a@b.ca", by: "visitor" }, MON_8AM)).toEqual({
      ok: false,
      error: "name_required",
    });
    expect(book(s, { start, name: "A", email: "not an email", by: "visitor" }, MON_8AM)).toEqual({
      ok: false,
      error: "email_invalid",
    });
  });

  it("skips time away and keeps hours sane", () => {
    const s = store();
    s.settings.blocks = [{ id: "x", start: "2026-11-17T13:00:00Z", end: "2026-11-17T21:00:00Z" }];
    expect(openSlots(s, MON_8AM).some((t) => t.startsWith("2026-11-17"))).toBe(false);
    const c = cleanSettings(
      {
        hours: {
          "1": [
            ["10:00", "09:00"],
            ["10:00", "12:00"],
          ],
          "6": [["bad", "x"]],
        },
        slotMin: 7,
      },
      s.settings,
    );
    expect(c.hours).toEqual({ "1": [["10:00", "12:00"]] });
    expect(c.slotMin).toBe(30);
    expect(c.feedKey).toBe(s.settings.feedKey);
  });

  it("writes a calendar Outlook reads", () => {
    const s = store();
    const r = book(
      s,
      {
        start: openSlots(s, MON_8AM)[0],
        name: "Pat; Co, Ltd",
        email: "pat@example.com",
        by: "visitor",
      },
      MON_8AM,
    );
    if (!r.ok) throw new Error("not booked");
    const ics = icsCalendar(
      [
        icsEvent(r.booking, {
          summary: "Follow-up: Pat; Co, Ltd",
          description: "x".repeat(200),
          location: "https://office.eastcoastemployeebenefits.com",
        }),
      ],
      "Office follow-ups",
    );
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20261117T130000Z");
    expect(ics).toContain("SUMMARY:Follow-up: Pat\\; Co\\, Ltd");
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(whenText("2026-11-17T13:00:00.000Z")).toMatch(
      /Tuesday, November 17 at 9:00 a\.m\. Atlantic time/,
    );
  });
});
