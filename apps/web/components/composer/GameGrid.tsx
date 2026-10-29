"use client";

// Step 2: "What are you doing here?" Big art cards grouped Work / Community /
// Games, a search box, a request field for anything we don't have yet, and a
// way into a custom-build meeting.
import React, { useMemo, useState } from "react";
import { GAMES, GROUPS, type GameEntry } from "./catalog";
import { FAINT, MUTED, TEXT, alpha, inputStyle, labelStyle } from "./ui";

export function GameArt({
  game,
  height,
  radius = 10,
  children,
}: {
  game: GameEntry;
  height: number | string;
  radius?: number;
  children?: React.ReactNode;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        height,
        borderRadius: radius,
        overflow: "hidden",
        background: game.image
          ? `linear-gradient(180deg, transparent 40%, rgba(0,0,0,.55)), url("${game.image}") center/cover no-repeat, ${game.art}`
          : game.art,
      }}
    >
      {!game.image && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
            fontSize: game.glyph.length > 2 ? 26 : 34,
            letterSpacing: "-1px",
            color: game.tint,
            textShadow: `0 0 24px ${alpha(game.tint, 0.6)}, 0 2px 0 rgba(0,0,0,.4)`,
            opacity: 0.92,
          }}
        >
          {game.glyph}
        </div>
      )}
      {children}
    </div>
  );
}

export default function GameGrid({
  value,
  accent,
  onPick,
  onRequest,
}: {
  value: string;
  accent: string;
  onPick: (g: GameEntry) => void;
  /** Resolves to the message to show under the field. */
  onRequest: (title: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<(typeof GROUPS)[number]["id"]>("all");
  const [req, setReq] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  const [reqMsg, setReqMsg] = useState<{ ok: boolean; message: string } | null>(null);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const inGroup = group === "all" ? GAMES : GAMES.filter((g) => g.group === group);
    if (!s) return inGroup;
    return GAMES.filter(
      (g) =>
        g.id === "NONE" ||
        g.name.toLowerCase().includes(s) ||
        g.tags.some((t) => t.includes(s)) ||
        g.blurb.toLowerCase().includes(s),
    );
  }, [q, group]);
  const realMatches = shown.filter((g) => g.id !== "NONE").length;

  async function submitRequest() {
    const title = (req || q).trim();
    if (title.length < 2 || reqBusy) return;
    setReqBusy(true);
    setReqMsg(null);
    const r = await onRequest(title);
    setReqMsg(r);
    setReqBusy(false);
    if (r.ok) setReq("");
  }

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: FAINT,
            fontSize: 14,
            pointerEvents: "none",
          }}
        >
          ⌕
        </span>
        <input
          type="search"
          aria-label="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search: team, clients, club, destiny, chess…"
          style={{ ...inputStyle, paddingLeft: 36 }}
        />
      </div>

      {!q.trim() && (
        <div
          role="tablist"
          aria-label="Kind"
          style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}
        >
          {GROUPS.map((gr) => {
            const on = group === gr.id;
            return (
              <button
                key={gr.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setGroup(gr.id)}
                className="cz-btn"
                style={{
                  minHeight: 34,
                  padding: "0 14px",
                  borderRadius: 999,
                  border: `1px solid ${on ? alpha(accent, 0.7) : "rgba(255,255,255,.1)"}`,
                  background: on ? alpha(accent, 0.2) : "rgba(255,255,255,.03)",
                  color: on ? TEXT : MUTED,
                  fontWeight: 800,
                  fontSize: 12.5,
                  letterSpacing: ".3px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {gr.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="cz-games" role="radiogroup" aria-label="What you're doing">
        {shown.map((g, i) => {
          const on = value === g.id;
          return (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={on}
              className="cz-card"
              onClick={() => onPick(g)}
              style={{
                textAlign: "left",
                padding: 6,
                borderRadius: 14,
                cursor: "pointer",
                fontFamily: "inherit",
                color: TEXT,
                background: on ? alpha(accent, 0.12) : "rgba(255,255,255,.025)",
                border: `1px solid ${on ? alpha(accent, 0.7) : "rgba(255,255,255,.08)"}`,
                boxShadow: on
                  ? `0 0 0 1px ${alpha(accent, 0.4)}, 0 10px 30px ${alpha(accent, 0.25)}`
                  : "none",
                minWidth: 0,
                // backwards, not both: a held transform would kill the hover lift.
                animation: `cz-pop .35s ${Math.min(i, 14) * 18}ms backwards`,
              }}
            >
              <GameArt game={g} height={86}>
                {on && (
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 22,
                      height: 22,
                      borderRadius: 99,
                      display: "grid",
                      placeItems: "center",
                      background: accent,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 900,
                      boxShadow: `0 0 16px ${accent}`,
                      animation: "cz-pop .3s both",
                    }}
                  >
                    ✓
                  </span>
                )}
              </GameArt>
              <div style={{ padding: "8px 4px 4px" }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 13.5,
                    letterSpacing: "-0.2px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {g.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    lineHeight: 1.35,
                    color: MUTED,
                    marginTop: 3,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    minHeight: 30,
                  }}
                >
                  {g.blurb}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {q.trim() && realMatches === 0 && (
        <div style={{ fontSize: 12.5, color: MUTED, marginTop: 12 }}>
          Nothing for “{q.trim()}” yet. Ask for it below and pick “Just a community” for now.
        </div>
      )}

      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 12,
          border: "1px dashed rgba(255,255,255,.14)",
          background: "rgba(255,255,255,.02)",
        }}
      >
        <label htmlFor="cz-request" style={{ ...labelStyle, marginBottom: 6 }}>
          Don&apos;t see it?
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            id="cz-request"
            value={req}
            onChange={(e) => setReq(e.target.value.slice(0, 80))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitRequest();
              }
            }}
            placeholder={
              q.trim() && realMatches === 0
                ? q.trim()
                : "e.g. Deep Rock Galactic, a booking calendar"
            }
            style={{ ...inputStyle, flex: "1 1 200px", minWidth: 0 }}
          />
          <button
            type="button"
            className="cz-btn"
            onClick={submitRequest}
            disabled={reqBusy || (req || q).trim().length < 2}
            style={{
              padding: "0 18px",
              minHeight: 44,
              borderRadius: 10,
              border: `1px solid ${alpha(accent, 0.5)}`,
              background: alpha(accent, 0.16),
              color: TEXT,
              fontWeight: 800,
              fontSize: 13,
              cursor: reqBusy ? "wait" : "pointer",
              fontFamily: "inherit",
              opacity: (req || q).trim().length < 2 ? 0.5 : 1,
              flex: "0 0 auto",
            }}
          >
            {reqBusy ? "Sending…" : "Request it"}
          </button>
        </div>
        <div
          role="status"
          style={{
            fontSize: 12,
            marginTop: 8,
            minHeight: 16,
            color: reqMsg ? (reqMsg.ok ? "rgba(74,222,128,.9)" : "rgba(252,165,165,.9)") : FAINT,
          }}
        >
          {reqMsg
            ? reqMsg.message
            : "It goes on the public request board. Popular asks get built first."}
        </div>
        <a
          href="/requests?meeting=1"
          target="_blank"
          rel="noopener"
          style={{
            display: "inline-block",
            marginTop: 10,
            fontSize: 13,
            fontWeight: 700,
            color: TEXT,
            textDecoration: "none",
            borderBottom: `1px solid ${alpha(accent, 0.6)}`,
          }}
        >
          Building for a business? I need a meeting →
        </a>
      </div>
    </div>
  );
}
