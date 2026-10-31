"use client";

// A describe-it result waiting for a yes (lib/aiBuild.ts describeJob): what it
// will make, and the button that makes it. Nothing is saved until that button.
// Styles: app/styles/54-build.css (.bp).
import React from "react";

export default function Proposal({
  accent,
  title,
  action,
  busy = false,
  error = "",
  note,
  onAction,
  onDismiss,
  children,
}: {
  accent: string;
  title: string;
  action: string;
  busy?: boolean;
  error?: string;
  note?: React.ReactNode;
  onAction?: () => void;
  onDismiss: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="bp" style={{ "--db-accent": accent } as React.CSSProperties}>
      <div className="bp-head">
        <span className="bp-title">
          <span aria-hidden>✦</span> {title}
        </span>
        <button type="button" className="bp-x" onClick={onDismiss} disabled={busy}>
          Not this
        </button>
      </div>
      {children && <div className="bp-body">{children}</div>}
      {note && <div className="bp-note">{note}</div>}
      {error && (
        <div className="bp-err" role="alert">
          {error}
        </div>
      )}
      {onAction && (
        <div className="bp-actions">
          <button type="button" className="bp-go" onClick={onAction} disabled={busy}>
            {busy ? "Saving…" : action}
          </button>
        </div>
      )}
    </div>
  );
}
