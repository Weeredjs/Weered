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
// Mail (copy settled with the Daily Ops session, 2026-11-16, verbatim). Until
// James sets up office@eastcoastemployeebenefits.com, it goes out through
// Weered's signed sender under ECEB's name with a PUBLISH invite. With
// OFFICE_SMTP_HOST/USER/PASS and OFFICE_MAIL_FROM set on the server, it goes
// from ECEB's own domain through Websavers and the invite becomes a REQUEST
// (an Accept bar) with a matching CANCEL. Config only, no rebuild.
import { randomBytes } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import type { FastifyInstance } from "fastify";
import { sendMail } from "../lib/email";
import { swallow } from "../lib/logger";
import {
  active,
  book,
  cleanSettings,
  firstName,
  icsCalendar,
  icsEvent,
  openSlots,
  readStore,
  timeText,
  whenPlain,
  writeStore,
  type Booking,
} from "../lib/officeBooking";

const OFFICE_LINK = "https://office.eastcoastemployeebenefits.com";
const OFFICE_SHOWN = "office.eastcoastemployeebenefits.com";
const FROM_NAME = "James Stirling · East Coast Employee Benefits";
const PHONE = "902-830-7423";
const JAMES = () => process.env.OFFICE_BOOKING_TO || "james@eastcoastemployeebenefits.com";

type Opts = {
  authFromHeader: (h?: string) => any;
  officeHostFromReq: (req: any) => Promise<{ id: string; name: string; office: string } | null>;
};

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// --- The sender -------------------------------------------------------------

/** ECEB's own mailbox, when the server has it (OFFICE_SMTP_*); else null. */
let officeTransport: Transporter | null | undefined;
function officeSmtp() {
  if (officeTransport !== undefined) return officeTransport;
  const host = process.env.OFFICE_SMTP_HOST;
  const user = process.env.OFFICE_SMTP_USER;
  const pass = process.env.OFFICE_SMTP_PASS;
  const from = process.env.OFFICE_MAIL_FROM;
  if (!host || !user || !pass || !from) return (officeTransport = null);
  const port = Number(process.env.OFFICE_SMTP_PORT || 465);
  officeTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return officeTransport;
}
const officeAddress = () => process.env.OFFICE_MAIL_FROM || "";
/** ECEB's own domain is sending: invites can carry an organizer and an Accept bar. */
const ownDomain = () => !!officeSmtp();

type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo: string;
  fromName?: string;
  ics?: { content: string; method: "PUBLISH" | "REQUEST" | "CANCEL" };
};

async function send(m: Mail) {
  const t = officeSmtp();
  const attachments = m.ics
    ? [
        {
          filename: "invite.ics",
          content: m.ics.content,
          contentType: `text/calendar; charset=utf-8; method=${m.ics.method}`,
        },
      ]
    : undefined;
  if (t) {
    try {
      await t.sendMail({
        from: `"${m.fromName || FROM_NAME}" <${officeAddress()}>`,
        to: m.to,
        replyTo: m.replyTo,
        subject: m.subject,
        html: m.html,
        text: m.text,
        ...(m.ics ? { icalEvent: { method: m.ics.method, content: m.ics.content } } : {}),
      });
      return;
    } catch (e) {
      swallow(e); // fall through to Weered's sender rather than lose the mail
    }
  }
  await sendMail({
    to: m.to,
    fromName: m.fromName || FROM_NAME,
    replyTo: m.replyTo,
    subject: m.subject,
    html: m.html,
    text: m.text,
    ...(attachments ? { attachments } : {}),
  }).catch(swallow);
}

// --- The invite --------------------------------------------------------------

const clientEvent = (b: Booking, sequence = 0) =>
  icsEvent(b, {
    summary: "James Stirling, East Coast Employee Benefits",
    description: `When it's time, come to the office: ${OFFICE_LINK}\nNo app, no sign-in.\n\nNeed a different time? Reply to the email or call ${PHONE}.`,
    location: OFFICE_LINK,
    sequence,
    ...(ownDomain()
      ? {
          organizer: { name: "James Stirling", email: officeAddress() },
          attendee: { name: b.name, email: b.email },
        }
      : {}),
  });
const jamesEvent = (b: Booking) =>
  icsEvent(b, {
    summary: `Follow-up: ${b.name}`,
    description: `${b.name} <${b.email}>${b.note ? `\n\n${b.note}` : ""}\n\nThe office: ${OFFICE_LINK}`,
    location: OFFICE_LINK,
  });

// --- The words ---------------------------------------------------------------

const SIGN_TEXT = `James Stirling\nEast Coast Employee Benefits\n${PHONE} · Halifax, Nova Scotia`;
const officeA = `<a href="${OFFICE_LINK}" style="color:#a8843f">${OFFICE_SHOWN}</a>`;

/** ECEB's cream and navy: a letter, not Weered's game look. */
const mailHtml = (paras: string[]) =>
  `<!DOCTYPE html><html><body style="margin:0;background:#f4f1ea;font-family:Georgia,serif;color:#1b2a3d;padding:32px 16px">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e3dccb;border-radius:6px;padding:28px">
  <tr><td>
  <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#a8843f;margin-bottom:18px">East Coast Employee Benefits</div>
  <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#2b3a4c">${paras.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("")}</div>
  <div style="margin-top:22px;padding-top:14px;border-top:1px solid #eee5d3;font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;color:#5b6876">James Stirling<br>East Coast Employee Benefits<br>${PHONE} · Halifax, Nova Scotia</div>
  </td></tr></table></body></html>`;

async function mailBooked(b: Booking) {
  const when = whenPlain(b.start);
  const first = firstName(b.name);
  await send({
    to: b.email,
    replyTo: JAMES(),
    subject: `Booked: ${when} Atlantic`,
    html: mailHtml([
      `Hi ${esc(first)},`,
      `We're booked for <b>${esc(when)} Atlantic</b>.`,
      `When it's time, come to the office: ${officeA}. No app, no sign-in.`,
      `The invite is attached for your calendar.`,
      `Need a different time? Reply to this email or call me at ${PHONE}.`,
      `James`,
    ]),
    text: `Hi ${first},\n\nWe're booked for ${when} Atlantic.\n\nWhen it's time, come to the office: ${OFFICE_SHOWN}. No app, no sign-in.\n\nThe invite is attached for your calendar.\n\nNeed a different time? Reply to this email or call me at ${PHONE}.\n\nJames\n\n${SIGN_TEXT}`,
    ics: ownDomain()
      ? {
          method: "REQUEST",
          content: icsCalendar([clientEvent(b)], "East Coast Employee Benefits", "REQUEST"),
        }
      : {
          method: "PUBLISH",
          content: icsCalendar([clientEvent(b)], "East Coast Employee Benefits", "PUBLISH"),
        },
  });
  const who = b.by === "host" ? "you" : "them";
  await send({
    to: JAMES(),
    fromName: "The office",
    replyTo: b.email,
    subject: `[office] Booked: ${b.name}, ${when}`,
    html: `<p>${esc(b.name)} (${esc(b.email)}) booked ${esc(when)} Atlantic. Booked by ${who}.</p>${b.note ? `<p>${esc(b.note)}</p>` : ""}<p>It's on your office calendar. Reply to write to them.</p>`,
    text: `${b.name} (${b.email}) booked ${when} Atlantic. Booked by ${who}.${b.note ? `\n\n${b.note}` : ""}\n\nIt's on your office calendar. Reply to write to them.`,
    ics: {
      method: "PUBLISH",
      content: icsCalendar([jamesEvent(b)], "Office follow-ups", "PUBLISH"),
    },
  });
}

async function mailCancelled(b: Booking) {
  const when = whenPlain(b.start);
  const first = firstName(b.name);
  const own = ownDomain();
  const calLine = own
    ? "Your calendar updates on its own."
    : "Please delete the old invite from your calendar.";
  await send({
    to: b.email,
    replyTo: JAMES(),
    subject: `Cancelled: ${when}`,
    html: mailHtml([
      `Hi ${esc(first)},`,
      `I have to cancel our time on ${esc(when)}. Sorry for the shuffle.`,
      `Reply with a time that suits you, or pick a new one at ${officeA}.`,
      calLine,
      `James`,
    ]),
    text: `Hi ${first},\n\nI have to cancel our time on ${when}. Sorry for the shuffle.\n\nReply with a time that suits you, or pick a new one at ${OFFICE_SHOWN}.\n\n${calLine}\n\nJames\n\n${SIGN_TEXT}`,
    ...(own
      ? {
          ics: {
            method: "CANCEL" as const,
            content: icsCalendar([clientEvent(b, 1)], "East Coast Employee Benefits", "CANCEL"),
          },
        }
      : {}),
  });
}

async function mailReminder(b: Booking) {
  const time = timeText(b.start);
  const first = firstName(b.name);
  await send({
    to: b.email,
    replyTo: JAMES(),
    subject: `Tomorrow at ${time} Atlantic`,
    html: mailHtml([
      `Hi ${esc(first)},`,
      `A reminder: we meet tomorrow at <b>${esc(time)} Atlantic</b>.`,
      `When it's time, come to the office: ${officeA}.`,
      `Can't make it? Reply to this email or call ${PHONE}.`,
      `James`,
    ]),
    text: `Hi ${first},\n\nA reminder: we meet tomorrow at ${time} Atlantic.\n\nWhen it's time, come to the office: ${OFFICE_SHOWN}.\n\nCan't make it? Reply to this email or call ${PHONE}.\n\nJames\n\n${SIGN_TEXT}`,
  });
}

/** Bookings made without James in a day, at most (the public page's ceiling). */
const PUBLIC_PER_DAY = 25;

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
      const body: any = req.body || {};
      const store = readStore();
      // Anyone may book from the public page (app/foyer/book, 2026-11-16).
      // Guards: the per-address rate limit above, two upcoming per email
      // (book()), a field only a bot fills, and a ceiling on public bookings
      // a day so nobody can use it to mail strangers in bulk.
      if (!host && !visitor) {
        if (typeof body.website === "string" && body.website.trim())
          return reply.code(400).send({ ok: false, error: "rejected" });
        const day = Date.now() - 86400_000;
        const today = store.bookings.filter(
          (b) => b.by === "visitor" && Date.parse(b.createdAt) > day,
        ).length;
        if (today >= PUBLIC_PER_DAY)
          return reply.code(429).send({ ok: false, error: "calendar_full" });
      }
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
