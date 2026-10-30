"use client";

// What someone told the lobby's front door (API lib/lobbyDoor.ts DoorEntry):
// each question as it was asked with their answer, and the boxes they ticked.
// Shown with a join request and under a member; moderators and up only (the
// API leaves it out for anyone below).
import React from "react";

export function DoorAnswers({ entry }: { entry: unknown }) {
  const e = entry && typeof entry === "object" ? (entry as any) : null;
  if (!e) return null;
  const answers: { q: string; a: string }[] = (Array.isArray(e.answers) ? e.answers : []).filter(
    (x: any) => x && typeof x.q === "string" && typeof x.a === "string",
  );
  const ticked = [e.rulesAccepted && "Accepted the rules", e.age18 && "Confirmed 18+"].filter(
    Boolean,
  ) as string[];
  if (!answers.length && !ticked.length) return null;
  return (
    <div
      style={{
        marginTop: 6,
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(255,255,255,.03)",
        border: "1px solid rgba(255,255,255,.06)",
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      {answers.map((x, i) => (
        <div key={i} style={{ marginBottom: 5 }}>
          <div style={{ opacity: 0.55 }}>{x.q}</div>
          <div style={{ fontWeight: 600, color: "rgba(243,244,246,.92)", whiteSpace: "pre-wrap" }}>
            {x.a}
          </div>
        </div>
      ))}
      {ticked.length > 0 && <div style={{ fontSize: 11, opacity: 0.55 }}>{ticked.join(" · ")}</div>}
    </div>
  );
}
