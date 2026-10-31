"use client";

// Describe it: the one box every builder uses (lib/aiBuild.ts). Type what you
// want and it builds; the line under it says what changed, with Undo. The
// composer shows it as a panel; Design mode and Change your drip as a bar.
// Styles: app/styles/54-build.css.
import React, { useEffect, useRef, useState } from "react";
import { buildErrorText } from "../../lib/aiBuild";

type Kind = "lobby" | "edit" | "drip";
export type DescribeResult = { summary: string; undo?: () => void };

const STEPS: Record<Kind, string[]> = {
  lobby: [
    "Reading what you want…",
    "Picking the rooms…",
    "Choosing a look…",
    "Writing the welcome…",
    "Putting it together…",
  ],
  edit: ["Reading the room…", "Making the change…", "Checking it fits…"],
  drip: ["Picking colours…", "Trying it on…"],
};

export default function DescribeBox({
  kind,
  accent,
  variant = "panel",
  label,
  placeholder,
  placeholderAfter,
  examples,
  initial = "",
  autoRun = false,
  autoFocus = false,
  onBuild,
  onClose,
}: {
  kind: Kind;
  accent: string;
  variant?: "panel" | "bar";
  label?: string;
  placeholder: string;
  /** Once something is built: what to suggest next. */
  placeholderAfter?: string;
  examples?: string[];
  initial?: string;
  /** Build `initial` straight away (Home's box hands its words over). */
  autoRun?: boolean;
  autoFocus?: boolean;
  onBuild: (prompt: string) => Promise<DescribeResult>;
  onClose?: () => void;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<DescribeResult | null>(null);
  const [err, setErr] = useState("");
  const ran = useRef(false);
  const steps = STEPS[kind];

  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1900);
    return () => clearInterval(t);
  }, [busy, steps.length]);

  async function go(prompt = text) {
    const p = prompt.trim();
    if (p.length < 3 || busy) return;
    setBusy(true);
    setErr("");
    setDone(null);
    try {
      setDone(await onBuild(p));
      setText("");
    } catch (e) {
      setErr(buildErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!autoRun || ran.current || initial.trim().length < 3) return;
    ran.current = true;
    void go(initial);
    // Once, with the words it was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, initial]);

  const ph = done && placeholderAfter ? placeholderAfter : placeholder;
  const field =
    variant === "panel" ? (
      <textarea
        className="db-input"
        value={text}
        rows={2}
        maxLength={600}
        placeholder={ph}
        aria-label={label || ph}
        disabled={busy}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void go();
          }
        }}
      />
    ) : (
      <input
        className="db-input"
        value={text}
        maxLength={600}
        placeholder={ph}
        aria-label={label || ph}
        disabled={busy}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
      />
    );

  return (
    <div
      className={`db is-${variant}${busy ? " is-busy" : ""}`}
      style={{ "--db-accent": accent } as React.CSSProperties}
    >
      {label && (
        <div className="db-label">
          <span aria-hidden>✦</span> {label}
        </div>
      )}
      <form
        className="db-row"
        onSubmit={(e) => {
          e.preventDefault();
          void go();
        }}
      >
        {field}
        <button type="submit" className="db-go" disabled={busy || text.trim().length < 3}>
          {busy ? <span className="db-spin" aria-hidden /> : <span aria-hidden>✦</span>}
          {busy ? "Building" : "Build it"}
        </button>
        {onClose && (
          <button type="button" className="db-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}
      </form>
      {busy && (
        <div className="db-status" role="status">
          <span className="db-prog" aria-hidden />
          {steps[step]}
        </div>
      )}
      {!busy && err && (
        <div className="db-err" role="alert">
          {err}
        </div>
      )}
      {!busy && done && (
        <div className="db-done" role="status">
          <span className="db-check" aria-hidden>
            ✓
          </span>
          <span className="db-sum">{done.summary || "Done."}</span>
          {done.undo && (
            <button
              type="button"
              className="db-undo"
              onClick={() => {
                done.undo?.();
                setDone(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
      {!busy && !done && !err && examples && examples.length > 0 && (
        <div className="db-examples">
          <span className="db-try">Try</span>
          {examples.map((x) => (
            <button
              key={x}
              type="button"
              className="db-ex"
              onClick={() => {
                setText(x);
                void go(x);
              }}
            >
              {x}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
