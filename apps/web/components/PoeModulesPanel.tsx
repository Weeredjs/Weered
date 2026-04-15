"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const POE_NINJA = "https://poe.ninja/api/data";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

// ── Style ────────────────────────────────────────────────────────────────────

const ACCENT_POE = "#AF6025";

const S = {
  card: { borderRadius: 10, border: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.03)", padding: "10px 12px" } as React.CSSProperties,
  btn: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)", fontFamily: "inherit" } as React.CSSProperties,
  btnPri: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(175,96,37,.35)", background: "rgba(175,96,37,.12)", fontSize: 12, cursor: "pointer", color: "rgb(175,96,37)", fontWeight: 600, fontFamily: "inherit" } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" },
  select: { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 12, color: "rgba(243,244,246,.92)", outline: "none", cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

// ── POE Constants ──────────────────────────────────────────────────────────

const DEFAULT_LEAGUE = "Mirage";

const LEAGUES = [
  "Mirage",
  "Hardcore Mirage",
  "Standard",
  "Hardcore",
];

const ITEM_CATEGORIES = [
  { id: "UniqueWeapon",    label: "Weapons" },
  { id: "UniqueArmour",    label: "Armour" },
  { id: "UniqueAccessory", label: "Accessories" },
  { id: "UniqueFlask",     label: "Flasks" },
  { id: "UniqueJewel",     label: "Jewels" },
];

const POE_REGIONS = ["Any", "NA", "EU", "Asia", "Oceania"];
const POE_ACTIVITIES = ["Mapping", "Bossing", "Delve", "Heist", "Lab Runs", "Leveling", "Trading", "Crafting", "Other"];

// ── poe.ninja Cache ────────────────────────────────────────────────────────

const ninjaCache = new Map<string, { data: any; ts: number }>();
const NINJA_TTL = 120000; // 2 min

async function ninjaFetch(url: string) {
  const cached = ninjaCache.get(url);
  if (cached && Date.now() - cached.ts < NINJA_TTL) return cached.data;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`poe.ninja ${r.status}`);
  const j = await r.json();
  ninjaCache.set(url, { data: j, ts: Date.now() });
  return j;
}

// ── Sparkline SVG ──────────────────────────────────────────────────────────

function MiniSparkline({ data, width = 60, height = 20, color }: { data: number[]; width?: number; height?: number; color: string }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 2) - 1}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block", flexShrink: 0 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function trendColor(sparkline: number[] | null | undefined): string {
  if (!sparkline || sparkline.length < 2) return "rgba(148,163,184,.5)";
  const last = sparkline[sparkline.length - 1];
  const first = sparkline[0];
  if (last > first) return "#22c55e";
  if (last < first) return "#ef4444";
  return "rgba(148,163,184,.5)";
}

function trendPercent(sparkline: number[] | null | undefined): string {
  if (!sparkline || sparkline.length < 2) return "";
  const first = sparkline[0];
  const last = sparkline[sparkline.length - 1];
  if (first === 0) return "";
  const pct = ((last - first) / Math.abs(first)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "economy" as const, label: "Economy",    icon: "\u{1FA99}" },
  { id: "items" as const,   label: "Items",       icon: "\u{2694}" },
  { id: "divcards" as const,label: "Div Cards",   icon: "\u{1F0CF}" },
  { id: "gems" as const,    label: "Gems",        icon: "\u{1F48E}" },
  { id: "streams" as const, label: "Live Streams", icon: "\u{1F4FA}" },
  { id: "lfg" as const,     label: "Find Team",   icon: "\u{1F465}" },
];
type TabId = typeof TABS[number]["id"];

// ═══════════════════════════════════════════════════════════════════════════
// ECONOMY TAB
// ═══════════════════════════════════════════════════════════════════════════

function EconomyTab({ league, accent }: { league: string; accent: string }) {
  const [currency, setCurrency] = useState<any[]>([]);
  const [fragments, setFragments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"currency" | "fragment">("currency");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, fRes] = await Promise.all([
        ninjaFetch(`${POE_NINJA}/currencyoverview?league=${encodeURIComponent(league)}&type=Currency`),
        ninjaFetch(`${POE_NINJA}/currencyoverview?league=${encodeURIComponent(league)}&type=Fragment`),
      ]);
      setCurrency((cRes.lines || []).sort((a: any, b: any) => (b.chaosEquivalent || 0) - (a.chaosEquivalent || 0)));
      setFragments((fRes.lines || []).sort((a: any, b: any) => (b.chaosEquivalent || 0) - (a.chaosEquivalent || 0)));
    } catch (e) {
      console.warn("poe.ninja currency error:", e);
    }
    setLoading(false);
  }, [league]);

  useEffect(() => { load(); }, [load]);

  const items = view === "currency" ? currency : fragments;
  const filtered = search
    ? items.filter(i => i.currencyTypeName?.toLowerCase().includes(search.toLowerCase()))
    : items;

  if (loading) return <div style={{ padding: 30, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading Wraeclast economy...</div>;

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button onClick={() => setView("currency")} style={{
          ...S.btn, fontSize: 11, padding: "5px 10px",
          borderColor: view === "currency" ? `${accent}44` : undefined,
          background: view === "currency" ? `${accent}12` : undefined,
          color: view === "currency" ? "rgba(243,244,246,.9)" : "rgba(148,163,184,.5)",
          fontWeight: view === "currency" ? 700 : 500,
        }}>Currency ({currency.length})</button>
        <button onClick={() => setView("fragment")} style={{
          ...S.btn, fontSize: 11, padding: "5px 10px",
          borderColor: view === "fragment" ? `${accent}44` : undefined,
          background: view === "fragment" ? `${accent}12` : undefined,
          color: view === "fragment" ? "rgba(243,244,246,.9)" : "rgba(148,163,184,.5)",
          fontWeight: view === "fragment" ? 700 : 500,
        }}>Fragments ({fragments.length})</button>
      </div>

      {/* Search */}
      <input
        style={{ ...S.input, marginBottom: 10 }}
        placeholder="Search currency..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Currency grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {filtered.map(item => {
          const spark = item.receiveSparkLine?.data || item.paySparkLine?.data || null;
          const clr = trendColor(spark);
          const pct = trendPercent(spark);
          const iconUrl = item.currencyTypeName
            ? `https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lEdXBsaWNhdGUiLCJ3IjoxLCJoIjoxLCJzY2FsZSI6MX1d/7111ac5c4e/CurrencyDuplicate.png`
            : null;
          // poe.ninja provides icon via currencyDetails or we use the detailsId
          const detailIcon = item.detailsId
            ? `https://poe.ninja/image/currency/${item.detailsId}.png`
            : null;
          return (
            <div key={item.detailsId || item.currencyTypeName} style={{
              ...S.card, display: "flex", alignItems: "center", gap: 8,
              transition: "border-color .12s",
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = `${accent}44`)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.06)")}
            >
              {/* Icon */}
              <div style={{
                width: 32, height: 32, borderRadius: 6,
                background: `${accent}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                overflow: "hidden",
              }}>
                {detailIcon ? (
                  <img src={detailIcon} alt={item.currencyTypeName + " icon"} style={{ width: 26, height: 26, objectFit: "contain" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <span style={{ fontSize: 16, opacity: 0.4 }}>{"\u{1FA99}"}</span>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.currencyTypeName}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: accent, fontFamily: "monospace" }}>
                    {(item.chaosEquivalent || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </span>
                  <span style={{ fontSize: 9, color: "rgba(148,163,184,.45)" }}>chaos</span>
                  {pct && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: clr, fontFamily: "monospace" }}>{pct}</span>
                  )}
                </div>
              </div>

              {/* Sparkline */}
              {spark && spark.length >= 2 && (
                <MiniSparkline data={spark} color={clr} width={50} height={18} />
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 30, textAlign: "center", opacity: 0.4, fontSize: 13 }}>No results found</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEMS TAB
// ═══════════════════════════════════════════════════════════════════════════

function ItemsTab({ league, accent }: { league: string; accent: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("UniqueWeapon");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"chaos" | "divine" | "name">("chaos");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await ninjaFetch(`${POE_NINJA}/itemoverview?league=${encodeURIComponent(league)}&type=${category}`);
      setItems(j.lines || []);
    } catch (e) {
      console.warn("poe.ninja items error:", e);
    }
    setLoading(false);
  }, [league, category]);

  useEffect(() => { load(); }, [load]);

  const filtered = (search
    ? items.filter(i => i.name?.toLowerCase().includes(search.toLowerCase()))
    : items
  ).sort((a, b) => {
    if (sortBy === "chaos") return (b.chaosValue || 0) - (a.chaosValue || 0);
    if (sortBy === "divine") return (b.divineValue || 0) - (a.divineValue || 0);
    return (a.name || "").localeCompare(b.name || "");
  });

  return (
    <div>
      {/* Category pills */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {ITEM_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)} style={{
            ...S.btn, fontSize: 11, padding: "5px 10px",
            borderColor: category === c.id ? `${accent}44` : undefined,
            background: category === c.id ? `${accent}12` : undefined,
            color: category === c.id ? "rgba(243,244,246,.9)" : "rgba(148,163,184,.5)",
            fontWeight: category === c.id ? 700 : 500,
          }}>{c.label}</button>
        ))}
      </div>

      {/* Search + Sort */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input style={{ ...S.input, flex: "1 1 200px" }} placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.select} value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
          <option value="chaos">Chaos Value</option>
          <option value="divine">Divine Value</option>
          <option value="name">Name</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading unique items...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", opacity: 0.4, fontSize: 13 }}>No items found</div>
      ) : (
        <>
          <div style={{ fontSize: 10, color: "rgba(148,163,184,.4)", marginBottom: 8 }}>{filtered.length} items</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {filtered.slice(0, 100).map((item, idx) => {
              const spark = item.sparkline?.data || null;
              const clr = trendColor(spark);
              return (
                <div key={item.id || `${item.name}-${idx}`} style={{
                  ...S.card, display: "flex", alignItems: "center", gap: 8,
                  transition: "border-color .12s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = `${accent}44`)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.06)")}
                >
                  {/* Icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 6,
                    background: "rgba(0,0,0,.30)", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, overflow: "hidden",
                  }}>
                    {item.icon ? (
                      <img src={item.icon} alt={item.name + " icon"} style={{ width: 32, height: 32, objectFit: "contain" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span style={{ fontSize: 16, opacity: 0.3 }}>{"\u{2694}"}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: accent, fontFamily: "monospace" }}>
                        {(item.chaosValue || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        <span style={{ fontSize: 9, fontWeight: 400, color: "rgba(148,163,184,.45)", marginLeft: 2 }}>c</span>
                      </span>
                      {item.divineValue > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#E8D44D", fontFamily: "monospace" }}>
                          {item.divineValue.toFixed(1)}
                          <span style={{ fontSize: 9, fontWeight: 400, color: "rgba(148,163,184,.45)", marginLeft: 2 }}>div</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sparkline */}
                  {spark && spark.length >= 2 && (
                    <MiniSparkline data={spark} color={clr} width={44} height={16} />
                  )}
                </div>
              );
            })}
          </div>
          {filtered.length > 100 && (
            <div style={{ padding: 12, textAlign: "center", opacity: 0.3, fontSize: 11 }}>
              Showing top 100 of {filtered.length} items
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIVINATION CARDS TAB
// ═══════════════════════════════════════════════════════════════════════════

function DivCardsTab({ league, accent }: { league: string; accent: string }) {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"chaos" | "name">("chaos");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await ninjaFetch(`${POE_NINJA}/itemoverview?league=${encodeURIComponent(league)}&type=DivinationCard`);
      setCards(j.lines || []);
    } catch (e) {
      console.warn("poe.ninja div cards error:", e);
    }
    setLoading(false);
  }, [league]);

  useEffect(() => { load(); }, [load]);

  const filtered = (search
    ? cards.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()))
    : cards
  ).sort((a, b) => {
    if (sortBy === "chaos") return (b.chaosValue || 0) - (a.chaosValue || 0);
    return (a.name || "").localeCompare(b.name || "");
  });

  return (
    <div>
      {/* Search + Sort */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input style={{ ...S.input, flex: "1 1 200px" }} placeholder="Search divination cards..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.select} value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
          <option value="chaos">Value (High to Low)</option>
          <option value="name">Alphabetical</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading divination cards...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", opacity: 0.4, fontSize: 13 }}>No cards found</div>
      ) : (
        <>
          <div style={{ fontSize: 10, color: "rgba(148,163,184,.4)", marginBottom: 8 }}>{filtered.length} cards</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {filtered.slice(0, 100).map((card, idx) => {
              const spark = card.sparkline?.data || null;
              const clr = trendColor(spark);
              return (
                <div key={card.id || `${card.name}-${idx}`} style={{
                  ...S.card, display: "flex", alignItems: "center", gap: 8,
                  transition: "border-color .12s",
                  border: (card.chaosValue || 0) >= 100 ? `1px solid ${accent}30` : undefined,
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = `${accent}44`)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = (card.chaosValue || 0) >= 100 ? `${accent}30` : "rgba(255,255,255,.06)")}
                >
                  {/* Icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 6,
                    background: "rgba(0,0,0,.30)", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, overflow: "hidden",
                  }}>
                    {card.icon ? (
                      <img src={card.icon} alt={card.name + " icon"} style={{ width: 32, height: 32, objectFit: "contain" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span style={{ fontSize: 16, opacity: 0.3 }}>{"\u{1F0CF}"}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {card.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: accent, fontFamily: "monospace" }}>
                        {(card.chaosValue || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        <span style={{ fontSize: 9, fontWeight: 400, color: "rgba(148,163,184,.45)", marginLeft: 2 }}>c</span>
                      </span>
                      {card.divineValue > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#E8D44D", fontFamily: "monospace" }}>
                          {card.divineValue.toFixed(1)}
                          <span style={{ fontSize: 9, fontWeight: 400, color: "rgba(148,163,184,.45)", marginLeft: 2 }}>div</span>
                        </span>
                      )}
                    </div>
                    {card.stackSize && card.stackSize > 1 && (
                      <div style={{ fontSize: 9, color: "rgba(148,163,184,.35)", marginTop: 2 }}>Stack: {card.stackSize}</div>
                    )}
                  </div>

                  {/* Sparkline */}
                  {spark && spark.length >= 2 && (
                    <MiniSparkline data={spark} color={clr} width={44} height={16} />
                  )}
                </div>
              );
            })}
          </div>
          {filtered.length > 100 && (
            <div style={{ padding: 12, textAlign: "center", opacity: 0.3, fontSize: 11 }}>
              Showing top 100 of {filtered.length} cards
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SKILL GEMS TAB
// ═══════════════════════════════════════════════════════════════════════════

function GemsTab({ league, accent }: { league: string; accent: string }) {
  const [gems, setGems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"chaos" | "name">("chaos");
  const [gemFilter, setGemFilter] = useState<"all" | "corrupted" | "quality">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await ninjaFetch(`${POE_NINJA}/itemoverview?league=${encodeURIComponent(league)}&type=SkillGem`);
      setGems(j.lines || []);
    } catch (e) {
      console.warn("poe.ninja gems error:", e);
    }
    setLoading(false);
  }, [league]);

  useEffect(() => { load(); }, [load]);

  const filtered = (search
    ? gems.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()))
    : gems
  ).filter(g => {
    if (gemFilter === "corrupted") return g.corrupted;
    if (gemFilter === "quality") return (g.gemQuality || 0) >= 20;
    return true;
  }).sort((a, b) => {
    if (sortBy === "chaos") return (b.chaosValue || 0) - (a.chaosValue || 0);
    return (a.name || "").localeCompare(b.name || "");
  });

  const GEM_COLORS: Record<string, string> = {
    "Strength": "#C33030",
    "Dexterity": "#2C8C2C",
    "Intelligence": "#4169E1",
  };

  function gemColor(gem: any): string {
    if (gem.gemColour === "r" || gem.name?.includes("Vaal")) return GEM_COLORS.Strength;
    if (gem.gemColour === "g") return GEM_COLORS.Dexterity;
    if (gem.gemColour === "b") return GEM_COLORS.Intelligence;
    return accent;
  }

  return (
    <div>
      {/* Search + Sort */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input style={{ ...S.input, flex: "1 1 200px" }} placeholder="Search skill gems..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.select} value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
          <option value="chaos">Value (High to Low)</option>
          <option value="name">Alphabetical</option>
        </select>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {(["all", "corrupted", "quality"] as const).map(f => (
          <button key={f} onClick={() => setGemFilter(f)} style={{
            ...S.btn, fontSize: 11, padding: "5px 10px",
            borderColor: gemFilter === f ? `${accent}44` : undefined,
            background: gemFilter === f ? `${accent}12` : undefined,
            color: gemFilter === f ? "rgba(243,244,246,.9)" : "rgba(148,163,184,.5)",
            fontWeight: gemFilter === f ? 700 : 500,
          }}>
            {f === "all" ? "All Gems" : f === "corrupted" ? "Corrupted" : "20% Quality"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading skill gems...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", opacity: 0.4, fontSize: 13 }}>No gems found</div>
      ) : (
        <>
          <div style={{ fontSize: 10, color: "rgba(148,163,184,.4)", marginBottom: 8 }}>{filtered.length} gems</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {filtered.slice(0, 100).map((gem, idx) => {
              const spark = gem.sparkline?.data || null;
              const clr = trendColor(spark);
              const gc = gemColor(gem);
              return (
                <div key={gem.id || `${gem.name}-${gem.gemLevel}-${gem.gemQuality}-${idx}`} style={{
                  ...S.card, display: "flex", alignItems: "center", gap: 8,
                  transition: "border-color .12s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = `${gc}44`)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.06)")}
                >
                  {/* Icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 6,
                    background: `${gc}12`, display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, overflow: "hidden",
                  }}>
                    {gem.icon ? (
                      <img src={gem.icon} alt={gem.name + " icon"} style={{ width: 30, height: 30, objectFit: "contain" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span style={{ fontSize: 16, opacity: 0.3 }}>{"\u{1F48E}"}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {gem.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                      {gem.gemLevel && (
                        <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: `${gc}15`, color: gc, fontWeight: 700 }}>
                          Lv{gem.gemLevel}
                        </span>
                      )}
                      {gem.gemQuality > 0 && (
                        <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "rgba(255,255,255,.06)", color: "rgba(243,244,246,.6)", fontWeight: 600 }}>
                          {gem.gemQuality}%
                        </span>
                      )}
                      {gem.corrupted && (
                        <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "rgba(210,40,40,.12)", color: "#D22828", fontWeight: 700 }}>VAAL</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: accent, fontFamily: "monospace" }}>
                        {(gem.chaosValue || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        <span style={{ fontSize: 9, fontWeight: 400, color: "rgba(148,163,184,.45)", marginLeft: 2 }}>c</span>
                      </span>
                      {gem.divineValue > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#E8D44D", fontFamily: "monospace" }}>
                          {gem.divineValue.toFixed(1)}
                          <span style={{ fontSize: 9, fontWeight: 400, color: "rgba(148,163,184,.45)", marginLeft: 2 }}>div</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sparkline */}
                  {spark && spark.length >= 2 && (
                    <MiniSparkline data={spark} color={clr} width={40} height={14} />
                  )}
                </div>
              );
            })}
          </div>
          {filtered.length > 100 && (
            <div style={{ padding: 12, textAlign: "center", opacity: 0.3, fontSize: 11 }}>
              Showing top 100 of {filtered.length} gems
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FIND TEAM (LFG)
// ═══════════════════════════════════════════════════════════════════════════

function FindTeam({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activity, setActivity] = useState("Mapping");
  const [region, setRegion] = useState("Any");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`)
      .then(j => { setPosts(j.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lobbyId]);

  useEffect(() => { load(); const i = setInterval(load, 12000); return () => clearInterval(i); }, [load]);

  async function create() {
    setCreating(true);
    setMsg("");
    const regionStr = region !== "Any" ? ` [${region}]` : "";
    const activityStr = `${activity}${regionStr}`;

    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({
        activity: activityStr,
        description: note,
        maxPlayers: 6,
        platform: "pc",
      }),
    });
    setCreating(false);
    if (j.ok) {
      setShowForm(false);
      setNote("");
      load();
    } else {
      setMsg(j.message || j.error || "Failed to create post");
    }
  }

  async function join(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/join`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed to join");
  }

  async function leave(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/leave`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed to leave");
  }

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading parties...</div>;

  const openPosts = posts.filter(p => p.status === "OPEN");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={S.label}>PARTY FINDER ({openPosts.length} open)</div>
        <button
          style={showForm ? S.btn : S.btnPri}
          onClick={() => { setShowForm(!showForm); setMsg(""); }}
        >
          {showForm ? "Cancel" : "+ Find Party"}
        </button>
      </div>

      {msg && (
        <div style={{
          marginBottom: 10, fontSize: 12, padding: "6px 10px", borderRadius: 8,
          background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)",
          color: "rgba(252,165,165,.8)",
        }}>{msg}</div>
      )}

      {/* Create Form */}
      {showForm && (
        <div style={{
          ...S.card, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10,
          border: `1px solid ${accent}33`, background: `${accent}06`,
        }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Activity</div>
              <select style={{ ...S.select, width: "100%" }} value={activity} onChange={e => setActivity(e.target.value)}>
                {POE_ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Region</div>
              <select style={{ ...S.select, width: "100%" }} value={region} onChange={e => setRegion(e.target.value)}>
                {POE_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div style={S.label}>Note (optional)</div>
            <input
              style={S.input}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Looking for carry on Uber Elder, need aurabot..."
              maxLength={300}
            />
          </div>

          <button
            style={{ ...S.btnPri, padding: "10px 24px", alignSelf: "flex-start", fontSize: 13 }}
            onClick={create}
            disabled={creating}
          >
            {creating ? "Posting..." : "Post Party"}
          </button>
        </div>
      )}

      {/* Posts List */}
      {posts.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.2 }}>{"\u{1F465}"}</div>
          <div style={{ opacity: 0.4, fontSize: 13, marginBottom: 4 }}>No parties posted yet</div>
          <div style={{ opacity: 0.25, fontSize: 11 }}>Be the first to find a group</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {posts.map(p => {
            const isFull = p.status === "FULL";
            const playerCount = (p.players || []).length;
            const maxP = p.maxPlayers || 6;
            const slots = Array.from({ length: maxP }, (_, i) => i < playerCount);

            return (
              <div key={p.id} style={{
                ...S.card, display: "flex", flexDirection: "column", gap: 8,
                border: isFull ? `1px solid ${accent}30` : "1px solid rgba(255,255,255,.06)",
                opacity: isFull ? 0.65 : 1,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.92)" }}>{p.activity}</div>
                    {p.description && <div style={{ fontSize: 11, color: "rgba(148,163,184,.5)", marginTop: 3 }}>{p.description}</div>}
                  </div>
                  <span style={{
                    fontSize: 9, padding: "2px 6px", borderRadius: 4,
                    background: isFull ? "rgba(239,68,68,.10)" : `${accent}12`,
                    color: isFull ? "#ef4444" : accent,
                    fontWeight: 700,
                  }}>{isFull ? "FULL" : "OPEN"}</span>
                </div>

                {/* Slot dots */}
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {slots.map((filled, i) => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: filled ? accent : "rgba(255,255,255,.10)",
                      boxShadow: filled ? `0 0 4px ${accent}66` : "none",
                    }} />
                  ))}
                  <span style={{ fontSize: 10, color: "rgba(148,163,184,.4)", marginLeft: 4 }}>{playerCount}/{maxP}</span>
                </div>

                {/* Host info */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "rgba(148,163,184,.35)" }}>
                    Host: {p.hostName || "Unknown"}
                  </span>
                  {!isFull ? (
                    <button style={S.btnPri} onClick={() => join(p.id)}>Join</button>
                  ) : (
                    <button style={S.btn} onClick={() => leave(p.id)}>Leave</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TWITCH STREAMS
// ═══════════════════════════════════════════════════════════════════════════

function TwitchStreams({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await apiFetch(`/twitch/streams?game=${encodeURIComponent("Path of Exile")}&first=20`);
      if (j.ok) setStreams(j.streams || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  function handleCardClick(s: any) {
    setInterceptStream({
      userLogin: s.userLogin || s.user_login || "",
      userName: s.userName || s.user_name || "",
      title: s.title || "",
      viewerCount: Number(s.viewerCount || s.viewer_count || 0),
      thumbnailUrl: s.thumbnailUrl || s.thumbnail_url || "",
      gameName: "Path of Exile",
    });
  }

  function handleWatchHere(stream: StreamInfo) {
    setActiveStream(stream.userLogin);
  }

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading streams...</div>;
  if (streams.length === 0) return (
    <div style={{ textAlign: "center", padding: 30 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u{1F4FA}"}</div>
      <div style={{ fontSize: 13, color: "rgba(148,163,184,.4)" }}>No Path of Exile streams live right now</div>
    </div>
  );

  return (
    <>
      {activeStream && (
        <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${accent}40`, background: "#000", marginBottom: 8 }}>
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${typeof window !== "undefined" ? window.location.hostname : "weered.ca"}&muted=true`}
            width="100%" height="280" style={{ border: "none", display: "block" }} allowFullScreen
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: `${accent}10` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{activeStream}</span>
            <button onClick={() => setActiveStream(null)} style={{ ...S.btn, fontSize: 11, padding: "4px 10px" }}>Close</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {streams.map(s => (
          <div key={s.userLogin} onClick={() => handleCardClick(s)} style={{
            ...S.card, cursor: "pointer", display: "flex", gap: 10, alignItems: "center",
            transition: "border-color .12s",
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = `${accent}44`)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.06)")}
          >
            {s.thumbnailUrl && (
              <img
                src={(s.thumbnailUrl || "").replace("{width}", "80").replace("{height}", "45")}
                alt={s.userName + " stream thumbnail"} style={{ width: 80, height: 45, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,.06)" }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{s.userName} {"\u00B7"} {s.viewerCount?.toLocaleString()} viewers</div>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,.6)", flexShrink: 0 }} />
          </div>
        ))}
      </div>

      <StreamInterceptModal
        stream={interceptStream}
        lobbyId={lobbyId}
        accentColor={accent}
        onClose={() => setInterceptStream(null)}
        onWatchHere={handleWatchHere}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════

interface Props {
  lobbyId: string;
  gameName?: string;
  accentColor?: string;
  style?: React.CSSProperties;
}

export default function PoeModulesPanel({
  lobbyId,
  gameName = "Path of Exile",
  accentColor = ACCENT_POE,
  style,
}: Props) {
  const accent = accentColor || ACCENT_POE;
  const [tab, setTab] = useState<TabId>("economy");
  const [league, setLeague] = useState(DEFAULT_LEAGUE);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}>
      {/* Tabs */}
      <div style={{
        display: "flex", gap: 2, padding: "8px 12px 0",
        borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0, overflowX: "auto",
        alignItems: "center",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "7px 12px", borderRadius: "8px 8px 0 0", border: "none",
            background: tab === t.id ? `${accent}20` : "transparent",
            color: tab === t.id ? "rgba(243,244,246,.92)" : "rgba(148,163,184,.65)",
            fontWeight: tab === t.id ? 700 : 400, fontSize: 12, cursor: "pointer",
            transition: "background .1s, color .1s",
            display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
            fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}

        {/* League selector */}
        {(tab === "economy" || tab === "items" || tab === "divcards" || tab === "gems") && (
          <select
            value={league}
            onChange={e => setLeague(e.target.value)}
            style={{
              ...S.select, marginLeft: "auto", fontSize: 11, padding: "4px 8px",
              border: `1px solid ${accent}33`, background: `${accent}08`,
            }}
          >
            {LEAGUES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 14px", display: "flex", flexDirection: "column" }}>
        {tab === "economy"  && <EconomyTab league={league} accent={accent} />}
        {tab === "items"    && <ItemsTab league={league} accent={accent} />}
        {tab === "divcards" && <DivCardsTab league={league} accent={accent} />}
        {tab === "gems"     && <GemsTab league={league} accent={accent} />}
        {tab === "streams"  && <TwitchStreams lobbyId={lobbyId} accent={accent} />}
        {tab === "lfg"      && <FindTeam lobbyId={lobbyId} accent={accent} />}
      </div>

      {/* GGG legal disclaimer */}
      <div style={{ padding: "6px 14px 8px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <p style={{ fontSize: 9, color: "rgba(100,116,139,.35)", lineHeight: 1.4, margin: 0, textAlign: "center" }}>
          Weered is not affiliated with, endorsed by, or sponsored by Grinding Gear Games. Path of Exile is a registered trademark of Grinding Gear Games. Economy data provided by poe.ninja.
        </p>
      </div>
    </div>
  );
}
