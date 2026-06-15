"use client";

import React from "react";
import { createRoot, Root } from "react-dom/client";

const REASONS: { id: string; label: string; hint: string }[] = [
  { id: "SPAM", label: "Spam", hint: "Repeated messages, links, advertising." },
  { id: "HARASSMENT", label: "Harassment", hint: "Targeted abuse, bullying, stalking." },
  { id: "HATE_SPEECH", label: "Hate speech", hint: "Attacks based on identity or group." },
  { id: "THREATS", label: "Threats / violence", hint: "Credible threats or incitement." },
  { id: "NSFW", label: "NSFW / explicit", hint: "Adult content in non-NSFW context." },
  { id: "MINOR_SAFETY", label: "Minor safety", hint: "Content that endangers a minor." },
  { id: "IMPERSONATION", label: "Impersonation", hint: "Pretending to be someone else." },
  { id: "SELF_HARM", label: "Self-harm", hint: "Content about hurting themselves." },
  { id: "OTHER", label: "Other", hint: "Something else — add context in the note." },
];

type ReportTarget = "MESSAGE" | "USER" | "ROOM" | "LOBBY";

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;
function cleanup() {
  try {
    activeRoot?.unmount();
  } catch {}
  try {
    if (activeContainer && activeContainer.parentNode)
      activeContainer.parentNode.removeChild(activeContainer);
  } catch {}
  activeRoot = null;
  activeContainer = null;
}

export function weeredReport(opts: {
  targetType: ReportTarget;
  targetId: string;
  context?: string;
}): Promise<{ ok: boolean; error?: string } | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    cleanup();
    const container = document.createElement("div");
    container.setAttribute("data-weered-report", "1");
    document.body.appendChild(container);
    const root = createRoot(container);
    activeRoot = root;
    activeContainer = container;

    function finish(result: { ok: boolean; error?: string } | null) {
      cleanup();
      resolve(result);
    }

    root.render(<ReportDialog {...opts} onDone={finish} />);
  });
}

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
function getToken(): string {
  try {
    return localStorage.getItem("weered_token") || "";
  } catch {
    return "";
  }
}

function ReportDialog({
  targetType,
  targetId,
  context,
  onDone,
}: {
  targetType: ReportTarget;
  targetId: string;
  context?: string;
  onDone: (r: { ok: boolean; error?: string } | null) => void;
}) {
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onDone(null);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [onDone, submitting]);

  async function submit() {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API_BASE}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          targetType,
          targetId,
          context,
          reason,
          note: note.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (j?.ok) onDone({ ok: true });
      else onDone({ ok: false, error: j?.error || "submit_failed" });
    } catch {
      onDone({ ok: false, error: "network_error" });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => !submitting && onDone(null)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10002,
        padding: 20,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.18s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--weered-panel, rgba(20,18,16,0.96))",
          border: "1px solid var(--weered-border2, rgba(148,163,184,0.28))",
          borderRadius: 14,
          padding: "22px 22px 18px",
          boxShadow: "0 24px 72px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
          transform: visible ? "scale(1) translateY(0)" : "scale(0.96) translateY(8px)",
          transition: "transform 0.22s cubic-bezier(0.22,1,0.36,1)",
          fontFamily: "inherit",
          color: "var(--weered-text, rgba(243,244,246,.95))",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
          Report this {targetType.toLowerCase()}.
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--weered-muted, rgba(148,163,184,.7))",
            marginBottom: 14,
          }}
        >
          Pick what's wrong. Staff will review. Abuse of reporting = mod action on you.
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            maxHeight: 260,
            overflowY: "auto",
            marginBottom: 12,
          }}
        >
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReason(r.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 2,
                padding: "8px 12px",
                borderRadius: 8,
                textAlign: "left",
                border:
                  reason === r.id
                    ? "1px solid var(--weered-accent-ring, rgba(124,58,237,.5))"
                    : "1px solid var(--weered-border, rgba(255,255,255,.06))",
                background:
                  reason === r.id ? "var(--weered-accent-bg, rgba(124,58,237,.14))" : "transparent",
                color:
                  reason === r.id
                    ? "var(--weered-accent-text, #c4b5fd)"
                    : "var(--weered-text, rgba(243,244,246,.9))",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.12s",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 13 }}>{r.label}</span>
              <span style={{ fontSize: 11, color: "var(--weered-muted, rgba(148,163,184,.65))" }}>
                {r.hint}
              </span>
            </button>
          ))}
        </div>
        <textarea
          placeholder="Optional: extra context (what happened, when, who's involved)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--weered-border, rgba(255,255,255,.1))",
            background: "var(--weered-panel2, rgba(0,0,0,.25))",
            color: "var(--weered-text, rgba(243,244,246,.95))",
            fontFamily: "inherit",
            fontSize: 13,
            outline: "none",
            marginBottom: 12,
          }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => onDone(null)}
            disabled={submitting}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--weered-border, rgba(148,163,184,.2))",
              background: "transparent",
              color: "var(--weered-muted, rgba(148,163,184,.8))",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: submitting ? "default" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!reason || submitting}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(239,68,68,0.45)",
              background: "rgba(239,68,68,0.16)",
              color: "rgba(252,165,165,.95)",
              fontSize: 12,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: !reason || submitting ? "not-allowed" : "pointer",
              opacity: !reason || submitting ? 0.5 : 1,
            }}
          >
            {submitting ? "Submitting..." : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}
