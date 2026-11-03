import { prisma } from "./prisma";
import { sendMail } from "./email";
import { log } from "./logger";

// The contact form (weered.ca/contact). It used to post from the browser to
// FormSubmit, a free form relay. That service went down (522 on 2026-11-03),
// so every message failed with "Something broke" and nothing was kept: a
// member asking about paid lobbies waited seven weeks. Now Weered keeps each
// message in Ops (Bug Reports, kind CONTACT) and emails it with the sender as
// reply-to, so an outage of the mail service loses nothing.

export const CONTACT_NOTIFY_TO = process.env.CONTACT_NOTIFY_TO || "james@weered.ca";
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export type ContactInput = { name: string; email: string; message: string };

/** The fields cleaned, or what's wrong with them. */
export function cleanContact(raw: any): ContactInput | { error: string } {
  const name = String(raw?.name ?? "")
    .replaceAll(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 80);
  const email = String(raw?.email ?? "")
    .trim()
    .slice(0, 254);
  const message = String(raw?.message ?? "")
    .trim()
    .slice(0, 4000);
  if (!name || !email || !message) return { error: "missing_fields" };
  if (!EMAIL_RE.test(email)) return { error: "bad_email" };
  if (message.length < 10) return { error: "message_too_short" };
  return { name, email, message };
}

const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Keep it in Ops, then email it; the email failing never loses the message. */
export async function takeContactMessage(
  c: ContactInput,
  meta: { userId?: string | null; userAgent?: string },
): Promise<{ id: string; mailed: boolean }> {
  const row = await prisma.bugReport.create({
    data: {
      userId: meta.userId || null,
      category: "CONTACT",
      page: "/contact",
      userAgent: String(meta.userAgent || "").slice(0, 500),
      body: `${c.name} <${c.email}>\n\n${c.message}`,
    },
    select: { id: true },
  });
  const sent = await sendMail({
    to: CONTACT_NOTIFY_TO,
    replyTo: c.email,
    subject: `[weered.ca] message from ${c.name}`,
    html: `<p><b>${esc(c.name)}</b> &lt;${esc(c.email)}&gt; wrote from weered.ca/contact:</p><p style="white-space:pre-wrap">${esc(c.message)}</p><p style="color:#888">Reply to this email to answer them. It's also in Ops under Bug Reports, kind Contact.</p>`,
    text: `${c.name} <${c.email}> wrote from weered.ca/contact:\n\n${c.message}\n\nReply to this email to answer them. It's also in Ops under Bug Reports, kind Contact.`,
  }).catch((e) => {
    log.error("[contact] mail failed:", e?.message || e);
    return { ok: false as const, error: "send_threw" };
  });
  return { id: row.id, mailed: sent.ok };
}
