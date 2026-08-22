// Division 2 worker — Operator sit-reps for the division2 lobby.
// Polls Ubisoft's public status feed (shared cache with /division2/status) and
// broadcasts short AI "SHD network" briefs when something actually changes:
// a platform dropping to maintenance/offline, recovering, or the weekly reset
// going live (Tuesdays 08:30 UTC). First tick only primes state, so a deploy
// never spams the lobby.

import { log } from "./lib/logger";
import { fetchDivision2Status } from "./routes/division2";

const D2_LOBBY_ID = "division2";
const RESET_ANNOUNCE_WINDOW_MS = 3 * 60 * 60 * 1000; // announce reset only within 3h of it

type Deps = {
  getAI: () => Promise<any | null>;
  broadcastToLobby: (lobbyId: string, event: any) => void;
  countLobbyActiveUsers?: (lobbyId: string) => number;
};

const _prev = new Map<string, { ok: boolean }>();
let _primed = false;
let _lastResetKey = "";
let _lastFiredAt = 0;

// Most recent Tuesday 08:30 UTC at or before now.
function lastWeeklyReset(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 30, 0));
  while (d.getUTCDay() !== 2 || d.getTime() > now.getTime()) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

async function operatorSay(deps: Deps, eventType: string, userPrompt: string) {
  const now = Date.now();
  if (now - _lastFiredAt < 60_000) return;
  if (deps.countLobbyActiveUsers && deps.countLobbyActiveUsers(D2_LOBBY_ID) === 0) return;
  _lastFiredAt = now;
  try {
    const ai = await deps.getAI();
    if (!ai) return;
    const response = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      system:
        "You are The Operator — Weered's ops anchor on The Division 2's SHD network. ONE sentence, max 22 words. Terse tactical brief; agent jargon (SHD, agents, D.C., the DZ) welcome. Never break character. No emojis. No quotes. No hashtags.",
      messages: [{ role: "user", content: userPrompt }],
    });
    const reply = (response?.content?.[0]?.text || "").trim();
    if (!reply) return;
    deps.broadcastToLobby(D2_LOBBY_ID, {
      type: "operator:commentary",
      body: reply,
      ts: Date.now(),
      eventType,
    });
  } catch (e) {
    log.error("[operator-d2]", { eventType, error: (e as any)?.message || String(e) });
  }
}

export async function runDivision2Worker(deps: Deps) {
  try {
    const status = await fetchDivision2Status();
    const now = new Date();
    const reset = lastWeeklyReset(now);
    const resetKey = reset.toISOString();

    if (!_primed) {
      // Prime silently: remember current platform health and mark the current
      // reset period as already-announced.
      for (const p of status?.platforms || []) {
        _prev.set(p.platform, { ok: p.status === "online" && !p.maintenance });
      }
      _lastResetKey = resetKey;
      _primed = true;
      return;
    }

    let fired = 0;
    for (const p of status?.platforms || []) {
      const ok = p.status === "online" && !p.maintenance;
      const before = _prev.get(p.platform);
      _prev.set(p.platform, { ok });
      if (!before || before.ok === ok || fired >= 2) continue;
      fired++;
      if (!ok) {
        const why = p.maintenance ? "scheduled maintenance" : `status: ${p.status}`;
        void operatorSay(
          deps,
          "servers_down",
          `The Division 2 servers on ${p.platform} just went dark (${why}). Brief the agents.`,
        );
      } else {
        void operatorSay(
          deps,
          "servers_up",
          `The Division 2 servers on ${p.platform} are back online. Brief the agents — back to work.`,
        );
      }
    }

    if (_lastResetKey !== resetKey && now.getTime() - reset.getTime() < RESET_ANNOUNCE_WINDOW_MS) {
      _lastResetKey = resetKey;
      void operatorSay(
        deps,
        "weekly_reset",
        "The Division 2 weekly reset just hit: vendors restocked, activities and projects rerolled. Brief the agents.",
      );
    } else if (_lastResetKey !== resetKey) {
      // Missed the window (worker was down) — mark it seen without announcing.
      _lastResetKey = resetKey;
    }
  } catch (e) {
    log.error("[division2-worker]", { error: (e as any)?.message || String(e) });
  }
}
