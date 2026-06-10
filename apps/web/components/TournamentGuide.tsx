"use client";

import React from "react";

const CHAMFER = "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";

type Step = {
  kicker: string;
  title: string;
  body: string;
  bullets?: string[];
  art: (accent: string) => React.ReactNode;
};

function Chip({ label, accent, on = true }: { label: string; accent: string; on?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px",
      background: on ? `${accent}22` : "rgba(255,255,255,.04)",
      border: `1px solid ${on ? accent : "rgba(255,255,255,.12)"}`,
      color: on ? "#fff" : "rgba(255,255,255,.6)",
      borderRadius: 999, fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ opacity: on ? 1 : 0.4 }}>{on ? "✓" : "○"}</span>{label}
    </span>
  );
}

function Panel({ children, accent, glow = false }: { children: React.ReactNode; accent: string; glow?: boolean }) {
  return (
    <div style={{
      clipPath: CHAMFER,
      background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02))",
      border: `1px solid ${accent}33`,
      boxShadow: glow ? `0 0 24px ${accent}22` : "none",
      padding: 14,
    }}>{children}</div>
  );
}

const STEPS: Step[] = [
  {
    kicker: "Host your own",
    title: "Run a Destiny Competition",
    body: "Weered lets you build your own challenges and race your crew through them. Two pieces snap together:",
    art: (accent) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Panel accent={accent} glow>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: accent, textTransform: "uppercase", marginBottom: 6 }}>Challenges</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.85)", lineHeight: 1.5 }}>The goals. Do an activity with specific skulls or modifiers.</div>
        </Panel>
        <div style={{ fontSize: 22, color: accent, flexShrink: 0 }}>→</div>
        <Panel accent={accent} glow>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: accent, textTransform: "uppercase", marginBottom: 6 }}>Tournament</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.85)", lineHeight: 1.5 }}>The race. Pool challenges, earn points, climb the board.</div>
        </Panel>
      </div>
    ),
  },
  {
    kicker: "Step 1",
    title: "Build a Challenge",
    body: "Open the Challenges tab and hit Build a Challenge. Pick an activity, check the skulls or modifiers, set how many. No codes, no manifest digging.",
    art: (accent) => (
      <Panel accent={accent}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.4)", marginBottom: 3 }}>ACTIVITY</div>
            <div style={{ padding: "6px 10px", background: "rgba(0,0,0,.3)", border: `1px solid ${accent}55`, borderRadius: 3, fontSize: 12, color: "#fff" }}>A Nightfall ▾</div>
          </div>
          <div style={{ width: 64 }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.4)", marginBottom: 3 }}>HOW MANY</div>
            <div style={{ padding: "6px 10px", background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 3, fontSize: 12, color: "#fff", textAlign: "center" }}>1</div>
          </div>
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,.4)", marginBottom: 5 }}>MODIFIERS</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
          <Chip label="Match Game" accent={accent} />
          <Chip label="Arc Surge" accent={accent} />
          <Chip label="Famine" accent={accent} on={false} />
        </div>
        <div style={{ padding: "9px 12px", background: "rgba(74,222,128,.08)", border: "1px solid rgba(74,222,128,.3)", borderRadius: 4, fontSize: 12, color: "rgba(255,255,255,.9)" }}>
          <span style={{ color: "#86efac", fontWeight: 700 }}>✓ Preview</span> — Complete 1 Nightfall with Match Game + Arc Surge
        </div>
      </Panel>
    ),
  },
  {
    kicker: "Step 2",
    title: "Pool Them Into a Tournament",
    body: "A Challenge Race bundles challenges together. Every player who completes one earns points. Use your own challenges, or any the community has built.",
    art: (accent) => (
      <Panel accent={accent}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>Pantheon Cup</div>
          <div style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", background: `${accent}22`, border: `1px solid ${accent}`, borderRadius: 999, color: accent }}>100 pts / completion</div>
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,.4)", marginBottom: 6 }}>CHALLENGES IN POOL</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <Chip label="Boss Rush" accent={accent} />
          <Chip label="Master Raid" accent={accent} />
          <Chip label="Surge Check" accent={accent} />
          <Chip label="Flawless Trials" accent={accent} on={false} />
        </div>
      </Panel>
    ),
  },
  {
    kicker: "Step 3",
    title: "Set the Rules",
    body: "Choose how the race ends. Pick the format that fits your event:",
    bullets: [
      "First to Score — the first player to hit the point goal wins.",
      "Clear Them All — finish every challenge in the pool.",
      "Deadline — most points when the clock runs out.",
    ],
    art: (accent) => (
      <Panel accent={accent}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ padding: "6px 12px", background: `${accent}22`, border: `1px solid ${accent}`, borderRadius: 3, fontSize: 11, fontWeight: 700, color: "#fff" }}>First to Score</span>
          <span style={{ padding: "6px 12px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 3, fontSize: 11, color: "rgba(255,255,255,.6)" }}>Clear Them All</span>
          <span style={{ padding: "6px 12px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 3, fontSize: 11, color: "rgba(255,255,255,.6)" }}>Deadline</span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "rgba(255,255,255,.55)" }}>
          <span><span style={{ color: accent, fontWeight: 700 }}>Goal</span> 500 pts</span>
          <span><span style={{ color: accent, fontWeight: 700 }}>Runs</span> Jun 9 → Jun 12</span>
          <span><span style={{ color: accent, fontWeight: 700 }}>Reward</span> Champion banner</span>
        </div>
      </Panel>
    ),
  },
  {
    kicker: "Step 4",
    title: "Register, Play, Auto-Credit",
    body: "Link your Bungie account once. Then just play. Load the skulls in-game, complete the activity, and Weered credits your points automatically. No screenshots, no honor system.",
    art: (accent) => (
      <Panel accent={accent} glow>
        {[
          { rank: 1, name: "You", pts: 300, you: true },
          { rank: 2, name: "Saint14", pts: 200, you: false },
          { rank: 3, name: "Drifter", pts: 100, you: false },
        ].map((r) => (
          <div key={r.rank} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", background: r.you ? `${accent}14` : "transparent", borderRadius: 3 }}>
            <div style={{ width: 22, textAlign: "right", fontWeight: 800, fontSize: 13, color: r.rank === 1 ? "#fbbf24" : "rgba(255,255,255,.5)" }}>{r.rank}</div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: r.you ? "#fff" : "rgba(255,255,255,.8)" }}>{r.name}{r.you && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, padding: "1px 6px", background: `${accent}28`, color: accent, borderRadius: 999 }}>YOU</span>}</div>
            <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 800, color: accent }}>{r.pts}</div>
          </div>
        ))}
      </Panel>
    ),
  },
];

export default function TournamentGuide({ onClose, accent, onCreate }: { onClose: () => void; accent: string; onCreate: () => void }) {
  const [i, setI] = React.useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(8,5,2,.86)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 640, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", background: "#140d07", border: `1px solid ${accent}55`, boxShadow: `0 0 40px ${accent}22`, borderRadius: 6 }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.4, color: accent, textTransform: "uppercase" }}>{step.kicker}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: 0.3 }}>{step.title}</div>
            </div>
            <button onClick={onClose} style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: 4, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.7)", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>

          <div style={{ marginBottom: 16 }}>{step.art(accent)}</div>

          <div style={{ fontSize: 13, color: "rgba(255,255,255,.78)", lineHeight: 1.6, marginBottom: step.bullets ? 10 : 18 }}>{step.body}</div>
          {step.bullets && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
              {step.bullets.map((b, k) => (
                <div key={k} style={{ display: "flex", gap: 8, fontSize: 12, color: "rgba(255,255,255,.75)" }}>
                  <span style={{ color: accent, fontWeight: 800 }}>›</span><span>{b}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {STEPS.map((_, k) => (
                <button key={k} onClick={() => setI(k)} aria-label={`Step ${k + 1}`} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 99, border: "none", cursor: "pointer", background: k === i ? accent : "rgba(255,255,255,.2)", transition: "width .2s" }} />
              ))}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {i > 0 && (
                <button onClick={() => setI(i - 1)} style={{ padding: "9px 16px", borderRadius: 3, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.8)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Back</button>
              )}
              {!last ? (
                <button onClick={() => setI(i + 1)} style={{ padding: "9px 20px", borderRadius: 3, border: `1px solid ${accent}`, background: `linear-gradient(135deg, ${accent}, #ff9a40)`, color: "#1a0e04", fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>Next</button>
              ) : (
                <button onClick={() => { onClose(); onCreate(); }} style={{ padding: "9px 20px", borderRadius: 3, border: `1px solid ${accent}`, background: `linear-gradient(135deg, ${accent}, #ff9a40)`, color: "#1a0e04", fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>Create a Tournament</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
