"use client";

import React, { useEffect, useState } from "react";

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
};

const ABILITY_KEYS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
const SKILLS = [
  "acrobatics",
  "animalHandling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleightOfHand",
  "stealth",
  "survival",
];
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
const FEATURE_SOURCES = ["race", "class", "feat", "background", "other"];

type Draft = Omit<Character, "id" | "ownerUserId">;

function emptyDraft(roomId: string): Draft {
  return {
    name: "",
    className: "",
    level: 1,
    race: "",
    alignment: "",
    campaignId: null,
    roomId,
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    hpCurrent: 0,
    hpMax: 0,
    hpTemp: 0,
    ac: 10,
    speed: 30,
    hitDice: "",
    saveProfs: [],
    skillProfs: [],
    spellSlots: {},
    spells: [],
    inventory: [],
    cp: 0,
    sp: 0,
    ep: 0,
    gp: 0,
    pp: 0,
    features: [],
    attacks: [],
    notesDM: "",
    notesPlayer: "",
    notesParty: "",
  };
}

export default function CharacterSheetEditor({
  apiBase,
  token,
  roomId,
  target,
  onSaved,
  onClose,
}: {
  apiBase: string;
  token: string;
  roomId: string;
  target: Character | null;
  onSaved: (c: Character) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(target ? stripIds(target) : emptyDraft(roomId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(target ? stripIds(target) : emptyDraft(roomId));
  }, [target, roomId]);

  function patch<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((prev) => ({ ...prev, [k]: v }));
  }

  function toggleSave(k: string) {
    setDraft((prev) => ({
      ...prev,
      saveProfs: prev.saveProfs.includes(k)
        ? prev.saveProfs.filter((x) => x !== k)
        : [...prev.saveProfs, k],
    }));
  }
  function setSkillProf(skill: string, mode: "none" | "prof" | "expert") {
    setDraft((prev) => {
      const others = prev.skillProfs.filter((s) => s.skill !== skill);
      if (mode === "none") return { ...prev, skillProfs: others };
      return { ...prev, skillProfs: [...others, { skill, expertise: mode === "expert" }] };
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const url = target ? `${apiBase}/characters/${target.id}` : `${apiBase}/characters`;
      const method = target ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "save_failed");
      onSaved(j.character);
    } catch (e: any) {
      setError(e?.message || "save_failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClose();
        }
      }}
      role="button"
      tabIndex={0}
      className="weered-dnd-modules"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.7)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        role="button"
        tabIndex={0}
        className="dnd-card"
        style={{
          width: "min(720px, 100%)",
          maxHeight: "92vh",
          overflow: "auto",
          padding: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div className="dnd-heading" style={{ fontSize: 22 }}>
            {target ? "Edit Character" : "New Character"}
          </div>
          <button
            className="dnd-stone-tile"
            style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: 12 }}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <Section label="Identity">
          <Row>
            <Field label="Name" flex={2}>
              <input
                className="dnd-parchment-input"
                value={draft.name}
                onChange={(e) => patch("name", e.target.value)}
              />
            </Field>
            <Field label="Level">
              <input
                className="dnd-parchment-input"
                type="number"
                min={1}
                max={20}
                value={draft.level}
                onChange={(e) => patch("level", parseInt(e.target.value) || 1)}
              />
            </Field>
          </Row>
          <Row>
            <Field label="Race">
              <input
                className="dnd-parchment-input"
                value={draft.race}
                onChange={(e) => patch("race", e.target.value)}
              />
            </Field>
            <Field label="Class">
              <input
                className="dnd-parchment-input"
                value={draft.className}
                onChange={(e) => patch("className", e.target.value)}
              />
            </Field>
            <Field label="Alignment">
              <input
                className="dnd-parchment-input"
                value={draft.alignment}
                onChange={(e) => patch("alignment", e.target.value)}
              />
            </Field>
          </Row>
        </Section>

        <Section label="Ability Scores">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
            {ABILITY_KEYS.map((k) => (
              <Field key={k} label={k}>
                <input
                  className="dnd-parchment-input"
                  type="number"
                  min={1}
                  max={30}
                  value={(draft as any)[k.toLowerCase()]}
                  onChange={(e) =>
                    patch(
                      k.toLowerCase() as any,
                      Math.max(1, Math.min(30, parseInt(e.target.value) || 10)),
                    )
                  }
                />
              </Field>
            ))}
          </div>
        </Section>

        <Section label="Vitals">
          <Row>
            <Field label="HP Current">
              <input
                className="dnd-parchment-input"
                type="number"
                value={draft.hpCurrent}
                onChange={(e) => patch("hpCurrent", parseInt(e.target.value) || 0)}
              />
            </Field>
            <Field label="HP Max">
              <input
                className="dnd-parchment-input"
                type="number"
                value={draft.hpMax}
                onChange={(e) => patch("hpMax", parseInt(e.target.value) || 0)}
              />
            </Field>
            <Field label="HP Temp">
              <input
                className="dnd-parchment-input"
                type="number"
                value={draft.hpTemp}
                onChange={(e) => patch("hpTemp", parseInt(e.target.value) || 0)}
              />
            </Field>
          </Row>
          <Row>
            <Field label="AC">
              <input
                className="dnd-parchment-input"
                type="number"
                value={draft.ac}
                onChange={(e) => patch("ac", parseInt(e.target.value) || 10)}
              />
            </Field>
            <Field label="Speed (ft)">
              <input
                className="dnd-parchment-input"
                type="number"
                value={draft.speed}
                onChange={(e) => patch("speed", parseInt(e.target.value) || 30)}
              />
            </Field>
            <Field label="Hit Dice">
              <input
                className="dnd-parchment-input"
                placeholder="e.g. 5d10"
                value={draft.hitDice}
                onChange={(e) => patch("hitDice", e.target.value)}
              />
            </Field>
          </Row>
        </Section>

        <Section label="Saving Throw Proficiencies">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ABILITY_KEYS.map((k) => {
              const on = draft.saveProfs.includes(k);
              return (
                <button
                  key={k}
                  className={`dnd-stone-tile${on ? " dnd-stone-tile--adv" : ""}`}
                  style={{ flex: "0 0 auto", padding: "6px 14px" }}
                  onClick={() => toggleSave(k)}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Skill Proficiencies">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 4,
            }}
          >
            {SKILLS.map((skill) => {
              const cur = draft.skillProfs.find((s) => s.skill === skill);
              const mode = cur ? (cur.expertise ? "expert" : "prof") : "none";
              return (
                <div key={skill} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontFamily: "var(--font-cormorant), serif",
                      color: "#F5D58A",
                    }}
                  >
                    {SKILL_LABEL[skill]}
                  </span>
                  <select
                    className="dnd-parchment-input"
                    style={{ flex: "0 0 auto", padding: "4px 8px", fontSize: 11 }}
                    value={mode}
                    onChange={(e) => setSkillProf(skill, e.target.value as any)}
                  >
                    <option value="none">—</option>
                    <option value="prof">Prof</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
              );
            })}
          </div>
        </Section>

        <ListEditor
          label="Attacks"
          rows={draft.attacks}
          empty={{ name: "", expression: "1d20+0", damage: "", notes: "" }}
          onChange={(rows) => patch("attacks", rows)}
          render={(row, set) => (
            <Row>
              <Field label="Name" flex={2}>
                <input
                  className="dnd-parchment-input"
                  value={row.name}
                  onChange={(e) => set({ ...row, name: e.target.value })}
                />
              </Field>
              <Field label="Hit (1d20+...)">
                <input
                  className="dnd-parchment-input"
                  value={row.expression}
                  onChange={(e) => set({ ...row, expression: e.target.value })}
                />
              </Field>
              <Field label="Damage">
                <input
                  className="dnd-parchment-input"
                  placeholder="e.g. 1d8+3"
                  value={row.damage}
                  onChange={(e) => set({ ...row, damage: e.target.value })}
                />
              </Field>
              <Field label="Notes">
                <input
                  className="dnd-parchment-input"
                  value={row.notes}
                  onChange={(e) => set({ ...row, notes: e.target.value })}
                />
              </Field>
            </Row>
          )}
        />

        <Section label="Spell Slots">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 6,
            }}
          >
            {Array.from({ length: 9 }).map((_, i) => {
              const lvl = String(i + 1);
              const slot = draft.spellSlots[lvl] || { current: 0, max: 0 };
              return (
                <div key={lvl} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-pirata), serif",
                      color: "#F5D58A",
                      minWidth: 24,
                    }}
                  >
                    L{lvl}
                  </span>
                  <input
                    className="dnd-parchment-input"
                    type="number"
                    min={0}
                    max={slot.max}
                    value={slot.current}
                    onChange={(e) => {
                      const cur = Math.max(0, Math.min(slot.max, parseInt(e.target.value) || 0));
                      patch("spellSlots", {
                        ...draft.spellSlots,
                        [lvl]: { current: cur, max: slot.max },
                      });
                    }}
                    style={{ flex: 1, padding: "4px 6px" }}
                  />
                  <span style={{ opacity: 0.55, fontSize: 11 }}>/</span>
                  <input
                    className="dnd-parchment-input"
                    type="number"
                    min={0}
                    value={slot.max}
                    onChange={(e) => {
                      const max = Math.max(0, parseInt(e.target.value) || 0);
                      patch("spellSlots", {
                        ...draft.spellSlots,
                        [lvl]: { current: Math.min(slot.current, max), max },
                      });
                    }}
                    style={{ flex: 1, padding: "4px 6px" }}
                  />
                </div>
              );
            })}
          </div>
        </Section>

        <ListEditor
          label="Spells"
          rows={draft.spells}
          empty={{ name: "", level: 0 }}
          onChange={(rows) => patch("spells", rows)}
          render={(row, set) => (
            <Row>
              <Field label="Name" flex={3}>
                <input
                  className="dnd-parchment-input"
                  value={row.name}
                  onChange={(e) => set({ ...row, name: e.target.value })}
                />
              </Field>
              <Field label="Level">
                <select
                  className="dnd-parchment-input"
                  value={row.level}
                  onChange={(e) => set({ ...row, level: parseInt(e.target.value) })}
                >
                  {Array.from({ length: 10 }).map((_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? "cantrip" : i}
                    </option>
                  ))}
                </select>
              </Field>
            </Row>
          )}
        />

        <Section label="Coin">
          <Row>
            {(["pp", "gp", "ep", "sp", "cp"] as const).map((k) => (
              <Field key={k} label={k.toUpperCase()}>
                <input
                  className="dnd-parchment-input"
                  type="number"
                  value={(draft as any)[k]}
                  onChange={(e) => patch(k as any, Math.max(0, parseInt(e.target.value) || 0))}
                />
              </Field>
            ))}
          </Row>
        </Section>

        <ListEditor
          label="Inventory"
          rows={draft.inventory}
          empty={{ name: "", qty: 1, equipped: false, attuned: false, notes: "" }}
          onChange={(rows) => patch("inventory", rows)}
          render={(row, set) => (
            <Row>
              <Field label="Item" flex={2}>
                <input
                  className="dnd-parchment-input"
                  value={row.name}
                  onChange={(e) => set({ ...row, name: e.target.value })}
                />
              </Field>
              <Field label="Qty">
                <input
                  className="dnd-parchment-input"
                  type="number"
                  min={0}
                  value={row.qty}
                  onChange={(e) => set({ ...row, qty: parseInt(e.target.value) || 1 })}
                />
              </Field>
              <Field label="Notes" flex={2}>
                <input
                  className="dnd-parchment-input"
                  value={row.notes}
                  onChange={(e) => set({ ...row, notes: e.target.value })}
                />
              </Field>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  color: "#F5D58A",
                }}
              >
                <input
                  type="checkbox"
                  checked={row.equipped}
                  onChange={(e) => set({ ...row, equipped: e.target.checked })}
                />
                Equip
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  color: "#F5D58A",
                }}
              >
                <input
                  type="checkbox"
                  checked={row.attuned}
                  onChange={(e) => set({ ...row, attuned: e.target.checked })}
                />
                Attuned
              </label>
            </Row>
          )}
        />

        <ListEditor
          label="Features & Traits"
          rows={draft.features}
          empty={{ title: "", body: "", source: "class" }}
          onChange={(rows) => patch("features", rows)}
          render={(row, set) => (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Row>
                <Field label="Title" flex={2}>
                  <input
                    className="dnd-parchment-input"
                    value={row.title}
                    onChange={(e) => set({ ...row, title: e.target.value })}
                  />
                </Field>
                <Field label="Source">
                  <select
                    className="dnd-parchment-input"
                    value={row.source}
                    onChange={(e) => set({ ...row, source: e.target.value })}
                  >
                    {FEATURE_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </Row>
              <textarea
                className="dnd-parchment-input"
                rows={3}
                placeholder="Body…"
                value={row.body}
                onChange={(e) => set({ ...row, body: e.target.value })}
              />
            </div>
          )}
        />

        <Section label="Notes">
          <Field label="Player Notes (private to you)">
            <textarea
              className="dnd-parchment-input"
              rows={3}
              value={draft.notesPlayer}
              onChange={(e) => patch("notesPlayer", e.target.value)}
            />
          </Field>
          <Field label="Party Notes (shared)">
            <textarea
              className="dnd-parchment-input"
              rows={3}
              value={draft.notesParty}
              onChange={(e) => patch("notesParty", e.target.value)}
            />
          </Field>
        </Section>

        {error && <div style={{ color: "#EF5350", fontSize: 12, padding: 8 }}>Error: {error}</div>}

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid rgba(196,165,90,.20)",
          }}
        >
          <button
            className="dnd-stone-tile"
            style={{ flex: 1, padding: "10px 0" }}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="dnd-stone-tile dnd-stone-tile--adv"
            style={{ flex: 2, padding: "10px 0", fontSize: 16 }}
            onClick={save}
            disabled={saving || !draft.name.trim()}
          >
            {saving ? "Saving…" : target ? "Save Changes" : "Create Character"}
          </button>
        </div>
      </div>
    </div>
  );
}

function stripIds(c: Character): Draft {
  const { id, ownerUserId, ...rest } = c as any;
  return rest;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="dnd-section-label">{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", flexWrap: "wrap" }}>
      {children}
    </div>
  );
}
function Field({
  label,
  flex,
  children,
}: {
  label: string;
  flex?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex: `${flex ?? 1} 1 80px`,
        minWidth: 80,
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <span style={{ fontSize: 9, opacity: 0.55, letterSpacing: 1.2, textTransform: "uppercase" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function ListEditor<T>({
  label,
  rows,
  empty,
  onChange,
  render,
}: {
  label: string;
  rows: T[];
  empty: T;
  onChange: (rows: T[]) => void;
  render: (row: T, set: (next: T) => void) => React.ReactNode;
}) {
  function setRow(i: number, next: T) {
    const out = rows.slice();
    out[i] = next;
    onChange(out);
  }
  function add() {
    onChange([...rows, { ...(empty as any) }]);
  }
  function remove(i: number) {
    onChange(rows.filter((_, j) => j !== i));
  }
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="dnd-section-label" style={{ marginBottom: 0 }}>
          {label}
        </div>
        <button
          className="dnd-stone-tile"
          style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: 11 }}
          onClick={add}
        >
          + Add
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {rows.map((r, i) => (
          <div key={i} className="dnd-card" style={{ padding: 8, position: "relative" }}>
            {render(r, (next) => setRow(i, next))}
            <button
              className="dnd-stone-tile dnd-stone-tile--dis"
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                padding: "2px 8px",
                fontSize: 10,
                flex: "0 0 auto",
              }}
              onClick={() => remove(i)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
