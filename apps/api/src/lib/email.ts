import { stripTags } from "./htmlText";
import { log } from "./logger";
import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";

let _resend: Resend | null = null;
let _transporter: Transporter | null = null;
let _warnedMissing = false;

function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || host === "mail.yourhostingprovider.com" || !user || !pass) {
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return _transporter;
}

export type SendMailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; logOnly?: boolean };

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendMailResult> {
  const from = process.env.MAIL_FROM || process.env.SMTP_FROM || "Weered <onboarding@resend.dev>";

  const resend = getResend();
  if (resend) {
    try {
      const r = await resend.emails.send({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text || stripHtml(opts.html),
      });
      if ((r as any).error) {
        log.error("[email:resend] send failed:", (r as any).error);
        return { ok: false, error: String((r as any).error?.message || (r as any).error) };
      }
      const id = (r as any).data?.id || "";
      return { ok: true, messageId: id };
    } catch (e: any) {
      log.error("[email:resend] send threw:", e?.message || e);
      return { ok: false, error: e?.message || "resend_send_failed" };
    }
  }

  const t = getTransporter();
  if (!t) {
    if (!_warnedMissing) {
      log.warn(
        "[email] No transport configured (need RESEND_API_KEY or SMTP_HOST/USER/PASS) — emails will be logged only.",
      );
      _warnedMissing = true;
    }
    log.log(`[email:logOnly] to=${opts.to} subject="${opts.subject}"`);
    log.log(`[email:logOnly] body:\n${opts.text || opts.html}`);
    return { ok: false, error: "transport_not_configured", logOnly: true };
  }
  try {
    const info = await t.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text || stripHtml(opts.html),
    });
    return { ok: true, messageId: info.messageId };
  } catch (e: any) {
    log.error("[email:smtp] send failed:", e?.message || e);
    return { ok: false, error: e?.message || "send_failed" };
  }
}

function stripHtml(html: string): string {
  return stripTags(html).replaceAll(/\s+/g, " ").trim();
}

const BRAND_COLOR = "#5800E5";
const ACCENT_COLOR = "#f5b700";
const APP_URL = process.env.APP_URL || "https://weered.ca";

function shellHtml(opts: {
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<p style="margin:32px 0 12px"><a href="${opts.ctaUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:14px 28px;border-radius:6px;font-family:monospace;font-weight:800;letter-spacing:1.2px;text-decoration:none;text-transform:uppercase;font-size:13px">${opts.ctaLabel}</a></p>
       <p style="margin:8px 0 0;font-size:11px;color:#888;font-family:monospace">If the button doesn't work, copy this link:<br/><span style="color:${BRAND_COLOR}">${opts.ctaUrl}</span></p>`
      : "";
  return `<!DOCTYPE html><html><body style="margin:0;background:#0c0b0a;font-family:system-ui,sans-serif;color:#e8e8f0;padding:40px 20px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#15131a;border:1px solid #2a2435;border-radius:12px;padding:32px 28px">
      <tr><td>
        <div style="font-family:monospace;font-size:24px;font-weight:900;letter-spacing:-1px;color:#fff">WEERED</div>
        <div style="font-family:monospace;font-size:10px;font-weight:800;letter-spacing:2px;color:${ACCENT_COLOR};margin-top:4px">LOBBIES · CREWS · CRIME</div>
        <div style="height:2px;width:60px;background:${BRAND_COLOR};margin:16px 0 28px"></div>
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#fff">${opts.heading}</h1>
        <div style="font-size:14px;line-height:1.6;color:#cbcbd6">${opts.body}</div>
        ${cta}
        <div style="margin-top:36px;padding-top:20px;border-top:1px solid #2a2435;font-size:11px;color:#666;font-family:monospace">
          ${APP_URL.replace(/^https?:\/\//, "")} · this is a transactional email
        </div>
      </td></tr>
    </table>
  </body></html>`;
}

export function buildVerifyEmail(opts: { username: string; token: string }): {
  subject: string;
  html: string;
} {
  const url = `${APP_URL}/verify-email?token=${encodeURIComponent(opts.token)}`;
  return {
    subject: "Verify your Weered email",
    html: shellHtml({
      heading: `Verify your email, ${opts.username}.`,
      body: `Confirm your email so you can post in public forums, list items in the marketplace, and receive notifications.<br/><br/>This link expires in 24 hours.`,
      ctaLabel: "Verify email",
      ctaUrl: url,
    }),
  };
}

export function buildResetEmail(opts: { username: string; token: string }): {
  subject: string;
  html: string;
} {
  const url = `${APP_URL}/reset-password?token=${encodeURIComponent(opts.token)}`;
  return {
    subject: "Reset your Weered password",
    html: shellHtml({
      heading: `Reset your password, ${opts.username}.`,
      body: `Someone (hopefully you) asked to reset your password. Click below to choose a new one.<br/><br/>If you didn't request this, ignore this email — your password stays the same. Link expires in 1 hour.`,
      ctaLabel: "Reset password",
      ctaUrl: url,
    }),
  };
}
