// Follow-up bookings in the ECEB office (lib/officeBooking.ts). James
// 2026-11-16: "a booking calendar that syncs with outlook and can be included
// in the office to book followups ... Without migrating anything."
//
// - GET  /office/booking/slots       open times (anyone: it shows only when)
// - POST /office/booking             book one: the host, or a visitor seated
//                                    in the office or its waiting room
// - GET  /office/bookings            host: what's booked, the hours, the feed
// - DELETE /office/booking/:id       host: cancel (the client is told)
// - POST /office/booking/settings    host: hours, length, time away
// - GET  /office/calendar/:key       the feed Outlook subscribes to
//
// Mail goes out under East Coast Employee Benefits' name, replies to James.
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { sendMail } from "../lib/email";
import { swallow } from "../lib/logger";
import {
  active,
  book,
  cleanSettings,
  icsCalendar,
  icsEvent,
  openSlots,
  readStore,
  whenText,
  writeStore,
  type Booking,
} from "../lib/officeBooking";

const OFFICE_LINK = "https://office.eastcoastemployeebenefits.com";
const FROM_NAME = "James Stirling · East Coast Employee Benefits";
const JAMES = () => process.env.OFFICE_BOOKING_TO || "james@eastcoastemployeebenefits.com";

type Opts = {
  authFromHeader: (h?: string) => any;
  officeHostFromReq: (req: any) => Promise<{ id: string; name: string; office: string } | null>;
};

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const event = (b: Booking) =>
  icsEvent(b, {
    summary: `Follow-up with James Stirling (East Coast Employee Benefits)`,
    description: `Your follow-up in James's office. Open this link at the time:\n${OFFICE_LINK}${b.note ? `\n\nNote: ${b.note}` : ""}`,
    location: OFFICE_LINK,
  });
const jamesEvent = (b: Booking) =>
  icsEvent(b, {
    summary: `Follow-up: ${b.name}`,
    description: `${b.name} <${b.email}>${b.note ? `\n\n${b.note}` : ""}\n\nThe office: ${OFFICE_LINK}`,
    location: OFFICE_LINK,
  });

/** A plain mail in ECEB's colours: the document, not Weered's game look. */
const mailHtml = (heading: string, body: string) =>
  `<!DOCTYPE html><html><body style="margin:0;background:#f4f1ea;font-family:Georgia,serif;color:#1b2a3d;padding:32px 16px">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e3dccb;border-radius:6px;padding:28px">
  <tr><td>
  <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#a8843f">East Coast Employee Benefits</div>
  <h1 style="font-size:21px;margin:14px 0 14px;color:#10233d">${heading}</h1>
  <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#2b3a4c">${body}</div>
  <div style="margin-top:26px;padding-top:14px;border-top:1px solid #eee5d3;font-family:system-ui,sans-serif;font-size:12px;color:#7b8794">James Stirling · East Coast Employee Benefits · Halifax, Nova Scotia</div>
  </td></tr></table></body></html>`;

async function mailBooked(b: Booking) {
  const when = whenText(b.start);
  await sendMail({
    to: b.email,
    fromName: FROM_NAME,
    replyTo: JAMES(),
    subject: `Your follow-up with James: ${when}`,
    html: mailHtml(
      "You're booked",
      `<p>Hi ${esc(b.name)},</p><p>Your follow-up with James is on <b>${esc(when)}</b>.</p>
       <p>At that time, open the office: <a href="${OFFICE_LINK}" style="color:#a8843f">${OFFICE_LINK.replace("https://", "")}</a>. No app or sign-in needed.</p>
       <p>The invite attached adds it to your calendar. To change the time, just reply to this email.</p>`,
    ),
    text: `Hi ${b.name},\n\nYour follow-up with James is on ${when}.\n\nAt that time, open the office: ${OFFICE_LINK}\nNo app or sign-in needed.\n\nThe invite attached adds it to your calendar. To change the time, just reply to this email.`,
    attachments: [
      {
        filename: "follow-up.ics",
        content: icsCalendar([event(b)], "East Coast Employee Benefits", "PUBLISH"),
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
      },
    ],
  }).catch(swallow);
  await sendMail({
    to: JAMES(),
    fromName: "The office",
    replyTo: b.email,
    subject: `[office] Follow-up booked: ${b.name}, ${when}`,
    html: `<p><b>${esc(b.name)}</b> (${esc(b.email)}) booked a follow-up for <b>${esc(when)}</b>${b.by === "host" ? " (you booked it)" : ""}.</p>${b.note ? `<blockquote>${esc(b.note)}</blockquote>` : ""}<p>It's on your office calendar. Reply to write to them.</p>`,
    text: `${b.name} (${b.email}) booked a follow-up for ${when}.${b.note ? `\n\n${b.note}` : ""}\n\nIt's on your office calendar. Reply to write to them.`,
    attachments: [
      {
        filename: "follow-up.ics",
        content: icsCalendar([jamesEvent(b)], "Office follow-ups", "PUBLISH"),
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
      },
    ],
  }).catch(swallow);
}

async function mailCancelled(b: Booking) {
  const when = whenText(b.start);
  await sendMail({
    to: b.email,
    fromName: FROM_NAME,
    replyTo: JAMES(),
    subject: `Your follow-up on ${when} is cancelled`,
    html: mailHtml(
      "Your follow-up is cancelled",
      `<p>Hi ${esc(b.name)},</p><p>James has cancelled the follow-up on <b>${esc(when)}</b>. Reply to this email to find another time.</p>`,
    ),
    text: `Hi ${b.name},\n\nJames has cancelled the follow-up on ${when}. Reply to this email to find another time.`,
    attachments: [
      {
        filename: "follow-up.ics",
        content: icsCalendar([event(b)], "East Coast Employee Benefits", "PUBLISH"),
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
      },
    ],
  }).catch(swallow);
}

async function mailReminder(b: Booking) {
  const when = whenText(b.start);
  await sendMail({
    to: b.email,
    fromName: FROM_NAME,
    replyTo: JAMES(),
    subject: `Tomorrow: your follow-up with James`,
    html: mailHtml(
      "See you tomorrow",
      `<p>Hi ${esc(b.name)},</p><p>A reminder: your follow-up with James is <b>${esc(when)}</b>.</p>
       <p>At that time, open the office: <a href="${OFFICE_LINK}" style="color:#a8843f">${OFFICE_LINK.replace("https://", "")}</a>.</p>
       <p>Can't make it? Reply to this email.</p>`,
    ),
    text: `Hi ${b.name},\n\nA reminder: your follow-up with James is ${when}.\n\nAt that time, open the office: ${OFFICE_LINK}\n\nCan't make it? Reply to this email.`,
  }).catch(swallow);
}

export default async function officeBookingRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, officeHostFromReq } = opts;

  /** A visitor in the office or its waiting room (a guest pass for the ECEB office). */
  const visitorOf = (req: any) => {
    const u: any = authFromHeader((req.headers as any).authorization);
    return u?.guest && String(u.scope?.office || "").startsWith("mtg-eceb") ? u : null;
  };

  app.get("/office/booking/slots", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    const store = readStore();
    return reply.send({
      ok: true,
      slotMin: store.settings.slotMin,
      tz: "America/Halifax",
      slots: openSlots(store),
    });
  });

  app.post(
    "/office/booking",
    { config: { rateLimit: { max: 6, timeWindow: "1 hour" } } },
    async (req, reply) => {
      const host = await officeHostFromReq(req);
      const visitor = host ? null : visitorOf(req);
      if (!host && !visitor) return reply.code(401).send({ ok: false, error: "office_only" });
      const body: any = req.body || {};
      const store = readStore();
      const r = book(store, {
        start: body.start,
        name: body.name,
        email: body.email,
        note: body.note,
        by: host ? "host" : "visitor",
      });
      if (!r.ok) return reply.code(409).send(r);
      writeStore(store);
      void mailBooked(r.booking);
      return reply.send({ ok: true, booking: { start: r.booking.start, end: r.booking.end } });
    },
  );

  app.get("/office/bookings", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!(await officeHostFromReq(req)))
      return reply.code(403).send({ ok: false, error: "host_only" });
    const store = readStore();
    const now = Date.now();
    return reply.send({
      ok: true,
      bookings: store.bookings
        .filter((b) => active(b) && Date.parse(b.end) > now - 3600_000)
        .sort((a, b) => a.start.localeCompare(b.start)),
      settings: { ...store.settings, feedKey: undefined },
      feed: `${OFFICE_LINK}/api/office/calendar/${store.settings.feedKey}.ics`,
    });
  });

  app.delete("/office/booking/:id", async (req, reply) => {
    if (!(await officeHostFromReq(req)))
      return reply.code(403).send({ ok: false, error: "host_only" });
    const id = String((req.params as any).id || "");
    const store = readStore();
    const b = store.bookings.find((x) => x.id === id && active(x));
    if (!b) return reply.code(404).send({ ok: false, error: "not_found" });
    b.cancelledAt = new Date().toISOString();
    writeStore(store);
    if (Date.parse(b.start) > Date.now()) void mailCancelled(b);
    return reply.send({ ok: true });
  });

  app.post("/office/booking/settings", async (req, reply) => {
    if (!(await officeHostFromReq(req)))
      return reply.code(403).send({ ok: false, error: "host_only" });
    const store = readStore();
    const body: any = req.body || {};
    store.settings = cleanSettings(body, store.settings);
    if (body.newFeedKey === true) store.settings.feedKey = readStoreKey();
    writeStore(store);
    return reply.send({
      ok: true,
      settings: { ...store.settings, feedKey: undefined },
      feed: `${OFFICE_LINK}/api/office/calendar/${store.settings.feedKey}.ics`,
    });
  });

  // The feed Outlook subscribes to (Add calendar → From internet). The key in
  // the address is the only lock, so it is long and can be replaced.
  app.get("/office/calendar/:key", async (req, reply) => {
    const key = String((req.params as any).key || "").replace(/\.ics$/, "");
    const store = readStore();
    if (!key || key !== store.settings.feedKey) return reply.code(404).send("Not found");
    const now = Date.now();
    const events = store.bookings
      .filter((b) => Date.parse(b.end) > now - 60 * 86400_000)
      .map(jamesEvent);
    reply.header("Content-Type", "text/calendar; charset=utf-8");
    reply.header("Cache-Control", "no-store");
    return reply.send(icsCalendar(events, "Office follow-ups"));
  });

  // The day-before reminder: once, for bookings made more than a day ahead.
  const remind = () => {
    try {
      const store = readStore();
      const now = Date.now();
      let changed = false;
      for (const b of store.bookings) {
        const t = Date.parse(b.start);
        if (!active(b) || b.remindedAt || t <= now || t - now > 24 * 3600_000) continue;
        if (t - Date.parse(b.createdAt) < 30 * 3600_000) continue; // booked recently: they know
        b.remindedAt = new Date(now).toISOString();
        changed = true;
        void mailReminder(b);
      }
      if (changed) writeStore(store);
    } catch (e) {
      swallow(e);
    }
  };
  const timer = setInterval(remind, 15 * 60_000);
  timer.unref?.();
  app.addHook("onClose", async () => clearInterval(timer));
}

function readStoreKey(): string {
  return randomBytes(18).toString("base64url");
}
