"use client";
import React, { useEffect, useState } from "react";

// ── Session Zero ──────────────────────────────────────────────────────────
// First-time onboarding for the D&D lobby. Eight panels written in The
// Innkeeper's voice (warm, gossipy, hospitable — same character as the
// Tavern Keeper AI NPC). Auto-opens once per user; localStorage flag
// prevents replays. Always-on access lives in the D&D module panel header
// so anyone can re-summon it.
//
// Pattern mirrors TheBrief (FakeOut walkthrough). Reuse the same
// rhythm — inline SVG/CSS visuals, 8-panel arc, action-CTA on the last
// step, esc/arrow keyboard nav.

const STORAGE_KEY = "weered:dnd:session-zero:seen";
const ACCENT = "#C4A55A";        // parchment gold (D&D lobby accentColor)
const FIRE = "#D4602A";          // hearth orange
const FOREST = "#7A853B";        // druid green
const ARCANE = "#7B469B";        // warlock purple

type PanelDef = {
  label: string;
  title: string;
  body: React.ReactNode;
  visual: React.ReactNode;
};

// ── Visual aids — small inline mocks/diagrams. SVG + CSS only. ──────────

function VisualWordmark() {
  return (
    <div style={{
      height: 140, display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 10,
      background: "linear-gradient(135deg, rgba(196,165,90,0.06), rgba(212,96,42,0.06))",
      border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12,
    }}>
      <div style={{
        fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
        fontSize: 48, fontWeight: 900, letterSpacing: "-1px",
        background: `linear-gradient(135deg, #fff, ${ACCENT})`,
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        textTransform: "uppercase",
      }}>The Tavern</div>
      <div style={{ fontSize: 11, color: "rgba(243,244,246,.5)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
        Adventurers · DMs · Bards · Lurkers
      </div>
    </div>
  );
}

function VisualRooms() {
  const HouseRoom = ({ name, icon }: { name: string; icon: string }) => (
    <div style={{
      padding: "8px 10px", borderRadius: 8,
      border: `1px solid ${ACCENT}55`, background: `${ACCENT}10`,
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 11, fontWeight: 700, color: ACCENT,
    }}>
      <span>{icon}</span><span>{name}</span>
      <span style={{ marginLeft: "auto", fontSize: 8, opacity: 0.55, letterSpacing: "0.6px", textTransform: "uppercase" }}>Pinned</span>
    </div>
  );
  const UserRoom = ({ name }: { name: string }) => (
    <div style={{
      padding: "6px 10px", borderRadius: 6, marginLeft: 14,
      border: "1px dashed rgba(123,70,155,0.4)", background: "rgba(123,70,155,0.06)",
      fontSize: 10, color: "rgba(216,180,254,0.85)", fontFamily: "monospace",
    }}>↳ {name}</div>
  );
  return (
    <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,.25)", display: "flex", flexDirection: "column", gap: 5 }}>
      <HouseRoom name="The Tavern" icon="🍺" />
      <HouseRoom name="Campaign Table" icon="🎲" />
      <HouseRoom name="DM's Workshop" icon="📜" />
      <HouseRoom name="Character Forge" icon="⚔" />
      <UserRoom name="Wednesday Night — Vault of Shadows" />
      <UserRoom name="+ your campaign here" />
    </div>
  );
}

function VisualBoard() {
  const Quest = ({ title, sub, color }: { title: string; sub: string; color: string }) => (
    <div style={{
      padding: "6px 9px", borderRadius: 6,
      border: `1px solid ${color}55`, background: `${color}0d`,
      transform: "rotate(-0.4deg)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(243,244,246,0.88)" }}>{title}</div>
      <div style={{ fontSize: 9, color: `${color}cc`, letterSpacing: "0.3px", marginTop: 2 }}>{sub}</div>
    </div>
  );
  return (
    <div style={{
      padding: 14, borderRadius: 12,
      border: `1px solid ${FIRE}40`,
      background: `repeating-linear-gradient(45deg, rgba(212,96,42,0.04) 0 6px, rgba(0,0,0,0.20) 6px 12px)`,
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: FIRE, marginBottom: 2 }}>
        📌 Tavern Board
      </div>
      <Quest title="LFP — Vault of Shadows · Friday 8pm EST" sub="2 spots · level 5 · sandbox" color={ACCENT} />
      <Quest title="Need a paladin · Sunday afternoon" sub="ongoing campaign · 6 sessions in" color={FOREST} />
      <Quest title="One-shot · Heist of the Bone Lord" sub="this Saturday · table of 4" color={FIRE} />
    </div>
  );
}

function VisualCompendium() {
  const Tab = ({ label, active }: { label: string; active?: boolean }) => (
    <span style={{
      padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700,
      background: active ? `${ACCENT}25` : "rgba(255,255,255,0.04)",
      color: active ? ACCENT : "rgba(243,244,246,0.4)",
      letterSpacing: "0.5px", textTransform: "uppercase",
    }}>{label}</span>
  );
  return (
    <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,.25)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 4 }}>
        <Tab label="✨ Spells" active />
        <Tab label="🐉 Bestiary" />
        <Tab label="⚔ Classes" />
        <Tab label="💎 Items" />
        <Tab label="⚡ Conditions" />
      </div>
      <div style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, fontFamily: "monospace" }}>Fireball</div>
        <div style={{ fontSize: 10, color: "rgba(243,244,246,0.55)", marginTop: 2, lineHeight: 1.4 }}>
          3rd · Evocation · 150ft · 8d6 fire damage in a 20ft radius
        </div>
      </div>
    </div>
  );
}

function VisualDice() {
  return (
    <div style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,.25)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
        <div style={{
          width: 56, height: 56,
          background: `linear-gradient(135deg, rgba(34,197,94,0.20), ${ACCENT}10)`,
          border: `2px solid #22C55Eaa`,
          borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
          fontSize: 30, fontWeight: 900, color: "#22C55E",
          transform: "rotate(-6deg)",
          boxShadow: `0 0 20px rgba(34,197,94,0.35), inset 0 0 10px rgba(34,197,94,0.12)`,
        }}>20</div>
        <div style={{ fontSize: 11, color: "rgba(243,244,246,0.6)", lineHeight: 1.4, fontStyle: "italic" }}>
          stirling rolled <strong style={{ color: "#22C55E" }}>1d20+5</strong> for attack
        </div>
      </div>
      <div style={{
        padding: "5px 9px", borderRadius: 4,
        borderLeft: `2px solid #22C55Eaa`, background: "rgba(34,197,94,0.06)",
        fontFamily: "monospace", fontSize: 10, color: "rgba(243,244,246,0.85)",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ fontSize: 8, fontWeight: 800, opacity: 0.5 }}>DICE TOWER</span>
        <span style={{ fontWeight: 700 }}>stirling</span>
        <span style={{ background: "rgba(34,197,94,0.22)", color: "#22C55E", padding: "0 4px", borderRadius: 2, fontSize: 8, fontWeight: 800 }}>NAT 20</span>
        <span style={{ color: "rgba(243,244,246,0.55)" }}>1d20+5</span>
        <span style={{ color: "rgba(243,244,246,0.55)" }}>[20]+5</span>
        <span style={{ marginLeft: "auto", color: "#22C55E", fontWeight: 800 }}>25</span>
      </div>
    </div>
  );
}

function VisualNpc() {
  return (
    <div style={{ display: "flex", gap: 10, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,.25)" }}>
      <div style={{
        width: 44, height: 44, flexShrink: 0, borderRadius: "50%",
        background: `${ACCENT}12`, border: `1px solid ${ACCENT}55`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
      }}>🍺</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 10, color: ACCENT, fontWeight: 800, letterSpacing: "0.4px", textTransform: "uppercase" }}>
          The Tavern Keeper
        </div>
        <div style={{
          padding: "6px 10px", borderRadius: 8,
          background: `${ACCENT}06`, border: `1px solid ${ACCENT}22`,
          fontSize: 12, color: "rgba(243,244,246,0.85)", lineHeight: 1.4, fontStyle: "italic",
        }}>
          Welcome, traveler. The bone lord? Aye, heard of him. Two coppers says you don't last the week.
        </div>
      </div>
    </div>
  );
}

function VisualStreams() {
  return (
    <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,.25)", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{
        padding: "8px 10px", borderRadius: 8,
        background: "linear-gradient(135deg, rgba(145,71,255,0.12), rgba(145,71,255,0.04))",
        border: "1px solid rgba(145,71,255,0.30)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 6px #ef4444" }} />
        <div style={{ fontSize: 9, fontWeight: 800, color: "#ef4444", letterSpacing: "0.4px", textTransform: "uppercase" }}>Live</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(243,244,246,0.85)" }}>Critical Role · Campaign 4 ep 22</div>
        <div style={{ marginLeft: "auto", fontSize: 10, color: "rgba(243,244,246,0.5)", fontFamily: "monospace" }}>34.2K</div>
      </div>
      <div style={{
        padding: "6px 10px", borderRadius: 6,
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
        fontSize: 10, color: "rgba(243,244,246,0.55)",
      }}>Dimension20 · Fantasy High Junior Year · 18.7K</div>
      <div style={{
        padding: "6px 10px", borderRadius: 6,
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
        fontSize: 10, color: "rgba(243,244,246,0.55)",
      }}>Dropout TV · Game Changer at the Table · 9.4K</div>
    </div>
  );
}

function VisualRoadmap() {
  const Item = ({ done, text }: { done: boolean; text: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 14, height: 14, borderRadius: 4, flexShrink: 0,
        border: `1px solid ${done ? `${FOREST}aa` : `${ARCANE}66`}`,
        background: done ? `${FOREST}30` : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, color: FOREST, fontWeight: 900,
      }}>{done ? "✓" : ""}</div>
      <div style={{ fontSize: 11, color: done ? "rgba(243,244,246,0.55)" : "rgba(216,180,254,0.85)", textDecoration: done ? "line-through" : undefined, opacity: done ? 0.7 : 1 }}>
        {text}
      </div>
    </div>
  );
  return (
    <div style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,.25)", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: ARCANE, marginBottom: 4 }}>
        🪶 The Roadmap
      </div>
      <Item done text="The four house rooms" />
      <Item done text="Compendium · Tavern Board · NPCs · Streams" />
      <Item done text="Witnessed dice rolls in lobby chat" />
      <Item done text="Persistent campaign state (sheets, XP, loot)" />
      <Item done text="Tactical battle map with fog of war + tokens" />
      <Item done={false} text="Multi-DM scheduling overlay" />
      <Item done={false} text="Compendium → Sheet drag-to-equip" />
      <div style={{ fontSize: 9, color: "rgba(243,244,246,0.4)", marginTop: 6, fontStyle: "italic", letterSpacing: "0.3px" }}>
        DMs who show up first shape what's next.
      </div>
    </div>
  );
}

const PANELS: PanelDef[] = [
  {
    label: "what this is",
    title: "Welcome to the Tavern.",
    body: (
      <>
        Doors are open. Travelers from every corner pass through — DMs prepping the next session, players hunting a party, lurkers nursing a pint and watching it all go down.
        <br /><br />
        Take a moment. Lay of the land matters before you wander off swinging.
        <br /><br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>— the Innkeeper</span>
      </>
    ),
    visual: <VisualWordmark />,
  },
  {
    label: "the rooms",
    title: "Four house rooms. As many of your own as you want.",
    body: (
      <>
        The <strong style={{ color: ACCENT }}>Tavern</strong>, the <strong style={{ color: ACCENT }}>Campaign Table</strong>, the <strong style={{ color: ACCENT }}>DM&apos;s Workshop</strong>, the <strong style={{ color: ACCENT }}>Character Forge</strong>. Pinned, permanent, always-on. Voice and chat in each.
        <br /><br />
        But you&apos;re not capped at four. <strong style={{ color: ACCENT }}>Spin up your own room</strong> for your campaign — &quot;Wednesday Night — Vault of Shadows,&quot; whatever — and run sessions in it. Lives inside this lobby alongside the house rooms.
        <br /><br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>Up to 25 of your own at a time. Look for &quot;+ Create room&quot; in the room directory.</span>
      </>
    ),
    visual: <VisualRooms />,
  },
  {
    label: "the board",
    title: "Find a party. Or post one.",
    body: (
      <>
        The Tavern Board is where DMs post quests and players sign on. Looking for two more for Friday night? Need a paladin? Hosting a one-shot?
        <br /><br />
        Pin it. The board sees the post, the lobby sees the post, the right party finds itself.
        <br /><br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>No lurking required.</span>
      </>
    ),
    visual: <VisualBoard />,
  },
  {
    label: "the compendium",
    title: "The whole 5e SRD. No alt-tab.",
    body: (
      <>
        Spells, Bestiary, Classes, Magic Items, Conditions. Searchable, in-lobby. No more breaking flow to dndbeyond mid-session.
        <br /><br />
        Lookup is instant. Your players see what you see. Rules disputes resolved in under ten seconds.
      </>
    ),
    visual: <VisualCompendium />,
  },
  {
    label: "the dice tower",
    title: "Public rolls. Witnessed.",
    body: (
      <>
        Roll in the lobby&apos;s Dice Tower with <strong style={{ color: "#22C55E" }}>Witnessed</strong> on and the room sees it — name, expression, dice, total — as a chip in chat. Server-rolled, so nobody can fake a nat 20.
        <br /><br />
        Switch to <strong style={{ color: ACCENT }}>Private</strong> for stat blocks and behind-the-screen rolls. Same dice, no broadcast.
        <br /><br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>Discord literally cannot do this.</span>
      </>
    ),
    visual: <VisualDice />,
  },
  {
    label: "the npcs",
    title: "The Tavern Keeper has stories.",
    body: (
      <>
        AI NPCs live in the lobby. The Tavern Keeper knows the gossip, the rumors, who&apos;s been causing trouble. Ask. He answers in character.
        <br /><br />
        More NPCs join the cast as players seed them. Yours can too.
      </>
    ),
    visual: <VisualNpc />,
  },
  {
    label: "streams",
    title: "Watch a session while you wait.",
    body: (
      <>
        Twitch&apos;s D&amp;D category, pinned in-lobby. Find a live game, lurk, learn the rhythm of a good DM.
        <br /><br />
        Useful between sessions. Useful between groups.
      </>
    ),
    visual: <VisualStreams />,
  },
  {
    label: "the sheet",
    title: "Your character. Live, on the table.",
    body: (
      <>
        Open <strong style={{ color: ACCENT }}>Sheets</strong> in the D&amp;D module — your full 5e sheet lives here. Stats, saves, skills, spell slots, inventory, attacks. Click a stat: it rolls. Click an attack: it rolls in chat with a <strong style={{ color: "#f87171" }}>Damage</strong> follow-up button waiting if it hit.
        <br /><br />
        The DM sees the whole party at a glance. Players see their own.
        <br /><br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>Sheets persist across sessions. No one rebuilds Tuesday.</span>
      </>
    ),
    visual: <VisualWordmark />,
  },
  {
    label: "the battle map",
    title: "Tokens on a grid. Fog where you want it.",
    body: (
      <>
        Open <strong style={{ color: ACCENT }}>Battle Map</strong>. The DM uploads an image, drops tokens, paints fog. Players drag their tokens. Distance measures itself.
        <br /><br />
        When initiative ticks forward, the matching token glows. Click a token to snap the initiative tracker to that combatant. Apply damage from chat — it lands on the token <em>and</em> the tracker, in one click.
        <br /><br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>Roll20-grade table state, no extra tab.</span>
      </>
    ),
    visual: <VisualWordmark />,
  },
  {
    label: "the chronicle",
    title: "The Campaign Ledger remembers everything.",
    body: (
      <>
        Open <strong style={{ color: ACCENT }}>Campaign</strong>. Party gold, loot, XP, session log, NPC encounters, plot threads, world wiki — all in one persistent chronicle per party.
        <br /><br />
        Award XP and the whole party gets it in one click. Find an item on a sheet and tap <strong style={{ color: ACCENT }}>→ Ledger</strong>. Spin up an AI NPC and they show up in the encounter index automatically.
        <br /><br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>The DM never re-types what already happened.</span>
      </>
    ),
    visual: <VisualWordmark />,
  },
  {
    label: "shape what's next",
    title: "If you're a DM, build with me.",
    body: (
      <>
        Honest about what&apos;s mid-build: <strong style={{ color: ARCANE }}>multi-DM scheduling</strong> and <strong style={{ color: ARCANE }}>compendium drag-to-sheet</strong>. Roadmap, not vapor.
        <br /><br />
        If you&apos;re a DM with a campaign you want to bring, holler in the <strong style={{ color: ACCENT }}>DM&apos;s Workshop</strong>. The next features get prioritized with the first GMs who show up.
        <br /><br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>You shape it, you keep it.</span>
      </>
    ),
    visual: <VisualRoadmap />,
  },
];

export default function SessionZero({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setStep(s => Math.min(PANELS.length - 1, s + 1));
      if (e.key === "ArrowLeft")  setStep(s => Math.max(0, s - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const panel = PANELS[step];
  const isLast = step === PANELS.length - 1;

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    onClose();
  }

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(4,4,8,0.78)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="weered-session-zero-modal"
        style={{
          width: "100%", maxWidth: 560,
          borderRadius: 16,
          border: `1px solid ${ACCENT}55`,
          background:
            "radial-gradient(ellipse 90% 50% at 50% 0%, rgba(212,96,42,0.10), transparent 70%), " +
            "radial-gradient(ellipse 60% 30% at 18% 100%, rgba(232,160,74,0.06), transparent 65%), " +
            "linear-gradient(180deg, rgba(28,18,10,0.98), rgba(14,9,5,0.98))",
          boxShadow: `0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px ${ACCENT}15 inset, 0 -2px 36px rgba(212,96,42,0.10) inset`,
          overflow: "hidden",
          fontFamily: "var(--font-barlow), system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/brand/lobbies/dnd/shield-04.webp"
              alt="Dungeons &amp; Dragons"
              width={28}
              height={28}
              style={{ borderRadius: 6, flexShrink: 0, objectFit: "cover" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase",
                  padding: "2px 8px", borderRadius: 999,
                  background: `${ACCENT}18`, border: `1px solid ${ACCENT}50`, color: ACCENT,
                }}>Session Zero</span>
                <span style={{ fontSize: 10, color: "rgba(243,244,246,0.35)", letterSpacing: "0.4px", textTransform: "uppercase" }}>
                  · {panel.label}
                </span>
              </div>
              <div style={{ fontSize: 10, color: "rgba(243,244,246,0.45)", letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: 600 }}>
                Dungeons &amp; Dragons lobby
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            style={{ background: "none", border: "none", color: "rgba(243,244,246,0.4)", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}
            title="Close"
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "22px 24px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div>{panel.visual}</div>
          <div>
            <div className="sz-heading" style={{
              fontSize: 28, fontWeight: 400, letterSpacing: "0.4px", marginBottom: 12,
              color: "#F5D58A",
              textShadow: "0 0 16px rgba(232,160,74,0.30), 0 1px 2px rgba(0,0,0,0.7)",
              lineHeight: 1.15,
            }}>{panel.title}</div>
            <div className="sz-serif" style={{ fontSize: 16, lineHeight: 1.55, color: "rgba(243,232,210,0.82)" }}>
              {panel.body}
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", justifyContent: "center", gap: 5, padding: "0 24px" }}>
          {PANELS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 22 : 6, height: 6,
                borderRadius: 999, border: "none", padding: 0, cursor: "pointer",
                background: i === step ? "linear-gradient(90deg, #D4602A, #E8A04A)" : "rgba(196,165,90,0.20)",
                boxShadow: i === step ? "0 0 8px rgba(232,160,74,0.5)" : "none",
                transition: "all 0.2s",
              }}
              aria-label={`Go to ${PANELS[i].label}`}
            />
          ))}
        </div>

        {/* Footer controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 18px" }}>
          <button
            type="button"
            onClick={dismiss}
            style={{
              background: "none", border: "none", color: "rgba(243,244,246,0.35)",
              fontSize: 11, letterSpacing: "0.6px", textTransform: "uppercase", cursor: "pointer",
            }}
          >Skip</button>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(s => Math.max(0, s - 1))}
                style={{
                  padding: "7px 16px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)",
                  color: "rgba(243,244,246,0.7)", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >Back</button>
            )}
            <button
              type="button"
              onClick={() => isLast ? dismiss() : setStep(s => Math.min(PANELS.length - 1, s + 1))}
              className={isLast ? "sz-heading" : ""}
              style={{
                padding: isLast ? "8px 22px" : "7px 22px", borderRadius: 8,
                border: `1px solid rgba(232,160,74,0.65)`,
                background: isLast ? "linear-gradient(180deg, rgba(212,96,42,0.30), rgba(127,68,34,0.50))" : `${ACCENT}18`,
                color: isLast ? "#F5D58A" : ACCENT,
                fontSize: isLast ? 14 : 12,
                fontWeight: isLast ? 400 : 800,
                letterSpacing: isLast ? "0.6px" : "0.5px",
                cursor: "pointer",
                textTransform: isLast ? "none" : "uppercase",
                textShadow: isLast ? "0 0 8px rgba(232,160,74,0.55), 0 1px 1px rgba(0,0,0,0.6)" : undefined,
                boxShadow: isLast ? "0 0 14px rgba(232,160,74,0.20), inset 0 1px 0 rgba(245,213,138,0.18)" : undefined,
              }}
            >{isLast ? "Pull up a chair" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hook for first-time auto-open + a stable open/reopen handle ──────────
export function useSessionZero(): { open: boolean; show: () => void; hide: () => void } {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let seen = false;
    try { seen = localStorage.getItem(STORAGE_KEY) === "1"; } catch {}
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);
  return { open, show: () => setOpen(true), hide: () => setOpen(false) };
}
