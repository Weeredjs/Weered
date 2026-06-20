"use client";

import React from "react";

// Custom window chrome for the Tauri desktop shell (Docker-style title bar).
// Renders ONLY when running inside the desktop build that ships custom chrome —
// that binary injects `window.__WEERED_DESKTOP_CHROME__` (see src-tauri on_page_load)
// and runs decorations:false. In a browser or an older binary the flag is never
// set, so this renders nothing and the layout is untouched.

function tauriWin(): any {
  try {
    return (window as any)?.__TAURI__?.window?.getCurrentWindow?.() || null;
  } catch {
    return null;
  }
}

export default function DesktopTitleBar() {
  const [active, setActive] = React.useState(false);
  const [maxd, setMaxd] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    function syncMax() {
      const win = tauriWin();
      win
        ?.isMaximized?.()
        .then((m: boolean) => {
          if (!cancelled) setMaxd(!!m);
        })
        .catch(() => {});
    }

    function activate() {
      if (cancelled) return;
      document.documentElement.setAttribute("data-weered-desktop", "1");
      setActive(true);
      syncMax();
      const win = tauriWin();
      win
        ?.onResized?.(() => syncMax())
        .then((u: () => void) => {
          unlisten = u;
        })
        .catch(() => {});
    }

    const w = window as any;
    if (w.__WEERED_DESKTOP_CHROME__) {
      activate();
    } else {
      // The flag is injected around page load — poll briefly for it, then give up.
      let tries = 0;
      const id = setInterval(() => {
        if (cancelled) {
          clearInterval(id);
          return;
        }
        if (w.__WEERED_DESKTOP_CHROME__) {
          clearInterval(id);
          activate();
        } else if (++tries > 30) clearInterval(id); // ~3s
      }, 100);
      return () => {
        cancelled = true;
        clearInterval(id);
        try {
          unlisten?.();
        } catch {}
      };
    }

    return () => {
      cancelled = true;
      try {
        unlisten?.();
      } catch {}
    };
  }, []);

  if (!active) return null;

  const onMin = () => tauriWin()?.minimize?.();
  const onMax = () => tauriWin()?.toggleMaximize?.();
  const onClose = () => tauriWin()?.close?.();

  return (
    <div className="weered-titlebar" data-tauri-drag-region>
      <div className="wtb-brand" data-tauri-drag-region>
        <img src="/brand/weered-mark.png" alt="" className="wtb-mark" draggable={false} />
        <span className="wtb-word">Weered</span>
      </div>
      <div className="wtb-drag" data-tauri-drag-region />
      <div className="wtb-controls">
        <button
          type="button"
          className="wtb-btn"
          onClick={onMin}
          aria-label="Minimize"
          title="Minimize"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
            <rect x="1" y="5" width="9" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className="wtb-btn"
          onClick={onMax}
          aria-label={maxd ? "Restore" : "Maximize"}
          title={maxd ? "Restore" : "Maximize"}
        >
          {maxd ? (
            <svg
              width="11"
              height="11"
              viewBox="0 0 11 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              aria-hidden="true"
            >
              <rect x="1" y="3" width="6" height="6" />
              <path d="M3 3V1h7v7H8" />
            </svg>
          ) : (
            <svg
              width="11"
              height="11"
              viewBox="0 0 11 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              aria-hidden="true"
            >
              <rect x="1" y="1" width="9" height="9" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="wtb-btn wtb-close"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 11 11"
            stroke="currentColor"
            strokeWidth="1"
            aria-hidden="true"
          >
            <path d="M1 1l9 9M10 1l-9 9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
