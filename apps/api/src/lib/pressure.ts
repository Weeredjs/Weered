import os from "node:os";
import { readFileSync } from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { prisma } from "./prisma";
import { log, swallow } from "./logger";
import { sendMail } from "./email";
import { floodSetting, setFlood } from "./flood";

/**
 * The pressure watch (flood readiness 2026-11-02). Every 10 s: how late the
 * API's event loop runs (p99), the box's load per core, and its memory left.
 * Three hot readings in a row throw flood mode on by itself ("auto") and email
 * the GOD accounts; fifteen calm minutes turn an "auto" flood off again. A
 * flood someone switched on by hand stays on until someone switches it off.
 * Ops → Today shows the latest reading.
 */
export type Pressure = {
  at: number;
  loopMs: number;
  loadPerCore: number;
  memLeftPct: number;
  sockets: number;
  level: "calm" | "busy" | "hot";
};

const EVERY_MS = 10_000;
const HOT_TO_ENGAGE = 3;
const CALM_TO_RELEASE = 90;

export function levelOf(p: Omit<Pressure, "level" | "at">): Pressure["level"] {
  if (p.loopMs > 250 || p.loadPerCore > 1.5 || p.memLeftPct < 10) return "hot";
  if (p.loopMs > 100 || p.loadPerCore > 0.8 || p.memLeftPct < 20) return "busy";
  return "calm";
}

/** Memory the box can still give, in percent (Linux MemAvailable). */
function memLeftPct(): number {
  try {
    const info = readFileSync("/proc/meminfo", "utf8");
    const kb = (k: string) => Number(new RegExp(`^${k}:\\s+(\\d+)`, "m").exec(info)?.[1] || 0);
    const total = kb("MemTotal");
    if (total > 0) return Math.round((kb("MemAvailable") / total) * 100);
  } catch {
    // not Linux
  }
  return Math.round((os.freemem() / os.totalmem()) * 100);
}

let latest: Pressure | null = null;
export const pressureNow = () => latest;

/** What the watch does with one reading; pure apart from the switch and mail. */
export function makeWatch(deps: {
  flood: () => "off" | "on" | "auto";
  setFlood: (m: "off" | "on" | "auto") => Promise<unknown>;
  alert: (subject: string, body: string) => Promise<void>;
}) {
  let hot = 0;
  let calm = 0;
  return async (p: Pressure) => {
    hot = p.level === "hot" ? hot + 1 : 0;
    calm = p.level === "calm" ? calm + 1 : 0;
    const mode = deps.flood();
    if (hot === HOT_TO_ENGAGE && mode === "off") {
      await deps.setFlood("auto");
      await deps.alert(
        "Weered: flood mode switched itself on",
        `The server has run hot for 30 seconds (event loop ${p.loopMs} ms late, load ${p.loadPerCore} per core, ${p.memLeftPct}% memory left, ${p.sockets} live connections). Sign-ups now go to the waitlist, the AI builder is resting, and big rooms update every few seconds. It switches itself off after 15 calm minutes; Ops → System has the switches.`,
      );
    }
    if (calm >= CALM_TO_RELEASE && mode === "auto") {
      calm = 0;
      await deps.setFlood("off");
      await deps.alert(
        "Weered: flood mode is off again",
        "Fifteen calm minutes: sign-ups, the AI builder and live room updates are back to normal.",
      );
    }
  };
}

async function alertGods(subject: string, body: string) {
  try {
    const gods = await prisma.user.findMany({
      where: { globalRole: "GOD", email: { not: null }, deletedAt: null },
      select: { email: true },
    });
    for (const g of gods)
      if (g.email)
        await sendMail({ to: g.email, subject, html: `<p>${body}</p>`, text: body }).catch(swallow);
  } catch (e) {
    swallow(e);
  }
  log.warn(`[pressure] ${subject}`);
}

let started = false;
export function startPressureWatch(deps: { sockets: () => number }) {
  if (started) return;
  started = true;
  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  const cores = Math.max(1, os.cpus().length);
  const watch = makeWatch({ flood: floodSetting, setFlood, alert: alertGods });
  setInterval(() => {
    const reading = {
      loopMs: Math.round(loop.percentile(99) / 1e6),
      loadPerCore: Math.round((os.loadavg()[0] / cores) * 100) / 100,
      memLeftPct: memLeftPct(),
      sockets: deps.sockets(),
    };
    loop.reset();
    latest = { at: Date.now(), ...reading, level: levelOf(reading) };
    void watch(latest).catch(swallow);
  }, EVERY_MS).unref();
}
