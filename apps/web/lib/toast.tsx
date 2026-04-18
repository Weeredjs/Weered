"use client";

import React from "react";
import { createRoot, Root } from "react-dom/client";

/**
 * Themed toast notifications. Fire-and-forget.
 *
 *   weeredToast("Copied to clipboard");
 *   weeredToast.error("Checkout failed");
 *   weeredToast.success("Profile saved");
 *
 * Stack up to 3. Auto-dismiss after 3.2s. Click to dismiss early.
 */

export type ToastKind = "info" | "success" | "error" | "warn";
export type ToastOptions = {
  kind?: ToastKind;
  duration?: number;
};

type ToastItem = {
  id: string;
  message: string;
  kind: ToastKind;
  duration: number;
  leaving?: boolean;
};

const listeners = new Set<(items: ToastItem[]) => void>();
let items: ToastItem[] = [];
let container: HTMLDivElement | null = null;
let root: Root | null = null;
let mounted = false;

function ensureMounted() {
  if (mounted || typeof document === "undefined") return;
  container = document.createElement("div");
  container.setAttribute("data-weered-toast-root", "1");
  document.body.appendChild(container);
  root = createRoot(container);
  root.render(<ToastStack />);
  mounted = true;
}

function emit() {
  listeners.forEach((l) => l([...items]));
}

function push(message: string, opts: ToastOptions = {}) {
  ensureMounted();
  const id = Math.random().toString(36).slice(2);
  const duration = opts.duration ?? 3200;
  const item: ToastItem = {
    id,
    message,
    kind: opts.kind ?? "info",
    duration,
  };
  items = [item, ...items].slice(0, 4);
  emit();
  setTimeout(() => dismiss(id), duration);
}

function dismiss(id: string) {
  items = items.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 200);
}

type ToastFn = ((message: string, opts?: ToastOptions) => void) & {
  info: (message: string, opts?: Omit<ToastOptions, "kind">) => void;
  success: (message: string, opts?: Omit<ToastOptions, "kind">) => void;
  error: (message: string, opts?: Omit<ToastOptions, "kind">) => void;
  warn: (message: string, opts?: Omit<ToastOptions, "kind">) => void;
};

const _weeredToast: ToastFn = ((message: string, opts?: ToastOptions) =>
  push(message, opts)) as ToastFn;
_weeredToast.info = (message, opts) => push(message, { ...opts, kind: "info" });
_weeredToast.success = (message, opts) => push(message, { ...opts, kind: "success" });
_weeredToast.error = (message, opts) => push(message, { ...opts, kind: "error" });
_weeredToast.warn = (message, opts) => push(message, { ...opts, kind: "warn" });

export const weeredToast = _weeredToast;

function ToastStack() {
  const [stack, setStack] = React.useState<ToastItem[]>(items);
  React.useEffect(() => {
    listeners.add(setStack);
    return () => {
      listeners.delete(setStack);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column-reverse",
        gap: 8,
        zIndex: 10001,
        pointerEvents: "none",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      {stack.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

const KIND_PALETTE: Record<ToastKind, { border: string; glow: string; iconColor: string }> = {
  info: {
    border: "var(--weered-accent-ring, rgba(124,58,237,0.45))",
    glow: "rgba(124,58,237,0.18)",
    iconColor: "var(--weered-accent-text, rgba(167,139,250,0.95))",
  },
  success: {
    border: "rgba(34,197,94,0.45)",
    glow: "rgba(34,197,94,0.18)",
    iconColor: "rgba(74,222,128,0.95)",
  },
  error: {
    border: "rgba(239,68,68,0.45)",
    glow: "rgba(239,68,68,0.20)",
    iconColor: "rgba(252,165,165,0.95)",
  },
  warn: {
    border: "rgba(245,158,11,0.45)",
    glow: "rgba(245,158,11,0.20)",
    iconColor: "rgba(251,191,36,0.95)",
  },
};

const KIND_ICON: Record<ToastKind, React.ReactNode> = {
  info: "●",
  success: "✓",
  error: "!",
  warn: "!",
};

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [mount, setMount] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setMount(true), 10);
    return () => clearTimeout(t);
  }, []);
  const palette = KIND_PALETTE[item.kind];

  return (
    <div
      onClick={onDismiss}
      style={{
        pointerEvents: "auto",
        cursor: "pointer",
        background: "var(--weered-panel, rgba(20,18,16,0.96))",
        border: `1px solid ${palette.border}`,
        borderRadius: 10,
        padding: "10px 14px 10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 260,
        maxWidth: 420,
        boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 24px ${palette.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
        opacity: mount && !item.leaving ? 1 : 0,
        transform: mount && !item.leaving ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.18s cubic-bezier(0.22, 1, 0.36, 1), transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
        fontFamily: "inherit",
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          borderRadius: 999,
          border: `1px solid ${palette.border}`,
          background: palette.glow,
          color: palette.iconColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        {KIND_ICON[item.kind]}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--weered-text, rgba(243,244,246,0.95))",
          lineHeight: 1.4,
        }}
      >
        {item.message}
      </span>
    </div>
  );
}
