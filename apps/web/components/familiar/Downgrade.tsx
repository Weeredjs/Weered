"use client";

// The Downgrade button (James 2026-11-04: "Oh you like discord? It can
// downgrade to that <show it morph into discord>"). On the lobbies in
// DOWNGRADE_LOBBIES: the page drains of colour while a fake install runs, then
// ./FamiliarView takes the whole screen; "Upgrade back to Weered" reverses it.
// ?downgrade=1 opens straight into it. A prop for the promo, built to film.
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import FamiliarView from "./FamiliarView";

/** The lobbies that show the button. */
export const DOWNGRADE_LOBBIES = ["downgrade"];

const STEPS = [
  "Removing the build tools…",
  "Unbranding your place…",
  "Hiding the good parts…",
  "Turning everything grey…",
];
const OUT_MS = 2600;
const BACK_MS = 900;

export default function Downgrade({
  lobbyId,
  accent = "#8b5cf6",
}: {
  lobbyId: string;
  accent?: string;
}) {
  const [phase, setPhase] = useState<"weered" | "out" | "old" | "back">("weered");
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (new URLSearchParams(location.search).get("downgrade") === "1") setPhase("old");
    } catch {}
  }, []);

  // The drain runs on the whole page, so it's a class on <html>.
  useEffect(() => {
    const d = document.documentElement;
    d.classList.toggle("weered-downgrading", phase === "out");
    d.classList.toggle("weered-downgraded", phase === "old" || phase === "back");
    return () => d.classList.remove("weered-downgrading", "weered-downgraded");
  }, [phase]);

  useEffect(() => {
    if (phase === "out") {
      setStep(0);
      const steps = STEPS.map((_, i) => setTimeout(() => setStep(i), (OUT_MS / STEPS.length) * i));
      const done = setTimeout(() => setPhase("old"), OUT_MS);
      return () => [...steps, done].forEach(clearTimeout);
    }
    if (phase === "back") {
      const done = setTimeout(() => setPhase("weered"), BACK_MS);
      return () => clearTimeout(done);
    }
  }, [phase]);

  return (
    <>
      <button
        type="button"
        className="weered-downgrade-btn"
        onClick={() => setPhase("out")}
        disabled={phase !== "weered"}
        title="See it the old way"
        style={{ borderColor: `${accent}88` }}
      >
        ⬇ Downgrade
      </button>
      {phase !== "weered" &&
        typeof document !== "undefined" &&
        createPortal(
          phase === "out" ? (
            <div className="weered-downgrade-install" role="status">
              <div className="weered-downgrade-box">
                <b>Downgrading…</b>
                <span>{STEPS[step]}</span>
                <span className="weered-downgrade-bar">
                  <span style={{ animationDuration: `${OUT_MS}ms` }} />
                </span>
              </div>
            </div>
          ) : (
            <div className="weered-downgrade-layer" data-leaving={phase === "back" || undefined}>
              <FamiliarView lobbyId={lobbyId} onUpgrade={() => setPhase("back")} />
            </div>
          ),
          document.body,
        )}
    </>
  );
}
