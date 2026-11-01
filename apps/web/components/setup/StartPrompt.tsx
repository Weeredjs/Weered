"use client";

// The one question a new account is asked, over its Home (James 2026-11-01:
// "They set up their account and can see the home page. They can choose...").
// Two answers, named for what's on screen rather than for who's choosing, since
// nobody picks "Simple" if it reads as "new here". Pointing at one shows it on
// the Home behind; picking one saves it. Both are layout presets
// (lib/shellLayout.ts), so Design's presets change it later. This replaced the
// three-step setup on first sign-in; /setup still runs the full one.
import { useEffect, useRef, useState } from "react";
import { presetLayout } from "../../lib/shellLayout";
import { previewShellLayout } from "../../lib/shellDesign";
import { saveUiPrefs } from "../../lib/uiPrefs";

const CHOICES = [
  {
    id: "clean",
    title: "Keep it clean",
    body: "Your places, your people, and a way to build. Everything else is a click away.",
  },
  {
    id: "weered",
    title: "Show me everything",
    body: "Live rooms, featured lobbies, news and both side panels.",
  },
] as const;

const ACCENT = "rgb(var(--nb-a, 139 92 246))";

export default function StartPrompt({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  // Focus lands on the card, not a choice: nothing is previewed until they
  // point at one (or tab to it).
  const card = useRef<HTMLDivElement>(null);
  // "Point at one" only means something with a mouse.
  const [canHover, setCanHover] = useState(false);

  const show = (id: string | null) => {
    setHover(id);
    previewShellLayout(id ? presetLayout(id) : null);
  };

  const pick = (id: string) => {
    if (busy) return;
    setBusy(true);
    const shell = presetLayout(id);
    previewShellLayout(null);
    saveUiPrefs({ ...(shell ? { shell } : {}), setup: "done", setupAt: new Date().toISOString() });
    onDone();
  };

  useEffect(() => {
    card.current?.focus();
    try {
      setCanHover(window.matchMedia("(hover: hover)").matches);
    } catch {}
    // Escape keeps the standard Weered, and never asks again.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && pick("weered");
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previewShellLayout(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="start-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99990,
        display: "grid",
        placeItems: "end center",
        padding: "16px 16px 48px",
        background: "linear-gradient(180deg, #00000000 30%, #000000b3 100%)",
        pointerEvents: "auto",
      }}
    >
      <div
        ref={card}
        tabIndex={-1}
        style={{
          outline: "none",
          width: "min(640px, 100%)",
          padding: 22,
          borderRadius: 18,
          background: "#0b0a14eb",
          border: "1px solid #ffffff1f",
          boxShadow: "0 24px 80px #000000b3",
          color: "#f4f3ff",
          backdropFilter: "blur(14px)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: ACCENT,
          }}
        >
          Welcome to Weered
        </div>
        <h2 id="start-title" style={{ margin: "6px 0 14px", fontSize: 24, fontWeight: 900 }}>
          How much do you want on screen?
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          {CHOICES.map((c) => (
            <button
              key={c.id}
              disabled={busy}
              onMouseEnter={() => show(c.id)}
              onMouseLeave={() => show(null)}
              onFocus={() => show(c.id)}
              onBlur={() => show(null)}
              onClick={() => pick(c.id)}
              style={{
                textAlign: "left",
                padding: "16px 16px 18px",
                borderRadius: 14,
                cursor: busy ? "default" : "pointer",
                color: "inherit",
                font: "inherit",
                background: hover === c.id ? "#ffffff14" : "#ffffff08",
                border: `1px solid ${hover === c.id ? ACCENT : "#ffffff1f"}`,
                transition: "background .15s, border-color .15s",
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{c.title}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.72 }}>{c.body}</div>
            </button>
          ))}
        </div>
        <p style={{ margin: "14px 2px 0", fontSize: 12, opacity: 0.6 }}>
          {canHover ? "Point at one to see it behind this. " : ""}Change it any time in Design,
          under presets.
        </p>
      </div>
    </div>
  );
}
