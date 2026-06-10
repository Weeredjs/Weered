"use client";

import React from "react";

export default function EmptyState({
  title,
  hint,
  icon,
  action,
  compact = false,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className="weered-empty"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 6 : 10,
        padding: compact ? "20px 16px" : "36px 20px",
        textAlign: "center",
        color: "var(--weered-muted, rgba(148,163,184,.7))",
      }}
    >
      {icon !== undefined && (
        <div
          className="weered-empty-icon"
          aria-hidden
          style={{
            fontSize: compact ? 22 : 28,
            opacity: 0.4,
            lineHeight: 1,
            filter: "grayscale(0.3)",
          }}
        >
          {icon}
        </div>
      )}
      <div
        className="weered-empty-title"
        style={{
          fontSize: compact ? 12 : 13,
          fontWeight: 700,
          color: "var(--weered-text, rgba(243,244,246,.9))",
          opacity: 0.72,
          letterSpacing: "0.01em",
        }}
      >
        {title}
      </div>
      {hint && (
        <div
          className="weered-empty-hint"
          style={{
            fontSize: compact ? 10 : 11,
            color: "var(--weered-muted, rgba(148,163,184,.5))",
            opacity: 0.75,
            maxWidth: 260,
            lineHeight: 1.45,
          }}
        >
          {hint}
        </div>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
