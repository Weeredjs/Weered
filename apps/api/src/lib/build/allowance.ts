import { prisma } from "../prisma";
import { takeAiBudget } from "../aiBudget";

// One daily allowance for every builder (routes/aiBuild.ts, routes/aiDescribe.ts):
// paid accounts 60, free ones 10, plus a ceiling for the whole site
// (AI_BUILD_SITE_DAILY, 1000 on prod since 2026-10-31).

const PAID_DAILY = 60;
const FREE_DAILY = 10;
export const PROMPT_MAX = 600;

let site = { day: "", n: 0 };
function takeSite(): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (site.day !== day) site = { day, n: 0 };
  if (site.n >= Number(process.env.AI_BUILD_SITE_DAILY || 3000)) return false;
  site.n++;
  return true;
}

/** One build from the person's allowance and one from the site's; on a no,
 *  the reply has been sent. */
export async function allowBuild(userId: string, reply: any): Promise<boolean> {
  const row = await prisma.user
    .findUnique({ where: { id: userId }, select: { tier: true } })
    .catch(() => null);
  const paid = !!row?.tier && row.tier !== "INNOCENT";
  if (!takeAiBudget(userId, "build", paid ? PAID_DAILY : FREE_DAILY)) {
    reply.code(429).send({ ok: false, error: "ai_budget_reached", paid });
    return false;
  }
  if (!takeSite()) {
    reply.code(429).send({ ok: false, error: "builder_busy" });
    return false;
  }
  return true;
}

/** "Now" in the person's own zone, so "Friday at 8" becomes a real time. */
export function nowLine(tz: unknown): string {
  const zone =
    typeof tz === "string" && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(tz) ? tz : "UTC";
  try {
    const d = new Date();
    const local = d.toLocaleString("en-CA", {
      timeZone: zone,
      dateStyle: "full",
      timeStyle: "short",
    });
    const off =
      new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")
        ?.value.match(/[+-]\d{2}:\d{2}/)?.[0] || "+00:00";
    return `Now: ${local} (${zone}, UTC${off}).`;
  } catch {
    return `Now: ${new Date().toISOString()} (UTC).`;
  }
}

export function promptOf(body: any): string {
  return String(body?.prompt ?? "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, PROMPT_MAX);
}
