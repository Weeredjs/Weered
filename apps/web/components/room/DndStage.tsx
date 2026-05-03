"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWeered } from "../WeeredProvider";
import DndNpcPanel from "./DndNpcPanel";
import CampaignLedger from "../CampaignLedger";

// ── Style ────────────────────────────────────────────────────────────────────

const S = {
  card: { borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: "10px 12px" } as React.CSSProperties,
  btn: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)", fontFamily: "inherit" } as React.CSSProperties,
  btnPri: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(196,165,90,.35)", background: "rgba(196,165,90,.12)", fontSize: 12, cursor: "pointer", color: "rgb(196,165,90)", fontWeight: 600, fontFamily: "inherit" } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" },
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

const ACCENT = "#C4A55A";

// ── Dice Engine (shared with DndModulesPanel) ───────────────────────────────

type DiceResult = {
  id: string; expr: string; rolls: number[]; modifier: number; total: number;
  advantage?: boolean; disadvantage?: boolean; kept?: number[]; dropped?: number[];
  sides: number; roller: string; ts: number; isNat20?: boolean; isNat1?: boolean;
};

function parseDice(expr: string): { count: number; sides: number; modifier: number; advantage?: boolean; disadvantage?: boolean } | null {
  const clean = expr.toLowerCase().trim().replace(/\s+/g, "");
  let adv = false, dis = false;
  let working = clean;
  if (working.includes("adv")) { adv = true; working = working.replace(/adv(antage)?/, ""); }
  if (working.includes("dis")) { dis = true; working = working.replace(/dis(advantage)?/, ""); }
  const m = working.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!m) return null;
  return { count: m[1] ? parseInt(m[1]) : 1, sides: parseInt(m[2]), modifier: m[3] ? parseInt(m[3]) : 0, advantage: adv, disadvantage: dis };
}

function rollDice(parsed: { count: number; sides: number; modifier: number; advantage?: boolean; disadvantage?: boolean }): Omit<DiceResult, "id" | "expr" | "roller" | "ts"> {
  if (parsed.advantage || parsed.disadvantage) {
    const r1 = Math.floor(Math.random() * parsed.sides) + 1;
    const r2 = Math.floor(Math.random() * parsed.sides) + 1;
    const keep = parsed.advantage ? Math.max(r1, r2) : Math.min(r1, r2);
    const drop = parsed.advantage ? Math.min(r1, r2) : Math.max(r1, r2);
    return { rolls: [r1, r2], kept: [keep], dropped: [drop], modifier: parsed.modifier, total: keep + parsed.modifier, sides: parsed.sides, advantage: parsed.advantage, disadvantage: parsed.disadvantage, isNat20: parsed.sides === 20 && keep === 20, isNat1: parsed.sides === 20 && keep === 1 };
  }
  const rolls: number[] = [];
  for (let i = 0; i < parsed.count; i++) rolls.push(Math.floor(Math.random() * parsed.sides) + 1);
  const sum = rolls.reduce((a, b) => a + b, 0);
  return { rolls, kept: rolls, dropped: [], modifier: parsed.modifier, total: sum + parsed.modifier, sides: parsed.sides, isNat20: parsed.sides === 20 && parsed.count === 1 && rolls[0] === 20, isNat1: parsed.sides === 20 && parsed.count === 1 && rolls[0] === 1 };
}

// ── Conditions Data ─────────────────────────────────────────────────────────

const CONDITIONS = [
  { name: "Blinded", icon: "🙈" }, { name: "Charmed", icon: "💘" }, { name: "Deafened", icon: "🔇" },
  { name: "Frightened", icon: "😨" }, { name: "Grappled", icon: "🤼" }, { name: "Incapacitated", icon: "💫" },
  { name: "Invisible", icon: "👻" }, { name: "Paralyzed", icon: "⚡" }, { name: "Petrified", icon: "🪨" },
  { name: "Poisoned", icon: "☠️" }, { name: "Prone", icon: "🔽" }, { name: "Restrained", icon: "⛓" },
  { name: "Stunned", icon: "💥" }, { name: "Unconscious", icon: "💤" }, { name: "Exhaustion", icon: "😩" },
  { name: "Concentrating", icon: "🧠" },
];

// ── Initiative Tracker ──────────────────────────────────────────────────────

type Combatant = {
  id: string;
  name: string;
  initiative: number;
  hpCurrent: number;
  hpMax: number;
  ac: number;
  conditions: string[];
  isNPC: boolean;
};

function InitiativeTracker({ roomId }: { roomId: string }) {
  const { sendRaw } = useWeered() as any;
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [round, setRound] = useState(1);
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const [addName, setAddName] = useState("");
  const [addInit, setAddInit] = useState("");
  const [addHp, setAddHp] = useState("");
  const [addAc, setAddAc] = useState("");
  const [addIsNpc, setAddIsNpc] = useState(false);

  // Condition picker
  const [condPicker, setCondPicker] = useState<string | null>(null);

  const sorted = useMemo(() => [...combatants].sort((a, b) => b.initiative - a.initiative), [combatants]);

  function broadcast(updated: Combatant[], turn: number, rnd: number) {
    sendRaw?.({ type: "dnd:initiative", roomId, combatants: updated, currentTurn: turn, round: rnd });
  }

  // Listen for WS updates from other users
  useEffect(() => {
    function handler(ev: any) {
      const d = ev?.detail;
      if (!d || d.roomId !== roomId || d.type !== "dnd:initiative") return;
      if (d.combatants) setCombatants(d.combatants);
      if (typeof d.currentTurn === "number") setCurrentTurn(d.currentTurn);
      if (typeof d.round === "number") setRound(d.round);
    }
    window.addEventListener("weered:dnd:initiative", handler);
    return () => window.removeEventListener("weered:dnd:initiative", handler);
  }, [roomId]);

  function addCombatant() {
    if (!addName.trim()) return;
    const c: Combatant = {
      id: Math.random().toString(36).slice(2),
      name: addName.trim(),
      initiative: parseInt(addInit) || Math.floor(Math.random() * 20) + 1,
      hpCurrent: parseInt(addHp) || 10,
      hpMax: parseInt(addHp) || 10,
      ac: parseInt(addAc) || 10,
      conditions: [],
      isNPC: addIsNpc,
    };
    const updated = [...combatants, c];
    setCombatants(updated);
    broadcast(updated, currentTurn, round);
    setAddName(""); setAddInit(""); setAddHp(""); setAddAc(""); setAddIsNpc(false);
    setShowAdd(false);
  }

  function removeCombatant(id: string) {
    const updated = combatants.filter(c => c.id !== id);
    setCombatants(updated);
    const newTurn = currentTurn >= updated.length ? 0 : currentTurn;
    setCurrentTurn(newTurn);
    broadcast(updated, newTurn, round);
  }

  function nextTurn() {
    const newTurn = (currentTurn + 1) % (sorted.length || 1);
    const newRound = newTurn === 0 ? round + 1 : round;
    setCurrentTurn(newTurn);
    setRound(newRound);
    broadcast(combatants, newTurn, newRound);
  }

  function prevTurn() {
    let newTurn = currentTurn - 1;
    let newRound = round;
    if (newTurn < 0) { newTurn = Math.max(sorted.length - 1, 0); newRound = Math.max(round - 1, 1); }
    setCurrentTurn(newTurn);
    setRound(newRound);
    broadcast(combatants, newTurn, newRound);
  }

  function adjustHp(id: string, delta: number) {
    const updated = combatants.map(c => c.id === id ? { ...c, hpCurrent: Math.max(0, Math.min(c.hpMax, c.hpCurrent + delta)) } : c);
    setCombatants(updated);
    broadcast(updated, currentTurn, round);
  }

  function toggleCondition(id: string, condition: string) {
    const updated = combatants.map(c => {
      if (c.id !== id) return c;
      const conds = c.conditions.includes(condition) ? c.conditions.filter(x => x !== condition) : [...c.conditions, condition];
      return { ...c, conditions: conds };
    });
    setCombatants(updated);
    broadcast(updated, currentTurn, round);
  }

  function clearAll() {
    setCombatants([]);
    setCurrentTurn(0);
    setRound(1);
    broadcast([], 0, 1);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span className="dnd-heading" style={{ fontSize: 18, color: "#F5D58A" }}>Initiative Tracker</span>
          <span className="dnd-serif" style={{ fontSize: 12, color: "rgba(201,168,120,.65)", marginLeft: 8, fontStyle: "italic" }}>Round {round}</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={S.btnPri} onClick={() => setShowAdd(!showAdd)}>{showAdd ? "Cancel" : "+ Add"}</button>
          {combatants.length > 0 && <button style={{ ...S.btn, fontSize: 10, color: "rgba(239,68,68,.6)" }} onClick={clearAll}>Clear</button>}
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 8, border: `1px solid ${ACCENT}33`, background: `${ACCENT}06` }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...S.input, flex: 2 }} placeholder="Name" value={addName} onChange={e => setAddName(e.target.value)} onKeyDown={e => e.key === "Enter" && addCombatant()} />
            <input style={{ ...S.input, flex: 1 }} placeholder="Init" type="number" value={addInit} onChange={e => setAddInit(e.target.value)} onKeyDown={e => e.key === "Enter" && addCombatant()} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...S.input, flex: 1 }} placeholder="HP" type="number" value={addHp} onChange={e => setAddHp(e.target.value)} />
            <input style={{ ...S.input, flex: 1 }} placeholder="AC" type="number" value={addAc} onChange={e => setAddAc(e.target.value)} />
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(148,163,184,.6)", cursor: "pointer", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={addIsNpc} onChange={e => setAddIsNpc(e.target.checked)} /> NPC
            </label>
          </div>
          <button style={{ ...S.btnPri, alignSelf: "flex-start" }} onClick={addCombatant}>Add to Initiative</button>
        </div>
      )}

      {/* Combatant list */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: 30, opacity: 0.4, fontSize: 13 }}>
          No combatants. Add creatures to begin tracking initiative.
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {sorted.map((c, i) => {
            const isActive = i === currentTurn;
            const hpPct = c.hpMax > 0 ? (c.hpCurrent / c.hpMax) * 100 : 0;
            const hpColor = hpPct > 50 ? "#22C55E" : hpPct > 25 ? "#F59E0B" : "#EF4444";
            return (
              <div key={c.id} style={{
                ...S.card, display: "flex", flexDirection: "column", gap: 6, position: "relative",
                borderColor: isActive ? `${ACCENT}66` : "rgba(255,255,255,.08)",
                background: isActive ? `${ACCENT}0A` : "rgba(255,255,255,.03)",
                boxShadow: isActive ? `0 0 12px ${ACCENT}15` : "none",
              }}>
                {/* Top row: initiative, name, AC, remove */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {isActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 6px ${ACCENT}`, flexShrink: 0 }} />}
                  <span style={{ fontSize: 16, fontWeight: 900, color: ACCENT, minWidth: 28, textAlign: "center" }}>{c.initiative}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.92)", flex: 1 }}>
                    {c.name}
                    {c.isNPC && <span style={{ fontSize: 9, marginLeft: 4, padding: "1px 4px", borderRadius: 3, background: "rgba(239,68,68,.12)", color: "#EF5350", fontWeight: 600 }}>NPC</span>}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(148,163,184,.5)" }}>AC {c.ac}</span>
                  <button onClick={() => removeCombatant(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,.4)", fontSize: 14, padding: 2, lineHeight: 1 }}>×</button>
                </div>

                {/* HP bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => adjustHp(c.id, -1)} style={{ ...S.btn, padding: "2px 8px", fontSize: 14, fontWeight: 900, color: "#EF4444", borderColor: "rgba(239,68,68,.2)" }}>−</button>
                  <div style={{ flex: 1, position: "relative" }}>
                    <div style={{ height: 14, borderRadius: 4, background: "rgba(0,0,0,.3)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${hpPct}%`, background: hpColor, borderRadius: 4, transition: "width .2s, background .2s" }} />
                    </div>
                    <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "rgba(243,244,246,.9)" }}>
                      {c.hpCurrent} / {c.hpMax}
                    </span>
                  </div>
                  <button onClick={() => adjustHp(c.id, 1)} style={{ ...S.btn, padding: "2px 8px", fontSize: 14, fontWeight: 900, color: "#22C55E", borderColor: "rgba(34,197,94,.2)" }}>+</button>
                  <button onClick={() => adjustHp(c.id, -5)} style={{ ...S.btn, padding: "2px 6px", fontSize: 9, color: "#EF4444" }}>-5</button>
                  <button onClick={() => adjustHp(c.id, 5)} style={{ ...S.btn, padding: "2px 6px", fontSize: 9, color: "#22C55E" }}>+5</button>
                </div>

                {/* Conditions */}
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                  {c.conditions.map(cond => {
                    const ci = CONDITIONS.find(x => x.name === cond);
                    return (
                      <span key={cond} onClick={() => toggleCondition(c.id, cond)} style={{
                        fontSize: 9, padding: "2px 5px", borderRadius: 3, cursor: "pointer",
                        background: "rgba(239,68,68,.12)", color: "#EF5350", fontWeight: 600,
                      }}>{ci?.icon || "⚠"} {cond}</span>
                    );
                  })}
                  <button onClick={() => setCondPicker(condPicker === c.id ? null : c.id)} style={{
                    ...S.btn, padding: "1px 5px", fontSize: 9, color: "rgba(148,163,184,.4)",
                  }}>+ condition</button>
                </div>

                {/* Condition picker dropdown */}
                {condPicker === c.id && (
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", padding: "6px 0", borderTop: "1px solid rgba(255,255,255,.06)" }}>
                    {CONDITIONS.map(cond => (
                      <button key={cond.name} onClick={() => { toggleCondition(c.id, cond.name); setCondPicker(null); }} style={{
                        ...S.btn, fontSize: 9, padding: "3px 6px",
                        background: c.conditions.includes(cond.name) ? "rgba(239,68,68,.12)" : undefined,
                        color: c.conditions.includes(cond.name) ? "#EF5350" : undefined,
                      }}>{cond.icon} {cond.name}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Turn controls */}
      {sorted.length > 0 && (
        <div style={{ display: "flex", gap: 8, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <button onClick={prevTurn} style={{ ...S.btn, flex: 1, padding: "10px 16px", fontSize: 13 }}>← Prev</button>
          <button onClick={nextTurn} style={{ ...S.btnPri, flex: 2, padding: "10px 16px", fontSize: 14, fontWeight: 800 }}>Next Turn →</button>
        </div>
      )}
    </div>
  );
}

// ── Room Dice Roller (broadcasts to room) ───────────────────────────────────

const QUICK_DICE = [
  { label: "d4", expr: "d4" }, { label: "d6", expr: "d6" }, { label: "d8", expr: "d8" },
  { label: "d10", expr: "d10" }, { label: "d12", expr: "d12" }, { label: "d20", expr: "d20" },
  { label: "d100", expr: "d100" },
];

function RoomDiceRoller({ roomId }: { roomId: string }) {
  const { sendRaw, me } = useWeered() as any;
  const [history, setHistory] = useState<DiceResult[]>([]);
  const [customExpr, setCustomExpr] = useState("");
  const [lastRoll, setLastRoll] = useState<DiceResult | null>(null);
  const [showFlash, setShowFlash] = useState(false);

  // Listen for dice rolls from other users
  useEffect(() => {
    function handler(ev: any) {
      const d = ev?.detail;
      if (!d || d.roomId !== roomId || d.type !== "dnd:roll") return;
      if (d.roll) {
        setHistory(prev => [d.roll, ...prev].slice(0, 50));
        setLastRoll(d.roll);
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 600);
      }
    }
    window.addEventListener("weered:dnd:roll", handler);
    return () => window.removeEventListener("weered:dnd:roll", handler);
  }, [roomId]);

  function doRoll(expr: string) {
    const parsed = parseDice(expr);
    if (!parsed) return;
    const result = rollDice(parsed);
    const roll: DiceResult = {
      ...result,
      id: Math.random().toString(36).slice(2),
      expr: expr.toLowerCase(),
      roller: me?.name || "Unknown",
      ts: Date.now(),
    };
    setLastRoll(roll);
    setHistory(prev => [roll, ...prev].slice(0, 50));
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 600);
    // Broadcast to room
    sendRaw?.({ type: "dnd:roll", roomId, roll });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      {/* Brazier — stone-mouth result panel with pulsing coal glow */}
      <div className="dnd-brazier" style={{
        boxShadow: showFlash
          ? (lastRoll?.isNat20 ? "0 0 56px rgba(122,209,88,0.50), inset 0 2px 0 rgba(196,165,90,0.10), inset 0 -1px 0 rgba(0,0,0,0.6)"
            : lastRoll?.isNat1 ? "0 0 50px rgba(239,68,68,0.50), inset 0 2px 0 rgba(196,165,90,0.10), inset 0 -1px 0 rgba(0,0,0,0.6)"
            : "0 0 48px rgba(232,160,74,0.40), inset 0 2px 0 rgba(196,165,90,0.10), inset 0 -1px 0 rgba(0,0,0,0.6)")
          : undefined,
      }}>
        {lastRoll ? (
          <>
            <div className={`dnd-brazier-result${lastRoll.isNat20 ? " is-nat20" : lastRoll.isNat1 ? " is-nat1" : ""}`}>
              {lastRoll.total}
            </div>
            {lastRoll.isNat20 && <div className="dnd-brazier-tag is-nat20">NATURAL 20</div>}
            {lastRoll.isNat1 && <div className="dnd-brazier-tag is-nat1">CRITICAL FAIL</div>}
            <div className="dnd-brazier-expr">
              <strong style={{ color: "#F5D58A", fontStyle: "normal" }}>{lastRoll.roller}</strong>{" rolled "}{lastRoll.expr}
              {(lastRoll.advantage || lastRoll.disadvantage) && (
                <span style={{ color: lastRoll.advantage ? "#C8E886" : "#FF8A7A", fontWeight: 600 }}>
                  {" "}({lastRoll.advantage ? "ADV" : "DIS"})
                </span>
              )}
            </div>
            <div className="dnd-brazier-rolls">
              [{lastRoll.rolls.join(", ")}]
              {lastRoll.dropped && lastRoll.dropped.length > 0 && (
                <span style={{ textDecoration: "line-through", opacity: 0.4 }}> dropped: {lastRoll.dropped.join(", ")}</span>
              )}
              {lastRoll.modifier !== 0 && <span> {lastRoll.modifier > 0 ? "+" : ""}{lastRoll.modifier}</span>}
            </div>
          </>
        ) : (
          <>
            <div className="dnd-brazier-d20">
              <RoomD20Icon />
            </div>
            <div className="dnd-brazier-prompt">Pick a die. Cast it before the table.</div>
          </>
        )}
      </div>

      {/* Carved-stone quick-roll tiles */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {QUICK_DICE.map(d => (
          <button key={d.label} onClick={() => doRoll(d.expr)} className="dnd-stone-tile">
            {d.label}
          </button>
        ))}
      </div>

      {/* Advantage / Disadvantage */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => doRoll("d20adv")} className="dnd-stone-tile dnd-stone-tile--adv" style={{ flex: 1 }}>
          d20 Advantage
        </button>
        <button onClick={() => doRoll("d20dis")} className="dnd-stone-tile dnd-stone-tile--dis" style={{ flex: 1 }}>
          d20 Disadvantage
        </button>
      </div>

      {/* Custom — parchment input + Cast button */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="dnd-parchment-input"
          placeholder="2d8+5, d20adv, 4d6, d100..."
          value={customExpr}
          onChange={e => setCustomExpr(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && customExpr) { doRoll(customExpr); setCustomExpr(""); } }}
        />
        <button
          className="dnd-stone-tile"
          style={{ flex: "0 0 auto", minWidth: 78 }}
          onClick={() => { if (customExpr) { doRoll(customExpr); setCustomExpr(""); } }}
        >Cast</button>
      </div>

      {/* Roll history — wooden ledger */}
      {history.length > 0 && (
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="dnd-section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Roll Log</span>
            <button
              style={{
                background: "transparent", border: "1px solid rgba(196,165,90,0.25)",
                color: "rgba(201,168,120,0.6)", fontSize: 10, padding: "2px 8px",
                borderRadius: 4, cursor: "pointer", fontFamily: "inherit", letterSpacing: ".5px",
              }}
              onClick={() => setHistory([])}
            >Clear</button>
          </div>
          {history.map(r => (
            <div key={r.id} className={`dnd-history-row${r.isNat20 ? " is-nat20" : r.isNat1 ? " is-nat1" : ""}`}>
              <span className="dnd-history-total">{r.total}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#F5D58A" }}>{r.roller}</span>
                <span className="dnd-history-expr" style={{ marginLeft: 6 }}>{r.expr}</span>
                {(r.advantage || r.disadvantage) && (
                  <span style={{ fontSize: 10, marginLeft: 6, color: r.advantage ? "#C8E886" : "#FF8A7A", fontWeight: 700, letterSpacing: ".5px" }}>
                    {r.advantage ? "ADV" : "DIS"}
                  </span>
                )}
                <span style={{ fontSize: 10, color: "rgba(201,168,120,0.45)", marginLeft: 6, fontFamily: "monospace" }}>
                  [{r.rolls.join(",")}]{r.modifier ? (r.modifier > 0 ? `+${r.modifier}` : r.modifier) : ""}
                </span>
              </div>
              <span style={{ fontSize: 9, color: "rgba(201,168,120,0.35)", fontFamily: "monospace" }}>
                {new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// SVG d20 — empty-state die in the in-room brazier. Mirrors the lobby version.
function RoomD20Icon() {
  return (
    <svg width="96" height="96" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="dndDieFillRoom" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7F4422" />
          <stop offset="55%" stopColor="#5D2F18" />
          <stop offset="100%" stopColor="#3A1C0E" />
        </linearGradient>
        <linearGradient id="dndDieFaceRoom" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.10)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.40)" />
        </linearGradient>
        <linearGradient id="dndDieEdgeRoom" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5D58A" />
          <stop offset="100%" stopColor="#C4A55A" />
        </linearGradient>
      </defs>
      <polygon
        points="50,5 90,28 90,72 50,95 10,72 10,28"
        fill="url(#dndDieFillRoom)"
        stroke="url(#dndDieEdgeRoom)"
        strokeWidth="1.5"
      />
      <polygon
        points="50,18 78,67 22,67"
        fill="url(#dndDieFaceRoom)"
        stroke="rgba(245,213,138,0.40)"
        strokeWidth="1"
      />
      <text
        x="50" y="56"
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        fill="#F5D58A"
        fontFamily="var(--font-pirata), 'Pirata One', serif"
        style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.6))" }}
      >20</text>
    </svg>
  );
}

// ── Quick Reference ─────────────────────────────────────────────────────────

const ACTIONS_IN_COMBAT = [
  { name: "Attack", desc: "Make a melee or ranged attack." },
  { name: "Cast a Spell", desc: "Cast a spell with a casting time of 1 action." },
  { name: "Dash", desc: "Gain extra movement equal to your speed." },
  { name: "Disengage", desc: "Your movement doesn't provoke opportunity attacks." },
  { name: "Dodge", desc: "Attacks against you have disadvantage. DEX saves with advantage." },
  { name: "Help", desc: "Give an ally advantage on their next ability check or attack." },
  { name: "Hide", desc: "Make a Stealth check to become hidden." },
  { name: "Ready", desc: "Prepare an action to trigger on a specific condition." },
  { name: "Search", desc: "Make a Perception or Investigation check." },
  { name: "Use an Object", desc: "Interact with an object that requires your action." },
  { name: "Grapple", desc: "Athletics vs Athletics/Acrobatics. Target is grappled on success." },
  { name: "Shove", desc: "Athletics vs Athletics/Acrobatics. Push 5ft or knock prone." },
];

const COVER_RULES = [
  { type: "Half Cover", ac: "+2 AC, +2 DEX saves", desc: "Obstacle blocks at least half the body." },
  { type: "Three-Quarters", ac: "+5 AC, +5 DEX saves", desc: "Obstacle blocks about three-quarters." },
  { type: "Total Cover", ac: "Can't be targeted", desc: "Completely concealed by an obstacle." },
];

const CONDITIONS_REF = [
  { name: "Blinded", short: "Auto-fail sight. Attacks have disadv. Attacks against have adv." },
  { name: "Charmed", short: "Can't attack charmer. Charmer has adv on social checks." },
  { name: "Frightened", short: "Disadv on checks/attacks while source visible. Can't approach." },
  { name: "Grappled", short: "Speed 0. Ends if grappler incapacitated." },
  { name: "Incapacitated", short: "Can't take actions or reactions." },
  { name: "Invisible", short: "Attacks have adv. Attacks against have disadv." },
  { name: "Paralyzed", short: "Incapacitated. Auto-fail STR/DEX. Melee hits = crits." },
  { name: "Poisoned", short: "Disadv on attacks and ability checks." },
  { name: "Prone", short: "Disadv on attacks. Melee against = adv. Ranged against = disadv." },
  { name: "Restrained", short: "Speed 0. Attacks disadv. Attacks against adv. DEX saves disadv." },
  { name: "Stunned", short: "Incapacitated. Auto-fail STR/DEX. Attacks against adv." },
  { name: "Unconscious", short: "Prone + incapacitated. Auto-fail STR/DEX. Melee crits." },
];

function QuickReference() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", overflow: "auto" }}>
      <div>
        <div style={{ ...S.label, color: ACCENT, opacity: 1, marginBottom: 8, fontSize: 11 }}>Actions in Combat</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {ACTIONS_IN_COMBAT.map(a => (
            <div key={a.name} style={{ ...S.card, padding: "6px 10px", display: "flex", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, minWidth: 80 }}>{a.name}</span>
              <span style={{ fontSize: 11, color: "rgba(243,244,246,.65)" }}>{a.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ ...S.label, color: ACCENT, opacity: 1, marginBottom: 8, fontSize: 11 }}>Cover</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {COVER_RULES.map(c => (
            <div key={c.type} style={{ ...S.card, padding: "6px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(243,244,246,.85)" }}>{c.type}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#22C55E" }}>{c.ac}</span>
              </div>
              <div style={{ fontSize: 10, color: "rgba(148,163,184,.45)", marginTop: 2 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ ...S.label, color: ACCENT, opacity: 1, marginBottom: 8, fontSize: 11 }}>Conditions Quick Ref</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {CONDITIONS_REF.map(c => (
            <div key={c.name} style={{ display: "flex", gap: 8, padding: "4px 8px", borderRadius: 4, background: "rgba(255,255,255,.02)" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, minWidth: 80 }}>{c.name}</span>
              <span style={{ fontSize: 10, color: "rgba(243,244,246,.55)" }}>{c.short}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DND STAGE
// ═══════════════════════════════════════════════════════════════════════════

const STAGE_TABS = [
  { id: "initiative" as const, label: "Initiative", icon: "⚔" },
  { id: "dice" as const,       label: "Dice", icon: "🎲" },
  { id: "npcs" as const,       label: "NPCs", icon: "🧙" },
  { id: "campaign" as const,   label: "Campaign", icon: "📜" },
  { id: "reference" as const,  label: "Reference", icon: "📖" },
];
type StageTab = typeof STAGE_TABS[number]["id"];

export default function DndStage({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const [tab, setTab] = useState<StageTab>("initiative");

  return (
    <div className="weered-dnd-modules" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", position: "relative" }}>
      {/* Tab bar — parchment-pill in-room sub-lectern */}
      <div style={{ display: "flex", gap: 5, padding: "10px 12px", borderBottom: "1px solid rgba(196,165,90,.18)", flexShrink: 0, flexWrap: "wrap" }}>
        {STAGE_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`weered-dnd-tab weered-dnd-tab--small${tab === t.id ? " is-active" : ""}`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: tab === "npcs" ? 0 : 12 }}>
        {tab === "initiative" && <InitiativeTracker roomId={roomId} />}
        {tab === "dice" && <RoomDiceRoller roomId={roomId} />}
        {tab === "npcs" && <DndNpcPanel roomId={roomId} />}
        {tab === "campaign" && <CampaignLedger roomId={roomId} />}
        {tab === "reference" && <QuickReference />}
      </div>
    </div>
  );
}
