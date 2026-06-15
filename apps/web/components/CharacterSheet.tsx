"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useWeered } from "./WeeredProvider";
import CharacterSheetEditor from "./CharacterSheetEditor";

type Character = {
  id: string;
  name: string;
  className: string;
  level: number;
  race: string;
  alignment: string;
  ownerUserId: string;
  campaignId: string | null;
  roomId: string | null;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  hpCurrent: number;
  hpMax: number;
  hpTemp: number;
  ac: number;
  speed: number;
  hitDice: string;
  saveProfs: string[];
  skillProfs: Array<{ skill: string; expertise?: boolean }>;
  spellSlots: Record<string, { current: number; max: number }>;
  spells: Array<{ name: string; level: number }>;
  inventory: Array<{
    name: string;
    qty: number;
    equipped: boolean;
    attuned: boolean;
    notes: string;
  }>;
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
  features: Array<{ title: string; body: string; source: string }>;
  attacks: Array<{ name: string; expression: string; damage: string; notes: string }>;
  notesDM: string;
  notesPlayer: string;
  notesParty: string;
  derived: {
    proficiencyBonus: number;
    mods: Record<"STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA", number>;
    saves: Array<{ ability: string; proficient: boolean; bonus: number }>;
    skills: Array<{
      skill: string;
      ability: string;
      proficient: boolean;
      expertise: boolean;
      bonus: number;
    }>;
    passivePerception: number;
    initiative: number;
  };
};

const ABILITY_LABEL: Record<string, string> = {
  STR: "Strength",
  DEX: "Dexterity",
  CON: "Constitution",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma",
};

const SKILL_LABEL: Record<string, string> = {
  acrobatics: "Acrobatics",
  animalHandling: "Animal Handling",
  arcana: "Arcana",
  athletics: "Athletics",
  deception: "Deception",
  history: "History",
  insight: "Insight",
  intimidation: "Intimidation",
  investigation: "Investigation",
  medicine: "Medicine",
  nature: "Nature",
  perception: "Perception",
  performance: "Performance",
  persuasion: "Persuasion",
  religion: "Religion",
  sleightOfHand: "Sleight of Hand",
  stealth: "Stealth",
  survival: "Survival",
};

const ACCENT = "#C4A55A";

function modSign(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export default function CharacterSheet({ roomId, lobbyId }: { roomId: string; lobbyId: string }) {
  const { apiBase, token, me } = useWeered() as any;

  const [characters, setCharacters] = useState<Character[]>([]);
  const [asDM, setAsDM] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<Character | null>(null);
  const [rollPrompt, setRollPrompt] = useState<{
    label: string;
    expression: string;
    intent?: string;
    attackName?: string;
    damageExpression?: string;
    characterId?: string;
  } | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${apiBase}/characters?roomId=${encodeURIComponent(roomId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "load_failed");
      setCharacters(j.characters || []);
      setAsDM(!!j.asDM);
      if (!j.asDM && j.characters?.length && !selectedId) {
        setSelectedId(j.characters[0].id);
      }
      setError(null);
    } catch (e: any) {
      setError(e?.message || "load_failed");
    } finally {
      setLoading(false);
    }
  }, [apiBase, token, roomId, selectedId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const selected = useMemo(
    () => characters.find((c) => c.id === selectedId) || null,
    [characters, selectedId],
  );

  function openCreate() {
    setEditorTarget(null);
    setEditorOpen(true);
  }
  function openEdit(c: Character) {
    setEditorTarget(c);
    setEditorOpen(true);
  }
  async function handleSaved(c: Character) {
    setEditorOpen(false);
    await reload();
    setSelectedId(c.id);
  }

  async function adjustHp(c: Character, delta: number) {
    const r = await fetch(`${apiBase}/characters/${c.id}/hp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ delta }),
    });
    const j = await r.json();
    if (j?.ok && j.character) {
      setCharacters((prev) => prev.map((x) => (x.id === c.id ? j.character : x)));
    }
  }

  async function toggleSlot(c: Character, level: string, index: number) {
    if (c.ownerUserId !== me?.id) return;
    const slot = c.spellSlots?.[level] || { current: 0, max: 0 };
    const filled = index < slot.current;
    const op = filled ? "use" : "restore";
    let nextCurrent = slot.current;
    if (filled) nextCurrent = index;
    else nextCurrent = Math.min(slot.max, index + 1);
    const r = await fetch(`${apiBase}/characters/${c.id}/spell-slot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ level, op: "set", current: nextCurrent, max: slot.max }),
    });
    const j = await r.json();
    if (j?.ok && j.character) {
      setCharacters((prev) => prev.map((x) => (x.id === c.id ? j.character : x)));
    }
  }

  async function deleteCharacter(c: Character) {
    if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    const r = await fetch(`${apiBase}/characters/${c.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (j?.ok) {
      setSelectedId(null);
      reload();
    }
  }

  async function castRoll(
    expression: string,
    meta?: {
      intent?: string;
      attackName?: string;
      damageExpression?: string;
      characterId?: string;
    },
  ) {
    if (!lobbyId) return;
    try {
      await fetch(`${apiBase}/lobbies/${lobbyId}/dice/roll`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ expression, ...(meta || {}) }),
      });
    } catch {}
    setRollPrompt(null);
  }

  if (!token) {
    return (
      <div style={{ padding: 24, textAlign: "center", opacity: 0.5 }}>
        Sign in to manage characters.
      </div>
    );
  }
  if (loading) {
    return <div style={{ padding: 24, textAlign: "center", opacity: 0.5 }}>Loading sheets…</div>;
  }
  if (error) {
    return <div style={{ padding: 24, textAlign: "center", color: "#EF5350" }}>Error: {error}</div>;
  }

  return (
    <div
      className="weered-dnd-modules"
      style={{ height: "100%", display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div className="dnd-section-label" style={{ marginBottom: 0 }}>
          {asDM ? "Party Sheets" : "My Character"}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!asDM && (
            <button
              className="dnd-stone-tile"
              style={{ flex: "0 0 auto", fontSize: 12, padding: "6px 12px" }}
              onClick={openCreate}
            >
              + New
            </button>
          )}
        </div>
      </div>

      {asDM && (
        <div
          style={{
            flex: selected ? "0 0 auto" : 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {characters.length === 0 && (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                opacity: 0.5,
                fontFamily: "var(--font-cormorant), serif",
                fontStyle: "italic",
              }}
            >
              No party members have created characters yet.
            </div>
          )}
          {characters.map((c) => (
            <PartyRow
              key={c.id}
              c={c}
              isSelected={c.id === selectedId}
              onSelect={() => setSelectedId(c.id === selectedId ? null : c.id)}
              onHp={(delta) => adjustHp(c, delta)}
            />
          ))}
        </div>
      )}

      {!asDM && characters.length === 0 && (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            opacity: 0.6,
            fontFamily: "var(--font-cormorant), serif",
          }}
        >
          <div style={{ fontSize: 16, marginBottom: 12, fontStyle: "italic" }}>
            No character yet for this campaign.
          </div>
          <button className="dnd-stone-tile" style={{ flex: "0 0 auto" }} onClick={openCreate}>
            Create a character
          </button>
        </div>
      )}

      {selected && (
        <SheetBody
          c={selected}
          isOwner={selected.ownerUserId === me?.id}
          isDM={asDM}
          onEdit={() => openEdit(selected)}
          onDelete={() => deleteCharacter(selected)}
          onHp={(delta) => adjustHp(selected, delta)}
          onToggleSlot={(level, idx) => toggleSlot(selected, level, idx)}
          onRoll={(label, expression, meta) =>
            setRollPrompt({ label, expression, characterId: selected?.id, ...(meta || {}) })
          }
          onLogItem={async (name, qty, notes) => {
            try {
              const desc = `${name}${qty > 1 ? ` ×${qty}` : ""}${notes ? ` — ${notes}` : ""}`;
              const r = await fetch(
                `${apiBase}/rooms/${encodeURIComponent(roomId)}/campaign/ledger`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ type: "ITEM", delta: qty || 1, description: desc }),
                },
              );
              const j = await r.json();
              if (j?.ok) {
                try {
                  (await import("../lib/toast")).weeredToast.success(`Logged: ${name}`);
                } catch {}
              } else {
                try {
                  (await import("../lib/toast")).weeredToast.error(j?.error || "Log failed");
                } catch {}
              }
            } catch {
              try {
                (await import("../lib/toast")).weeredToast.error("Log failed");
              } catch {}
            }
          }}
        />
      )}

      {editorOpen && (
        <CharacterSheetEditor
          apiBase={apiBase}
          token={token}
          roomId={roomId}
          target={editorTarget}
          onSaved={(c) => {
            void handleSaved(c as Parameters<typeof handleSaved>[0]);
          }}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {rollPrompt && (
        <RollPrompt
          label={rollPrompt.label}
          expression={rollPrompt.expression}
          onCast={() =>
            castRoll(rollPrompt.expression, {
              intent: rollPrompt.intent,
              attackName: rollPrompt.attackName,
              damageExpression: rollPrompt.damageExpression,
              characterId: rollPrompt.characterId,
            })
          }
          onCancel={() => setRollPrompt(null)}
        />
      )}
    </div>
  );
}

function PartyRow({
  c,
  isSelected,
  onSelect,
  onHp,
}: {
  c: Character;
  isSelected: boolean;
  onSelect: () => void;
  onHp: (delta: number) => void;
}) {
  const pct = c.hpMax > 0 ? Math.max(0, Math.min(100, (c.hpCurrent / c.hpMax) * 100)) : 0;
  const hpColor = pct > 50 ? "#22C55E" : pct > 25 ? "#F59E0B" : "#EF4444";
  return (
    <div
      className="dnd-card"
      style={{
        cursor: "pointer",
        borderColor: isSelected ? `${ACCENT}aa` : undefined,
        boxShadow: isSelected ? `0 0 14px ${ACCENT}22` : undefined,
      }}
    >
      <div onClick={onSelect} style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="dnd-heading" style={{ fontSize: 16, lineHeight: 1.1 }}>
            {c.name}
          </div>
          <div className="dnd-serif" style={{ fontSize: 12, opacity: 0.7 }}>
            Lv {c.level} {c.race} {c.className}
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: 90 }}>
          <div style={{ fontSize: 11, opacity: 0.6 }}>AC {c.ac}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: hpColor }}>
            {c.hpCurrent} / {c.hpMax} HP
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <button
          className="dnd-stone-tile dnd-stone-tile--dis"
          style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: 14 }}
          onClick={() => onHp(-1)}
        >
          −
        </button>
        <button
          className="dnd-stone-tile dnd-stone-tile--dis"
          style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: 11 }}
          onClick={() => onHp(-5)}
        >
          −5
        </button>
        <div
          style={{
            flex: 1,
            height: 10,
            borderRadius: 4,
            background: "rgba(0,0,0,.4)",
            overflow: "hidden",
            border: "1px solid rgba(196,165,90,.20)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: hpColor,
              transition: "width .2s, background .2s",
            }}
          />
        </div>
        <button
          className="dnd-stone-tile dnd-stone-tile--adv"
          style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: 11 }}
          onClick={() => onHp(5)}
        >
          +5
        </button>
        <button
          className="dnd-stone-tile dnd-stone-tile--adv"
          style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: 14 }}
          onClick={() => onHp(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

function SheetBody({
  c,
  isOwner,
  isDM,
  onEdit,
  onDelete,
  onHp,
  onToggleSlot,
  onRoll,
  onLogItem,
}: {
  c: Character;
  isOwner: boolean;
  isDM: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onHp: (delta: number) => void;
  onToggleSlot: (level: string, idx: number) => void;
  onRoll: (
    label: string,
    expression: string,
    meta?: { intent?: string; attackName?: string; damageExpression?: string },
  ) => void;
  onLogItem: (name: string, qty: number, notes: string) => void;
}) {
  const pct = c.hpMax > 0 ? (c.hpCurrent / c.hpMax) * 100 : 0;
  const hpColor = pct > 50 ? "#22C55E" : pct > 25 ? "#F59E0B" : "#EF4444";

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        paddingRight: 4,
      }}
    >
      <div className="dnd-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dnd-heading" style={{ fontSize: 24, lineHeight: 1.0 }}>
              {c.name}
            </div>
            <div className="dnd-serif" style={{ fontSize: 13, opacity: 0.75 }}>
              Level {c.level} {c.race}
              {c.race && c.className ? " " : ""}
              {c.className}
              {c.alignment ? ` · ${c.alignment}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {isOwner && (
              <button
                className="dnd-stone-tile"
                style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: 11 }}
                onClick={onEdit}
              >
                Edit
              </button>
            )}
            {isOwner && (
              <button
                className="dnd-stone-tile dnd-stone-tile--dis"
                style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: 11 }}
                onClick={onDelete}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 8,
        }}
      >
        <VitalCard label="Hit Points">
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: hpColor,
              fontFamily: "var(--font-pirata), serif",
              letterSpacing: 1,
            }}
          >
            {c.hpCurrent}
            <span style={{ opacity: 0.4 }}> / {c.hpMax}</span>
            {c.hpTemp > 0 && (
              <span style={{ fontSize: 13, color: "#60a5fa", marginLeft: 6 }}>+{c.hpTemp}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            <button
              className="dnd-stone-tile dnd-stone-tile--dis"
              style={{ flex: 1, padding: "4px 6px", fontSize: 12 }}
              onClick={() => onHp(-1)}
            >
              −1
            </button>
            <button
              className="dnd-stone-tile dnd-stone-tile--dis"
              style={{ flex: 1, padding: "4px 6px", fontSize: 11 }}
              onClick={() => onHp(-5)}
            >
              −5
            </button>
            <button
              className="dnd-stone-tile dnd-stone-tile--adv"
              style={{ flex: 1, padding: "4px 6px", fontSize: 11 }}
              onClick={() => onHp(5)}
            >
              +5
            </button>
            <button
              className="dnd-stone-tile dnd-stone-tile--adv"
              style={{ flex: 1, padding: "4px 6px", fontSize: 12 }}
              onClick={() => onHp(1)}
            >
              +1
            </button>
          </div>
        </VitalCard>
        <VitalCard label="Armor Class">
          <Big>{c.ac}</Big>
        </VitalCard>
        <VitalCard label="Speed">
          <Big>
            {c.speed}
            <span style={{ fontSize: 13, opacity: 0.5 }}> ft</span>
          </Big>
        </VitalCard>
        <VitalCard label="Initiative">
          <button
            className="dnd-stone-tile"
            style={{ width: "100%", padding: "10px 0" }}
            onClick={() => onRoll(`Initiative`, `1d20${modSign(c.derived.initiative)}`)}
          >
            <span style={{ fontSize: 22, fontWeight: 800 }}>{modSign(c.derived.initiative)}</span>
          </button>
        </VitalCard>
        <VitalCard label="Proficiency">
          <Big>+{c.derived.proficiencyBonus}</Big>
        </VitalCard>
        <VitalCard label="Passive Perception">
          <Big>{c.derived.passivePerception}</Big>
        </VitalCard>
        <VitalCard label="Hit Dice">
          <div
            style={{
              fontFamily: "var(--font-pirata), serif",
              fontSize: 16,
              color: "#F5D58A",
              textAlign: "center",
            }}
          >
            {c.hitDice || "—"}
          </div>
        </VitalCard>
      </div>

      <div>
        <div className="dnd-section-label">Ability Scores</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {(["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const).map((k) => {
            const score = (c as any)[k.toLowerCase()];
            const mod = c.derived.mods[k];
            return (
              <button
                key={k}
                className="dnd-stone-tile"
                style={{ flex: "0 0 auto", padding: "10px 4px", textAlign: "center" }}
                onClick={() => onRoll(`${ABILITY_LABEL[k]} check`, `1d20${modSign(mod)}`)}
              >
                <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 1.5 }}>{k}</div>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{modSign(mod)}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{score}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div>
          <div className="dnd-section-label">Saving Throws</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {c.derived.saves.map((s) => (
              <button
                key={s.ability}
                className="dnd-stone-tile"
                style={{
                  flex: "0 0 auto",
                  padding: "5px 10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textAlign: "left",
                  fontSize: 12,
                }}
                onClick={() =>
                  onRoll(`${ABILITY_LABEL[s.ability]} save`, `1d20${modSign(s.bonus)}`)
                }
              >
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      border: `1px solid ${ACCENT}77`,
                      background: s.proficient ? ACCENT : "transparent",
                      marginRight: 8,
                    }}
                  />
                  {ABILITY_LABEL[s.ability]}
                </span>
                <span style={{ fontWeight: 700 }}>{modSign(s.bonus)}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="dnd-section-label">Skills</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {c.derived.skills.map((s) => (
              <button
                key={s.skill}
                className="dnd-stone-tile"
                style={{
                  flex: "0 0 auto",
                  padding: "4px 10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textAlign: "left",
                  fontSize: 12,
                }}
                onClick={() =>
                  onRoll(`${SKILL_LABEL[s.skill]} (${s.ability})`, `1d20${modSign(s.bonus)}`)
                }
              >
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      border: `1px solid ${ACCENT}77`,
                      background: s.expertise ? "#E8A04A" : s.proficient ? ACCENT : "transparent",
                      marginRight: 8,
                    }}
                  />
                  {SKILL_LABEL[s.skill]}
                  <span style={{ fontSize: 10, opacity: 0.45, marginLeft: 6 }}>{s.ability}</span>
                </span>
                <span style={{ fontWeight: 700 }}>{modSign(s.bonus)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {c.attacks.length > 0 && (
        <div>
          <div className="dnd-section-label">Attacks</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {c.attacks.map((a, i) => (
              <div key={i} className="dnd-card" style={{ padding: "8px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="dnd-heading" style={{ fontSize: 14 }}>
                      {a.name}
                    </div>
                    {a.notes && (
                      <div
                        style={{
                          fontSize: 11,
                          opacity: 0.6,
                          fontFamily: "var(--font-cormorant), serif",
                        }}
                      >
                        {a.notes}
                      </div>
                    )}
                  </div>
                  <button
                    className="dnd-stone-tile"
                    style={{ flex: "0 0 auto", padding: "5px 10px", fontSize: 12 }}
                    onClick={() =>
                      onRoll(`${a.name} (attack)`, a.expression, {
                        intent: "attack",
                        attackName: a.name,
                        damageExpression: a.damage || undefined,
                      })
                    }
                  >
                    Hit · {a.expression}
                  </button>
                  {a.damage && (
                    <button
                      className="dnd-stone-tile dnd-stone-tile--dis"
                      style={{ flex: "0 0 auto", padding: "5px 10px", fontSize: 12 }}
                      onClick={() =>
                        onRoll(`${a.name} (damage)`, a.damage, {
                          intent: "damage",
                          attackName: a.name,
                        })
                      }
                    >
                      Dmg · {a.damage}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(c.spellSlots || {}).length > 0 && (
        <div>
          <div className="dnd-section-label">Spell Slots</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {Object.keys(c.spellSlots)
              .sort()
              .map((level) => {
                const slot = c.spellSlots[level];
                if (!slot || slot.max <= 0) return null;
                return (
                  <div key={level} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-pirata), serif",
                        fontSize: 14,
                        color: "#F5D58A",
                        minWidth: 36,
                      }}
                    >
                      L{level}
                    </span>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {Array.from({ length: slot.max }).map((_, i) => {
                        const filled = i < slot.current;
                        return (
                          <button
                            key={i}
                            onClick={() => onToggleSlot(level, i)}
                            disabled={!isOwner}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              border: `2px solid ${ACCENT}88`,
                              background: filled ? ACCENT : "transparent",
                              cursor: isOwner ? "pointer" : "default",
                              padding: 0,
                            }}
                          />
                        );
                      })}
                    </div>
                    <span style={{ fontSize: 11, opacity: 0.55, marginLeft: "auto" }}>
                      {slot.current} / {slot.max}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {c.spells.length > 0 && (
        <div>
          <div className="dnd-section-label">Spells</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[...c.spells]
              .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
              .map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 8px",
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontFamily: "var(--font-cormorant), serif", color: "#F5D58A" }}>
                    {s.name}
                  </span>
                  <span style={{ opacity: 0.55, fontSize: 11 }}>
                    {s.level === 0 ? "cantrip" : `L${s.level}`}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div>
        <div className="dnd-section-label">Coin</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["pp", "gp", "ep", "sp", "cp"] as const).map((k) => (
            <div
              key={k}
              className="dnd-card"
              style={{ flex: 1, padding: "6px 8px", textAlign: "center" }}
            >
              <div style={{ fontSize: 10, opacity: 0.55, letterSpacing: 1.5 }}>
                {k.toUpperCase()}
              </div>
              <div
                style={{ fontFamily: "var(--font-pirata), serif", fontSize: 16, color: "#F5D58A" }}
              >
                {(c as any)[k]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {c.inventory.length > 0 && (
        <div>
          <div className="dnd-section-label">Inventory</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {c.inventory.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "4px 8px",
                  fontSize: 12,
                  alignItems: "center",
                }}
              >
                <span
                  style={{ flex: 1, fontFamily: "var(--font-cormorant), serif", color: "#F5D58A" }}
                >
                  {it.name}
                  {it.qty > 1 && <span style={{ opacity: 0.5 }}> ×{it.qty}</span>}
                </span>
                {it.equipped && (
                  <span style={{ fontSize: 9, color: "#22C55E", fontWeight: 700 }}>EQUIP</span>
                )}
                {it.attuned && (
                  <span style={{ fontSize: 9, color: "#60A5FA", fontWeight: 700 }}>ATTUNED</span>
                )}
                {it.notes && <span style={{ opacity: 0.5, fontSize: 11 }}>{it.notes}</span>}
                {(isOwner || isDM) && (
                  <button
                    onClick={() => onLogItem(it.name, it.qty || 1, it.notes || "")}
                    title="Log this item to the Campaign Ledger"
                    style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      borderRadius: 3,
                      background: "rgba(196,165,90,.15)",
                      color: "#C4A55A",
                      border: "1px solid rgba(196,165,90,.3)",
                      cursor: "pointer",
                      letterSpacing: ".5px",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    → Ledger
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {c.features.length > 0 && (
        <div>
          <div className="dnd-section-label">Features &amp; Traits</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {c.features.map((f, i) => (
              <div key={i} className="dnd-card" style={{ padding: "8px 10px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <span className="dnd-heading" style={{ fontSize: 14 }}>
                    {f.title}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      opacity: 0.5,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    {f.source}
                  </span>
                </div>
                {f.body && (
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.8,
                      fontFamily: "var(--font-cormorant), serif",
                      whiteSpace: "pre-wrap",
                      marginTop: 4,
                    }}
                  >
                    {f.body}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <NotesBlock c={c} isOwner={isOwner} isDM={isDM} />
    </div>
  );
}

function VitalCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="dnd-card" style={{ padding: "8px 10px", textAlign: "center" }}>
      <div
        style={{
          fontSize: 9,
          opacity: 0.55,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
function Big({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--font-pirata), serif", fontSize: 24, color: "#F5D58A" }}>
      {children}
    </div>
  );
}

function NotesBlock({ c, isOwner, isDM }: { c: Character; isOwner: boolean; isDM: boolean }) {
  const blocks: Array<{ label: string; body: string }> = [];
  if (c.notesParty) blocks.push({ label: "Party Notes", body: c.notesParty });
  if (isOwner && c.notesPlayer)
    blocks.push({ label: "Player Notes (private)", body: c.notesPlayer });
  if (isDM && c.notesDM) blocks.push({ label: "DM Notes (private)", body: c.notesDM });
  if (blocks.length === 0) return null;
  return (
    <div>
      <div className="dnd-section-label">Notes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {blocks.map((b, i) => (
          <div key={i} className="dnd-card" style={{ padding: "8px 10px" }}>
            <div
              style={{
                fontSize: 10,
                opacity: 0.55,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {b.label}
            </div>
            <div
              style={{
                fontSize: 12,
                opacity: 0.85,
                fontFamily: "var(--font-cormorant), serif",
                whiteSpace: "pre-wrap",
              }}
            >
              {b.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RollPrompt({
  label,
  expression,
  onCast,
  onCancel,
}: {
  label: string;
  expression: string;
  onCast: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.65)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="dnd-card weered-dnd-modules"
        style={{
          padding: 24,
          minWidth: 280,
          maxWidth: 360,
          textAlign: "center",
        }}
      >
        <div className="dnd-section-label" style={{ marginBottom: 8 }}>
          Roll
        </div>
        <div className="dnd-heading" style={{ fontSize: 18, marginBottom: 6 }}>
          {label}
        </div>
        <div
          style={{
            fontFamily: "var(--font-pirata), serif",
            fontSize: 32,
            color: "#F5D58A",
            letterSpacing: 2,
            marginBottom: 16,
          }}
        >
          {expression}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="dnd-stone-tile"
            style={{ flex: 1, padding: "10px 0" }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="dnd-stone-tile dnd-stone-tile--adv"
            style={{ flex: 2, padding: "10px 0", fontSize: 16 }}
            onClick={onCast}
          >
            Cast
          </button>
        </div>
      </div>
    </div>
  );
}
