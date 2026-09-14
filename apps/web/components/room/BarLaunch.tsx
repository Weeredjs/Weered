"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { LaunchSnapshot, LaunchTarget } from "../WeeredProvider";
import { useVoice } from "../VoiceContext";
import { barMapThumb, useBarMaps } from "../bar/useBarMaps";
import {
  BAR_DEFAULT_PORT,
  BAR_MODE_LABEL,
  scriptFor,
  type BarDifficulty,
  type BarMode,
} from "@/lib/bar/startScript";

// The Beyond All Reason side of the room Launch Pad. The pad itself (slots,
// ready check, countdown, server state) is shared with Steam launches; this
// file owns the BAR setup dialog and the hand-off to the desktop app, which is
// the only thing on the PC allowed to start the engine.

type Member = { id: string; name?: string };

export type BarDesktopStatus = {
  found: boolean;
  install_dir: string | null;
  engine: string | null;
  game: string | null;
  error: string | null;
};

function tauriInvoke(): ((cmd: string, args?: any) => Promise<any>) | null {
  if (typeof window === "undefined") return null;
  const w: any = window;
  return w.__TAURI_INTERNALS__?.invoke || w.__TAURI__?.core?.invoke || null;
}

export function isDesktopApp(): boolean {
  return !!tauriInvoke();
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const fn = tauriInvoke();
  if (!fn) throw new Error("desktop_only");
  return fn(cmd, args);
}

export function useBarDesktopStatus() {
  const [status, setStatus] = useState<BarDesktopStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const desktop = isDesktopApp();

  const refresh = useCallback(async () => {
    if (!isDesktopApp()) return;
    try {
      setStatus(await invoke<BarDesktopStatus>("cmd_bar_status"));
      setError(null);
    } catch {
      setError("This version of the desktop app can't launch BAR yet. Update Weered.");
    }
  }, []);

  const setDir = useCallback(async (dir: string) => {
    try {
      setStatus(await invoke<BarDesktopStatus>("cmd_bar_set_dir", { dir }));
      setError(null);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { desktop, status, error, refresh, setDir };
}

/** Ctrl+Shift+F8 in the desktop app flips the room screen share, even mid-game. */
export function useShareHotkey(enabled: boolean) {
  const voice: any = useVoice();
  useEffect(() => {
    if (!enabled) return;
    const onToggle = () => {
      try {
        voice?.toggleScreenShare?.();
      } catch {}
    };
    window.addEventListener("weered:share-toggle", onToggle);
    return () => window.removeEventListener("weered:share-toggle", onToggle);
  }, [enabled, voice]);
}

export async function launchBarForMe({
  launch,
  target,
  meId,
  users,
}: {
  launch: LaunchSnapshot;
  target: LaunchTarget;
  meId: string;
  users: Member[];
}): Promise<{ ok: boolean; message: string }> {
  const cfg = target.bar;
  if (!cfg) return { ok: false, message: "This launch has no BAR settings." };
  if (!isDesktopApp()) {
    return {
      ok: false,
      message:
        "Launching BAR needs the Weered desktop app. You can still watch the host's stream here.",
    };
  }

  let status: BarDesktopStatus;
  try {
    status = await invoke<BarDesktopStatus>("cmd_bar_status");
  } catch {
    return {
      ok: false,
      message: "This version of the desktop app can't launch BAR yet. Update Weered.",
    };
  }
  if (!status.found) {
    return {
      ok: false,
      message:
        "Weered can't find Beyond All Reason on this PC. Set its folder in the lobby's Room launcher tab.",
    };
  }
  if (status.error || !status.game) {
    return {
      ok: false,
      message: status.error || "BAR hasn't finished updating. Open it once first.",
    };
  }

  const byId = new Map(users.map((u) => [u.id, u]));
  const playerIds = launch.slots.filter((s) => s.slot === "player").map((s) => s.userId);
  const players = playerIds.map((id) => ({ userId: id, name: byId.get(id)?.name || id }));
  const observers = users
    .filter((u) => !playerIds.includes(u.id))
    .map((u) => ({ userId: u.id, name: u.name || u.id }));

  const plan = scriptFor({ game: status.game, cfg, players, observers, myUserId: meId });
  if ("error" in plan) return { ok: false, message: plan.error };

  try {
    await invoke<number>("cmd_bar_launch", { req: { script: plan.script, map: cfg.map } });
    return {
      ok: true,
      message:
        plan.role === "host"
          ? `Hosting as ${plan.name}. Share your screen to put the game in the room. Ctrl+Shift+F8 toggles it from inside BAR.`
          : `Joining as ${plan.name}. BAR is starting.`,
    };
  } catch (e: any) {
    return { ok: false, message: String(e?.message || e) };
  }
}

export function BarTargetSummary({ target, users }: { target: LaunchTarget; users: Member[] }) {
  const cfg = target.bar;
  if (!cfg) return null;
  const host = users.find((u) => u.id === cfg.hostUserId)?.name || "host";
  return (
    <span>
      {BAR_MODE_LABEL[cfg.mode]} · host {host}
      {cfg.mode === "team" ? ` · ${cfg.teams} teams` : ""}
      {!isDesktopApp() ? <span style={{ opacity: 0.6 }}> · desktop app needed to play</span> : null}
    </span>
  );
}

const ADDR_RE = /^[A-Za-z0-9.-]{1,100}(:\d{2,5})?$/;

export function BarSetupDialog({
  initial,
  members,
  onClose,
  onSubmit,
}: {
  initial?: LaunchTarget;
  members: Member[];
  onClose: () => void;
  onSubmit: (t: any) => void;
}) {
  const maps = useBarMaps();
  const prior = initial?.bar;
  const [query, setQuery] = useState("");
  const [map, setMap] = useState(prior?.map || "");
  const [mode, setMode] = useState<BarMode>(prior?.mode || "team");
  const [teams, setTeams] = useState(prior?.teams || 2);
  const [difficulty, setDifficulty] = useState<BarDifficulty>(prior?.difficulty || "normal");
  const [hostUserId, setHostUserId] = useState(prior?.hostUserId || members[0]?.id || "");
  const [hostAddress, setHostAddress] = useState(prior?.hostAddress || "");
  const [note, setNote] = useState(initial?.note || "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = maps || [];
    return (q ? rows.filter((m) => m.scriptName.toLowerCase().includes(q)) : rows).slice(0, 60);
  }, [maps, query]);

  const needsAddress = mode !== "vs-ai";
  const addressOk = !needsAddress || ADDR_RE.test(hostAddress.trim());
  const canSubmit = !!map && !!hostUserId && addressOk;

  function submit() {
    if (!canSubmit) return;
    onSubmit({
      kind: "bar",
      display: map,
      note: note.trim() ? note.trim().slice(0, 300) : undefined,
      bar: { map, mode, teams, difficulty, hostUserId, hostAddress: hostAddress.trim() },
    });
  }

  return (
    <div style={backdrop} onClick={onClose} role="presentation">
      <div
        style={dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Set up a BAR game"
      >
        <div style={eyebrow}>Beyond All Reason</div>
        <div style={title}>{initial ? "Change the game" : "Set up a game"}</div>

        <div style={label}>Map</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value.slice(0, 60))}
          placeholder={map || (maps ? `Search ${maps.length} maps` : "Loading maps…")}
          style={input}
        />
        <div style={mapList}>
          {filtered.map((m) => (
            <button
              key={m.fileName}
              type="button"
              onClick={() => setMap(m.scriptName)}
              style={{ ...mapRow, ...(m.scriptName === map ? mapRowActive : null) }}
            >
              <img src={barMapThumb(m.fileName)} alt="" loading="lazy" style={thumb} />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.scriptName}
              </span>
              <span style={meta}>
                {m.width && m.height ? `${m.width}×${m.height}` : ""}
                {m.startPositions ? ` · ${m.startPositions} starts` : ""}
              </span>
            </button>
          ))}
          {maps && filtered.length === 0 && (
            <div style={{ ...meta, padding: 8 }}>No map matches.</div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
          <div>
            <div style={label}>Mode</div>
            <select value={mode} onChange={(e) => setMode(e.target.value as BarMode)} style={input}>
              {(Object.keys(BAR_MODE_LABEL) as BarMode[]).map((k) => (
                <option key={k} value={k}>
                  {BAR_MODE_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          {mode === "team" ? (
            <div>
              <div style={label}>Teams</div>
              <select
                value={teams}
                onChange={(e) => setTeams(Number(e.target.value))}
                style={input}
              >
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} teams
                  </option>
                ))}
              </select>
            </div>
          ) : mode === "ffa" ? (
            <div />
          ) : (
            <div>
              <div style={label}>Difficulty</div>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as BarDifficulty)}
                style={input}
              >
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          )}
        </div>

        <div style={{ ...label, marginTop: 12 }}>Host</div>
        <select value={hostUserId} onChange={(e) => setHostUserId(e.target.value)} style={input}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.id}
            </option>
          ))}
        </select>

        <div style={{ ...label, marginTop: 12 }}>
          Host address {needsAddress ? "" : "(optional)"}
        </div>
        <input
          value={hostAddress}
          onChange={(e) => setHostAddress(e.target.value.slice(0, 106))}
          placeholder={`203.0.113.7:${BAR_DEFAULT_PORT}`}
          style={{
            ...input,
            borderColor: addressOk ? "rgba(255,255,255,.1)" : "rgba(239,68,68,.5)",
          }}
        />
        <div style={hint}>
          The host's public IP with UDP port {BAR_DEFAULT_PORT} forwarded, or everyone's shared VPN
          address. These games don't go through BAR's servers, so they're unrated.
        </div>

        <div style={{ ...label, marginTop: 12 }}>Note (optional)</div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 300))}
          placeholder="No rush until 20"
          style={input}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            style={{
              ...primaryBtn,
              opacity: canSubmit ? 1 : 0.45,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {initial ? "Update game" : "Set game"}
          </button>
        </div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "rgba(5,5,10,.72)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const dialog: React.CSSProperties = {
  width: "min(540px, calc(100% - 32px))",
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
  background: "rgba(18,18,26,.98)",
  border: "1px solid rgba(79,163,224,.35)",
  borderRadius: 14,
  padding: "22px 24px",
  boxShadow: "0 24px 64px rgba(0,0,0,.55)",
};
const eyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: "rgba(147,197,253,.85)",
  marginBottom: 4,
};
const title: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "rgba(243,244,246,.95)",
  marginBottom: 14,
};
const label: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: "rgba(148,163,184,.72)",
  marginBottom: 5,
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  background: "rgba(0,0,0,.3)",
  border: "1px solid rgba(255,255,255,.1)",
  color: "rgba(243,244,246,.95)",
  fontFamily: "inherit",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};
const hint: React.CSSProperties = {
  fontSize: 10,
  color: "rgba(148,163,184,.6)",
  marginTop: 4,
  lineHeight: 1.45,
};
const mapList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  marginTop: 6,
  maxHeight: 220,
  overflowY: "auto",
};
const mapRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "4px 8px",
  borderRadius: 6,
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.07)",
  color: "rgba(229,231,235,.88)",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  fontSize: 12,
};
const mapRowActive: React.CSSProperties = {
  background: "rgba(79,163,224,.16)",
  borderColor: "rgba(79,163,224,.55)",
};
const thumb: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 4,
  objectFit: "cover",
  flexShrink: 0,
  background: "#111",
};
const meta: React.CSSProperties = {
  fontSize: 10,
  color: "rgba(148,163,184,.7)",
  fontFamily: "ui-monospace, monospace",
  flexShrink: 0,
};
const ghostBtn: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 8,
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.1)",
  color: "rgba(203,213,225,.75)",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
const primaryBtn: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 8,
  background: "rgba(79,163,224,.2)",
  border: "1px solid rgba(79,163,224,.55)",
  color: "#bfdbfe",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 700,
};
