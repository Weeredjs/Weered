"use client";
import { useState, useEffect } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import { PAL, S, WR_FONT_DISPLAY, WR_FONT_MONO, apiFetch } from "./WrShared";
import { ModRow } from "./WrStreams";

export function ModsTab() {
  const [mods, setMods] = useState<ModRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"endorsed" | "downloads" | "updated" | "new">("endorsed");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ gameSlug: "windrose", sort, limit: "50" });
    if (search.trim()) params.set("search", search.trim());
    apiFetch(`/mods?${params.toString()}`)
      .then((j: any) => {
        if (cancelled) return;
        setMods(Array.isArray(j?.mods) ? j.mods : []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, sort]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search mods, authors, summaries..."
          style={{ ...S.input, flex: 1, minWidth: 220 }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          style={{ ...S.input, fontFamily: WR_FONT_MONO, minWidth: 130 }}
        >
          <option value="endorsed">Most endorsed</option>
          <option value="downloads">Most downloaded</option>
          <option value="updated">Recently updated</option>
          <option value="new">Newest</option>
        </select>
      </div>

      {loading ? (
        <LoadingState label="Hauling mods from the depths..." />
      ) : mods.length === 0 ? (
        <EmptyState
          icon="🪝"
          title="No mods found"
          hint={
            search ? "Try a different search." : "The poller hasn't surfaced any Windrose mods yet."
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {mods.map((m) => (
            <a
              key={m.id}
              href={m.sourceUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...S.card,
                padding: 0,
                overflow: "hidden",
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  width: "100%",
                  aspectRatio: "16 / 9",
                  background: m.thumbnailUrl
                    ? `url(${m.thumbnailUrl}) center/cover`
                    : `linear-gradient(135deg, ${PAL.stormMid}, ${PAL.stormDeep})`,
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    padding: "2px 7px",
                    background: `${PAL.brass}25`,
                    border: `1px solid ${PAL.brass}80`,
                    color: PAL.brassHi,
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "1px",
                    fontFamily: WR_FONT_MONO,
                  }}
                >
                  {m.source.toUpperCase()}
                </span>
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontFamily: WR_FONT_DISPLAY,
                    fontSize: 14,
                    color: PAL.brassHi,
                    letterSpacing: "0.2px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.name}
                </div>
                {m.author && (
                  <div style={{ fontSize: 11, color: PAL.parchDim, fontStyle: "italic" }}>
                    by {m.author}
                  </div>
                )}
                {m.summary && (
                  <div
                    style={{
                      fontSize: 11,
                      color: PAL.parchment,
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {m.summary}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginTop: "auto",
                    paddingTop: 6,
                    fontFamily: WR_FONT_MONO,
                    fontSize: 10,
                    color: PAL.parchDim,
                  }}
                >
                  <span title="Endorsements">👍 {m.endorsements.toLocaleString()}</span>
                  <span title="Downloads">⬇ {m.downloads.toLocaleString()}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function AboutTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 760 }}>
      <div style={{ ...S.card, padding: "22px 26px" }}>
        <div style={{ ...S.label, marginBottom: 6 }}>The Studio</div>
        <h2
          style={{
            fontFamily: WR_FONT_DISPLAY,
            fontSize: 28,
            color: PAL.brassHi,
            margin: "0 0 10px",
            letterSpacing: "0.5px",
          }}
        >
          Kraken Express
        </h2>
        <p
          style={{
            fontSize: 14,
            color: PAL.parchment,
            lineHeight: 1.7,
            margin: "0 0 10px",
            fontStyle: "italic",
          }}
        >
          Uzbekistan-based indie studio previously known as <em>Windrose Crew</em>, originally{" "}
          <em>Crosswind Crew</em>. Producer Philip Molodkovets delivered the Gamescom 2025 demo and
          has been the studio&apos;s public voice through the pivot.
        </p>
        <p
          style={{
            fontSize: 14,
            color: PAL.parchment,
            lineHeight: 1.7,
            margin: 0,
            fontStyle: "italic",
          }}
        >
          Upcoming:{" "}
          <strong style={{ color: PAL.brassHi, fontStyle: "normal" }}>
            Kraken&apos;s Lair: Battle for the Abyss
          </strong>{" "}
          — a free-to-play underwater multiplayer action game.
        </p>
      </div>

      <div style={{ ...S.card, padding: "22px 26px" }}>
        <div style={{ ...S.label, marginBottom: 6 }}>Windrose</div>
        <h2
          style={{
            fontFamily: WR_FONT_DISPLAY,
            fontSize: 28,
            color: PAL.brassHi,
            margin: "0 0 10px",
            letterSpacing: "0.5px",
          }}
        >
          Build. Sail. Survive.
        </h2>
        <p
          style={{
            fontSize: 14,
            color: PAL.parchment,
            lineHeight: 1.7,
            margin: "0 0 10px",
            fontStyle: "italic",
          }}
        >
          A PvE survival adventure in the Age of Piracy. Procedural open world, soulslite combat,
          naval warfare, base building. Fully playable solo offline or up to 8-player co-op.
          Self-hosted or dedicated servers.
        </p>
        <p
          style={{
            fontSize: 14,
            color: PAL.parchment,
            lineHeight: 1.7,
            margin: 0,
            fontStyle: "italic",
          }}
        >
          The studio has cited Assassin&apos;s Creed IV: Black Flag as the best pirate game of all
          time — and it shows. Originally announced as a free-to-play MMO called <em>Crosswind</em>,
          Kraken Express pivoted to a paid survival adventure. The gamble paid off.
        </p>
      </div>

      <div
        style={{
          ...S.card,
          padding: "22px 26px",
          borderColor: `${PAL.brass}80`,
          background: `
          radial-gradient(ellipse 70% 55% at 50% 0%, rgba(232,196,138,0.10) 0%, transparent 60%),
          linear-gradient(180deg, rgba(30,48,72,0.70) 0%, rgba(20,34,56,0.85) 100%)
        `,
        }}
      >
        <div style={{ ...S.label, marginBottom: 6 }}>Why Weered</div>
        <h3
          style={{
            fontFamily: WR_FONT_DISPLAY,
            fontSize: 22,
            color: PAL.brassHi,
            margin: "0 0 10px",
            letterSpacing: "0.5px",
          }}
        >
          The crew-social layer nobody else built.
        </h3>
        <p
          style={{
            fontSize: 14,
            color: PAL.parchment,
            lineHeight: 1.7,
            margin: "0 0 10px",
            fontStyle: "italic",
          }}
        >
          Windrose&apos;s community shipped incredible infrastructure in the five days since launch:{" "}
          <strong style={{ color: PAL.brassHi, fontStyle: "normal" }}>WindrosePlus</strong> (RCON +
          Lua modding), the{" "}
          <strong style={{ color: PAL.brassHi, fontStyle: "normal" }}>Mod Manager</strong> (SFTP
          deploy to hosted servers), dozens of Nexus mods,{" "}
          <strong style={{ color: PAL.brassHi, fontStyle: "normal" }}>windrose.gaming.tools</strong>{" "}
          (seed-parsed world maps, character builder), and five+ commercial hosts with pre-installed
          mod stacks.
        </p>
        <p
          style={{
            fontSize: 14,
            color: PAL.parchment,
            lineHeight: 1.7,
            margin: 0,
            fontStyle: "italic",
          }}
        >
          No one built the <em>crew-social</em> layer — where to hang out between sessions, find a
          crew, watch a stream together, talk to the dev team. That&apos;s what we do. We respect
          the stack the community already put down.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ ...S.card, padding: 18, textAlign: "center" }}>
          <div style={{ ...S.label, marginBottom: 6 }}>Publisher</div>
          <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 22, color: PAL.brassHi }}>
            Pocketpair
          </div>
          <div style={{ fontSize: 11, color: PAL.parchDim, marginTop: 4, fontStyle: "italic" }}>
            Palworld studio
          </div>
        </div>
        <div style={{ ...S.card, padding: 18, textAlign: "center" }}>
          <div style={{ ...S.label, marginBottom: 6 }}>Platforms</div>
          <div style={{ fontFamily: WR_FONT_DISPLAY, fontSize: 20, color: PAL.brassHi }}>
            Steam · Epic · Stove
          </div>
          <div style={{ fontSize: 11, color: PAL.parchDim, marginTop: 4, fontStyle: "italic" }}>
            Console TBD
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          href="https://store.steampowered.com/app/3041230/Windrose/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...S.btnPrimary, textDecoration: "none" }}
        >
          Steam Store
        </a>
        <a
          href="https://playwindrose.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...S.btn, textDecoration: "none" }}
        >
          playwindrose.com
        </a>
      </div>

      <div
        style={{ fontSize: 10, color: PAL.parchDim, marginTop: 8, lineHeight: 1.5, opacity: 0.7 }}
      >
        Windrose and Kraken Express are trademarks of their respective owners. This is an unofficial
        community hub. Not affiliated with, endorsed by, or officially associated with Kraken
        Express or Pocketpair. If the studio wants anything changed or removed, email
        hello@weered.ca and we&apos;ll act same-day.
      </div>
    </div>
  );
}
