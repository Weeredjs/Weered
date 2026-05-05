"use client";

import React from "react";
import WindroseBuildCard from "./WindroseBuildCard";
import WindroseBuildBuilder from "./WindroseBuildBuilder";
import WindroseBuildDetail from "./WindroseBuildDetail";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#c9a066";

const BIOMES = [
  { id: "PLAINS",   label: "Plains" },
  { id: "COAST",    label: "Coast" },
  { id: "CLIFFS",   label: "Cliffs" },
  { id: "SWAMP",    label: "Swamp" },
  { id: "CAVE",     label: "Cave" },
  { id: "MOUNTAIN", label: "Mountain" },
  { id: "ISLAND",   label: "Island" },
];
const BUILD_TYPES = [
  { id: "SHIP",     label: "Ship" },
  { id: "DOCK",     label: "Dock" },
  { id: "FORTRESS", label: "Fortress" },
  { id: "TAVERN",   label: "Tavern" },
  { id: "HIDEOUT",  label: "Hideout" },
  { id: "OUTPOST",  label: "Outpost" },
  { id: "BRIDGE",   label: "Bridge" },
  { id: "MISC",     label: "Misc" },
];

const PAGE_LIMIT = 24;

type Build = any;

/**
 * The build showcase. Hero featured carousel at top, filter bar, masonry
 * grid below with infinite scroll. Clicking a card opens the full detail
 * modal. The "+ New Build" button opens the builder flow.
 */
export default function WindroseBuildBrowser({ lobbyAccent = ACCENT }: { lobbyAccent?: string }) {
  const accent = lobbyAccent;
  const [featured, setFeatured] = React.useState<Build[]>([]);
  const [builds, setBuilds] = React.useState<Build[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [biome, setBiome] = React.useState<string>("");
  const [buildType, setBuildType] = React.useState<string>("");
  const [sort, setSort] = React.useState<string>("top");
  const [q, setQ] = React.useState<string>("");
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [openSlug, setOpenSlug] = React.useState<string | null>(null);
  const [showBuilder, setShowBuilder] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<any>(null);

  // Featured (one-shot)
  React.useEffect(() => {
    let alive = true;
    fetch(`${API}/windrose/builds/featured`)
      .then(r => r.json())
      .then(j => { if (alive && j?.ok) setFeatured(j.builds || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Open a build deep-link from query string (?build=slug). Used by the
  // server-rendered share page at /windrose/build/[slug] which redirects
  // here with this query param after attaching OpenGraph metadata.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const u = new URL(window.location.href);
      const target = u.searchParams.get("build");
      if (target) setOpenSlug(target);
    } catch {}
  }, []);

  // List (re-fetch on filter/search change with debounce)
  const fetchList = React.useCallback(async (resetOffset: boolean) => {
    const useOffset = resetOffset ? 0 : offset;
    if (resetOffset) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (biome) params.set("biome", biome);
      if (buildType) params.set("buildType", buildType);
      if (sort) params.set("sort", sort);
      if (q) params.set("q", q);
      params.set("limit", String(PAGE_LIMIT));
      params.set("offset", String(useOffset));
      const r = await fetch(`${API}/windrose/builds?${params}`);
      const j = await r.json();
      if (!j?.ok) return;
      if (resetOffset) {
        setBuilds(j.builds || []);
        setOffset((j.builds || []).length);
      } else {
        setBuilds(prev => [...prev, ...(j.builds || [])]);
        setOffset(useOffset + (j.builds || []).length);
      }
      setTotal(j.total || 0);
    } finally {
      if (resetOffset) setLoading(false); else setLoadingMore(false);
    }
  }, [biome, buildType, sort, q, offset]);

  // Reset + refetch when filters change (debounce search)
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { fetchList(true); }, q ? 250 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [biome, buildType, sort, q]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll
  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting) && !loading && !loadingMore && builds.length < total) {
        fetchList(false);
      }
    }, { rootMargin: "200px" });
    obs.observe(node);
    return () => obs.disconnect();
  }, [builds.length, total, loading, loadingMore, fetchList]);

  function handleCreated(slug: string) {
    setShowBuilder(false);
    setOpenSlug(slug);
    // Re-fetch to surface the new build
    setTimeout(() => fetchList(true), 200);
  }

  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: "auto",
      padding: "12px 14px",
      color: "rgba(228,212,176,.92)",
      fontFamily: "inherit",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{
            fontFamily: "var(--font-pirata, 'Pirata One'), serif",
            fontSize: 26, fontWeight: 700,
            color: "#e8c48a",
            letterSpacing: 1,
            lineHeight: 1,
          }}>The Logbook</div>
          <div style={{ fontSize: 11, color: "rgba(228,212,176,.55)", marginTop: 4, letterSpacing: 0.5 }}>
            Captain's logs · {total.toLocaleString()} builds filed
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowBuilder(true)}
          style={{
            padding: "8px 16px",
            background: `linear-gradient(135deg, ${accent} 0%, #e8c48a 100%)`,
            color: "#1a1410",
            border: "1px solid rgba(232,196,138,.85)",
            borderRadius: 4,
            fontSize: 12, fontWeight: 800, letterSpacing: 1,
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 0 12px rgba(232,196,138,.25), inset 0 1px 0 rgba(255,255,255,.25)",
          }}
        >+ File a Log</button>
      </div>

      {/* Featured carousel */}
      {featured.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: "1.4px",
            color: "rgba(232,196,138,.7)",
            textTransform: "uppercase",
            marginBottom: 8,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>★</span> Captain's Picks
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(featured.length, 4)}, minmax(0, 1fr))`,
            gap: 10,
          }}>
            {featured.slice(0, 4).map(b => (
              <WindroseBuildCard key={b.id} build={b} onOpen={setOpenSlug} large />
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
        padding: 10, marginBottom: 12,
        background: "rgba(20,16,8,.5)",
        border: "1px solid rgba(201,160,102,.2)",
        borderRadius: 4,
      }}>
        <span style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 9, fontWeight: 800, letterSpacing: "1.4px",
          color: "rgba(232,196,138,.5)",
          textTransform: "uppercase",
          paddingRight: 4,
        }}>// BIOME</span>
        <Chip active={!biome} color={accent} onClick={() => setBiome("")}>All</Chip>
        {BIOMES.map(b => (
          <Chip key={b.id} active={biome === b.id} color={accent} onClick={() => setBiome(biome === b.id ? "" : b.id)}>{b.label}</Chip>
        ))}
        <span style={{ width: 1, height: 18, background: "rgba(201,160,102,.2)", margin: "0 4px" }} />
        <span style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 9, fontWeight: 800, letterSpacing: "1.4px",
          color: "rgba(232,196,138,.5)",
          textTransform: "uppercase",
          paddingRight: 4,
        }}>// TYPE</span>
        <Chip active={!buildType} color={accent} onClick={() => setBuildType("")}>All</Chip>
        {BUILD_TYPES.map(t => (
          <Chip key={t.id} active={buildType === t.id} color={accent} onClick={() => setBuildType(buildType === t.id ? "" : t.id)}>{t.label}</Chip>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          style={{
            padding: "6px 10px",
            background: "rgba(10,8,4,.6)",
            border: "1px solid rgba(201,160,102,.35)",
            color: "rgba(228,212,176,.92)",
            borderRadius: 3,
            fontSize: 12,
            fontFamily: "inherit",
          }}
        >
          <option value="top">Top</option>
          <option value="new">New</option>
          <option value="rising">Rising</option>
          <option value="views">Most Viewed</option>
        </select>
        <input
          placeholder="Search logs…"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{
            flex: 1, minWidth: 180,
            padding: "6px 10px",
            background: "rgba(10,8,4,.6)",
            border: "1px solid rgba(201,160,102,.35)",
            color: "rgba(228,212,176,.92)",
            borderRadius: 3,
            fontSize: 12,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Masonry grid */}
      {loading && builds.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: "rgba(228,212,176,.45)", fontSize: 13 }}>
          Hauling the logbook from below decks…
        </div>
      ) : builds.length === 0 ? (
        <EmptyState onCreate={() => setShowBuilder(true)} accent={accent} />
      ) : (
        <div style={{
          // CSS columns for true masonry
          columnCount: 1,
          columnGap: 12,
          // Responsive column count via inline media-style fallback below
        }} className="windrose-build-masonry">
          <style>{`
            .windrose-build-masonry { column-count: 1; }
            @media (min-width: 520px)  { .windrose-build-masonry { column-count: 2; } }
            @media (min-width: 820px)  { .windrose-build-masonry { column-count: 3; } }
            @media (min-width: 1180px) { .windrose-build-masonry { column-count: 4; } }
            .windrose-build-masonry > * { break-inside: avoid; margin-bottom: 12px; display: block; }
          `}</style>
          {builds.map(b => (
            <WindroseBuildCard key={b.id} build={b} onOpen={setOpenSlug} />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loadingMore && (
        <div style={{ padding: 16, textAlign: "center", color: "rgba(228,212,176,.45)", fontSize: 11 }}>
          Hauling more logs…
        </div>
      )}

      {/* Modals */}
      {openSlug && (
        <WindroseBuildDetail
          slug={openSlug}
          onClose={() => setOpenSlug(null)}
          onDeleted={() => { setOpenSlug(null); fetchList(true); }}
        />
      )}
      {showBuilder && (
        <WindroseBuildBuilder
          onClose={() => setShowBuilder(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

function Chip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 9px",
        borderRadius: 3,
        border: `1px solid ${active ? color : "rgba(201,160,102,.18)"}`,
        background: active ? `${color}28` : "transparent",
        color: active ? "#e8c48a" : "rgba(228,212,176,.7)",
        fontSize: 10, fontWeight: 700,
        letterSpacing: ".5px",
        textTransform: "uppercase",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all .12s",
      }}
    >{children}</button>
  );
}

function EmptyState({ onCreate, accent }: { onCreate: () => void; accent: string }) {
  return (
    <div style={{
      padding: "40px 20px",
      textAlign: "center",
      border: "1px dashed rgba(201,160,102,.3)",
      borderRadius: 6,
      background: "rgba(20,16,8,.3)",
    }}>
      <div style={{
        fontFamily: "var(--font-pirata, 'Pirata One'), serif",
        fontSize: 22, color: "#e8c48a",
        marginBottom: 6,
      }}>The Logbook is empty.</div>
      <div style={{ fontSize: 12, color: "rgba(228,212,176,.6)", marginBottom: 16 }}>
        Be the first to file a log. Show your build, claim a place in the archive.
      </div>
      <button
        type="button"
        onClick={onCreate}
        style={{
          padding: "8px 18px",
          background: `linear-gradient(135deg, ${accent} 0%, #e8c48a 100%)`,
          color: "#1a1410",
          border: "1px solid rgba(232,196,138,.85)",
          borderRadius: 4,
          fontSize: 12, fontWeight: 800, letterSpacing: 1,
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >+ File the First Log</button>
    </div>
  );
}
