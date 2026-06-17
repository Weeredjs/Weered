"use client";

import React, { useCallback, useEffect, useState } from "react";
import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";
import EmptyState from "./EmptyState";
import ModuleTabBar from "./ModuleTabBar";
import PassiveTree from "./PassiveTree";
import { useWatchHere, consumePendingStream } from "../lib/useWatchHere";
import { onActivate } from "@/lib/a11y";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const POE_NINJA = "https://poe.ninja/api/data";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

const ACCENT_POE = "#AF6025";

const S = {
  card: { borderRadius: 2, border: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.03)", padding: "10px 12px" } as React.CSSProperties,
  btn: { padding: "6px 12px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)", fontFamily: "inherit" } as React.CSSProperties,
  btnPri: { padding: "6px 12px", borderRadius: 2, border: "1px solid rgba(175,96,37,.35)", background: "rgba(175,96,37,.12)", fontSize: 12, cursor: "pointer", color: "rgb(175,96,37)", fontWeight: 600, fontFamily: "inherit" } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" },
  select: { padding: "8px 12px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 12, color: "rgba(243,244,246,.92)", outline: "none", cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

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

const ninjaCache = new Map<string, { data: any; ts: number }>();
const NINJA_TTL = 120000;

async function ninjaFetch(url: string) {
  const cached = ninjaCache.get(url);
  if (cached && Date.now() - cached.ts < NINJA_TTL) return cached.data;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`poe.ninja ${r.status}`);
  const j = await r.json();
  ninjaCache.set(url, { data: j, ts: Date.now() });
  return j;
}

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

const TABS = [
  { id: "economy" as const, label: "Economy",    icon: "\u{1FA99}" },
  { id: "tree" as const,    label: "Skill Tree",  icon: "\u{1F333}" },
  { id: "divcards" as const,label: "Div Cards",   icon: "\u{1F0CF}" },
  { id: "ladder" as const,  label: "Ladder",      icon: "\u{1F3C6}" },
  { id: "streams" as const, label: "Live Streams", icon: "\u{1F4FA}" },
  { id: "lfg" as const,     label: "Find Team",   icon: "\u{1F465}" },
  { id: "account" as const, label: "My Account",  icon: "\u{1FAAA}" },
];
type TabId = typeof TABS[number]["id"];

function EconomyTab({ league, accent, filterCat }: { league: string; accent: string; filterCat?: string }) {
  const [data, setData] = useState<{ asOf?: string; divineChaos?: number; chaosIcon?: string; divineIcon?: string; currencies: any[] }>({ currencies: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"value" | "volume">("value");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j: any = await apiFetch(`/poe/economy?league=${encodeURIComponent(league)}`);
      setData({ asOf: j?.asOf, divineChaos: j?.divineChaos, chaosIcon: j?.chaosIcon, divineIcon: j?.divineIcon, currencies: Array.isArray(j?.currencies) ? j.currencies : [] });
    } catch (e) {
      console.warn("economy error:", e);
      setData({ currencies: [] });
    }
    setLoading(false);
  }, [league]);

  useEffect(() => { load(); }, [load]);

  const asOfLabel = (() => {
    if (!data.asOf) return "";
    try {
      const d = new Date(data.asOf);
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    } catch { return ""; }
  })();

  const sorted = [...data.currencies].sort((a: any, b: any) =>
    sort === "volume" ? (b.volume || 0) - (a.volume || 0) : (b.chaos || 0) - (a.chaos || 0)
  );
  const pool = filterCat ? sorted.filter((i: any) => i.cat === filterCat) : sorted;
  const filtered = search
    ? pool.filter((i: any) => (i.name || i.id || "").toLowerCase().includes(search.toLowerCase()))
    : pool;
  const maxVol = Math.max(1, ...data.currencies.map((c: any) => c.volume || 0));

  if (loading) return <div style={{ padding: 30, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading Wraeclast economy...</div>;

  const Orb = ({ src, size = 13 }: { src?: string; size?: number }) =>
    src ? <img src={src} alt="" style={{ width: size, height: size, verticalAlign: "-2px", objectFit: "contain", filter: "drop-shadow(0 0 2px rgba(0,0,0,.6))" }} /> : null;

  return (
    <div>
      {/* Exchange banner */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
        padding: "11px 14px", marginBottom: 10, borderRadius: 10,
        border: `1px solid ${accent}33`,
        background: `linear-gradient(135deg, ${accent}1f 0%, rgba(0,0,0,.25) 55%)`,
        boxShadow: `inset 0 0 30px ${accent}10`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {data.divineChaos ? (
            <>
              <Orb src={data.divineIcon} size={26} />
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(243,244,246,.96)", fontFamily: "monospace", letterSpacing: ".3px" }}>
                  {data.divineChaos.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span style={{ color: accent }}>c</span>
                </div>
                <div style={{ fontSize: 9, color: "rgba(148,163,184,.55)", letterSpacing: ".6px", textTransform: "uppercase" }}>1 Divine Orb</div>
              </div>
              <Orb src={data.chaosIcon} size={26} />
            </>
          ) : <span style={{ fontSize: 12, opacity: 0.5 }}>{data.currencies.length} currencies</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", borderRadius: 7, overflow: "hidden", border: "1px solid rgba(255,255,255,.10)" }}>
            {(["value", "volume"] as const).map(k => (
              <button key={k} onClick={() => setSort(k)} style={{
                padding: "4px 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase",
                cursor: "pointer", border: "none", fontFamily: "inherit",
                background: sort === k ? `${accent}26` : "transparent",
                color: sort === k ? "rgba(243,244,246,.92)" : "rgba(148,163,184,.5)",
              }}>{k}</button>
            ))}
          </div>
          <span style={{ fontSize: 8.5, color: "rgba(148,163,184,.4)", letterSpacing: ".5px", textAlign: "right", lineHeight: 1.3 }}>
            OFFICIAL<br />EXCHANGE{asOfLabel ? ` · ${asOfLabel}` : ""}
          </span>
        </div>
      </div>

      <input
        style={{ ...S.input, marginBottom: 10 }}
        placeholder={filterCat === "Cards" ? "Search cards..." : "Search currency..."}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {filtered.map((item: any, idx: number) => {
          const hot = (item.divine || 0) >= 1; // worth a divine or more
          return (
          <div key={item.id} style={{
            ...S.card, display: "flex", alignItems: "center", gap: 9, position: "relative", overflow: "hidden",
            padding: "9px 11px",
            borderColor: hot ? `${accent}33` : "rgba(255,255,255,.06)",
            transition: "border-color .12s, box-shadow .12s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}66`; e.currentTarget.style.boxShadow = `0 0 0 1px ${accent}22, inset 0 0 22px ${accent}0c`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = hot ? `${accent}33` : "rgba(255,255,255,.06)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            {/* rank */}
            <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(148,163,184,.35)", fontFamily: "monospace", width: 16, textAlign: "right", flexShrink: 0 }}>
              {sort === "value" && !search ? idx + 1 : ""}
            </span>

            {/* icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: `radial-gradient(circle at 50% 40%, ${accent}1c, ${accent}06)`,
              border: `1px solid ${accent}22`,
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            }}>
              {item.icon ? (
                <img src={item.icon} alt={(item.name || item.id) + " icon"} style={{ width: 30, height: 30, objectFit: "contain" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <span style={{ fontSize: 16, opacity: 0.4 }}>{"\u{1FA99}"}</span>
              )}
            </div>

            {/* name + volume bar */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.93)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.name || item.id}
              </div>
              {item.volume ? (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
                  <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,.06)", overflow: "hidden", maxWidth: 70 }}>
                    <div style={{ height: "100%", width: `${Math.max(4, Math.round((item.volume / maxVol) * 100))}%`, background: `linear-gradient(90deg, ${accent}66, ${accent})`, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 8.5, color: "rgba(148,163,184,.45)", fontFamily: "monospace" }}>
                    {Number(item.volume).toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 } as any)}
                  </span>
                </div>
              ) : null}
            </div>

            {/* price */}
            <div style={{ textAlign: "right", flexShrink: 0, lineHeight: 1.25 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: hot ? accent : "rgba(243,244,246,.9)", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                {(item.chaos || 0).toLocaleString(undefined, { maximumFractionDigits: item.chaos >= 100 ? 0 : 1 })}
                <Orb src={data.chaosIcon} size={13} />
              </div>
              {item.divine != null && item.divine >= 0.01 && (
                <div style={{ fontSize: 9.5, color: "rgba(148,163,184,.6)", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end", marginTop: 2 }}>
                  {item.divine.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  <Orb src={data.divineIcon} size={11} />
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyState title="No currency data." hint="The exchange digest may not be published yet for this league." />
      )}
    </div>
  );
}

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
        <EmptyState title="No items found." />
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
                  <div style={{
                    width: 36, height: 36, borderRadius: 2,
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
        <EmptyState title="No cards found." />
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
                  <div style={{
                    width: 36, height: 36, borderRadius: 2,
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
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input style={{ ...S.input, flex: "1 1 200px" }} placeholder="Search skill gems..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.select} value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
          <option value="chaos">Value (High to Low)</option>
          <option value="name">Alphabetical</option>
        </select>
      </div>

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
        <EmptyState title="No gems found." />
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
                  <div style={{
                    width: 36, height: 36, borderRadius: 2,
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
          marginBottom: 10, fontSize: 12, padding: "6px 10px", borderRadius: 2,
          background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)",
          color: "rgba(252,165,165,.8)",
        }}>{msg}</div>
      )}

      {showForm && (
        <div style={{
          ...S.card, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10,
          border: `1px solid ${accent}33`, borderLeft: `2px solid ${accent}`, background: `${accent}06`,
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

      {posts.length === 0 ? (
        <EmptyState icon="👥" title="No parties posted yet." hint="Drop one up top — someone's looking." />
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
                    fontSize: 9, padding: "2px 6px", borderRadius: 2,
                    background: isFull ? "rgba(239,68,68,.10)" : `${accent}12`,
                    color: isFull ? "#ef4444" : accent,
                    fontWeight: 700,
                  }}>{isFull ? "FULL" : "OPEN"}</span>
                </div>

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

function TwitchStreams({ lobbyId, accent }: { lobbyId: string; accent: string }) {
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
      <div style={{ fontSize: 13, color: "var(--weered-muted, rgba(148,163,184,.55))" }}>Nobody streaming PoE right now.</div>
    </div>
  );

  return (
    <>
      {activeStream && (
        <div style={{ borderRadius: 2, overflow: "hidden", border: `1px solid ${accent}40`, background: "#000", marginBottom: 8 }}>
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
          <div key={s.userLogin} onClick={() => handleCardClick(s)} onKeyDown={onActivate(() => handleCardClick(s))} tabIndex={0} role="button" style={{
            ...S.card, cursor: "pointer", display: "flex", gap: 10, alignItems: "center",
            transition: "border-color .12s",
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = `${accent}44`)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.06)")}
          >
            {s.thumbnailUrl && (
              <img
                src={(s.thumbnailUrl || "").replace("{width}", "80").replace("{height}", "45")}
                alt={s.userName + " stream thumbnail"} style={{ width: 80, height: 45, borderRadius: 2, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,.06)" }}
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

interface Props {
  lobbyId: string;
  gameName?: string;
  accentColor?: string;
  style?: React.CSSProperties;
}

const POE_FRAME_COLOR: Record<number, string> = { 0: "#c8c8c8", 1: "#8888ff", 2: "#ffff77", 3: "#af6025", 4: "#1ba29b", 9: "#aa9e82" };
const POE_SLOT_ORDER = ["Weapon", "Offhand", "Helm", "BodyArmour", "Gloves", "Boots", "Belt", "Amulet", "Ring", "Ring2"];

function GearGrid({ items, accent }: { items: any[]; accent: string }) {
  const equip = items.filter(i => POE_SLOT_ORDER.includes(i.slot)).sort((a, b) => POE_SLOT_ORDER.indexOf(a.slot) - POE_SLOT_ORDER.indexOf(b.slot));
  const flasks = items.filter(i => i.slot === "Flask");
  if (equip.length === 0 && flasks.length === 0) return <div style={{ fontSize: 11, opacity: 0.5, padding: 8 }}>No equipped items.</div>;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
        {equip.map((it, i) => (
          <div key={i} title={`${it.name || it.typeLine}\n${it.typeLine}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "rgba(0,0,0,.28)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 4, minWidth: 0 }}>
            {it.icon ? <img src={it.icon} alt="" style={{ width: 30, height: 30, objectFit: "contain", flexShrink: 0 }} /> : <div style={{ width: 30, height: 30, flexShrink: 0 }} />}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: POE_FRAME_COLOR[it.frame] || "#c8c8c8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name || it.typeLine}{it.corrupted && <span style={{ color: "#d20000", marginLeft: 4 }}>{"⊘"}</span>}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name ? it.typeLine : it.slot}</div>
            </div>
          </div>
        ))}
      </div>
      {flasks.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.4)", marginBottom: 4, letterSpacing: 0.6 }}>FLASKS</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {flasks.map((it, i) => it.icon ? <img key={i} src={it.icon} alt={it.typeLine} title={it.name || it.typeLine} style={{ width: 28, height: 28, objectFit: "contain", border: `1px solid ${(POE_FRAME_COLOR[it.frame] || "#555")}55`, borderRadius: 3, background: "rgba(0,0,0,.28)" }} /> : null)}
          </div>
        </div>
      )}
    </div>
  );
}

function PoeAccountTab({ accent }: { accent: string }) {
  const [me, setMe] = useState<any>(null);
  const [chars, setChars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState(false);
  const [flash, setFlash] = useState("");
  const [selChar, setSelChar] = useState<string | null>(null);
  const [gear, setGear] = useState<any>(null);
  const [gearLoading, setGearLoading] = useState(false);
  async function openChar(c: any) {
    if (selChar === c.name) { setSelChar(null); return; }
    setSelChar(c.name); setGear(null); setGearLoading(true);
    const j = await apiFetch(`/poe/character?name=${encodeURIComponent(c.name)}&realm=${encodeURIComponent(c.realm || "pc")}`);
    setGear(j); setGearLoading(false);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const j = await apiFetch("/poe/me");
    setMe(j);
    if (j?.linked) {
      const c = await apiFetch("/poe/me/characters");
      setChars(c?.characters || []);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("poe");
      if (!p) return;
      if (p === "success") setFlash("Account linked.");
      else if (p === "denied") setFlash("Link cancelled.");
      else setFlash("Link failed — please try again.");
      const url = new URL(window.location.href);
      url.searchParams.delete("poe");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);

  const token = typeof window !== "undefined" ? (localStorage.getItem("weered_token") || "") : "";
  const linkHref = `${API}/auth/poe?token=${encodeURIComponent(token)}`;

  async function unlink() {
    setUnlinking(true);
    await apiFetch("/poe/me", { method: "DELETE" });
    setMe({ linked: false }); setChars([]); setUnlinking(false);
  }

  if (loading) return <div style={{ padding: 20, opacity: 0.5, fontSize: 12 }}>Loading…</div>;

  if (!me?.linked) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", textAlign: "center", paddingTop: 28 }}>
        {flash && <div style={{ marginBottom: 12, fontSize: 12, color: accent }}>{flash}</div>}
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Link your Path of Exile account</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginBottom: 20, lineHeight: 1.6 }}>
          Connect through Grinding Gear Games to surface your characters and league in your Weered profile. Read-only — Weered only requests profile and character access, and you can unlink anytime.
        </div>
        <a href={linkHref} style={{ display: "inline-block", padding: "11px 22px", borderRadius: 4, background: `linear-gradient(135deg, ${accent}, #b8860b)`, color: "#1a1206", fontWeight: 800, fontSize: 13, textDecoration: "none", letterSpacing: 0.5, textTransform: "uppercase" }}>
          Link PoE Account
        </a>
      </div>
    );
  }

  const a = me.account || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {flash && <div style={{ fontSize: 12, color: accent }}>{flash}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: `${accent}10`, border: `1px solid ${accent}33`, borderRadius: 6 }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{"\u{1F3AD}"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{a.name || "Exile"}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>{String(a.realm || "pc").toUpperCase()} · linked</div>
        </div>
        <button onClick={unlink} disabled={unlinking} style={{ padding: "5px 12px", borderRadius: 3, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.7)", fontSize: 11, cursor: "pointer" }}>{unlinking ? "…" : "Unlink"}</button>
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: accent, textTransform: "uppercase", marginBottom: 8 }}>Characters ({chars.length})</div>
        {chars.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", padding: 12 }}>No characters returned (private profile, or the token expired — re-link to refresh).</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {chars.map((c: any) => {
              const open = selChar === c.name;
              return (
                <div key={c.id || c.name}>
                  <div onClick={() => openChar(c)} onKeyDown={onActivate(() => openChar(c))} tabIndex={0} role="button" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: open ? `${accent}14` : "rgba(255,255,255,.03)", border: `1px solid ${open ? accent + "44" : "rgba(255,255,255,.07)"}`, borderRadius: 4, cursor: "pointer" }}>
                    <span style={{ width: 10, color: "rgba(255,255,255,.4)", fontSize: 10 }}>{open ? "▾" : "▸"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>{c.class}{c.league ? ` · ${c.league}` : ""}{c.realm ? ` · ${String(c.realm).toUpperCase()}` : ""}</div>
                    </div>
                    {typeof c.level !== "undefined" && <div style={{ fontSize: 13, fontWeight: 800, color: accent }}>Lv {c.level}</div>}
                  </div>
                  {open && (
                    <div style={{ padding: "10px 4px 6px" }}>
                      {gearLoading ? <div style={{ fontSize: 11, opacity: 0.5, padding: 8 }}>Loading gear…</div>
                        : gear && gear.items && gear.items.length ? <GearGrid items={gear.items} accent={accent} />
                        : <div style={{ fontSize: 11, opacity: 0.5, padding: 8 }}>{gear && gear.error === "private" ? "Items hidden — enable the Stash/Items privacy on pathofexile.com." : "No gear data."}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function LadderTab({ league, accent }: { league: string; accent: string }) {
  const [data, setData] = useState<{ total: number; entries: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiFetch(`/poe/ladder?league=${encodeURIComponent(league)}`).then((j: any) => {
      if (!alive) return;
      setData({ total: j?.total || 0, entries: j?.entries || [] });
      setLoading(false);
    });
    return () => { alive = false; };
  }, [league]);

  if (loading) return <div style={{ padding: 20, opacity: 0.5, fontSize: 12 }}>Loading ladder…</div>;
  const entries = data?.entries || [];
  if (entries.length === 0) return <div style={{ padding: 24, textAlign: "center", opacity: 0.45, fontSize: 13 }}>No ladder available for {league}.</div>;

  return (
    <div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginBottom: 10 }}>
        Top {entries.length} of {(data?.total || 0).toLocaleString()} · {league}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {entries.map((e: any) => (
          <div key={e.rank} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", background: e.rank % 2 ? "rgba(255,255,255,.02)" : "transparent", borderRadius: 3 }}>
            <div style={{ width: 34, textAlign: "right", fontWeight: 800, fontSize: 13, color: e.rank === 1 ? "#fbbf24" : e.rank <= 3 ? "#cbd5e1" : "rgba(255,255,255,.45)" }}>{e.rank}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {e.name}{e.dead && <span style={{ color: "#f87171", fontSize: 10, marginLeft: 6, fontWeight: 700 }}>DEAD</span>}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {e.account}{e.twitch ? ` · twitch.tv/${e.twitch}` : ""}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: accent }}>Lv {e.level}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.45)" }}>{e.cls}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PoeModulesPanel({
  lobbyId,
  gameName = "Path of Exile",
  accentColor = ACCENT_POE,
  style,
}: Props) {
  const accent = accentColor || ACCENT_POE;
  const [tab, setTab] = useState<TabId>("economy");
  useWatchHere(useCallback(() => { setTab("streams"); }, []));
  const [league, setLeague] = useState(DEFAULT_LEAGUE);
  const [leagues, setLeagues] = useState<{ id: string; current?: boolean }[]>([]);
  useEffect(() => {
    apiFetch("/poe/leagues").then((j: any) => { const ls = j?.leagues || []; if (ls.length) setLeagues(ls); });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}>
      <div style={{
        display: "flex", gap: 2,
        borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0, overflowX: "auto",
        alignItems: "center",
      }}>
        <ModuleTabBar
          tabs={TABS.map(t => ({ id: t.id, label: t.label, icon: <span style={{ fontSize: 13 }}>{t.icon}</span> }))}
          active={tab}
          onSelect={(id) => setTab(id as TabId)}
          accent={accent}
        />

        {(tab === "economy" || tab === "divcards" || tab === "ladder") && (
          <select
            value={league}
            onChange={e => setLeague(e.target.value)}
            style={{
              ...S.select, marginLeft: "auto", marginRight: 12, fontSize: 11, padding: "4px 8px",
              border: `1px solid ${accent}33`, background: `${accent}08`,
            }}
          >
            {(leagues.length ? leagues.map(l => l.id) : LEAGUES).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 14px", display: "flex", flexDirection: "column" }}>
        {tab === "economy"  && <EconomyTab league={league} accent={accent} />}
        {tab === "tree"     && <PassiveTree accent={accent} />}
        {tab === "divcards" && <EconomyTab league={league} accent={accent} filterCat="Cards" />}
        {tab === "ladder"   && <LadderTab league={league} accent={accent} />}
        {tab === "streams"  && <TwitchStreams lobbyId={lobbyId} accent={accent} />}
        {tab === "lfg"      && <FindTeam lobbyId={lobbyId} accent={accent} />}
        {tab === "account"  && <PoeAccountTab accent={accent} />}
      </div>

      <div style={{ padding: "6px 14px 8px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <p style={{ fontSize: 9, color: "rgba(100,116,139,.35)", lineHeight: 1.4, margin: 0, textAlign: "center" }}>
          Weered is not affiliated with, endorsed by, or sponsored by Grinding Gear Games. Path of Exile is a registered trademark of Grinding Gear Games. Economy and passive tree data via Grinding Gear Games' official API.
        </p>
      </div>
    </div>
  );
}
