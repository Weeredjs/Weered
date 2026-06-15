"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";
import { useWatchHere, consumePendingStream } from "../lib/useWatchHere";
import EmptyState from "./EmptyState";
import SessionZero, { useSessionZero } from "./SessionZero";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const OPEN5E = "https://api.open5e.com/v1";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  return r.json();
}

const S = {
  card: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.03)",
    padding: "10px 12px",
  } as React.CSSProperties,
  btn: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.05)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgba(243,244,246,.88)",
    fontFamily: "inherit",
  } as React.CSSProperties,
  btnPri: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid rgba(196,165,90,.35)",
    background: "rgba(196,165,90,.12)",
    fontSize: 12,
    cursor: "pointer",
    color: "rgb(196,165,90)",
    fontWeight: 600,
    fontFamily: "inherit",
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.30)",
    fontSize: 13,
    color: "rgba(243,244,246,.92)",
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  },
  select: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.30)",
    fontSize: 12,
    color: "rgba(243,244,246,.92)",
    outline: "none",
    cursor: "pointer",
    fontFamily: "inherit",
  } as React.CSSProperties,
  label: {
    fontSize: 10,
    fontWeight: 700,
    opacity: 0.45,
    letterSpacing: ".7px",
    textTransform: "uppercase" as const,
    marginBottom: 6,
  } as React.CSSProperties,
};

const ACCENT = "#C4A55A";

const CLASS_COLORS: Record<string, string> = {
  Barbarian: "#E7623E",
  Bard: "#AB6DAC",
  Cleric: "#91A1B2",
  Druid: "#7A853B",
  Fighter: "#7F513E",
  Monk: "#51A5C5",
  Paladin: "#B59E54",
  Ranger: "#507F62",
  Rogue: "#555752",
  Sorcerer: "#992E2E",
  Warlock: "#7B469B",
  Wizard: "#2A50A1",
};

const CLASS_ICONS: Record<string, string> = {
  Barbarian: "⚔",
  Bard: "🎵",
  Cleric: "✝",
  Druid: "🌿",
  Fighter: "🗡",
  Monk: "👊",
  Paladin: "🛡",
  Ranger: "🏹",
  Rogue: "🗡",
  Sorcerer: "🔮",
  Warlock: "👁",
  Wizard: "📖",
};

const SCHOOL_COLORS: Record<string, string> = {
  Abjuration: "#4FC3F7",
  Conjuration: "#FFB74D",
  Divination: "#CE93D8",
  Enchantment: "#F48FB1",
  Evocation: "#EF5350",
  Illusion: "#AB47BC",
  Necromancy: "#66BB6A",
  Transmutation: "#FDD835",
};

const SCHOOL_ICONS: Record<string, string> = {
  Abjuration: "/brand/dnd-icons/spell-abjuration.svg",
  Conjuration: "/brand/dnd-icons/spell-conjuration.svg",
  Divination: "/brand/dnd-icons/spell-divination.svg",
  Enchantment: "/brand/dnd-icons/spell-enchantment.svg",
  Evocation: "/brand/dnd-icons/spell-evocation.svg",
  Illusion: "/brand/dnd-icons/spell-illusion.svg",
  Necromancy: "/brand/dnd-icons/spell-necromancy.svg",
  Transmutation: "/brand/dnd-icons/spell-transmutation.svg",
};

const MONSTER_ICONS: Record<string, string> = {
  aberration: "/brand/dnd-icons/monster-aberration.svg",
  beast: "/brand/dnd-icons/monster-beast.svg",
  celestial: "/brand/dnd-icons/monster-celestial.svg",
  construct: "/brand/dnd-icons/monster-construct.svg",
  dragon: "/brand/dnd-icons/monster-dragon.svg",
  elemental: "/brand/dnd-icons/monster-elemental.svg",
  fey: "/brand/dnd-icons/monster-fey.svg",
  fiend: "/brand/dnd-icons/monster-fiend.svg",
  giant: "/brand/dnd-icons/monster-giant.svg",
  humanoid: "/brand/dnd-icons/monster-humanoid.svg",
  monstrosity: "/brand/dnd-icons/monster-monstrosity.svg",
  ooze: "/brand/dnd-icons/monster-ooze.svg",
  plant: "/brand/dnd-icons/monster-plant.svg",
  undead: "/brand/dnd-icons/monster-undead.svg",
};

const RARITY_COLORS: Record<string, string> = {
  common: "rgba(255,255,255,.55)",
  uncommon: "#1FC219",
  rare: "#4FC3F7",
  "very rare": "#7B1FA2",
  legendary: "#FF8F00",
  artifact: "#C62828",
};

function crColor(cr: number): string {
  if (cr <= 4) return "#66BB6A";
  if (cr <= 10) return "#FDD835";
  if (cr <= 16) return "#FF8F00";
  return "#EF5350";
}

type DiceResult = {
  id: string;
  expr: string;
  rolls: number[];
  modifier: number;
  total: number;
  advantage?: boolean;
  disadvantage?: boolean;
  kept?: number[];
  dropped?: number[];
  sides: number;
  roller: string;
  ts: number;
  isNat20?: boolean;
  isNat1?: boolean;
};

function parseDice(expr: string): {
  count: number;
  sides: number;
  modifier: number;
  advantage?: boolean;
  disadvantage?: boolean;
} | null {
  const clean = expr.toLowerCase().trim().replace(/\s+/g, "");
  let adv = false,
    dis = false;
  let working = clean;
  if (working.includes("adv")) {
    adv = true;
    working = working.replace(/adv(antage)?/, "");
  }
  if (working.includes("dis")) {
    dis = true;
    working = working.replace(/dis(advantage)?/, "");
  }
  const m = working.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!m) return null;
  return {
    count: m[1] ? parseInt(m[1]) : 1,
    sides: parseInt(m[2]),
    modifier: m[3] ? parseInt(m[3]) : 0,
    advantage: adv,
    disadvantage: dis,
  };
}

function rollDice(parsed: {
  count: number;
  sides: number;
  modifier: number;
  advantage?: boolean;
  disadvantage?: boolean;
}): Omit<DiceResult, "id" | "expr" | "roller" | "ts"> {
  if (parsed.advantage || parsed.disadvantage) {
    const r1 = Math.floor(Math.random() * parsed.sides) + 1;
    const r2 = Math.floor(Math.random() * parsed.sides) + 1;
    const keep = parsed.advantage ? Math.max(r1, r2) : Math.min(r1, r2);
    const drop = parsed.advantage ? Math.min(r1, r2) : Math.max(r1, r2);
    const isNat20 = parsed.sides === 20 && keep === 20;
    const isNat1 = parsed.sides === 20 && keep === 1;
    return {
      rolls: [r1, r2],
      kept: [keep],
      dropped: [drop],
      modifier: parsed.modifier,
      total: keep + parsed.modifier,
      sides: parsed.sides,
      advantage: parsed.advantage,
      disadvantage: parsed.disadvantage,
      isNat20,
      isNat1,
    };
  }
  const rolls: number[] = [];
  for (let i = 0; i < parsed.count; i++) rolls.push(Math.floor(Math.random() * parsed.sides) + 1);
  const sum = rolls.reduce((a, b) => a + b, 0);
  const isNat20 = parsed.sides === 20 && parsed.count === 1 && rolls[0] === 20;
  const isNat1 = parsed.sides === 20 && parsed.count === 1 && rolls[0] === 1;
  return {
    rolls,
    kept: rolls,
    dropped: [],
    modifier: parsed.modifier,
    total: sum + parsed.modifier,
    sides: parsed.sides,
    isNat20,
    isNat1,
  };
}

const o5eCache = new Map<string, { data: any; ts: number }>();
const O5E_TTL = 300000;

async function o5eFetch(path: string) {
  const cached = o5eCache.get(path);
  if (cached && Date.now() - cached.ts < O5E_TTL) return cached.data;
  const r = await fetch(`${OPEN5E}${path}`);
  const j = await r.json();
  o5eCache.set(path, { data: j, ts: Date.now() });
  return j;
}

const TABS = [
  { id: "compendium" as const, label: "Compendium", icon: "📜" },
  { id: "lfg" as const, label: "Tavern Board", icon: "🍺" },
  { id: "dice" as const, label: "Dice Tower", icon: "🎲" },
  { id: "streams" as const, label: "Streams", icon: "📺" },
];
type TabId = (typeof TABS)[number]["id"];

const COMP_TABS = [
  { id: "spells" as const, label: "Spells", icon: "✨" },
  { id: "monsters" as const, label: "Bestiary", icon: "🐉" },
  { id: "classes" as const, label: "Classes", icon: "⚔" },
  { id: "magicitems" as const, label: "Magic Items", icon: "💎" },
  { id: "conditions" as const, label: "Conditions", icon: "⚡" },
];
type CompTabId = (typeof COMP_TABS)[number]["id"];

const RIBBON_RGB: Record<CompTabId, string> = {
  spells: "42, 80, 161",
  monsters: "122, 133, 59",
  classes: "153, 46, 46",
  magicitems: "81, 165, 197",
  conditions: "181, 158, 84",
};

const SPELL_LEVELS = ["All", "Cantrip", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const SPELL_SCHOOLS = [
  "All",
  "Abjuration",
  "Conjuration",
  "Divination",
  "Enchantment",
  "Evocation",
  "Illusion",
  "Necromancy",
  "Transmutation",
];
const SPELL_CLASSES = [
  "All",
  "Bard",
  "Cleric",
  "Druid",
  "Paladin",
  "Ranger",
  "Sorcerer",
  "Warlock",
  "Wizard",
];

function SpellBrowser() {
  const [spells, setSpells] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("All");
  const [school, setSchool] = useState("All");
  const [dndClass, setDndClass] = useState("All");
  const [selected, setSelected] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const debounce = useRef<any>(null);

  const load = useCallback(
    async (pg = 1) => {
      setLoading(true);
      let q = `/spells/?format=json&page=${pg}&limit=20`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (level !== "All") q += `&level_int=${level === "Cantrip" ? 0 : level}`;
      if (school !== "All") q += `&school=${encodeURIComponent(school)}`;
      if (dndClass !== "All") q += `&dnd_class=${encodeURIComponent(dndClass)}`;
      q += `&document__slug=wotc-srd`;
      try {
        const j = await o5eFetch(q);
        setSpells(j.results || []);
        setTotal(j.count || 0);
        setPage(pg);
      } catch {}
      setLoading(false);
    },
    [search, level, school, dndClass],
  );

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(1), search ? 350 : 0);
    return () => clearTimeout(debounce.current);
  }, [load]);

  if (selected) {
    const s = selected;
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          style={{ ...S.btn, marginBottom: 12, fontSize: 11 }}
        >
          ← Back to Spells
        </button>
        <div
          style={{
            ...S.card,
            border: `1px solid ${SCHOOL_COLORS[s.school] || ACCENT}33`,
            background: `${SCHOOL_COLORS[s.school] || ACCENT}06`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {SCHOOL_ICONS[s.school] && (
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  background: `${SCHOOL_COLORS[s.school] || ACCENT}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <img
                  src={SCHOOL_ICONS[s.school]}
                  alt={s.school + " school icon"}
                  style={{
                    width: 26,
                    height: 26,
                    opacity: 0.8,
                    filter: `drop-shadow(0 0 6px ${SCHOOL_COLORS[s.school] || ACCENT}55)`,
                  }}
                />
              </div>
            )}
            <span style={{ fontSize: 20, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>
              {s.name}
            </span>
            {s.concentration === "yes" && (
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "rgba(239,68,68,.12)",
                  color: "#EF5350",
                  fontWeight: 700,
                }}
              >
                CONC
              </span>
            )}
            {s.ritual === "yes" && (
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "rgba(171,109,172,.15)",
                  color: "#AB6DAC",
                  fontWeight: 700,
                }}
              >
                RITUAL
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(148,163,184,.6)",
              marginBottom: 12,
              fontStyle: "italic",
            }}
          >
            {s.level_int === 0 ? `${s.school} cantrip` : `${s.level} ${s.school?.toLowerCase()}`}
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}
          >
            <div>
              <span style={S.label}>Casting Time</span>
              <div style={{ fontSize: 12, color: "rgba(243,244,246,.85)" }}>{s.casting_time}</div>
            </div>
            <div>
              <span style={S.label}>Range</span>
              <div style={{ fontSize: 12, color: "rgba(243,244,246,.85)" }}>{s.range}</div>
            </div>
            <div>
              <span style={S.label}>Duration</span>
              <div style={{ fontSize: 12, color: "rgba(243,244,246,.85)" }}>{s.duration}</div>
            </div>
            <div>
              <span style={S.label}>Components</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(s.components || "")
                  .split(",")
                  .map((c: string) => c.trim())
                  .filter(Boolean)
                  .map((c: string) => (
                    <span
                      key={c}
                      style={{
                        fontSize: 10,
                        padding: "1px 5px",
                        borderRadius: 3,
                        background: c === "M" ? "rgba(255,215,0,.12)" : "rgba(255,255,255,.06)",
                        color: c === "M" ? "#FFD700" : "rgba(243,244,246,.7)",
                        fontWeight: 600,
                      }}
                    >
                      {c}
                    </span>
                  ))}
              </div>
            </div>
          </div>
          {s.material && (
            <div
              style={{
                fontSize: 11,
                color: "rgba(148,163,184,.5)",
                marginBottom: 10,
                fontStyle: "italic",
              }}
            >
              Material: {s.material}
            </div>
          )}
          <div
            style={{
              fontSize: 13,
              color: "rgba(243,244,246,.82)",
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
            }}
          >
            {s.desc}
          </div>
          {s.higher_level && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 10px",
                borderRadius: 6,
                background: "rgba(196,165,90,.06)",
                border: "1px solid rgba(196,165,90,.12)",
              }}
            >
              <div style={{ ...S.label, color: ACCENT, opacity: 1, marginBottom: 4 }}>
                At Higher Levels
              </div>
              <div style={{ fontSize: 12, color: "rgba(243,244,246,.75)", lineHeight: 1.5 }}>
                {s.higher_level}
              </div>
            </div>
          )}
          <div style={{ fontSize: 10, color: "rgba(148,163,184,.35)", marginTop: 12 }}>
            Classes: {s.dnd_class || "—"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          style={{ ...S.input, flex: "1 1 200px" }}
          placeholder="Search spells..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {SPELL_LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            style={{
              ...S.btn,
              fontSize: 10,
              padding: "3px 8px",
              borderColor: level === l ? `${ACCENT}55` : undefined,
              background: level === l ? `${ACCENT}18` : undefined,
              color: level === l ? ACCENT : undefined,
            }}
          >
            {l === "Cantrip" ? "C" : l === "All" ? "All Lvl" : l}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <select style={S.select} value={school} onChange={(e) => setSchool(e.target.value)}>
          {SPELL_SCHOOLS.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All Schools" : s}
            </option>
          ))}
        </select>
        <select style={S.select} value={dndClass} onChange={(e) => setDndClass(e.target.value)}>
          {SPELL_CLASSES.map((c) => (
            <option key={c} value={c}>
              {c === "All" ? "All Classes" : c}
            </option>
          ))}
        </select>
        <span
          style={{
            fontSize: 10,
            color: "rgba(148,163,184,.4)",
            alignSelf: "center",
            marginLeft: "auto",
          }}
        >
          {total} spells
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
          Consulting the arcane library...
        </div>
      ) : spells.length === 0 ? (
        <EmptyState title="No spells match." hint="Try a different search or filter." />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {spells.map((s) => {
              const schoolClr = SCHOOL_COLORS[s.school] || ACCENT;
              const schoolIcon = SCHOOL_ICONS[s.school];
              return (
                <div
                  key={s.slug}
                  onClick={() => setSelected(s)}
                  style={{
                    ...S.card,
                    cursor: "pointer",
                    transition: "border-color .12s",
                    borderColor: "rgba(255,255,255,.08)",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${schoolClr}44`)}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")
                  }
                >
                  {schoolIcon && (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: `${schoolClr}12`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={schoolIcon}
                        alt={s.school + " school icon"}
                        style={{
                          width: 20,
                          height: 20,
                          opacity: 0.7,
                          filter: `drop-shadow(0 0 4px ${schoolClr}44)`,
                        }}
                      />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "rgba(243,244,246,.92)",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.name}
                      </span>
                      {s.concentration === "yes" && (
                        <span
                          style={{
                            fontSize: 8,
                            padding: "1px 4px",
                            borderRadius: 3,
                            background: "rgba(239,68,68,.12)",
                            color: "#EF5350",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          C
                        </span>
                      )}
                      {s.ritual === "yes" && (
                        <span
                          style={{
                            fontSize: 8,
                            padding: "1px 4px",
                            borderRadius: 3,
                            background: "rgba(171,109,172,.12)",
                            color: "#AB6DAC",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          R
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 9,
                          padding: "1px 5px",
                          borderRadius: 3,
                          background: `${schoolClr}15`,
                          color: schoolClr,
                          fontWeight: 700,
                        }}
                      >
                        {s.school}
                      </span>
                      <span style={{ fontSize: 10, color: "rgba(148,163,184,.5)" }}>
                        {s.level_int === 0 ? "Cantrip" : `Level ${s.level_int}`}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(148,163,184,.45)",
                        marginTop: 5,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.casting_time} · {s.range}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {total > 20 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
              <button style={S.btn} disabled={page <= 1} onClick={() => load(page - 1)}>
                ← Prev
              </button>
              <span style={{ fontSize: 11, color: "rgba(148,163,184,.5)", alignSelf: "center" }}>
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                style={S.btn}
                disabled={page >= Math.ceil(total / 20)}
                onClick={() => load(page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const MONSTER_TYPES = [
  "All",
  "aberration",
  "beast",
  "celestial",
  "construct",
  "dragon",
  "elemental",
  "fey",
  "fiend",
  "giant",
  "humanoid",
  "monstrosity",
  "ooze",
  "plant",
  "undead",
];
const MONSTER_CRS = [
  "All",
  "0",
  "1/8",
  "1/4",
  "1/2",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "30",
];

function MonsterBrowser() {
  const [monsters, setMonsters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [cr, setCr] = useState("All");
  const [selected, setSelected] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const debounce = useRef<any>(null);

  const load = useCallback(
    async (pg = 1) => {
      setLoading(true);
      let q = `/monsters/?format=json&page=${pg}&limit=20&document__slug=wotc-srd`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (type !== "All") q += `&type=${encodeURIComponent(type)}`;
      if (cr !== "All") q += `&cr=${encodeURIComponent(cr)}`;
      try {
        const j = await o5eFetch(q);
        setMonsters(j.results || []);
        setTotal(j.count || 0);
        setPage(pg);
      } catch {}
      setLoading(false);
    },
    [search, type, cr],
  );

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(1), search ? 350 : 0);
    return () => clearTimeout(debounce.current);
  }, [load]);

  function AbilityScore({ label, val }: { label: string; val: number }) {
    const mod = Math.floor((val - 10) / 2);
    return (
      <div style={{ textAlign: "center", padding: "6px 0" }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "rgba(148,163,184,.5)",
            letterSpacing: ".5px",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>{val}</div>
        <div style={{ fontSize: 10, color: ACCENT }}>{mod >= 0 ? `+${mod}` : mod}</div>
      </div>
    );
  }

  if (selected) {
    const m = selected;
    const numCr = parseFloat(m.challenge_rating) || 0;
    const cc = crColor(numCr);
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          style={{ ...S.btn, marginBottom: 12, fontSize: 11 }}
        >
          ← Back to Bestiary
        </button>
        <div style={{ ...S.card, border: `1px solid ${cc}33`, background: `${cc}06` }}>
          <div
            style={{
              borderBottom: `2px solid ${cc}44`,
              paddingBottom: 10,
              marginBottom: 12,
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            {MONSTER_ICONS[(m.type || "").toLowerCase()] && (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background: `${cc}12`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <img
                  src={MONSTER_ICONS[(m.type || "").toLowerCase()]}
                  alt={(m.type || "Monster") + " type icon"}
                  style={{
                    width: 30,
                    height: 30,
                    opacity: 0.75,
                    filter: `drop-shadow(0 0 6px ${cc}55)`,
                  }}
                />
              </div>
            )}
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>
                {m.name}
              </div>
              <div style={{ fontSize: 11, color: "rgba(148,163,184,.6)", fontStyle: "italic" }}>
                {m.size} {m.type}
                {m.subtype ? ` (${m.subtype})` : ""}, {m.alignment}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: "1px solid rgba(255,255,255,.06)",
            }}
          >
            <div>
              <span style={S.label}>Armor Class</span>
              <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(243,244,246,.9)" }}>
                {m.armor_class}
              </div>
            </div>
            <div>
              <span style={S.label}>Hit Points</span>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#EF5350" }}>
                {m.hit_points}{" "}
                <span style={{ fontSize: 10, fontWeight: 400, color: "rgba(148,163,184,.5)" }}>
                  ({m.hit_dice})
                </span>
              </div>
            </div>
            <div>
              <span style={S.label}>Speed</span>
              <div style={{ fontSize: 12, color: "rgba(243,244,246,.8)" }}>
                {typeof m.speed === "object"
                  ? Object.entries(m.speed)
                      .map(([k, v]) => `${k} ${v} ft.`)
                      .join(", ")
                  : m.speed}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 4,
              marginBottom: 14,
              padding: "8px 0",
              borderBottom: "1px solid rgba(255,255,255,.06)",
            }}
          >
            <AbilityScore label="STR" val={m.strength} />
            <AbilityScore label="DEX" val={m.dexterity} />
            <AbilityScore label="CON" val={m.constitution} />
            <AbilityScore label="INT" val={m.intelligence} />
            <AbilityScore label="WIS" val={m.wisdom} />
            <AbilityScore label="CHA" val={m.charisma} />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              marginBottom: 14,
              fontSize: 12,
            }}
          >
            {m.damage_immunities && (
              <div>
                <strong style={{ color: "rgba(243,244,246,.7)" }}>Damage Immunities</strong>{" "}
                <span style={{ color: "rgba(148,163,184,.6)" }}>{m.damage_immunities}</span>
              </div>
            )}
            {m.damage_resistances && (
              <div>
                <strong style={{ color: "rgba(243,244,246,.7)" }}>Damage Resistances</strong>{" "}
                <span style={{ color: "rgba(148,163,184,.6)" }}>{m.damage_resistances}</span>
              </div>
            )}
            {m.damage_vulnerabilities && (
              <div>
                <strong style={{ color: "rgba(243,244,246,.7)" }}>Damage Vulnerabilities</strong>{" "}
                <span style={{ color: "rgba(148,163,184,.6)" }}>{m.damage_vulnerabilities}</span>
              </div>
            )}
            {m.condition_immunities && (
              <div>
                <strong style={{ color: "rgba(243,244,246,.7)" }}>Condition Immunities</strong>{" "}
                <span style={{ color: "rgba(148,163,184,.6)" }}>{m.condition_immunities}</span>
              </div>
            )}
            {m.senses && (
              <div>
                <strong style={{ color: "rgba(243,244,246,.7)" }}>Senses</strong>{" "}
                <span style={{ color: "rgba(148,163,184,.6)" }}>{m.senses}</span>
              </div>
            )}
            {m.languages && (
              <div>
                <strong style={{ color: "rgba(243,244,246,.7)" }}>Languages</strong>{" "}
                <span style={{ color: "rgba(148,163,184,.6)" }}>{m.languages}</span>
              </div>
            )}
            <div>
              <strong style={{ color: "rgba(243,244,246,.7)" }}>Challenge</strong>{" "}
              <span style={{ color: cc, fontWeight: 700 }}>{m.challenge_rating}</span>
            </div>
          </div>

          {m.special_abilities?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ ...S.label, marginBottom: 8, color: cc, opacity: 1 }}>Traits</div>
              {m.special_abilities.map((a: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "rgba(243,244,246,.9)",
                      fontStyle: "italic",
                    }}
                  >
                    {a.name}.
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(243,244,246,.72)", lineHeight: 1.55 }}>
                    {a.desc}
                  </div>
                </div>
              ))}
            </div>
          )}

          {m.actions?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  ...S.label,
                  marginBottom: 8,
                  color: "#EF5350",
                  opacity: 1,
                  borderTop: `2px solid ${cc}44`,
                  paddingTop: 10,
                }}
              >
                Actions
              </div>
              {m.actions.map((a: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "rgba(243,244,246,.9)",
                      fontStyle: "italic",
                    }}
                  >
                    {a.name}.
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(243,244,246,.72)", lineHeight: 1.55 }}>
                    {a.desc}
                  </div>
                </div>
              ))}
            </div>
          )}

          {m.legendary_actions?.length > 0 && (
            <div>
              <div
                style={{
                  ...S.label,
                  marginBottom: 8,
                  color: "#FF8F00",
                  opacity: 1,
                  borderTop: `2px solid ${cc}44`,
                  paddingTop: 10,
                }}
              >
                Legendary Actions
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(148,163,184,.5)",
                  marginBottom: 8,
                  fontStyle: "italic",
                }}
              >
                {m.legendary_desc}
              </div>
              {m.legendary_actions.map((a: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "rgba(243,244,246,.9)",
                      fontStyle: "italic",
                    }}
                  >
                    {a.name}.
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(243,244,246,.72)", lineHeight: 1.55 }}>
                    {a.desc}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          style={{ ...S.input, flex: "1 1 200px" }}
          placeholder="Search monsters..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <select style={S.select} value={type} onChange={(e) => setType(e.target.value)}>
          {MONSTER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === "All" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <select style={S.select} value={cr} onChange={(e) => setCr(e.target.value)}>
          {MONSTER_CRS.map((c) => (
            <option key={c} value={c}>
              {c === "All" ? "All CRs" : `CR ${c}`}
            </option>
          ))}
        </select>
        <span
          style={{
            fontSize: 10,
            color: "rgba(148,163,184,.4)",
            alignSelf: "center",
            marginLeft: "auto",
          }}
        >
          {total} creatures
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
          Scouting the dungeon...
        </div>
      ) : monsters.length === 0 ? (
        <EmptyState title="No monsters match." hint="Try a different search or CR range." />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {monsters.map((m) => {
              const numCr = parseFloat(m.challenge_rating) || 0;
              const cc = crColor(numCr);
              const typeKey = (m.type || "").toLowerCase();
              const typeIcon = MONSTER_ICONS[typeKey];
              return (
                <div
                  key={m.slug}
                  onClick={() => setSelected(m)}
                  style={{
                    ...S.card,
                    cursor: "pointer",
                    transition: "border-color .12s",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${cc}44`)}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")
                  }
                >
                  {typeIcon && (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        background: `${cc}10`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={typeIcon}
                        alt={(m.type || "Monster") + " type icon"}
                        style={{
                          width: 22,
                          height: 22,
                          opacity: 0.6,
                          filter: `drop-shadow(0 0 4px ${cc}44)`,
                        }}
                      />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "rgba(243,244,246,.92)",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: `${cc}18`,
                          color: cc,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        CR {m.challenge_rating}
                      </span>
                    </div>
                    <div
                      style={{ fontSize: 10, color: "rgba(148,163,184,.5)", fontStyle: "italic" }}
                    >
                      {m.size} {m.type}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 10 }}>
                      <span style={{ color: "rgba(148,163,184,.5)" }}>
                        AC{" "}
                        <strong style={{ color: "rgba(243,244,246,.8)" }}>{m.armor_class}</strong>
                      </span>
                      <span style={{ color: "rgba(148,163,184,.5)" }}>
                        HP <strong style={{ color: "#EF5350" }}>{m.hit_points}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {total > 20 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
              <button style={S.btn} disabled={page <= 1} onClick={() => load(page - 1)}>
                ← Prev
              </button>
              <span style={{ fontSize: 11, color: "rgba(148,163,184,.5)", alignSelf: "center" }}>
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                style={S.btn}
                disabled={page >= Math.ceil(total / 20)}
                onClick={() => load(page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const CLASS_DATA: { name: string; hitDie: string; primary: string; saves: string; desc: string }[] =
  [
    {
      name: "Barbarian",
      hitDie: "d12",
      primary: "Strength",
      saves: "STR, CON",
      desc: "A fierce warrior who channels primal rage to devastate enemies on the battlefield.",
    },
    {
      name: "Bard",
      hitDie: "d8",
      primary: "Charisma",
      saves: "DEX, CHA",
      desc: "A master of song, speech, and magic who inspires allies and manipulates foes.",
    },
    {
      name: "Cleric",
      hitDie: "d8",
      primary: "Wisdom",
      saves: "WIS, CHA",
      desc: "A divine champion who wields the power of their deity to heal, protect, and smite.",
    },
    {
      name: "Druid",
      hitDie: "d8",
      primary: "Wisdom",
      saves: "INT, WIS",
      desc: "A priest of the Old Faith who draws power from nature and can assume animal forms.",
    },
    {
      name: "Fighter",
      hitDie: "d10",
      primary: "STR or DEX",
      saves: "STR, CON",
      desc: "A master of martial combat, skilled with weapons and armor of every kind.",
    },
    {
      name: "Monk",
      hitDie: "d8",
      primary: "DEX & WIS",
      saves: "STR, DEX",
      desc: "A martial artist who harnesses the body's inner ki to perform extraordinary feats.",
    },
    {
      name: "Paladin",
      hitDie: "d10",
      primary: "STR & CHA",
      saves: "WIS, CHA",
      desc: "A holy warrior bound by a sacred oath to fight evil and protect the innocent.",
    },
    {
      name: "Ranger",
      hitDie: "d10",
      primary: "DEX & WIS",
      saves: "STR, DEX",
      desc: "A warrior of the wilderness who hunts monsters that threaten civilization.",
    },
    {
      name: "Rogue",
      hitDie: "d8",
      primary: "Dexterity",
      saves: "DEX, INT",
      desc: "A scoundrel who uses stealth and trickery to overcome obstacles and enemies.",
    },
    {
      name: "Sorcerer",
      hitDie: "d6",
      primary: "Charisma",
      saves: "CON, CHA",
      desc: "A spellcaster who draws on inherent magic from a gift or bloodline.",
    },
    {
      name: "Warlock",
      hitDie: "d8",
      primary: "Charisma",
      saves: "WIS, CHA",
      desc: "A wielder of magic granted by an otherworldly patron through a dark pact.",
    },
    {
      name: "Wizard",
      hitDie: "d6",
      primary: "Intelligence",
      saves: "INT, WIS",
      desc: "A scholarly magic-user who commands arcane power through study and mastery.",
    },
  ];

function ClassBrowser() {
  const [selected, setSelected] = useState<any | null>(null);
  const [classDetail, setClassDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function loadClass(slug: string) {
    setLoading(true);
    try {
      const j = await o5eFetch(`/classes/${slug}/?format=json`);
      setClassDetail(j);
    } catch {}
    setLoading(false);
  }

  if (selected) {
    const c = selected;
    const cc = CLASS_COLORS[c.name] || ACCENT;
    return (
      <div>
        <button
          onClick={() => {
            setSelected(null);
            setClassDetail(null);
          }}
          style={{ ...S.btn, marginBottom: 12, fontSize: 11 }}
        >
          ← Back to Classes
        </button>
        <div style={{ ...S.card, border: `1px solid ${cc}33`, background: `${cc}06` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>{CLASS_ICONS[c.name] || "⚔"}</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>
                {c.name}
              </div>
              <div style={{ fontSize: 11, color: "rgba(148,163,184,.6)", fontStyle: "italic" }}>
                {c.desc}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                textAlign: "center",
                padding: 10,
                borderRadius: 8,
                background: `${cc}10`,
                border: `1px solid ${cc}22`,
              }}
            >
              <div style={{ ...S.label, color: cc, opacity: 1 }}>Hit Die</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>
                {c.hitDie}
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                padding: 10,
                borderRadius: 8,
                background: `${cc}10`,
                border: `1px solid ${cc}22`,
              }}
            >
              <div style={{ ...S.label, color: cc, opacity: 1 }}>Primary</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.9)" }}>
                {c.primary}
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                padding: 10,
                borderRadius: 8,
                background: `${cc}10`,
                border: `1px solid ${cc}22`,
              }}
            >
              <div style={{ ...S.label, color: cc, opacity: 1 }}>Saves</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.9)" }}>
                {c.saves}
              </div>
            </div>
          </div>

          {loading && (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
              Loading class features...
            </div>
          )}
          {classDetail && (
            <div>
              {classDetail.desc && (
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(243,244,246,.78)",
                    lineHeight: 1.65,
                    marginBottom: 14,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {classDetail.desc}
                </div>
              )}
              {classDetail.hit_dice && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...S.label, color: cc, opacity: 1 }}>Hit Points</div>
                  <div style={{ fontSize: 12, color: "rgba(243,244,246,.75)", lineHeight: 1.5 }}>
                    <strong>Hit Dice:</strong> {classDetail.hit_dice}
                    <br />
                    <strong>HP at 1st Level:</strong> {classDetail.hp_at_1st_level}
                    <br />
                    <strong>HP at Higher Levels:</strong> {classDetail.hp_at_higher_levels}
                  </div>
                </div>
              )}
              {classDetail.prof_armor && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...S.label, color: cc, opacity: 1 }}>Proficiencies</div>
                  <div style={{ fontSize: 12, color: "rgba(243,244,246,.75)", lineHeight: 1.5 }}>
                    <strong>Armor:</strong> {classDetail.prof_armor}
                    <br />
                    <strong>Weapons:</strong> {classDetail.prof_weapons}
                    <br />
                    <strong>Tools:</strong> {classDetail.prof_tools || "None"}
                    <br />
                    <strong>Saving Throws:</strong> {classDetail.prof_saving_throws}
                    <br />
                    <strong>Skills:</strong> {classDetail.prof_skills}
                  </div>
                </div>
              )}
              {classDetail.equipment && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...S.label, color: cc, opacity: 1 }}>Starting Equipment</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(243,244,246,.72)",
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {classDetail.equipment}
                  </div>
                </div>
              )}
              {classDetail.table && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...S.label, color: cc, opacity: 1 }}>Class Table</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(243,244,246,.7)",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      fontFamily: "monospace",
                      overflow: "auto",
                    }}
                  >
                    {classDetail.table}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {CLASS_DATA.map((c) => {
        const cc = CLASS_COLORS[c.name] || ACCENT;
        return (
          <div
            key={c.name}
            onClick={() => {
              setSelected(c);
              loadClass(c.name.toLowerCase());
            }}
            style={{
              ...S.card,
              cursor: "pointer",
              transition: "border-color .12s",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${cc}44`)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}
          >
            <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>
              {CLASS_ICONS[c.name] || "⚔"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: cc, marginBottom: 3 }}>
                {c.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(148,163,184,.55)",
                  lineHeight: 1.4,
                  marginBottom: 6,
                }}
              >
                {c.desc}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span
                  style={{
                    fontSize: 9,
                    padding: "1px 5px",
                    borderRadius: 3,
                    background: `${cc}12`,
                    color: cc,
                    fontWeight: 700,
                  }}
                >
                  {c.hitDie}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    padding: "1px 5px",
                    borderRadius: 3,
                    background: "rgba(255,255,255,.05)",
                    color: "rgba(148,163,184,.55)",
                    fontWeight: 600,
                  }}
                >
                  {c.saves}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const RARITY_OPTIONS = ["All", "common", "uncommon", "rare", "very rare", "legendary", "artifact"];

function MagicItemBrowser() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("All");
  const [selected, setSelected] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const debounce = useRef<any>(null);

  const load = useCallback(
    async (pg = 1) => {
      setLoading(true);
      let q = `/magicitems/?format=json&page=${pg}&limit=20&document__slug=wotc-srd`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (rarity !== "All") q += `&rarity=${encodeURIComponent(rarity)}`;
      try {
        const j = await o5eFetch(q);
        setItems(j.results || []);
        setTotal(j.count || 0);
        setPage(pg);
      } catch {}
      setLoading(false);
    },
    [search, rarity],
  );

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(1), search ? 350 : 0);
    return () => clearTimeout(debounce.current);
  }, [load]);

  if (selected) {
    const it = selected;
    const rc = RARITY_COLORS[it.rarity?.toLowerCase()] || "rgba(255,255,255,.6)";
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          style={{ ...S.btn, marginBottom: 12, fontSize: 11 }}
        >
          ← Back to Items
        </button>
        <div style={{ ...S.card, border: `1px solid ${rc}33` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "rgba(243,244,246,.95)" }}>
              {it.name}
            </span>
            <span
              style={{
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 4,
                background: `${rc}18`,
                color: rc,
                fontWeight: 700,
                textTransform: "capitalize",
              }}
            >
              {it.rarity}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(148,163,184,.6)",
              fontStyle: "italic",
              marginBottom: 12,
            }}
          >
            {it.type}, {it.requires_attunement || "no attunement"}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(243,244,246,.82)",
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
            }}
          >
            {it.desc}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          style={{ ...S.input, flex: "1 1 200px" }}
          placeholder="Search magic items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={S.select} value={rarity} onChange={(e) => setRarity(e.target.value)}>
          {RARITY_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r === "All" ? "All Rarities" : r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <span
        style={{ fontSize: 10, color: "rgba(148,163,184,.4)", marginBottom: 8, display: "block" }}
      >
        {total} items
      </span>

      {loading ? (
        <div style={{ padding: 30, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
          Rummaging through the hoard...
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No magic items match." hint="Try a different search or rarity." />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {items.map((it) => {
              const rc = RARITY_COLORS[it.rarity?.toLowerCase()] || "rgba(255,255,255,.6)";
              return (
                <div
                  key={it.slug}
                  onClick={() => setSelected(it)}
                  style={{ ...S.card, cursor: "pointer", transition: "border-color .12s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${rc}44`)}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")
                  }
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "rgba(243,244,246,.92)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {it.name}
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        padding: "1px 5px",
                        borderRadius: 3,
                        background: `${rc}18`,
                        color: rc,
                        fontWeight: 700,
                        flexShrink: 0,
                        textTransform: "capitalize",
                      }}
                    >
                      {it.rarity}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(148,163,184,.45)" }}>{it.type}</div>
                </div>
              );
            })}
          </div>
          {total > 20 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
              <button style={S.btn} disabled={page <= 1} onClick={() => load(page - 1)}>
                ← Prev
              </button>
              <span style={{ fontSize: 11, color: "rgba(148,163,184,.5)", alignSelf: "center" }}>
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                style={S.btn}
                disabled={page >= Math.ceil(total / 20)}
                onClick={() => load(page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const CONDITIONS_DATA = [
  {
    name: "Blinded",
    desc: "Can't see. Auto-fail sight checks. Attacks have disadvantage. Attacks against have advantage.",
    icon: "🙈",
  },
  {
    name: "Charmed",
    desc: "Can't attack charmer or target them with harmful abilities. Charmer has advantage on social checks.",
    icon: "💘",
  },
  { name: "Deafened", desc: "Can't hear. Auto-fail hearing checks.", icon: "🔇" },
  {
    name: "Exhaustion",
    desc: "Cumulative levels (1-6). Disadvantage on checks, speed halved, HP max halved, speed 0, then death.",
    icon: "😩",
  },
  {
    name: "Frightened",
    desc: "Disadvantage on ability checks and attack rolls while source of fear is in line of sight. Can't willingly move closer.",
    icon: "😨",
  },
  {
    name: "Grappled",
    desc: "Speed becomes 0. Ends if grappler is incapacitated or effect moves creature out of reach.",
    icon: "🤼",
  },
  { name: "Incapacitated", desc: "Can't take actions or reactions.", icon: "💫" },
  {
    name: "Invisible",
    desc: "Impossible to see without special sense. Attacks have advantage. Attacks against have disadvantage.",
    icon: "👻",
  },
  {
    name: "Paralyzed",
    desc: "Incapacitated, can't move or speak. Auto-fail STR and DEX saves. Attacks have advantage. Melee hits are crits.",
    icon: "⚡",
  },
  {
    name: "Petrified",
    desc: "Transformed to stone. Weight x10. Incapacitated, can't move or speak. Resistance to all damage. Immune to poison/disease.",
    icon: "🪨",
  },
  { name: "Poisoned", desc: "Disadvantage on attack rolls and ability checks.", icon: "☠️" },
  {
    name: "Prone",
    desc: "Can only crawl. Disadvantage on attacks. Melee attacks against have advantage. Ranged attacks against have disadvantage.",
    icon: "🔽",
  },
  {
    name: "Restrained",
    desc: "Speed 0. Attacks have disadvantage. Attacks against have advantage. Disadvantage on DEX saves.",
    icon: "⛓",
  },
  {
    name: "Stunned",
    desc: "Incapacitated, can't move, can only speak falteringly. Auto-fail STR and DEX saves. Attacks against have advantage.",
    icon: "💥",
  },
  {
    name: "Unconscious",
    desc: "Incapacitated, can't move or speak. Drops what it's holding, falls prone. Auto-fail STR/DEX. Attacks have advantage. Melee crits.",
    icon: "💤",
  },
];

function ConditionsReference() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {CONDITIONS_DATA.map((c) => (
        <div key={c.name} style={{ ...S.card, display: "flex", gap: 8 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{c.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 3 }}>
              {c.name}
            </div>
            <div style={{ fontSize: 11, color: "rgba(243,244,246,.65)", lineHeight: 1.45 }}>
              {c.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const QUICK_DICE = [
  { label: "d4", expr: "d4" },
  { label: "d6", expr: "d6" },
  { label: "d8", expr: "d8" },
  { label: "d10", expr: "d10" },
  { label: "d12", expr: "d12" },
  { label: "d20", expr: "d20" },
  { label: "d100", expr: "d100" },
  { label: "2d6", expr: "2d6" },
  { label: "4d6", expr: "4d6" },
];

function DiceTower({ lobbyId }: { lobbyId: string }) {
  const [history, setHistory] = useState<DiceResult[]>([]);
  const [customExpr, setCustomExpr] = useState("");
  const [lastRoll, setLastRoll] = useState<DiceResult | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [isPublic, setIsPublic] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const saved = localStorage.getItem(`weered:dnd:dice-public:${lobbyId}`);
      return saved === null ? true : saved === "1";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`weered:dnd:dice-public:${lobbyId}`, isPublic ? "1" : "0");
    } catch {}
  }, [isPublic, lobbyId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doRoll(expr: string) {
    setError(null);
    if (isPublic) {
      if (busy) return;
      setBusy(true);
      try {
        const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/dice/roll`, {
          method: "POST",
          body: JSON.stringify({ expression: expr }),
        });
        if (!j.ok) {
          setError(j.message || "Couldn't roll. Check the expression.");
          return;
        }
        const roll: DiceResult = {
          rolls: j.rolls || [],
          kept: j.kept || [],
          dropped: j.dropped || [],
          modifier: Number(j.modifier || 0),
          total: Number(j.total || 0),
          sides: Number(j.sides || 0),
          advantage: !!j.advantage,
          disadvantage: !!j.disadvantage,
          isNat20: !!j.isNat20,
          isNat1: !!j.isNat1,
          id: `srv:${j.time}:${Math.random().toString(36).slice(2, 6)}`,
          expr: expr.toLowerCase(),
          roller: "You",
          ts: Number(j.time || Date.now()),
        };
        setLastRoll(roll);
        setHistory((prev) => [roll, ...prev].slice(0, 50));
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 600);
      } finally {
        setBusy(false);
      }
      return;
    }

    const parsed = parseDice(expr);
    if (!parsed) {
      setError("Bad expression. Try 1d20, 2d8+5, d20adv.");
      return;
    }
    const result = rollDice(parsed);
    const roll: DiceResult = {
      ...result,
      id: Math.random().toString(36).slice(2),
      expr: expr.toLowerCase(),
      roller: "You",
      ts: Date.now(),
    };
    setLastRoll(roll);
    setHistory((prev) => [roll, ...prev].slice(0, 50));
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 600);
  }

  const advRoll = (adv: boolean) => {
    doRoll(adv ? "d20adv" : "d20dis");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,.06)",
          background: "rgba(0,0,0,.20)",
        }}
      >
        <button
          type="button"
          onClick={() => setIsPublic(true)}
          style={{
            padding: "5px 12px",
            borderRadius: 7,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            border: `1px solid ${isPublic ? "#22C55E66" : "rgba(255,255,255,.10)"}`,
            background: isPublic ? "rgba(34,197,94,.10)" : "rgba(255,255,255,.02)",
            color: isPublic ? "#22C55E" : "rgba(148,163,184,.65)",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontFamily: "inherit",
          }}
          title="Rolls broadcast to lobby chat as a witnessed chip"
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isPublic ? "#22C55E" : "rgba(148,163,184,.4)",
              boxShadow: isPublic ? "0 0 6px #22C55E" : "none",
            }}
          />
          Witnessed (lobby chat)
        </button>
        <button
          type="button"
          onClick={() => setIsPublic(false)}
          style={{
            padding: "5px 12px",
            borderRadius: 7,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            border: `1px solid ${!isPublic ? `${ACCENT}55` : "rgba(255,255,255,.10)"}`,
            background: !isPublic ? `${ACCENT}10` : "rgba(255,255,255,.02)",
            color: !isPublic ? ACCENT : "rgba(148,163,184,.65)",
            fontFamily: "inherit",
          }}
          title="Rolls stay local — useful for DM stat blocks behind the screen"
        >
          Private (just you)
        </button>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "rgba(148,163,184,.45)",
            letterSpacing: ".3px",
          }}
        >
          {isPublic ? "the room sees every roll" : "behind the DM screen"}
        </span>
      </div>

      {error && (
        <div
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(239,68,68,.25)",
            background: "rgba(239,68,68,.06)",
            color: "#EF5350",
            fontSize: 11,
          }}
        >
          {error}
        </div>
      )}

      <div
        className="dnd-brazier"
        style={{
          boxShadow: showFlash
            ? lastRoll?.isNat20
              ? "0 0 56px rgba(122,209,88,0.50), inset 0 2px 0 rgba(196,165,90,0.10), inset 0 -1px 0 rgba(0,0,0,0.6)"
              : lastRoll?.isNat1
                ? "0 0 50px rgba(239,68,68,0.50), inset 0 2px 0 rgba(196,165,90,0.10), inset 0 -1px 0 rgba(0,0,0,0.6)"
                : "0 0 48px rgba(232,160,74,0.40), inset 0 2px 0 rgba(196,165,90,0.10), inset 0 -1px 0 rgba(0,0,0,0.6)"
            : undefined,
        }}
      >
        {lastRoll ? (
          <>
            <div
              className={`dnd-brazier-result${lastRoll.isNat20 ? " is-nat20" : lastRoll.isNat1 ? " is-nat1" : ""}`}
            >
              {lastRoll.total}
            </div>
            {lastRoll.isNat20 && <div className="dnd-brazier-tag is-nat20">NATURAL 20</div>}
            {lastRoll.isNat1 && <div className="dnd-brazier-tag is-nat1">CRITICAL FAIL</div>}
            <div className="dnd-brazier-expr">
              {lastRoll.expr}
              {(lastRoll.advantage || lastRoll.disadvantage) && (
                <span
                  style={{ color: lastRoll.advantage ? "#C8E886" : "#FF8A7A", fontWeight: 600 }}
                >
                  {" "}
                  ({lastRoll.advantage ? "ADV" : "DIS"})
                </span>
              )}
            </div>
            <div className="dnd-brazier-rolls">
              [{lastRoll.rolls.join(", ")}]
              {lastRoll.dropped && lastRoll.dropped.length > 0 && (
                <span style={{ textDecoration: "line-through", opacity: 0.4 }}>
                  {" "}
                  dropped: {lastRoll.dropped.join(", ")}
                </span>
              )}
              {lastRoll.modifier !== 0 && (
                <span>
                  {" "}
                  {lastRoll.modifier > 0 ? "+" : ""}
                  {lastRoll.modifier}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="dnd-brazier-d20">
              <D20Icon />
            </div>
            <div className="dnd-brazier-prompt">Pick a die. Cast it into the tower.</div>
          </>
        )}
      </div>

      <div>
        <div className="dnd-section-label">Quick Roll</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {QUICK_DICE.map((d) => (
            <button
              key={d.label}
              onClick={() => doRoll(d.expr)}
              className="dnd-stone-tile"
              disabled={busy}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => advRoll(true)}
          className="dnd-stone-tile dnd-stone-tile--adv"
          disabled={busy}
          style={{ flex: 1 }}
        >
          d20 Advantage
        </button>
        <button
          onClick={() => advRoll(false)}
          className="dnd-stone-tile dnd-stone-tile--dis"
          disabled={busy}
          style={{ flex: 1 }}
        >
          d20 Disadvantage
        </button>
      </div>

      <div>
        <div className="dnd-section-label">Custom Roll</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="dnd-parchment-input"
            placeholder="2d8+5, d20adv, 4d6, d100..."
            value={customExpr}
            onChange={(e) => setCustomExpr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customExpr) {
                doRoll(customExpr);
                setCustomExpr("");
              }
            }}
          />
          <button
            className="dnd-stone-tile"
            style={{ flex: "0 0 auto", minWidth: 80 }}
            onClick={() => {
              if (customExpr) {
                doRoll(customExpr);
                setCustomExpr("");
              }
            }}
            disabled={busy}
          >
            Cast
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <div
            className="dnd-section-label"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>Roll History</span>
            <button
              style={{
                background: "transparent",
                border: "1px solid rgba(196,165,90,0.25)",
                color: "rgba(201,168,120,0.6)",
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 4,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: ".5px",
              }}
              onClick={() => setHistory([])}
            >
              Clear
            </button>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              maxHeight: 220,
              overflow: "auto",
            }}
          >
            {history.map((r) => (
              <div
                key={r.id}
                className={`dnd-history-row${r.isNat20 ? " is-nat20" : r.isNat1 ? " is-nat1" : ""}`}
              >
                <span className="dnd-history-total">{r.total}</span>
                <div style={{ flex: 1 }}>
                  <span className="dnd-history-expr">{r.expr}</span>
                  {(r.advantage || r.disadvantage) && (
                    <span
                      style={{
                        fontSize: 10,
                        marginLeft: 6,
                        color: r.advantage ? "#C8E886" : "#FF8A7A",
                        fontWeight: 700,
                        letterSpacing: ".5px",
                      }}
                    >
                      {r.advantage ? "ADV" : "DIS"}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 10,
                      color: "rgba(201,168,120,0.45)",
                      marginLeft: 8,
                      fontFamily: "monospace",
                    }}
                  >
                    [{r.rolls.join(",")}]
                    {r.modifier ? (r.modifier > 0 ? `+${r.modifier}` : r.modifier) : ""}
                  </span>
                </div>
                <span
                  style={{ fontSize: 9, color: "rgba(201,168,120,0.35)", fontFamily: "monospace" }}
                >
                  {new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function D20Icon() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="dndDieFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7F4422" />
          <stop offset="55%" stopColor="#5D2F18" />
          <stop offset="100%" stopColor="#3A1C0E" />
        </linearGradient>
        <linearGradient id="dndDieFace" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.10)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.40)" />
        </linearGradient>
        <linearGradient id="dndDieEdge" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5D58A" />
          <stop offset="100%" stopColor="#C4A55A" />
        </linearGradient>
      </defs>
      <polygon
        points="50,5 90,28 90,72 50,95 10,72 10,28"
        fill="url(#dndDieFill)"
        stroke="url(#dndDieEdge)"
        strokeWidth="1.5"
      />
      <polygon
        points="50,18 78,67 22,67"
        fill="url(#dndDieFace)"
        stroke="rgba(245,213,138,0.40)"
        strokeWidth="1"
      />
      <text
        x="50"
        y="56"
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        fill="#F5D58A"
        fontFamily="var(--font-pirata), 'Pirata One', serif"
        style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.6))" }}
      >
        20
      </text>
    </svg>
  );
}

const DND_SYSTEMS = [
  "D&D 5e",
  "D&D 5.5e (2024)",
  "Pathfinder 2e",
  "Call of Cthulhu",
  "OSR",
  "Other",
];
const DND_SESSION_TYPES = ["One-Shot", "Campaign", "West Marches", "Drop-in", "Tutorial"];
const DND_EXPERIENCE = ["Any", "New to TTRPGs", "Familiar", "Experienced", "Veteran"];
const DND_VTTS = [
  "Any",
  "Roll20",
  "Foundry VTT",
  "TaleSpire",
  "Owlbear Rodeo",
  "Theater of the Mind",
  "In-Person",
];
const DND_ROLES = ["Looking for Players", "Looking for DM"];
const DND_TAGS = [
  "RP-heavy",
  "combat-focused",
  "homebrew-friendly",
  "RAW",
  "beginner-friendly",
  "voice-required",
  "18+",
  "LGBTQ+ friendly",
  "PBP",
  "long-running",
];

function TavernBoard({ lobbyId }: { lobbyId: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activity, setActivity] = useState("");
  const [description, setDescription] = useState("");
  const [sessionType, setSessionType] = useState("One-Shot");
  const [system, setSystem] = useState("D&D 5e");
  const [role, setRole] = useState("Looking for Players");
  const [experience, setExperience] = useState("Any");
  const [vtt, setVtt] = useState("Any");
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  function load() {
    apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`)
      .then((j) => {
        if (j.ok) setPosts(j.posts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }
  useEffect(() => {
    load();
  }, [lobbyId]);

  async function create() {
    setCreating(true);
    await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({
        activity: activity || `${system} ${sessionType}`,
        description,
        maxPlayers,
        platform: "crossplay",
        gameMode: sessionType,
        rankTier: experience !== "Any" ? experience : null,
        region: vtt !== "Any" ? vtt : null,
        tags: [role, system, ...selectedTags],
        metadata: { system, sessionType, role, experience, vtt },
      }),
    });
    setCreating(false);
    setShowForm(false);
    setActivity("");
    setDescription("");
    load();
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 5),
    );
  }

  if (loading)
    return (
      <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
        Checking the notice board...
      </div>
    );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={S.label}>
          TAVERN BOARD ({posts.filter((p) => p.status === "OPEN").length} quests posted)
        </div>
        <button style={S.btnPri} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Post Quest"}
        </button>
      </div>

      {showForm && (
        <div
          style={{
            ...S.card,
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            border: `1px solid ${ACCENT}33`,
            background: `${ACCENT}06`,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Role</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {DND_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>System</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={system}
                onChange={(e) => setSystem(e.target.value)}
              >
                {DND_SYSTEMS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Session Type</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
              >
                {DND_SESSION_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Experience</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
              >
                {DND_EXPERIENCE.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>VTT / Platform</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={vtt}
                onChange={(e) => setVtt(e.target.value)}
              >
                {DND_VTTS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 80 }}>
              <div style={S.label}>Party Size</div>
              <select
                style={{ ...S.select, width: "100%" }}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
              >
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div style={S.label}>Tags</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {DND_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{
                    ...S.btn,
                    fontSize: 10,
                    padding: "3px 8px",
                    borderColor: selectedTags.includes(tag) ? `${ACCENT}55` : undefined,
                    background: selectedTags.includes(tag) ? `${ACCENT}18` : undefined,
                    color: selectedTags.includes(tag) ? ACCENT : undefined,
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <input
            style={S.input}
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="Quest title (e.g. 'Lost Mine of Phandelver — Session 0')"
            maxLength={200}
          />
          <textarea
            style={{ ...S.input, minHeight: 60, resize: "vertical" } as React.CSSProperties}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your quest, setting, expectations, schedule..."
            maxLength={1000}
          />

          <button
            style={{ ...S.btnPri, padding: "8px 20px", alignSelf: "flex-start" }}
            onClick={create}
            disabled={creating}
          >
            {creating ? "Posting..." : "Post to Tavern Board"}
          </button>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="dnd-corkboard" style={{ textAlign: "center", padding: 30 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🍺</div>
          <div
            className="dnd-serif"
            style={{ fontSize: 14, color: "rgba(201,168,120,.7)", fontStyle: "italic" }}
          >
            The board hangs empty. Pin the first quest.
          </div>
        </div>
      ) : (
        <div className="dnd-corkboard" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {posts.map((p) => {
            const meta = p.metadata || {};
            const isLFDM = (p.tags || []).includes("Looking for DM");
            return (
              <div
                key={p.id}
                className="dnd-scroll"
                style={{ display: "flex", flexDirection: "column", gap: 7 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div
                      className="dnd-heading"
                      style={{ fontSize: 17, color: "var(--dnd-parchment-ink)", lineHeight: 1.15 }}
                    >
                      {p.activity || "Seeking Adventurers"}
                    </div>
                    <div
                      className="dnd-serif"
                      style={{
                        fontSize: 12,
                        color: "rgba(58,28,14,.7)",
                        marginTop: 2,
                        fontStyle: "italic",
                      }}
                    >
                      posted by <strong>{p.userName}</strong> · {p.players?.length || 1}/
                      {p.maxPlayers} adventurers
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: 3,
                      letterSpacing: ".5px",
                      border: `1px solid ${p.status === "OPEN" ? "rgba(58,103,46,.55)" : "rgba(155,40,30,.55)"}`,
                      background:
                        p.status === "OPEN" ? "rgba(122,133,59,.22)" : "rgba(231,98,62,.20)",
                      color: p.status === "OPEN" ? "#3A6B22" : "#9B281E",
                    }}
                  >
                    {p.status}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {(p.tags || []).map((t: string) => {
                    const isSystem = DND_SYSTEMS.includes(t);
                    const isRole = DND_ROLES.includes(t);
                    const tagBg = isRole
                      ? isLFDM
                        ? "rgba(155,40,30,.18)"
                        : "rgba(127,68,34,.20)"
                      : isSystem
                        ? "rgba(74,46,116,.20)"
                        : "rgba(58,28,14,.10)";
                    const tagFg = isRole
                      ? isLFDM
                        ? "#9B281E"
                        : "#5D2F18"
                      : isSystem
                        ? "#4A2E74"
                        : "rgba(58,28,14,.65)";
                    const tagBd = isRole
                      ? isLFDM
                        ? "rgba(155,40,30,.4)"
                        : "rgba(127,68,34,.4)"
                      : isSystem
                        ? "rgba(74,46,116,.4)"
                        : "rgba(58,28,14,.25)";
                    return (
                      <span
                        key={t}
                        style={{
                          fontSize: 9,
                          padding: "2px 6px",
                          borderRadius: 3,
                          fontWeight: 700,
                          letterSpacing: ".3px",
                          border: `1px solid ${tagBd}`,
                          background: tagBg,
                          color: tagFg,
                        }}
                      >
                        {t}
                      </span>
                    );
                  })}
                  {p.gameMode && !DND_ROLES.includes(p.gameMode) && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 3,
                        border: "1px solid rgba(184,140,30,.5)",
                        background: "rgba(184,140,30,.18)",
                        color: "#7A5A12",
                        fontWeight: 700,
                      }}
                    >
                      {p.gameMode}
                    </span>
                  )}
                  {p.rankTier && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 3,
                        border: "1px solid rgba(58,28,14,.25)",
                        background: "rgba(58,28,14,.08)",
                        color: "rgba(58,28,14,.6)",
                        fontWeight: 600,
                      }}
                    >
                      {p.rankTier}
                    </span>
                  )}
                  {p.region && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 3,
                        border: "1px solid rgba(58,28,14,.25)",
                        background: "rgba(58,28,14,.08)",
                        color: "rgba(58,28,14,.6)",
                        fontWeight: 600,
                      }}
                    >
                      {p.region}
                    </span>
                  )}
                </div>
                {p.description && (
                  <div
                    className="dnd-serif"
                    style={{
                      fontSize: 13,
                      color: "rgba(58,28,14,.78)",
                      lineHeight: 1.5,
                      fontStyle: "italic",
                    }}
                  >
                    {p.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TwitchStreams({ lobbyId }: { lobbyId: string }) {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(null);

  useEffect(() => {
    const ch = consumePendingStream();
    if (ch) setActiveStream(ch);
  }, []);

  const load = useCallback(async () => {
    try {
      const j = await apiFetch(
        `/twitch/streams?game=${encodeURIComponent("Dungeons & Dragons")}&first=20`,
      );
      if (j.ok) setStreams(j.streams || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, [load]);

  const parentHost = typeof window !== "undefined" ? window.location.hostname : "weered.ca";

  if (loading)
    return (
      <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
        Scrying for live streams...
      </div>
    );
  if (streams.length === 0 && !activeStream)
    return (
      <div style={{ textAlign: "center", padding: 30 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📺</div>
        <div style={{ fontSize: 13, color: "var(--weered-muted, rgba(148,163,184,.55))" }}>
          Nobody streaming D&D right now.
        </div>
      </div>
    );

  return (
    <>
      {activeStream && (
        <div
          style={{
            ...S.card,
            padding: 0,
            marginBottom: 12,
            overflow: "hidden",
            border: `1px solid ${ACCENT}55`,
            flexShrink: 0,
          }}
        >
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${parentHost}&muted=true`}
            width="100%"
            height="380"
            style={{ border: "none", display: "block" }}
            allowFullScreen
            title={`${activeStream} live stream`}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: `${ACCENT}10`,
              borderTop: `1px solid ${ACCENT}35`,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#ef4444",
                  boxShadow: "0 0 8px #ef4444",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{activeStream}</span>
              <span
                style={{
                  fontSize: 10,
                  opacity: 0.5,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                }}
              >
                Live · Watching in the lobby
              </span>
            </span>
            <button
              type="button"
              onClick={() => setActiveStream(null)}
              style={{ ...S.btn, fontSize: 11 }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {streams.map((s) => (
          <div
            key={s.userLogin}
            onClick={() => setInterceptStream(s)}
            style={{
              ...S.card,
              cursor: "pointer",
              display: "flex",
              gap: 10,
              alignItems: "center",
              transition: "border-color .12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${ACCENT}44`)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}
          >
            {s.thumbnailUrl && (
              <img
                src={s.thumbnailUrl.replace("{width}", "80").replace("{height}", "45")}
                alt={s.userName + " stream thumbnail"}
                style={{
                  width: 80,
                  height: 45,
                  borderRadius: 6,
                  objectFit: "cover",
                  flexShrink: 0,
                  border: "1px solid rgba(255,255,255,.06)",
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.title}
              </div>
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                {s.userName} · {s.viewerCount?.toLocaleString()} viewers
              </div>
            </div>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#EF4444",
                boxShadow: "0 0 6px #EF444488",
                flexShrink: 0,
              }}
            />
          </div>
        ))}
      </div>
      <StreamInterceptModal
        stream={interceptStream}
        lobbyId={lobbyId}
        onClose={() => setInterceptStream(null)}
        onWatchHere={(s) => {
          setActiveStream(s.userLogin);
          setInterceptStream(null);
        }}
      />
    </>
  );
}

export default function DndModulesPanel({
  lobbyId,
  accentColor,
  gameName,
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  gameName?: string;
  style?: React.CSSProperties;
}) {
  const accent = accentColor || ACCENT;
  const [tab, setTab] = useState<TabId>("compendium");
  useWatchHere(
    useCallback(() => {
      setTab("streams");
    }, []),
  );
  const [compTab, setCompTab] = useState<CompTabId>("spells");

  const sessionZero = useSessionZero();

  return (
    <div
      className="weered-dnd-modules"
      style={{ padding: "14px 16px", overflow: "auto", position: "relative", ...style }}
    >
      <SessionZero open={sessionZero.open} onClose={sessionZero.hide} />

      <div className="dnd-lectern">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`dnd-lectern-tool${tab === t.id ? " is-active" : ""}`}
          >
            <span className="dnd-lectern-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={sessionZero.show}
          title="Reopen Session Zero — the D&D lobby walkthrough"
          className="dnd-lectern-quill"
        >
          <span style={{ fontStyle: "normal" }}>🪶</span>
          Session Zero
        </button>
      </div>

      {tab === "compendium" && (
        <>
          <div className="dnd-codex">
            <div className="dnd-codex-ribbons">
              {COMP_TABS.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setCompTab(ct.id)}
                  className={`dnd-codex-ribbon${compTab === ct.id ? " is-active" : ""}`}
                  style={{ ["--ribbon-rgb" as any]: RIBBON_RGB[ct.id] }}
                >
                  <span style={{ marginRight: 2 }}>{ct.icon}</span>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
          {compTab === "spells" && <SpellBrowser />}
          {compTab === "monsters" && <MonsterBrowser />}
          {compTab === "classes" && <ClassBrowser />}
          {compTab === "magicitems" && <MagicItemBrowser />}
          {compTab === "conditions" && <ConditionsReference />}
        </>
      )}

      {tab === "lfg" && <TavernBoard lobbyId={lobbyId} />}
      {tab === "dice" && <DiceTower lobbyId={lobbyId} />}
      {tab === "streams" && <TwitchStreams lobbyId={lobbyId} />}
    </div>
  );
}
