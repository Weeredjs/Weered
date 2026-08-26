"use client";
import React from "react";

/**
 * Renders tabular boards defined in a lobby's moduleConfig.
 *
 * A community's own standings, records and ratings live in their systems, not
 * ours. Rather than invent an integration per community, a lobby can carry the
 * shape of a board in its config and we render it — which is also how a board
 * gets demonstrated before any integration exists.
 *
 * When the data is a placeholder, `sample` MUST be set. It draws a visible
 * notice, because a table of standings that looks live but is not is the kind
 * of thing someone screenshots and repeats.
 */
export type BoardSpec = {
  title?: string;
  blurb?: string;
  season?: string;
  columns?: string[];
  rows?: string[][];
};

function isStringGrid(rows: unknown): rows is string[][] {
  return (
    Array.isArray(rows) &&
    rows.every((r) => Array.isArray(r) && r.every((c) => typeof c === "string"))
  );
}

/** Defensive: moduleConfig is operator-entered JSON, so a malformed board
 *  should render as nothing rather than throw the whole panel away. */
export function readBoard(raw: unknown): BoardSpec | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const columns = Array.isArray(r.columns) ? r.columns.filter((c) => typeof c === "string") : [];
  const rows = isStringGrid(r.rows) ? r.rows : [];
  if (!columns.length || !rows.length) return null;
  return {
    title: typeof r.title === "string" ? r.title : undefined,
    blurb: typeof r.blurb === "string" ? r.blurb : undefined,
    season: typeof r.season === "string" ? r.season : undefined,
    columns: columns as string[],
    rows,
  };
}

export function SampleNotice({ accent }: { accent: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 8,
        marginBottom: 12,
        border: `1px solid ${accent}40`,
        background: `${accent}0d`,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: ".08em",
          padding: "2px 6px",
          borderRadius: 4,
          background: accent,
          color: "#0b0b0b",
        }}
      >
        SAMPLE
      </span>
      <span style={{ fontSize: 11, lineHeight: 1.5, opacity: 0.8 }}>
        Example layout with placeholder figures — not connected to live data yet. Point us at the
        source and this fills with the real thing.
      </span>
    </div>
  );
}

export function ConfigBoard({
  board,
  accent,
  sample,
}: {
  board: BoardSpec;
  accent: string;
  sample?: boolean;
}) {
  const cols = board.columns ?? [];
  const rows = board.rows ?? [];
  return (
    <div>
      {sample && <SampleNotice accent={accent} />}
      {board.title && (
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: ".01em" }}>{board.title}</div>
      )}
      {board.season && (
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{board.season}</div>
      )}
      {board.blurb && (
        <p style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.55, margin: "8px 0 0" }}>
          {board.blurb}
        </p>
      )}

      {/* Wide tables scroll in their own container so the panel never scrolls sideways. */}
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: i === 0 ? "left" : "right",
                    padding: "6px 10px",
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    opacity: 0.5,
                    borderBottom: "1px solid rgba(255,255,255,.09)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      textAlign: ci === 0 ? "left" : "right",
                      padding: "7px 10px",
                      borderBottom: "1px solid rgba(255,255,255,.04)",
                      whiteSpace: "nowrap",
                      // Leading column of a ranked table carries the accent so
                      // the eye lands on position before anything else.
                      color: ci === 0 ? accent : "rgba(243,244,246,.85)",
                      fontWeight: ci === 0 ? 700 : 500,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
