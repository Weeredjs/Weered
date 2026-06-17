"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWeered, useRoomUsers, type LaunchSnapshot, type LaunchTarget } from "../WeeredProvider";

const STEAM_LAUNCH_MODULE_TYPES = new Set(["WINDROSE"]);

export default function LaunchPad({ roomId, moduleType }: { roomId: string; moduleType?: string }) {
  const ctx: any = useWeered();
  const launch: LaunchSnapshot | null = (ctx?.launchByRoom || {})[roomId] ?? null;
  const steamLaunchable =
    !!moduleType && STEAM_LAUNCH_MODULE_TYPES.has(String(moduleType).toUpperCase());
  const users: any[] = useRoomUsers(roomId);
  const me = ctx?.me;
  const meId = String(me?.id || "");
  const meGlobalRole = String(me?.globalRole || "USER");
  const meta = ctx?.metaByRoom?.[roomId] || null;
  const ownerId = String(meta?.ownerId || "");
  const isOwner =
    !!meId && (meId === ownerId || ["GOD", "STAFF", "SUPPORT"].includes(meGlobalRole));

  const target: LaunchTarget | null = launch?.target ?? null;
  const [showSetup, setShowSetup] = useState(false);

  const slotByUser = useMemo(() => {
    const m = new Map<string, "player" | "observer">();
    for (const s of launch?.slots ?? []) m.set(s.userId, s.slot);
    return m;
  }, [launch?.slots]);
  const mySlot = slotByUser.get(meId) ?? "observer";
  const readySet = useMemo(() => new Set(launch?.ready ?? []), [launch?.ready]);
  const meReady = readySet.has(meId);

  const roomMembers = users.filter((u) => u?.id && u.id !== "operator");
  const players = roomMembers.filter((u) => slotByUser.get(u.id) === "player");
  const playerCount = players.length;
  const readyCount = players.filter((u) => readySet.has(u.id)).length;

  function send(msg: object) {
    try {
      ctx?.sendRaw?.(msg);
    } catch {}
  }

  const firedAt = launch?.firedAt ?? null;
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!firedAt) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [firedAt]);

  if (!steamLaunchable) return null;

  const COUNTDOWN_MS = 3500;
  const countdownLeft = firedAt ? Math.max(0, firedAt + COUNTDOWN_MS - now) : 0;
  const countdownSec = firedAt ? Math.max(0, Math.ceil(countdownLeft / 1000)) : 0;
  const countdownDone = !!firedAt && countdownLeft === 0;

  if (!target) {
    if (!isOwner) return null;
    return (
      <>
        <div style={barStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <PadIcon />
            <div style={{ minWidth: 0 }}>
              <div style={labelStyle}>Launch Pad</div>
              <div style={subStyle}>
                Set a Steam server target and rally the crew. MPlayer-style fire when ready.
              </div>
            </div>
          </div>
          <button type="button" onClick={() => setShowSetup(true)} style={primaryBtnStyle}>
            Set Target
          </button>
        </div>
        {showSetup && (
          <SetupDialog
            onClose={() => setShowSetup(false)}
            onSubmit={(t) => {
              send({ type: "launch:set", ...t });
              setShowSetup(false);
            }}
          />
        )}
      </>
    );
  }

  if (firedAt) {
    return (
      <CountdownOverlay
        target={target}
        sec={countdownSec}
        done={countdownDone}
        isPlayer={mySlot === "player"}
        isOwner={isOwner}
        onLaunch={() => {
          const url = `steam://connect/${target.connect}`;
          try {
            window.location.href = url;
          } catch {}
        }}
        onAbort={() => send({ type: "launch:abort" })}
      />
    );
  }

  return (
    <>
      <div style={barStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <PadIcon />
          <div style={{ minWidth: 0 }}>
            <div style={labelStyle}>Launch Pad · {target.display}</div>
            <div style={subStyle}>
              <span style={{ fontFamily: "ui-monospace, monospace" }}>{target.connect}</span>
              {target.note ? <span style={{ opacity: 0.6 }}> · {target.note}</span> : null}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <SlotButton
            active={mySlot === "player"}
            onClick={() => send({ type: "launch:slot", slot: "player" })}
          >
            Player
          </SlotButton>
          <SlotButton
            active={mySlot === "observer"}
            onClick={() => send({ type: "launch:slot", slot: "observer" })}
          >
            Observer
          </SlotButton>
        </div>

        {mySlot === "player" && (
          <button
            type="button"
            onClick={() => send({ type: "launch:ready", ready: !meReady })}
            style={{
              ...primaryBtnStyle,
              background: meReady ? "rgba(34,197,94,.22)" : "rgba(255,255,255,.05)",
              borderColor: meReady ? "rgba(34,197,94,.55)" : "rgba(255,255,255,.12)",
              color: meReady ? "#86efac" : "rgba(229,231,235,.85)",
            }}
          >
            {meReady ? "✓ Ready" : "Ready up"}
          </button>
        )}

        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            color: "rgba(203,213,225,.7)",
            whiteSpace: "nowrap",
          }}
        >
          {readyCount}/{playerCount} ready
        </div>

        {isOwner && (
          <>
            <button
              type="button"
              onClick={() => setShowSetup(true)}
              style={{ ...secondaryBtnStyle }}
              title="Change target"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => send({ type: "launch:clear" })}
              style={{ ...secondaryBtnStyle, color: "rgba(252,165,165,.85)" }}
              title="Clear target"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={playerCount === 0}
              onClick={() => send({ type: "launch:fire" })}
              style={{
                ...primaryBtnStyle,
                background:
                  playerCount === 0
                    ? "rgba(255,255,255,.05)"
                    : "linear-gradient(135deg, rgba(239,68,68,.3), rgba(234,88,12,.3))",
                borderColor: playerCount === 0 ? "rgba(255,255,255,.12)" : "rgba(239,68,68,.55)",
                color: playerCount === 0 ? "rgba(255,255,255,.35)" : "#fecaca",
                cursor: playerCount === 0 ? "not-allowed" : "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 800,
              }}
              title={
                playerCount === 0 ? "At least one player must slot in" : "Launch the countdown"
              }
            >
              {readyCount === playerCount && playerCount > 0 ? "Fire (all ready)" : "Fire"}
            </button>
          </>
        )}
      </div>

      {roomMembers.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: "8px 16px 10px",
            borderBottom: "1px solid rgba(124,58,237,.15)",
            background: "rgba(124,58,237,.03)",
          }}
        >
          {roomMembers.map((u) => {
            const slot = slotByUser.get(u.id) ?? "observer";
            const isReady = readySet.has(u.id);
            return (
              <span
                key={u.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 9px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  background:
                    slot === "player"
                      ? isReady
                        ? "rgba(34,197,94,.15)"
                        : "rgba(124,58,237,.15)"
                      : "rgba(255,255,255,.04)",
                  border: `1px solid ${
                    slot === "player"
                      ? isReady
                        ? "rgba(34,197,94,.4)"
                        : "rgba(124,58,237,.35)"
                      : "rgba(255,255,255,.08)"
                  }`,
                  color:
                    slot === "player" ? (isReady ? "#86efac" : "#c4b5fd") : "rgba(203,213,225,.55)",
                }}
              >
                <span style={{ fontSize: 10 }}>
                  {slot === "player" ? (isReady ? "✓" : "●") : "◎"}
                </span>
                {u.name || u.id}
              </span>
            );
          })}
        </div>
      )}

      {showSetup && (
        <SetupDialog
          initial={target}
          onClose={() => setShowSetup(false)}
          onSubmit={(t) => {
            send({ type: "launch:set", ...t });
            setShowSetup(false);
          }}
        />
      )}
    </>
  );
}

function CountdownOverlay({
  target,
  sec,
  done,
  isPlayer,
  isOwner,
  onLaunch,
  onAbort,
}: {
  target: LaunchTarget;
  sec: number;
  done: boolean;
  isPlayer: boolean;
  isOwner: boolean;
  onLaunch: () => void;
  onAbort: () => void;
}) {
  return (
    <div
      style={{
        position: "relative",
        padding: "24px 20px 26px",
        background: "linear-gradient(135deg, rgba(30,10,5,.85), rgba(40,14,7,.9))",
        borderBottom: "2px solid rgba(239,68,68,.35)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse at center, rgba(239,68,68,.18) 0%, transparent 70%)",
          animation: "weered-launch-pulse 1.2s ease-in-out infinite",
        }}
      />
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: "rgba(252,165,165,.75)",
          position: "relative",
        }}
      >
        {done ? "Go · Go · Go" : "Launching"}
      </div>
      {!done ? (
        <div
          style={{
            fontSize: 84,
            fontWeight: 900,
            lineHeight: 1,
            color: "#fecaca",
            textShadow: "0 0 40px rgba(239,68,68,.5)",
            fontVariantNumeric: "tabular-nums",
            position: "relative",
          }}
        >
          {sec}
        </div>
      ) : isPlayer ? (
        <button
          type="button"
          onClick={onLaunch}
          autoFocus
          style={{
            padding: "18px 44px",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: "4px",
            textTransform: "uppercase",
            color: "#fff",
            background: "linear-gradient(135deg, rgba(239,68,68,.85), rgba(234,88,12,.85))",
            border: "2px solid rgba(252,165,165,.6)",
            borderRadius: 10,
            cursor: "pointer",
            boxShadow: "0 0 40px rgba(239,68,68,.55), inset 0 1px 0 rgba(255,255,255,.18)",
            position: "relative",
            animation: "weered-launch-cta 0.9s ease-in-out infinite",
          }}
        >
          LAUNCH GAME
        </button>
      ) : (
        <div
          style={{
            fontSize: 14,
            color: "rgba(229,231,235,.85)",
            fontStyle: "italic",
            position: "relative",
          }}
        >
          Players are boarding the ship. Grab a seat and watch.
        </div>
      )}
      <div
        style={{
          fontSize: 11,
          color: "rgba(203,213,225,.7)",
          fontFamily: "ui-monospace, monospace",
          position: "relative",
        }}
      >
        {target.display} <span style={{ opacity: 0.5 }}>·</span> {target.connect}
      </div>
      {isOwner && (
        <button
          type="button"
          onClick={onAbort}
          style={{
            marginTop: 4,
            padding: "5px 12px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            background: "rgba(255,255,255,.05)",
            color: "rgba(252,165,165,.85)",
            border: "1px solid rgba(239,68,68,.3)",
            borderRadius: 6,
            cursor: "pointer",
            position: "relative",
          }}
        >
          Abort
        </button>
      )}
      <style>{`
        @keyframes weered-launch-pulse {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        @keyframes weered-launch-cta {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.03); }
        }
      `}</style>
    </div>
  );
}

function SetupDialog({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: LaunchTarget;
  onClose: () => void;
  onSubmit: (t: { appid: number; connect: string; display: string; note?: string }) => void;
}) {
  const [appid, setAppid] = useState(String(initial?.appid ?? 3041230));
  const [connect, setConnect] = useState(initial?.connect ?? "");
  const [display, setDisplay] = useState(initial?.display ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [publicServers, setPublicServers] = useState<any[] | null>(null);

  useEffect(() => {
    if (Number(appid) !== 3041230) {
      setPublicServers(null);
      return;
    }
    const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
    fetch(`${API}/windrose/public-servers`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && Array.isArray(j.servers)) setPublicServers(j.servers.slice(0, 10));
        else setPublicServers([]);
      })
      .catch(() => setPublicServers([]));
  }, [appid]);

  function submit() {
    const c = connect.trim();
    if (!c) return;
    let cleaned = c;
    const prefixMatch = c.match(/^steam:\/\/connect\/(.+)$/i);
    if (prefixMatch) cleaned = prefixMatch[1];
    onSubmit({
      appid: Number(appid) || 3041230,
      connect: cleaned,
      display: (display.trim() || cleaned).slice(0, 80),
      note: note.trim() ? note.trim().slice(0, 300) : undefined,
    });
  }

  return (
    <div style={dialogBackdropStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "rgba(196,181,253,.85)",
            marginBottom: 4,
          }}
        >
          Launch Target
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "rgba(243,244,246,.95)",
            marginBottom: 16,
          }}
        >
          {initial ? "Change target" : "Set a launch target"}
        </div>

        <div style={dialogFieldLabel}>Steam AppID</div>
        <input
          value={appid}
          onChange={(e) => setAppid(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
          placeholder="3041230"
          style={dialogInputStyle}
        />

        <div style={{ ...dialogFieldLabel, marginTop: 12 }}>Connect address</div>
        <input
          value={connect}
          onChange={(e) => setConnect(e.target.value)}
          placeholder="1.2.3.4:27015 or 1.2.3.4:27015/password"
          style={dialogInputStyle}
        />
        <div style={{ fontSize: 10, color: "rgba(148,163,184,.6)", marginTop: 4 }}>
          Paste a <code style={{ fontFamily: "ui-monospace, monospace" }}>steam://connect/...</code>{" "}
          URL and we'll strip it.
        </div>

        <div style={{ ...dialogFieldLabel, marginTop: 12 }}>Display name</div>
        <input
          value={display}
          onChange={(e) => setDisplay(e.target.value.slice(0, 80))}
          placeholder="Captain Morgan's Fleet"
          style={dialogInputStyle}
        />

        <div style={{ ...dialogFieldLabel, marginTop: 12 }}>Note (optional)</div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 300))}
          placeholder="Hard mode · 2x loot weekend"
          style={dialogInputStyle}
        />

        {publicServers && publicServers.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={dialogFieldLabel}>Or pick a live Windrose server</div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginTop: 6,
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {publicServers.map((s: any) => (
                <button
                  key={s.addr}
                  type="button"
                  onClick={() => {
                    setConnect(s.addr);
                    if (s.name) setDisplay(s.name);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid rgba(255,255,255,.08)",
                    color: "rgba(229,231,235,.85)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    fontSize: 12,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,.08)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.03)";
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {s.name || s.addr}
                  </span>
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 10,
                      color: "rgba(148,163,184,.7)",
                      flexShrink: 0,
                    }}
                  >
                    {s.players}/{s.maxPlayers}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!connect.trim()}
            style={{
              ...primaryBtnStyle,
              background: connect.trim() ? "rgba(124,58,237,.2)" : "rgba(255,255,255,.05)",
              borderColor: connect.trim() ? "rgba(124,58,237,.55)" : "rgba(255,255,255,.12)",
              color: connect.trim() ? "#c4b5fd" : "rgba(255,255,255,.4)",
              cursor: connect.trim() ? "pointer" : "not-allowed",
            }}
          >
            {initial ? "Update target" : "Set target"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SlotButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 10px",
        borderRadius: 6,
        background: active ? "rgba(124,58,237,.22)" : "rgba(255,255,255,.04)",
        border: `1px solid ${active ? "rgba(124,58,237,.55)" : "rgba(255,255,255,.1)"}`,
        color: active ? "#c4b5fd" : "rgba(203,213,225,.75)",
        fontFamily: "inherit",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </button>
  );
}

function PadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke="rgba(196,181,253,.55)" strokeWidth="1.5" />
      <path
        d="M12 3v4M12 17v4M3 12h4M17 12h4"
        stroke="rgba(196,181,253,.55)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3" fill="rgba(124,58,237,.7)" />
    </svg>
  );
}

const barStyle: React.CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 16px",
  borderBottom: "1px solid rgba(124,58,237,.18)",
  background: "linear-gradient(90deg, rgba(124,58,237,.08), rgba(124,58,237,.03))",
  minHeight: 48,
};
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(243,244,246,.92)",
  letterSpacing: "0.02em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const subStyle: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(148,163,184,.72)",
  marginTop: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const primaryBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 8,
  background: "rgba(124,58,237,.18)",
  border: "1px solid rgba(124,58,237,.45)",
  color: "#c4b5fd",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  letterSpacing: "0.02em",
  flexShrink: 0,
  whiteSpace: "nowrap",
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.1)",
  color: "rgba(203,213,225,.75)",
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  letterSpacing: "0.02em",
  flexShrink: 0,
  whiteSpace: "nowrap",
};
const dialogBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "rgba(5,5,10,.72)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const dialogStyle: React.CSSProperties = {
  width: "min(480px, calc(100% - 32px))",
  background: "rgba(18,18,26,.98)",
  border: "1px solid rgba(124,58,237,.35)",
  borderRadius: 14,
  padding: "22px 24px",
  boxShadow: "0 24px 64px rgba(0,0,0,.55)",
};
const dialogFieldLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: "rgba(148,163,184,.72)",
  marginBottom: 5,
};
const dialogInputStyle: React.CSSProperties = {
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
