"use client";

// A rap sheet's page: the card, and what a viewer can do next. Its owner shares
// it or edits it; anyone else is asked to make their own (the point of sharing).
import React, { useEffect, useState } from "react";
import RapSheetCard from "../../../components/rap/RapSheetCard";
import { rapLink, type RapSheet } from "../../../lib/rapSheet";

const btn: React.CSSProperties = {
  padding: "11px 18px",
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};
const primary: React.CSSProperties = {
  ...btn,
  background: "#ff4d9d",
  color: "#0b0b0f",
  border: "1px solid #ff4d9d",
};
const quiet: React.CSSProperties = {
  ...btn,
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  border: "1px solid rgba(255,255,255,.14)",
};

export default function RapSheetView({ sheet }: { sheet: RapSheet }) {
  const [mine, setMine] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    try {
      const me = JSON.parse(localStorage.getItem("weered_user") || "null");
      setMine(!!me?.id && me.id === sheet.id);
    } catch {}
  }, [sheet.id]);

  const link = rapLink(sheet);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `${sheet.name}'s rap sheet`, url: link });
      else await copy();
    } catch {}
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px 16px 48px",
        background: "var(--weered-bg, #080810)",
        color: "rgba(243,244,246,.92)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto 18px", display: "flex", alignItems: "center" }}>
        <a
          href="/"
          style={{ color: "inherit", textDecoration: "none", fontWeight: 900, fontSize: 18 }}
        >
          weered
        </a>
      </div>
      <RapSheetCard sheet={sheet} />
      <div
        style={{
          maxWidth: 860,
          margin: "18px auto 0",
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {mine ? (
          <>
            <button type="button" onClick={share} style={primary}>
              Share your sheet
            </button>
            <button type="button" onClick={copy} style={quiet}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <a href="/rap" style={quiet}>
              Edit
            </a>
          </>
        ) : (
          <>
            <a href="/rap" style={primary}>
              Make your rap sheet
            </a>
            <button type="button" onClick={copy} style={quiet}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </>
        )}
      </div>
      {!mine && (
        <p
          style={{
            textAlign: "center",
            fontSize: 13,
            opacity: 0.55,
            margin: "14px auto 0",
            maxWidth: 520,
          }}
        >
          Your crew, your handles, how and when you play: one link to drop anywhere. Free, on
          Weered.
        </p>
      )}
    </main>
  );
}
