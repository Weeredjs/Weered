"use client";

// The Weered guide, opened by Home's "What can you do here?" (James
// 2026-10-30: "It has to be crazy more detailed about all the customization
// and new things"). Chapters down the side, each with buttons that open the
// thing it describes. Most of what it lists is read from the catalogs the
// features themselves use, so a new colourway, template or block shows up
// here without anyone editing this.
//
// A real dialog, portalled to <body>: the old one was a role="button" box,
// so the global button:hover (40-core-layout.css) turned it see-through
// under the pointer. Styles: app/styles/53-guide.css.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CHAPTERS, ChapterBody, type ChapterId, type GuideActions } from "./guideChapters";

export default function WeeredGuide({
  open,
  onClose,
  actions,
  start = "start",
}: {
  open: boolean;
  onClose: () => void;
  actions: GuideActions;
  start?: ChapterId;
}) {
  const [chapter, setChapter] = useState<ChapterId>(start);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Home re-renders on every presence change; the latest onClose without
  // re-running the effect below (which would pull focus back to the dialog).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (open) setChapter(start);
  }, [open, start]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    const was = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      was?.focus?.();
    };
  }, [open]);

  // Each chapter starts at its top.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [chapter]);

  if (!open || typeof document === "undefined") return null;

  const go = (id: ChapterId) => setChapter(id);
  const idx = CHAPTERS.findIndex((c) => c.id === chapter);
  const next = CHAPTERS[idx + 1];
  // Every button closes the guide, then does its thing.
  const design = actions.design;
  const act: GuideActions = {
    design: design
      ? () => {
          onClose();
          design();
        }
      : undefined,
    look: () => {
      onClose();
      actions.look();
    },
    build: () => {
      onClose();
      actions.build();
    },
    href: (path) => {
      onClose();
      actions.href(path);
    },
  };

  return createPortal(
    <div className="wg-overlay" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="wg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wg-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="wg-nav" aria-label="Guide chapters">
          <div className="wg-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- the Weered mark */}
            <img src="/brand/logo/weered-logo-64.png" alt="" />
            <span>
              <b>The Weered guide</b>
              <small>Everything you can do here</small>
            </span>
          </div>
          <div className="wg-nav-list">
            {CHAPTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`wg-nav-btn${c.id === chapter ? " is-on" : ""}`}
                aria-current={c.id === chapter ? "page" : undefined}
                onClick={() => go(c.id)}
                style={{ ["--wg-c" as string]: c.color }}
              >
                <span className="wg-nav-icon" aria-hidden>
                  {c.icon}
                </span>
                <span className="wg-nav-name">{c.name}</span>
                {c.fresh && <span className="wg-new">New</span>}
              </button>
            ))}
          </div>
        </nav>

        <div className="wg-main">
          <button type="button" className="wg-close" onClick={onClose} aria-label="Close the guide">
            ✕
          </button>
          <div className="wg-body" ref={bodyRef}>
            <ChapterBody id={chapter} go={go} actions={act} />
            {next && (
              <button type="button" className="wg-next" onClick={() => go(next.id)}>
                <span>Next</span>
                <b>
                  {next.icon} {next.name} →
                </b>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
