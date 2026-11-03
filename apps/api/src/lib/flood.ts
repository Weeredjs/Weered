import { getSiteFlags, forgetSiteFlags } from "./ai";
import { setSiteConfig } from "./siteConfig";
import { swallow } from "./logger";

/**
 * The flood switches (James 2026-11-02: "We have 5 minutes before it crashes.
 * What is the plan"). Set in Ops → System, or by lib/pressure.ts on its own.
 *
 * floodMode, "off" | "on" | "auto" (auto = switched on by the pressure watch,
 * and off again by it once things calm down):
 *   - new sign-ups go to the waitlist (lib/registration.ts)
 *   - the AI builder and the Operator rest (lib/ai.ts)
 *   - a big room sends a head count and a sample every few seconds instead of
 *     announcing every arrival to everyone (lib/roomState.ts)
 *   - pages refresh less often (the web reads `flood` from auth:ok)
 *
 * The door, "open" | "capacity" | "maintenance": lights off. Everyone but
 * staff gets a "Weered is full" page, their live connection closes cleanly
 * and stays closed (no reconnect storm), and the API answers 503. The server
 * keeps running, for staff and for Fathom beside it.
 *
 * Read synchronously on hot paths (every broadcast); refreshed every 5 s.
 */
export type Door = "open" | "capacity" | "maintenance";
type FloodState = { flood: "off" | "on" | "auto"; door: Door };

let state: FloodState = { flood: "off", door: "open" };
const listeners = new Set<(now: FloodState, was: FloodState) => void>();

export const floodOn = () => state.flood !== "off";
export const floodSetting = () => state.flood;
export const siteDoor = (): Door => state.door;

export const DOOR_MESSAGE: Record<Exclude<Door, "open">, string> = {
  capacity:
    "Weered is full right now. Leave your email and you'll be let in as soon as there's room.",
  maintenance: "Weered is down for maintenance. Back shortly.",
};

/** What stays reachable with the door shut: health, the door's own status,
 *  the waitlist, sign-in (so an operator can get in and open it again), Ops,
 *  and Stripe's webhook (nobody's payment is dropped). */
export function passesShutDoor(path: string): boolean {
  const url = String(path || "").split("?")[0];
  return (
    url === "/health" ||
    url === "/site/status" ||
    url === "/waitlist" ||
    url === "/subscribe/webhook" ||
    url.startsWith("/auth/") ||
    url.startsWith("/staff")
  );
}

/** Called when a switch changes, here or in another request. */
export function onFloodChange(fn: (now: FloodState, was: FloodState) => void) {
  listeners.add(fn);
}

function read(flags: Record<string, string>): FloodState {
  const f = flags.floodMode;
  return {
    flood: f === "on" || f === "auto" ? f : "off",
    door:
      flags.maintenanceMode === "true"
        ? "maintenance"
        : flags.capacityMode === "true"
          ? "capacity"
          : "open",
  };
}

export async function refreshFlood(fresh = false): Promise<FloodState> {
  try {
    if (fresh) forgetSiteFlags();
    const next = read(await getSiteFlags());
    const was = state;
    state = next;
    if (next.flood !== was.flood || next.door !== was.door)
      for (const fn of listeners) {
        try {
          fn(next, was);
        } catch (e) {
          swallow(e);
        }
      }
  } catch (e) {
    swallow(e);
  }
  return state;
}

/** Turn flood mode on, "auto", or off; takes effect at once in this process. */
export async function setFlood(mode: "off" | "on" | "auto") {
  await setSiteConfig("floodMode", mode);
  return refreshFlood(true);
}

let started = false;
export function startFloodWatch() {
  if (started) return;
  started = true;
  void refreshFlood(true);
  setInterval(() => void refreshFlood(), 5_000).unref();
}

/** For tests. */
export function _setFloodStateForTest(s: Partial<FloodState>) {
  state = { ...state, ...s };
}
