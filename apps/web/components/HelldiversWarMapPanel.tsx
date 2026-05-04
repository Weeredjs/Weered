"use client";

import React, { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

// Faction colour palette — Super Earth military propaganda aesthetic.
const FACTION_COLORS: Record<string, string> = {
  Humans: "#FFD700",
  "Super Earth": "#FFD700",
  Terminids: "#f58220",
  Automaton: "#b91c1c",
  Automatons: "#b91c1c",
  Illuminate: "#a855f7",
};

function factionColor(name?: string | null) {
  if (!name) return "#6b7280";
  return FACTION_COLORS[name] || "#6b7280";
}

type Campaign = {
  id: number;
  type: number;
  isDefense: boolean;
  planet: {
    index: number;
    name: string;
    sector: string;
    biome?: any;
    hazards?: any[];
    currentOwner: string;
    initialOwner?: string;
    liberationPct: number;
    players: number;
    health?: number;
    maxHealth?: number;
  };
  event: any;
};

type PlanetDetail = {
  index: number;
  name: string;
  sector: string;
  biome?: any;
  hazards?: any[];
  currentOwner: string;
  initialOwner?: string;
  liberationPct: number;
  statistics?: any;
  event?: any;
  history?: any[];
} | null;

const stencil: React.CSSProperties = {
  fontFamily: '"Stencil Std","Black Ops One","Impact",sans-serif',
  letterSpacing: "1.5px",
  textTransform: "uppercase",
};

export default function HelldiversWarMapPanel({ style }: { style?: React.CSSProperties }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<PlanetDetail>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`${API}/helldivers/campaigns`);
        const j = await r.json();
        if (!alive) return;
        if (j?.ok) setCampaigns(j.campaigns || []);
      } catch {}
      finally { if (alive) setLoading(false); }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (selected == null) { setDetail(null); return; }
    let alive = true;
    setDetailLoading(true);
    (async () => {
      try {
        const r = await fetch(`${API}/helldivers/planets/${selected}`);
        const j = await r.json();
        if (!alive) return;
        if (j?.ok) setDetail(j.planet);
      } catch {}
      finally { if (alive) setDetailLoading(false); }
    })();
    return () => { alive = false; };
  }, [selected]);

  const factions = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach(c => { if (c.planet.currentOwner) set.add(c.planet.currentOwner); });
    return Array.from(set);
  }, [campaigns]);

  const visible = campaigns.filter(c =>
    filter === "ALL" ? true : c.planet.currentOwner === filter
  );

  return (
    <div style={{
      borderRadius: 10,
      border: "1px solid rgba(255,215,0,.20)",
      background: "linear-gradient(180deg, rgba(20,20,18,.92), rgba(10,10,8,.96))",
      padding: 12,
      ...style,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ ...stencil, fontSize: 14, color: "#FFD700", fontWeight: 800 }}>
            ▌Galactic War Map
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,215,0,.55)", letterSpacing: ".5px", marginTop: 2 }}>
            Active Campaigns · {visible.length} {visible.length === 1 ? "front" : "fronts"}
          </div>
        </div>

        {/* Faction filter chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Chip active={filter === "ALL"} onClick={() => setFilter("ALL")} color="#FFD700">All</Chip>
          {factions.map(f => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)} color={factionColor(f)}>
              {f}
            </Chip>
          ))}
        </div>
      </div>

      {/* Featured Fronts — top campaigns by player deployment, prominent cards
          rendered above the full grid. Quick-glance for "where the war actually is". */}
      {!loading && visible.length > 4 && (() => {
        const top = [...visible].sort((a, b) => (b.planet.players || 0) - (a.planet.players || 0)).slice(0, 4);
        return (
          <div style={{ marginBottom: 12 }}>
            <div style={{ ...stencil, fontSize: 10, color: "rgba(255,215,0,.7)", letterSpacing: "1.2px", marginBottom: 6 }}>
              ▸ FEATURED FRONTS
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 8,
            }}>
              {top.map(c => (
                <PlanetTile key={`featured-${c.id}`} campaign={c} onClick={() => setSelected(c.planet.index)} featured />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Sector grid */}
      {loading ? (
        <div style={{ padding: 20, textAlign: "center", color: "rgba(255,215,0,.4)", fontSize: 12 }}>
          Acquiring tactical data…
        </div>
      ) : visible.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "rgba(255,215,0,.4)", fontSize: 12 }}>
          No active campaigns on this front.
        </div>
      ) : (
        <>
          {visible.length > 4 && (
            <div style={{ ...stencil, fontSize: 10, color: "rgba(255,215,0,.7)", letterSpacing: "1.2px", marginBottom: 6 }}>
              ▸ ALL FRONTS
            </div>
          )}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: 8,
          }}>
            {visible.map(c => (
              <PlanetTile key={c.id} campaign={c} onClick={() => setSelected(c.planet.index)} />
            ))}
          </div>
        </>
      )}

      {/* Defense pulse keyframes */}
      <style>{`
        @keyframes hd2-defense-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(185,28,28,0); }
          50%      { box-shadow: 0 0 0 4px rgba(185,28,28,.32); }
        }
      `}</style>

      {/* Detail modal */}
      {selected != null && (
        <PlanetModal
          planetIndex={selected}
          detail={detail}
          loading={detailLoading}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Chip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 4,
        border: `1px solid ${active ? color : "rgba(255,255,255,.10)"}`,
        background: active ? `${color}22` : "rgba(255,255,255,.03)",
        color: active ? color : "rgba(255,255,255,.7)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".5px",
        textTransform: "uppercase",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function PlanetTile({ campaign, onClick, featured = false }: { campaign: Campaign; onClick: () => void; featured?: boolean }) {
  const { planet, isDefense, event } = campaign;
  const color = factionColor(planet.currentOwner);
  const pct = isDefense && event ? (event.defensePct ?? 0) : (planet.liberationPct ?? 0);

  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        textAlign: "left",
        padding: featured ? 14 : 10,
        borderRadius: 6,
        border: `1px solid ${color}${isDefense ? "99" : "55"}`,
        background: `linear-gradient(135deg, ${color}${featured ? "33" : "22"}, ${color}08)`,
        cursor: "pointer",
        color: "rgba(255,255,255,.95)",
        fontFamily: "inherit",
        overflow: "hidden",
        minHeight: featured ? 110 : 92,
        animation: isDefense ? "hd2-defense-pulse 2s ease-in-out infinite" : "none",
      }}
    >
      {isDefense && (
        <div style={{
          position: "absolute",
          top: 6,
          right: 6,
          padding: "2px 6px",
          borderRadius: 3,
          background: "#b91c1c",
          color: "#fff",
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: ".5px",
          textTransform: "uppercase",
          ...stencil,
        }}>
          ⚠ Defense
        </div>
      )}

      <div style={{ ...stencil, fontSize: 13, fontWeight: 800, color, marginBottom: 2 }}>
        {planet.name}
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,.45)", letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 6 }}>
        {planet.sector || "—"} Sector
      </div>

      {/* Liberation/defense bar */}
      <div style={{
        height: 5,
        borderRadius: 2,
        background: "rgba(0,0,0,.4)",
        overflow: "hidden",
        marginBottom: 4,
      }}>
        <div style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height: "100%",
          background: isDefense ? "#b91c1c" : color,
          transition: "width .4s",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,.7)" }}>
        <span style={{ fontWeight: 700 }}>{pct.toFixed(1)}%</span>
        <span>{planet.players.toLocaleString()} 👤</span>
      </div>
    </button>
  );
}

function PlanetModal({ planetIndex, detail, loading, onClose }: {
  planetIndex: number; detail: PlanetDetail; loading: boolean; onClose: () => void;
}) {
  const color = factionColor(detail?.currentOwner);
  const biomeName = (detail?.biome as any)?.name || (typeof detail?.biome === "string" ? detail?.biome : "Unknown");
  const biomeDesc = (detail?.biome as any)?.description || "";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560,
          maxHeight: "85vh", overflow: "auto",
          background: "linear-gradient(180deg, #1a1812, #0c0b08)",
          border: `2px solid ${color}`,
          borderRadius: 8,
          padding: 20,
          color: "rgba(255,255,255,.92)",
          boxShadow: `0 0 40px ${color}33`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,215,0,.6)", letterSpacing: "1px", textTransform: "uppercase", ...stencil }}>
              Planet Index #{planetIndex}
            </div>
            <div style={{ ...stencil, fontSize: 22, color, fontWeight: 800, marginTop: 2 }}>
              {detail?.name || "…"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 2, letterSpacing: ".5px" }}>
              {detail?.sector || "Unknown"} Sector · Held by {detail?.currentOwner || "—"}
            </div>
          </div>
          <button onClick={onClose} style={{
            padding: "4px 10px", borderRadius: 4,
            border: "1px solid rgba(255,255,255,.15)",
            background: "rgba(255,255,255,.05)",
            color: "rgba(255,255,255,.8)", cursor: "pointer", fontSize: 11, fontFamily: "inherit",
          }}>Close</button>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: "rgba(255,215,0,.5)", fontSize: 12 }}>
            Receiving telemetry…
          </div>
        ) : !detail ? (
          <div style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,.5)", fontSize: 12 }}>
            No detail available.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Stat label="Liberation" value={`${detail.liberationPct.toFixed(1)}%`} color={color} />
            <Stat label="Active Helldivers" value={(detail.statistics?.playerCount ?? 0).toLocaleString()} />

            <Section label="Biome">
              <div style={{ fontSize: 13, fontWeight: 600 }}>{biomeName}</div>
              {biomeDesc && <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 2 }}>{biomeDesc}</div>}
            </Section>

            {Array.isArray(detail.hazards) && detail.hazards.length > 0 && (
              <Section label="Environmental Hazards">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {detail.hazards.map((h: any, i: number) => (
                    <span key={i} style={{
                      padding: "3px 8px", borderRadius: 3,
                      background: "rgba(245,130,32,.12)",
                      border: "1px solid rgba(245,130,32,.25)",
                      fontSize: 10, color: "#f58220", fontWeight: 600,
                    }}>
                      {h?.name || h?.type || String(h)}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {detail.event && (
              <Section label="Defense Event">
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.7)" }}>
                  Type {detail.event.eventType} · Faction {detail.event.faction}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", letterSpacing: ".5px", textTransform: "uppercase", ...stencil }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || "#FFD700", ...stencil }}>{value}</div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "rgba(255,215,0,.55)", letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 4, ...stencil }}>{label}</div>
      {children}
    </div>
  );
}
