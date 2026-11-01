"use client";

import React, { useState } from "react";
import { useVoice } from "./VoiceContext";
import MicSettings from "./MicSettings";

// Discord-style persistent voice dock. Mounted globally (inside VoiceProvider),
// so it stays visible with live controls — speaker list, talking indicators,
// mute / deafen / settings / disconnect — as you navigate while in a voice room.

function avColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360} 52% 42%)`;
}

const MicIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </svg>
);
const MicOffIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
    <path d="M3.5 3.5l17 17" />
  </svg>
);
const HeadphoneIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="2.5" y="13.5" width="4" height="6" rx="1.5" />
    <rect x="17.5" y="13.5" width="4" height="6" rx="1.5" />
  </svg>
);
const HeadphoneOffIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="2.5" y="13.5" width="4" height="6" rx="1.5" />
    <rect x="17.5" y="13.5" width="4" height="6" rx="1.5" />
    <path d="M3.5 3.5l17 17" />
  </svg>
);
const LeaveIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
    <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
  </svg>
);

export default function VoiceDock({ roomMeta }: { roomMeta?: Record<string, { name?: string }> }) {
  const {
    connState,
    activeRoomId,
    tiles,
    muted,
    deafened,
    toggleMute,
    toggleDeafen,
    disconnect,
    volumes,
    setVolume,
    ptt,
    talking,
  } = useVoice();
  // Whose volume slider is open (click a person in the list).
  const [adjusting, setAdjusting] = useState<string | null>(null);

  if (connState !== "connected" && connState !== "connecting") return null;

  const live = connState === "connected";
  // The id is a fallback, not a label. A room made in the UI gets a generated
  // short id ("pWPHak") that reads as noise, and de-hyphenating one only ever
  // flattered ids that were hand-written to look like names.
  const roomName =
    roomMeta?.[activeRoomId || ""]?.name?.trim() || (activeRoomId || "").replaceAll("-", " ");

  return (
    <div className="weered-voicedock" role="region" aria-label="Voice connection">
      <style>{`
        .weered-voicedock {
          position: fixed; left: 12px; bottom: 38px; width: 256px; z-index: 65;
          background: rgba(14,13,20,.97); border: 1px solid rgba(124,58,237,.28);
          border-radius: 12px; box-shadow: 0 10px 32px rgba(0,0,0,.5);
          font-family: var(--font-rajdhani), var(--font-barlow), sans-serif;
          overflow: hidden; backdrop-filter: blur(8px);
        }
        .weered-voicedock .wvd-head {
          display: flex; align-items: center; gap: 7px; padding: 9px 12px;
          border-bottom: 1px solid rgba(255,255,255,.06);
        }
        .weered-voicedock .wvd-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.25); flex-shrink: 0; }
        .weered-voicedock .wvd-dot.on { background: #22c55e; box-shadow: 0 0 7px #22c55e; }
        .weered-voicedock .wvd-title { font-size: 11px; font-weight: 800; letter-spacing: .4px; color: #c8f7d4; text-transform: uppercase; }
        .weered-voicedock .wvd-room { font-size: 11px; color: rgba(226,232,240,.5); margin-left: auto; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: capitalize; }
        .weered-voicedock .wvd-list { max-height: 210px; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px; }
        .weered-voicedock .wvd-row { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 7px; }
        .weered-voicedock .wvd-row:hover { background: rgba(255,255,255,.04); }
        .weered-voicedock .wvd-av {
          width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; color: #fff;
          box-shadow: 0 0 0 2px transparent; transition: box-shadow .12s ease;
        }
        .weered-voicedock .wvd-av.speaking { box-shadow: 0 0 0 2px #22c55e, 0 0 9px rgba(34,197,94,.55); }
        .weered-voicedock .wvd-name { font-size: 13px; color: rgba(237,233,255,.92); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
        .weered-voicedock .wvd-mic { font-size: 11px; opacity: .8; flex-shrink: 0; }
        .weered-voicedock .wvd-empty { font-size: 12px; color: rgba(255,255,255,.4); padding: 8px 6px; }
        .weered-voicedock .wvd-row.other { cursor: pointer; }
        .weered-voicedock .wvd-vol { font-size: 10px; color: rgba(226,232,240,.55); flex-shrink: 0; }
        .weered-voicedock .wvd-volrow { display: flex; align-items: center; gap: 8px; padding: 2px 8px 6px 40px; font-size: 11px; color: rgba(226,232,240,.7); }
        .weered-voicedock .wvd-volrow input { flex: 1; accent-color: #8b5cf6; }
        .weered-voicedock .wvd-ptt { font-size: 11px; padding: 6px 12px; color: rgba(226,232,240,.6); border-top: 1px solid rgba(255,255,255,.06); }
        .weered-voicedock .wvd-ptt.on { color: #86efac; }
        .weered-voicedock .wvd-controls { display: flex; align-items: center; gap: 4px; padding: 8px 10px; border-top: 1px solid rgba(255,255,255,.06); background: rgba(255,255,255,.02); }
        .weered-voicedock .wvd-btn {
          width: 34px; height: 30px; border: 0; border-radius: 8px; background: transparent;
          color: rgba(226,232,240,.82); display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .12s ease, color .12s ease;
        }
        .weered-voicedock .wvd-btn:hover { background: rgba(255,255,255,.08); color: #fff; }
        .weered-voicedock .wvd-btn.active { background: rgba(239,68,68,.16); color: #fca5a5; }
        .weered-voicedock .wvd-btn.leave:hover { background: rgba(239,68,68,.85); color: #fff; }
        .weered-voicedock .wvd-spacer { flex: 1; }
        .weered-voicedock .wvd-gear { display: inline-flex; align-items: center; }
      `}</style>

      <div className="wvd-head">
        <span className={`wvd-dot${live ? " on" : ""}`} />
        <span className="wvd-title">{live ? "Voice Connected" : "Connecting…"}</span>
        {roomName && <span className="wvd-room">{roomName}</span>}
      </div>

      <div className="wvd-list">
        {tiles.length === 0 ? (
          <div className="wvd-empty">No one here yet.</div>
        ) : (
          tiles.map((t) => {
            const vol = volumes[t.identity] ?? 1;
            const open = !t.isLocal && adjusting === t.identity;
            const toggle = () => !t.isLocal && setAdjusting(open ? null : t.identity);
            return (
              <div key={t.sid}>
                <div
                  className={`wvd-row${t.isLocal ? "" : " other"}`}
                  {...(t.isLocal
                    ? {}
                    : {
                        role: "button",
                        tabIndex: 0,
                        title: "Their volume",
                        "aria-expanded": open,
                        onClick: toggle,
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggle();
                          }
                        },
                      })}
                >
                  <span
                    className={`wvd-av${t.isSpeaking ? " speaking" : ""}`}
                    style={{ background: avColor(t.identity || t.name || "?") }}
                  >
                    {(t.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="wvd-name">
                    {t.name || "Guest"}
                    {t.isLocal ? " (you)" : ""}
                  </span>
                  {!t.isLocal && vol < 1 && (
                    <span className="wvd-vol">{Math.round(vol * 100)}%</span>
                  )}
                  {t.isMuted && (
                    <span className="wvd-mic" title="Muted">
                      🔇
                    </span>
                  )}
                </div>
                {open && (
                  <div className="wvd-volrow">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(vol * 100)}
                      aria-label={`Volume for ${t.name || "Guest"}`}
                      onChange={(e) => setVolume(t.identity, Number(e.target.value) / 100)}
                    />
                    <span>{Math.round(vol * 100)}%</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {ptt.on && live && (
        <div className={`wvd-ptt${talking ? " on" : ""}`} aria-live="polite">
          {muted
            ? `Muted. Unmute to use ${ptt.label}.`
            : talking
              ? "Talking"
              : `Hold ${ptt.label} to talk`}
        </div>
      )}

      <div className="wvd-controls">
        <button
          className={`wvd-btn${muted ? " active" : ""}`}
          onClick={toggleMute}
          title={muted ? "Unmute" : "Mute"}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOffIcon /> : <MicIcon />}
        </button>
        <button
          className={`wvd-btn${deafened ? " active" : ""}`}
          onClick={toggleDeafen}
          title={deafened ? "Undeafen" : "Deafen"}
          aria-label={deafened ? "Undeafen" : "Deafen"}
        >
          {deafened ? <HeadphoneOffIcon /> : <HeadphoneIcon />}
        </button>
        <span className="wvd-gear">
          <MicSettings />
        </span>
        <div className="wvd-spacer" />
        <button
          className="wvd-btn leave"
          onClick={disconnect}
          title="Disconnect"
          aria-label="Disconnect"
        >
          <LeaveIcon />
        </button>
      </div>
    </div>
  );
}
