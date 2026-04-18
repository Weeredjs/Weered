"use client";

import React from "react";
import { createRoot, Root } from "react-dom/client";

/**
 * Themed confirm dialog — drop-in for window.confirm, returns a Promise<boolean>.
 *
 *   const ok = await weeredConfirm({ title: "Delete post?", body: "This can't be undone." });
 *   if (!ok) return;
 *
 * Short call: weeredConfirm("Leave this lobby?")
 */

export type ConfirmOptions = {
  title?: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** If true, the confirm button gets a red destructive treatment. */
  destructive?: boolean;
};

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

function cleanup() {
  try {
    activeRoot?.unmount();
  } catch {}
  try {
    if (activeContainer && activeContainer.parentNode) {
      activeContainer.parentNode.removeChild(activeContainer);
    }
  } catch {}
  activeRoot = null;
  activeContainer = null;
}

export function weeredConfirm(input: string | ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);

  const opts: ConfirmOptions =
    typeof input === "string" ? { title: input } : input;

  return new Promise<boolean>((resolve) => {
    // Clean any previous confirm before mounting
    cleanup();

    const container = document.createElement("div");
    container.setAttribute("data-weered-confirm", "1");
    document.body.appendChild(container);
    const root = createRoot(container);

    activeContainer = container;
    activeRoot = root;

    function finish(result: boolean) {
      cleanup();
      resolve(result);
    }

    root.render(
      <ConfirmDialog
        {...opts}
        onConfirm={() => finish(true)}
        onCancel={() => finish(false)}
      />
    );
  });
}

function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") onConfirm();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [onCancel, onConfirm]);

  const confirmColor = destructive ? "#ef4444" : "var(--weered-accent-text, #c4b5fd)";
  const confirmBg = destructive
    ? "rgba(239,68,68,0.14)"
    : "var(--weered-accent-bg, rgba(124,58,237,0.18))";
  const confirmBorder = destructive
    ? "rgba(239,68,68,0.45)"
    : "var(--weered-accent-ring, rgba(124,58,237,0.45))";
  const confirmHover = destructive
    ? "rgba(239,68,68,0.24)"
    : "var(--weered-accent-bg, rgba(124,58,237,0.28))";

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 20,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.18s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--weered-panel, rgba(20,18,16,0.96))",
          border: "1px solid var(--weered-border2, rgba(148,163,184,0.28))",
          borderRadius: 14,
          padding: "22px 22px 18px",
          boxShadow:
            "0 24px 72px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), 0 0 48px var(--weered-accent-ring, rgba(124,58,237,0.1))",
          transform: visible ? "scale(1) translateY(0)" : "scale(0.96) translateY(8px)",
          transition: "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
          fontFamily: "inherit",
        }}
      >
        {title && (
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "var(--weered-text, rgba(243,244,246,0.95))",
              letterSpacing: "-0.01em",
              marginBottom: body ? 8 : 16,
            }}
          >
            {title}
          </div>
        )}
        {body && (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--weered-muted, rgba(148,163,184,0.75))",
              lineHeight: 1.55,
              marginBottom: 18,
            }}
          >
            {body}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--weered-border, rgba(148,163,184,0.2))",
              background: "transparent",
              color: "var(--weered-muted, rgba(148,163,184,0.8))",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLElement).style.color =
                "var(--weered-text, rgba(243,244,246,0.95))";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color =
                "var(--weered-muted, rgba(148,163,184,0.8))";
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${confirmBorder}`,
              background: confirmBg,
              color: confirmColor,
              fontSize: 12,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: "pointer",
              transition: "background 0.12s, transform 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = confirmHover;
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = confirmBg;
              (e.currentTarget as HTMLElement).style.transform = "none";
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
