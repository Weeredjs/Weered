"use client";

// The live preview: a miniature of the lobby being composed, redrawn on every
// pick. Theme art behind its veil, the ambient effect running, the tabs that
// will exist, the starter rooms, the game card, the chosen heading font, and
// the entrance replayed whenever it changes.
import React, { useEffect, useState } from "react";
import LobbyAmbient from "../LobbyAmbient";
import type { TabId } from "../../lib/lobbyLayout";
import { FONT_STACK, type ThemePreset } from "../../lib/lobbyThemePresets";
import { moduleOf, type FeatureId, type GameEntry } from "./catalog";
import { GameArt } from "./GameGrid";
import type { ThemeValue } from "./ThemePicker";
import { alpha } from "./ui";

const MODULE_ICON: Record<string, string> = {
  voice: "🎙",
  video: "📹",
  youtube: "▶",
  screen: "🖥",
};

function hash(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** A made-up "online now" count that wanders, for the preview only. */
function useFakeOnline(seed: string) {
  const [n, setN] = useState(() => 12 + (hash(seed) % 30));
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setN((v) => {
        const d = Math.round((Math.random() - 0.45) * 4);
        if (d !== 0) setBump((b) => b + 1);
        return Math.max(3, Math.min(240, v + d));
      });
    }, 1800);
    return () => clearInterval(t);
  }, []);
  return { n, bump };
}

export type PreviewRoom = { name: string; module: string | null };

export default function Preview({
  name,
  slug,
  description,
  game,
  preset,
  theme,
  tabs,
  landing,
  rooms,
  features,
  spinKey,
  replayKey,
}: {
  name: string;
  slug: string;
  description: string;
  game: GameEntry;
  preset: ThemePreset;
  theme: ThemeValue;
  tabs: { id: TabId; label: string }[];
  landing: TabId;
  rooms: PreviewRoom[];
  features: Record<FeatureId, boolean>;
  spinKey: number;
  replayKey: number;
}) {
  const accent = theme.accent;
  const display = name.trim() || "Your lobby";
  const head = FONT_STACK[theme.font];
  const online = useFakeOnline(display);
  const hasGame = game.id !== "NONE";
  const hasModule = moduleOf(game) !== "NONE";
  const entranceAnim =
    theme.entrance === "none"
      ? undefined
      : theme.entrance === "glitch"
        ? "cz-ent-glitch .7s steps(1, end) both, cz-ent-fade .7s both"
        : `cz-ent-${theme.entrance} .7s cubic-bezier(.2,.8,.2,1) both`;

  const headStyle: React.CSSProperties = {
    fontFamily: head,
    letterSpacing: theme.font === "display" || theme.font === "stencil" ? "0.4px" : "-0.3px",
  };

  const featureIcons = (
    [
      ["voice", "🎙", "Voice"],
      ["video", "📹", "Video"],
      ["screen", "🖥", "Screen"],
      ["youtube", "▶", "YouTube"],
      ["twitch", "📺", "Twitch"],
    ] as [FeatureId, string, string][]
  ).filter(([id]) => features[id]);

  return (
    <div
      key={spinKey}
      className="cz-anim"
      style={{ animation: spinKey ? "cz-flip .7s cubic-bezier(.2,.8,.2,1)" : undefined }}
    >
      <div
        style={{
          borderRadius: 18,
          overflow: "hidden",
          border: `1px solid ${alpha(accent, 0.35)}`,
          boxShadow: `0 30px 80px -20px ${alpha(accent, 0.45)}, 0 0 0 1px rgba(0,0,0,.4)`,
          background: "#05050a",
          transition: "box-shadow .4s, border-color .4s",
        }}
      >
        {/* Window chrome */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            background: "rgba(255,255,255,.04)",
            borderBottom: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <span aria-hidden style={{ display: "flex", gap: 5 }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <span
                key={c}
                style={{ width: 9, height: 9, borderRadius: 99, background: c, opacity: 0.8 }}
              />
            ))}
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 11,
              color: "rgba(226,232,240,.6)",
              background: "rgba(0,0,0,.35)",
              borderRadius: 7,
              padding: "4px 10px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            weered.ca/lobby/<span style={{ color: accent }}>{slug || "your-lobby"}</span>
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 9.5,
              fontWeight: 900,
              letterSpacing: "1px",
              color: "rgba(255,255,255,.7)",
            }}
          >
            <span
              className="cz-anim"
              style={{
                width: 6,
                height: 6,
                borderRadius: 99,
                background: "#ef4444",
                animation: "cz-pulse 1.4s infinite",
              }}
            />
            PREVIEW
          </span>
        </div>

        {/* Stage */}
        <div
          style={{
            position: "relative",
            minHeight: 520,
            background: preset.art,
            overflow: "hidden",
            transition: "background .4s",
          }}
        >
          <div aria-hidden style={{ position: "absolute", inset: 0, background: preset.veil }} />
          <LobbyAmbient effect={theme.effect} accent={accent} intensity={theme.intensity} />

          <div
            key={`${theme.entrance}-${replayKey}`}
            className="cz-anim"
            style={{ position: "relative", zIndex: 1, animation: entranceAnim }}
          >
            {/* Banner */}
            <div style={{ position: "relative", height: 88 }}>
              {hasGame ? (
                <GameArt game={game} height={88} radius={0} />
              ) : (
                <div
                  style={{
                    height: 88,
                    background: `linear-gradient(120deg, ${alpha(accent, 0.55)}, ${alpha(accent, 0.08)} 60%, transparent)`,
                  }}
                />
              )}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(180deg, transparent 20%, ${preset.veil})`,
                }}
              />
            </div>

            <div
              style={{ padding: "0 16px 16px", marginTop: -26, position: "relative", zIndex: 2 }}
            >
              {/* Identity */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
                <div
                  style={{
                    width: 54,
                    height: 54,
                    flex: "0 0 54px",
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 26,
                    fontWeight: 900,
                    color: "#fff",
                    background: `linear-gradient(135deg, ${accent}, ${alpha(accent, 0.55)})`,
                    border: "3px solid rgba(0,0,0,.55)",
                    boxShadow: `0 8px 24px ${alpha(accent, 0.5)}`,
                    ...headStyle,
                  }}
                >
                  {display.slice(0, 1).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1, paddingBottom: 2 }}>
                  <div
                    style={{
                      fontSize: 21,
                      fontWeight: 900,
                      color: "#fff",
                      lineHeight: 1.1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      textShadow: "0 2px 12px rgba(0,0,0,.6)",
                      ...headStyle,
                    }}
                  >
                    {display}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 4,
                      fontSize: 10.5,
                      color: "rgba(226,232,240,.75)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span
                        className="cz-anim"
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 99,
                          background: "#22c55e",
                          boxShadow: "0 0 8px #22c55e",
                          animation: "cz-pulse 2s infinite",
                        }}
                      />
                      <span
                        key={online.bump}
                        className="cz-anim"
                        style={{
                          fontWeight: 800,
                          color: "#fff",
                          display: "inline-block",
                          animation: "cz-pop .35s",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {online.n}
                      </span>
                      online
                    </span>
                    {hasGame && (
                      <span
                        style={{
                          padding: "1px 7px",
                          borderRadius: 99,
                          border: `1px solid ${alpha(accent, 0.45)}`,
                          color: accent,
                          fontWeight: 800,
                          fontSize: 9.5,
                          letterSpacing: ".4px",
                          textTransform: "uppercase",
                        }}
                      >
                        {game.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  color: description.trim() ? "rgba(241,245,249,.85)" : "rgba(203,213,225,.4)",
                  fontStyle: description.trim() ? "normal" : "italic",
                }}
              >
                {description.trim() || "Say what this place is about. One line does it."}
              </div>

              {/* Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  marginTop: 12,
                  padding: 3,
                  borderRadius: 10,
                  background: "rgba(0,0,0,.35)",
                  border: "1px solid rgba(255,255,255,.06)",
                  overflow: "hidden",
                }}
              >
                {tabs.map((t) => {
                  const on = t.id === landing;
                  return (
                    <span
                      key={t.id}
                      style={{
                        padding: "5px 9px",
                        borderRadius: 7,
                        fontSize: 11,
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                        color: on ? "#fff" : "rgba(226,232,240,.6)",
                        background: on ? alpha(accent, 0.85) : "transparent",
                        boxShadow: on ? `0 0 14px ${alpha(accent, 0.5)}` : "none",
                        transition: "all .25s",
                      }}
                    >
                      {t.label}
                    </span>
                  );
                })}
              </div>

              {/* Body */}
              {landing === "home" && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "14px 14px",
                    borderRadius: 12,
                    background: `linear-gradient(135deg, ${alpha(accent, 0.22)}, rgba(0,0,0,.25))`,
                    border: `1px solid ${alpha(accent, 0.3)}`,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", ...headStyle }}>
                    Welcome to {display}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(226,232,240,.7)", marginTop: 4 }}>
                    Pull up a chair. Rooms are open, the calendar is below.
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 9,
                      padding: "5px 12px",
                      borderRadius: 8,
                      background: accent,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    Jump in
                  </span>
                </div>
              )}

              {hasModule && (
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: 8,
                    borderRadius: 12,
                    background: "rgba(0,0,0,.35)",
                    border: "1px solid rgba(255,255,255,.07)",
                  }}
                >
                  <div style={{ width: 74, flex: "0 0 74px" }}>
                    <GameArt game={game} height={46} radius={8} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#fff", ...headStyle }}>
                      {game.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "rgba(226,232,240,.65)",
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {game.blurb}
                    </div>
                  </div>
                </div>
              )}

              <div
                style={{
                  marginTop: 12,
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: "rgba(226,232,240,.5)",
                }}
              >
                Rooms
              </div>
              {rooms.length === 0 ? (
                <div style={{ fontSize: 11, color: "rgba(203,213,225,.45)", marginTop: 6 }}>
                  No rooms yet.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 6,
                    marginTop: 6,
                  }}
                >
                  {rooms.slice(0, 6).map((r, i) => {
                    const inside = hash(r.name + display) % 5;
                    return (
                      <div
                        key={r.name}
                        className="cz-anim"
                        style={{
                          padding: "8px 9px",
                          borderRadius: 10,
                          background: "rgba(0,0,0,.38)",
                          border: `1px solid ${inside ? alpha(accent, 0.3) : "rgba(255,255,255,.07)"}`,
                          animation: `cz-pop .35s ${i * 50}ms backwards`,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 11.5,
                            fontWeight: 800,
                            color: "#fff",
                          }}
                        >
                          <span aria-hidden>{r.module ? MODULE_ICON[r.module] || "💬" : "💬"}</span>
                          <span
                            style={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {r.name}
                          </span>
                        </div>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 6 }}
                        >
                          {Array.from({ length: inside }).map((_, k) => (
                            <span
                              key={k}
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 99,
                                marginLeft: k ? -5 : 0,
                                border: "1.5px solid rgba(0,0,0,.6)",
                                background: `hsl(${(hash(r.name) + k * 67) % 360} 70% 60%)`,
                              }}
                            />
                          ))}
                          <span
                            style={{ fontSize: 9.5, color: "rgba(226,232,240,.55)", marginLeft: 4 }}
                          >
                            {inside ? `${inside} inside` : "empty"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {featureIcons.length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 12 }}>
                  {featureIcons.map(([id, icon, label]) => (
                    <span
                      key={id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 8px",
                        borderRadius: 99,
                        fontSize: 10,
                        fontWeight: 800,
                        color: "rgba(241,245,249,.8)",
                        background: "rgba(0,0,0,.35)",
                        border: "1px solid rgba(255,255,255,.08)",
                      }}
                    >
                      <span aria-hidden>{icon}</span>
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
