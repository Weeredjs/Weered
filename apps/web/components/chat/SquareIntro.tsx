"use client";

// The Town Square's one line, until "Got it": what this chat is and what the
// tags by the names mean (James 2026-11-12: the mall is "the entire premise of
// the platform"). Starts hidden on the server and the first render, so the
// page never redraws for it.

import React, { useEffect, useState } from "react";

const KEY = "weered_square_intro_v1";

export function SquareIntro() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  return (
    <div
      role="note"
      className="weered-square-intro"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "6px 10px 8px",
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid rgba(167,139,250,.28)",
        background: "rgba(124,58,237,.10)",
        fontSize: 12.5,
        lineHeight: 1.45,
        color: "var(--weered-text, rgba(226,232,240,.92))",
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <b>Town Square.</b> Everyone on Weered talks here. The tag by a name is the lobby
        they&apos;re from. Click it to walk in.
      </span>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {}
          setShow(false);
        }}
        style={{
          flexShrink: 0,
          padding: "3px 10px",
          borderRadius: 999,
          border: "1px solid rgba(167,139,250,.45)",
          background: "transparent",
          color: "inherit",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Got it
      </button>
    </div>
  );
}
