"use client";

// Design your Weered: Design mode for the viewer's own sidebars and Home,
// built like a lobby's (components/lobby-design). The shell itself is the
// canvas, slid right to make room for the build panel; the top bar carries
// undo, redo, discard and save. Opened from Home's ✦ Design, from Settings,
// or by landing on /home?design=1.
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconBtn, chip, panel } from "../lobby-design/designerKit";
import Confetti from "../composer/Confetti";
import { useWeered } from "../WeeredProvider";
import { hideItem, findItem, type ShellRegion } from "../../lib/shellLayout";
import {
  discardDesign,
  editLayout,
  isDirty,
  redo,
  saveDesign,
  selectItem,
  startDesign,
  stopDesign,
  undo,
  useShellDesign,
} from "../../lib/shellDesign";
import { paletteColours } from "../../lib/uiPrefs";
import { weeredToast } from "../../lib/toast";
import ShellDesignOverlay from "./ShellDesignOverlay";
import { LayoutsTab, LookTab, SectionsTab } from "./ShellDesignPanels";
import ShellInspector from "./ShellInspector";

type Tab = "sections" | "layouts" | "look";
let mounted_ = 0;
const NARROW = 1180;

export default function ShellDesigner() {
  const s = useShellDesign();
  const { me } = useWeered() as any;
  const [tab, setTab] = useState<Tab>("sections");
  const [addTo, setAddTo] = useState<ShellRegion>("left");
  const [armed, setArmed] = useState(false);
  // The build panel can step aside so the page gets the whole window; it
  // comes back when something is picked, since the inspector lives in it.
  const [panelOpen, setPanelOpen] = useState(true);
  useEffect(() => {
    if (s.selected) setPanelOpen(true);
  }, [s.selected]);
  useEffect(() => {
    const d = document.documentElement;
    if (s.designing && !panelOpen) d.setAttribute("data-weered-shell-design-panel", "off");
    else d.removeAttribute("data-weered-shell-design-panel");
    return () => d.removeAttribute("data-weered-shell-design-panel");
  }, [s.designing, panelOpen]);
  const [confetti, setConfetti] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // /home?design=1 opens Design mode (Settings links here).
  useEffect(() => {
    mounted_++;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("design") === "1") {
        url.searchParams.delete("design");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        startDesign();
      }
    } catch {}
    // Leaving Home leaves Design mode; the draft stays in this browser. Only
    // when no designer is left: React mounts twice in development, and a
    // remount must not close what the first mount opened.
    return () => {
      mounted_--;
      setTimeout(() => {
        if (mounted_ === 0) stopDesign();
      }, 0);
    };
  }, []);

  // Design mode needs the room for the panel beside the shell.
  useEffect(() => {
    if (s.designing && window.innerWidth < NARROW) {
      stopDesign();
      weeredToast.info("Design needs a wider window. Try it on a computer.");
    }
  }, [s.designing]);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  // Keyboard: undo/redo, Delete removes the selection, Esc steps out.
  useEffect(() => {
    if (!s.designing) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && s.selected) {
        e.preventDefault();
        const key = s.selected;
        editLayout((l) => hideItem(l, key));
        selectItem(null);
      } else if (e.key === "Escape") {
        if (s.selected) selectItem(null);
        else stopDesign();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.designing, s.selected]);

  if (!mounted || !s.designing || !s.draft) return null;
  const d = s.draft;
  const colours = paletteColours(d.look.palette, d.look.accent);
  const accent = d.look.theme === "nebula" ? colours.a : "#8b5cf6";
  const hi = d.look.theme === "nebula" ? colours.hi : "#c4b5fd";
  const dirty = isDirty(s);
  const selected = s.selected && findItem(d.layout, s.selected) ? s.selected : null;

  const save = async () => {
    const rightBefore = JSON.stringify(s.base?.layout.right);
    const res = await saveDesign();
    if (res === "ok") {
      setConfetti((n) => n + 1);
      if (JSON.stringify(d.layout.right) !== rightBefore && d.layout.right.length)
        window.dispatchEvent(new Event("weered:rail:open-right"));
    } else if (res === "too_large")
      weeredToast.error(
        "That's more than a layout can hold. Shorten a few blocks (long lists and banners take the most room), then Save.",
      );
    else weeredToast.error("Couldn't save to your account. Check your connection and try again.");
  };

  return createPortal(
    <>
      <ShellDesignOverlay accent={accent} light={d.look.theme === "nebula" && !!colours.light} />

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        className="weered-shell-design-bar"
        style={{
          ...panel,
          top: 12,
          left: panelOpen ? 344 : 12,
          right: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px 8px 16px",
          borderRadius: 999,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontWeight: 900,
            letterSpacing: ".04em",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: accent, fontSize: 16 }}>✦</span> Design your Weered
        </span>
        <span
          style={{ width: 1, height: 20, background: "rgba(255,255,255,.12)", margin: "0 4px" }}
        />
        <IconBtn title="Undo (Ctrl+Z)" disabled={!s.canUndo} onClick={undo}>
          ↶
        </IconBtn>
        <IconBtn title="Redo (Ctrl+Shift+Z)" disabled={!s.canRedo} onClick={redo}>
          ↷
        </IconBtn>
        <button
          type="button"
          style={chip(panelOpen, accent)}
          title={panelOpen ? "Hide the panel: the page gets the whole window" : "Show the panel"}
          onClick={() => setPanelOpen((v) => !v)}
        >
          {panelOpen ? "Hide panel" : "Show panel"}
        </button>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 12,
            color: "rgba(243,244,246,.55)",
            minWidth: 80,
            textAlign: "center",
          }}
        >
          {s.saving === "saving"
            ? "Saving…"
            : s.saving === "saved" && !dirty
              ? "● Saved"
              : s.saving === "error"
                ? "Not saved"
                : dirty
                  ? "Unsaved changes"
                  : "Up to date"}
        </span>
        <button
          type="button"
          disabled={!dirty}
          title={dirty ? "Throw away what you changed" : "Nothing to discard"}
          style={{
            ...chip(false, accent),
            ...(armed
              ? { background: "#dc2626", borderColor: "#dc2626", color: "#fff" }
              : { color: "rgba(243,244,246,.7)" }),
            opacity: dirty ? 1 : 0.4,
            cursor: dirty ? "pointer" : "default",
          }}
          onClick={() => {
            if (!armed) return setArmed(true);
            setArmed(false);
            discardDesign();
          }}
        >
          {armed ? "Throw it away?" : "Discard"}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={s.saving === "saving" || !me}
          style={{
            padding: "9px 18px",
            borderRadius: 999,
            border: "none",
            background: accent,
            color: d.look.theme === "nebula" ? colours.on : "#0b0b0f",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: `0 6px 20px ${accent}66`,
          }}
        >
          Save
        </button>
        <IconBtn title="Leave Design (Esc)" onClick={stopDesign}>
          ✕
        </IconBtn>
      </div>

      {/* ── Left: build panel / inspector ───────────────────────────────── */}
      <div
        className="weered-shell-design-panel"
        hidden={!panelOpen}
        style={{
          ...panel,
          top: 12,
          left: 12,
          bottom: 12,
          width: 320,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {selected ? (
          <div style={{ overflow: "auto", padding: 16, flex: 1 }}>
            <ShellInspector accent={accent} layout={d.layout} selected={selected} />
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: 4,
                padding: 8,
                borderBottom: "1px solid rgba(255,255,255,.08)",
              }}
            >
              {(["sections", "layouts", "look"] as Tab[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  style={{ ...chip(tab === k, accent), flex: 1 }}
                >
                  {k === "sections" ? "Sections" : k === "layouts" ? "Layouts" : "Look"}
                </button>
              ))}
            </div>
            <div style={{ overflow: "auto", padding: "4px 14px 16px", flex: 1 }}>
              {tab === "sections" && (
                <SectionsTab
                  accent={accent}
                  layout={d.layout}
                  tier={me?.tier}
                  addTo={addTo}
                  setAddTo={setAddTo}
                />
              )}
              {tab === "layouts" && <LayoutsTab accent={accent} hi={hi} layout={d.layout} />}
              {tab === "look" && <LookTab accent={accent} look={d.look} />}
            </div>
            <div
              style={{
                padding: "10px 14px",
                borderTop: "1px solid rgba(255,255,255,.08)",
                fontSize: 11.5,
                opacity: 0.6,
                lineHeight: 1.45,
              }}
            >
              Click anything on the page to change it. Drag to move it.
            </div>
          </>
        )}
      </div>

      {confetti > 0 && <Confetti fire={confetti} colors={[accent, hi, "#ffffff"]} />}
    </>,
    document.body,
  );
}
