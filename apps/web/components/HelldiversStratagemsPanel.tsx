"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

// HelldiversStratagemsPanel — searchable, filterable stratagem reference
// for the Helldivers 2 lobby. Pulls from /helldivers/stratagems on the
// API. Aesthetic: Super Earth military — gold accent, dark background,
// arrow codes BIG and bold (these are iconic to HD2).
//
// Bonus: trainer mode at the bottom — random stratagem, type the code via
// arrow keys or WASD, hit/miss + speed score.

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#FFD700";

const CATEGORY_COLORS: Record<string, string> = {
  Eagle:     "#FFD700", // gold — air strikes
  Orbital:   "#4FC3F7", // sky blue — orbital beams
  Defensive: "#81C784", // green — sentries
  Supply:    "#FFB74D", // amber — weapons
  Backpack:  "#BA68C8", // purple — gear
  Mech:      "#EF5350", // red — heavy
  Mission:   "#90A4AE", // grey — utility
};

const USAGE_TYPES = ["All", "Offensive", "Defensive", "Supply", "Vehicle", "Mission"];
const UNLOCK_TIERS = [
  { label: "All Levels",  max: 50 },
  { label: "≤ Level 5",   max: 5 },
  { label: "≤ Level 10",  max: 10 },
  { label: "≤ Level 15",  max: 15 },
  { label: "≤ Level 20",  max: 20 },
  { label: "≤ Level 25",  max: 25 },
];

type Stratagem = {
  slug: string;
  name: string;
  code: string;
  category: string;
  usageType: string;
  cooldown: number;
  uses: number;
  unlockLevel: number;
  description: string;
};

const S = {
  card: { borderRadius: 8, border: `1px solid ${ACCENT}22`, background: "rgba(255,215,0,.04)", padding: "10px 14px" } as React.CSSProperties,
  btn: { padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)", fontSize: 11, cursor: "pointer", color: "rgba(243,244,246,.85)", fontFamily: "inherit", letterSpacing: ".4px" } as React.CSSProperties,
  btnActive: { padding: "5px 10px", borderRadius: 6, border: `1px solid ${ACCENT}`, background: `${ACCENT}18`, fontSize: 11, cursor: "pointer", color: ACCENT, fontFamily: "inherit", fontWeight: 700, letterSpacing: ".4px" } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${ACCENT}30`, background: "rgba(0,0,0,.50)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" } as React.CSSProperties,
  label: { fontSize: 10, fontWeight: 700, opacity: 0.55, letterSpacing: "1.2px", textTransform: "uppercase" as const, marginBottom: 6, color: ACCENT } as React.CSSProperties,
};

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...authHeaders() } });
  return r.json();
}

// Format the arrow code with consistent spacing for big-bold display.
function formatCode(code: string): string {
  return code.split("").join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Mode
// ─────────────────────────────────────────────────────────────────────────────

const ARROW_KEYS: Record<string, string> = {
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
  w: "↑", s: "↓", a: "←", d: "→",
  W: "↑", S: "↓", A: "←", D: "→",
};

function TrainerMode({ pool }: { pool: Stratagem[] }) {
  const [target, setTarget] = useState<Stratagem | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastTime, setLastTime] = useState<number | null>(null);
  const [lastHit, setLastHit] = useState<"hit" | "miss" | null>(null);
  const [score, setScore] = useState({ hits: 0, misses: 0, best: Infinity });

  const pickNext = useCallback(() => {
    if (!pool.length) return;
    const next = pool[Math.floor(Math.random() * pool.length)];
    setTarget(next);
    setProgress("");
    setStartedAt(null);
    setLastHit(null);
  }, [pool]);

  useEffect(() => { if (!target) pickNext(); }, [target, pickNext]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!target) return;
      const arrow = ARROW_KEYS[e.key];
      if (!arrow) return;
      e.preventDefault();
      if (!startedAt) setStartedAt(Date.now());
      const next = progress + arrow;
      const expected = target.code.slice(0, next.length);
      if (next === expected) {
        if (next === target.code) {
          // Hit
          const elapsed = (Date.now() - (startedAt ?? Date.now())) / 1000;
          setLastTime(elapsed);
          setLastHit("hit");
          setScore(s => ({ hits: s.hits + 1, misses: s.misses, best: Math.min(s.best, elapsed) }));
          setTimeout(pickNext, 900);
        } else {
          setProgress(next);
        }
      } else {
        // Miss
        setLastHit("miss");
        setScore(s => ({ ...s, misses: s.misses + 1 }));
        setProgress("");
        setStartedAt(null);
        setTimeout(pickNext, 600);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, progress, startedAt, pickNext]);

  if (!target) return <div style={{ opacity: 0.5, padding: 20, textAlign: "center" }}>Loading trainer...</div>;

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      <div style={{ ...S.label, marginBottom: 10, fontSize: 11 }}>Trainer Mode — input via arrow keys or WASD</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: ACCENT, letterSpacing: ".5px" }}>{target.name}</div>
        <div style={{ fontSize: 11, opacity: 0.5 }}>
          Hits {score.hits} · Misses {score.misses}{score.best < Infinity ? ` · Best ${score.best.toFixed(2)}s` : ""}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "20px 0", fontSize: 38, fontWeight: 900, letterSpacing: 4 }}>
        {target.code.split("").map((ch, i) => {
          const done = i < progress.length;
          const isCurrent = i === progress.length && !lastHit;
          return (
            <span
              key={i}
              style={{
                color: done ? "#4ADE80" : isCurrent ? ACCENT : "rgba(255,255,255,.25)",
                textShadow: done ? "0 0 12px rgba(74,222,128,.55)" : isCurrent ? `0 0 12px ${ACCENT}80` : "none",
                transition: "color .15s, text-shadow .15s",
              }}
            >{ch}</span>
          );
        })}
      </div>

      <div style={{ textAlign: "center", fontSize: 13, height: 18 }}>
        {lastHit === "hit" && <span style={{ color: "#4ADE80", fontWeight: 700 }}>STRATAGEM DEPLOYED · {lastTime?.toFixed(2)}s</span>}
        {lastHit === "miss" && <span style={{ color: "#EF4444", fontWeight: 700 }}>INPUT REJECTED — TRY AGAIN</span>}
        {!lastHit && <span style={{ opacity: 0.5 }}>Awaiting input...</span>}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
        <button onClick={pickNext} style={S.btn}>Skip</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Panel
// ─────────────────────────────────────────────────────────────────────────────

export default function HelldiversStratagemsPanel({
  lobbyId, accentColor, style,
}: {
  lobbyId?: string; accentColor?: string; style?: React.CSSProperties;
}) {
  const accent = accentColor || ACCENT;
  const [stratagems, setStratagems] = useState<Stratagem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [usage, setUsage] = useState<string>("All");
  const [tier, setTier] = useState<number>(0); // index into UNLOCK_TIERS
  const [selected, setSelected] = useState<Stratagem | null>(null);
  const [showTrainer, setShowTrainer] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch("/helldivers/stratagems")
      .then(j => {
        if (!alive) return;
        setStratagems(j.stratagems || []);
        setCategories(j.categories || []);
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const maxLvl = UNLOCK_TIERS[tier].max;
    return stratagems.filter(s => {
      if (category !== "All" && s.category !== category) return false;
      if (usage !== "All" && s.usageType !== usage) return false;
      if (s.unlockLevel > maxLvl) return false;
      if (q && !(s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [stratagems, search, category, usage, tier]);

  return (
    <div style={{ padding: "14px 16px", overflow: "auto", color: "rgba(243,244,246,.92)", ...style }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: '"Stencil Std","Black Ops One","Impact",sans-serif', fontSize: 18, fontWeight: 800, letterSpacing: "1.5px", color: accent, textTransform: "uppercase", textShadow: `0 0 12px ${accent}40` }}>
            Stratagems
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2, letterSpacing: ".5px" }}>
            Super Earth Tactical Reference · {stratagems.length} active
          </div>
        </div>
        <button
          onClick={() => setShowTrainer(v => !v)}
          style={showTrainer ? S.btnActive : S.btn}
          title="Practice stratagem inputs with arrow keys or WASD"
        >
          {showTrainer ? "Close Trainer" : "Trainer Mode"}
        </button>
      </div>

      {showTrainer && stratagems.length > 0 && <TrainerMode pool={filtered.length ? filtered : stratagems} />}

      {/* Search */}
      <div style={{ marginTop: showTrainer ? 16 : 0, marginBottom: 12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search stratagems..."
          style={S.input}
        />
      </div>

      {/* Filters */}
      <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={S.label}>Category</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setCategory("All")} style={category === "All" ? S.btnActive : S.btn}>All</button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                style={category === c
                  ? { ...S.btnActive, borderColor: CATEGORY_COLORS[c] || accent, color: CATEGORY_COLORS[c] || accent, background: `${CATEGORY_COLORS[c] || accent}18` }
                  : S.btn}
              >{c}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={S.label}>Usage</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {USAGE_TYPES.map(u => (
              <button key={u} onClick={() => setUsage(u)} style={usage === u ? S.btnActive : S.btn}>{u}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={S.label}>Unlock Level</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {UNLOCK_TIERS.map((t, i) => (
              <button key={t.label} onClick={() => setTier(i)} style={tier === i ? S.btnActive : S.btn}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Result count */}
      <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 8, letterSpacing: ".3px" }}>
        {loading ? "Loading..." : `${filtered.length} stratagem${filtered.length === 1 ? "" : "s"} match`}
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map(s => {
          const catColor = CATEGORY_COLORS[s.category] || accent;
          const isOpen = selected?.slug === s.slug;
          return (
            <div
              key={s.slug}
              style={{
                ...S.card,
                cursor: "pointer",
                borderColor: isOpen ? catColor : `${ACCENT}1f`,
                background: isOpen ? `${catColor}10` : "rgba(255,215,0,.04)",
                transition: "border-color .15s, background .15s",
              }}
              onClick={() => setSelected(isOpen ? null : s)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* Big arrow code — iconic to HD2, render LOUD. */}
                <div style={{
                  flex: "0 0 auto",
                  fontSize: 30,
                  fontWeight: 900,
                  letterSpacing: 4,
                  color: catColor,
                  fontFamily: "ui-monospace, 'JetBrains Mono', 'Cascadia Mono', monospace",
                  textShadow: `0 0 12px ${catColor}55, 0 0 2px ${catColor}80`,
                  minWidth: 170,
                  lineHeight: 1,
                }}>
                  {formatCode(s.code)}
                </div>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, color: "rgba(243,244,246,.96)" }}>
                    {s.name}
                  </div>
                  <div style={{ display: "flex", gap: 8, fontSize: 10, opacity: 0.7, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{
                      padding: "2px 7px",
                      borderRadius: 999,
                      background: `${catColor}20`,
                      color: catColor,
                      fontWeight: 700,
                      letterSpacing: ".5px",
                      textTransform: "uppercase",
                      fontSize: 9,
                    }}>{s.category}</span>
                    <span>{s.usageType}</span>
                    <span>·</span>
                    <span>CD {s.cooldown}s</span>
                    {s.uses > 0 && (<><span>·</span><span>{s.uses} use{s.uses === 1 ? "" : "s"}</span></>)}
                    {s.unlockLevel > 0 && (<><span>·</span><span>Lv {s.unlockLevel}</span></>)}
                  </div>
                </div>
              </div>

              {isOpen && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${catColor}25`, fontSize: 12, lineHeight: 1.5, opacity: 0.85 }}>
                  {s.description}
                  {s.unlockLevel > 0 && (
                    <div style={{ marginTop: 6, fontSize: 10, opacity: 0.65, color: catColor }}>
                      Unlocks at Helldiver Level {s.unlockLevel}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, opacity: 0.4, fontSize: 12 }}>
            No stratagems match. Adjust your filters, Helldiver.
          </div>
        )}
      </div>
    </div>
  );
}
