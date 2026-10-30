"use client";

// The Home tab of a designed lobby: a 12-column canvas of blocks. In Design
// mode the same canvas is the editing surface — blocks show an outline, can be
// selected, dragged to reorder, resized and removed — so what the owner edits
// is exactly what members see.
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Block, LobbyLayout, TabId } from "../../lib/lobbyLayout";
import { SIZE_SPAN, BLOCK_CATALOG } from "../../lib/lobbyLayout";

const RequestBoard = dynamic(() => import("../RequestBoard"), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type Room = {
  id: string;
  name: string;
  description?: string;
  onlineCount?: number;
  minLevel?: number;
  locked?: boolean;
};

function useJson<T>(url: string | null, pick: (j: any) => T, fallback: T, refreshMs = 0): T {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => {
    if (!url) return;
    let dead = false;
    const load = () =>
      fetch(url, { credentials: "include" })
        .then((r) => r.json())
        .then((j) => !dead && setV(pick(j)))
        .catch(() => {});
    load();
    const t = refreshMs ? setInterval(load, refreshMs) : null;
    return () => {
      dead = true;
      if (t) clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, refreshMs]);
  return v;
}

export type CanvasProps = {
  lobbyId: string;
  layout: LobbyLayout;
  accent: string;
  displayFont: string;
  counts?: { members?: number; rooms?: number };
  gameEl?: React.ReactNode;
  onNavigate: (tab: TabId) => void;
  designing?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMove?: (fromId: string, toId: string) => void;
  onDropNew?: (type: string, beforeId: string | null) => void;
};

export default function LobbyHomeCanvas(p: CanvasProps) {
  const { layout, designing } = p;
  const [dragOver, setDragOver] = useState<string | null>(null);
  const rooms = useJson<Room[]>(
    `${API}/lobbies/${encodeURIComponent(p.lobbyId)}/rooms`,
    (j) => (Array.isArray(j?.rooms) ? j.rooms : []),
    [],
    30_000,
  );
  const ordered = useMemo(() => {
    const order = layout.roomOrder || [];
    const rank = (id: string) => {
      const i = order.indexOf(id);
      return i < 0 ? 1e6 : i;
    };
    return [...rooms].sort((a, b) => rank(a.id) - rank(b.id));
  }, [rooms, layout.roomOrder]);

  const blocks = layout.blocks;

  if (!blocks.length) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "var(--weered-muted, rgba(243,244,246,.6))",
        }}
      >
        {designing
          ? "Empty canvas. Drag a block in from the left, or click one to add it."
          : "Nothing here yet."}
      </div>
    );
  }

  const drop = (e: React.DragEvent, beforeId: string | null) => {
    e.preventDefault();
    setDragOver(null);
    const moving = e.dataTransfer.getData("text/x-weered-block");
    const fresh = e.dataTransfer.getData("text/x-weered-new");
    if (moving && beforeId && moving !== beforeId) p.onMove?.(moving, beforeId);
    else if (moving && !beforeId) p.onMove?.(moving, "__end");
    else if (fresh) p.onDropNew?.(fresh, beforeId);
  };

  return (
    <div
      className="weered-home-canvas"
      onDragOver={designing ? (e) => e.preventDefault() : undefined}
      onDrop={designing ? (e) => drop(e, null) : undefined}
      onClick={designing ? () => p.onSelect?.(null) : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        gap: 14,
        padding: designing ? "18px 18px 120px" : 18,
        alignContent: "start",
        position: "relative",
        zIndex: 1,
      }}
    >
      {blocks.map((b, i) => {
        const selected = designing && p.selectedId === b.id;
        return (
          <section
            key={b.id}
            draggable={designing}
            onDragStart={
              designing
                ? (e) => {
                    e.dataTransfer.setData("text/x-weered-block", b.id);
                    e.dataTransfer.effectAllowed = "move";
                  }
                : undefined
            }
            onDragOver={
              designing
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOver(b.id);
                  }
                : undefined
            }
            onDragLeave={designing ? () => setDragOver((d) => (d === b.id ? null : d)) : undefined}
            onDrop={
              designing
                ? (e) => {
                    e.stopPropagation();
                    drop(e, b.id);
                  }
                : undefined
            }
            onClick={
              designing
                ? (e) => {
                    e.stopPropagation();
                    p.onSelect?.(b.id);
                  }
                : undefined
            }
            className={`weered-block weered-block-${b.type}`}
            style={{
              gridColumn: `span ${SIZE_SPAN[b.size]}`,
              position: "relative",
              minWidth: 0,
              borderRadius: 14,
              background: "rgba(10,10,16,.55)",
              backdropFilter: "blur(6px)",
              border: selected
                ? `2px solid ${p.accent}`
                : designing
                  ? "1px dashed rgba(255,255,255,.22)"
                  : "1px solid rgba(255,255,255,.08)",
              boxShadow:
                dragOver === b.id
                  ? `inset 4px 0 0 ${p.accent}, 0 0 0 1px ${p.accent}66`
                  : selected
                    ? `0 0 0 4px ${p.accent}33`
                    : "0 10px 30px rgba(0,0,0,.25)",
              cursor: designing ? "grab" : undefined,
              overflow: "hidden",
              animation: `weeredBlockIn .45s ${Math.min(i, 8) * 0.05}s both`,
            }}
          >
            {designing && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  zIndex: 5,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: selected ? p.accent : "rgba(0,0,0,.6)",
                  color: selected ? "#0b0b0f" : "rgba(255,255,255,.7)",
                  pointerEvents: "none",
                }}
              >
                {BLOCK_CATALOG.find((c) => c.type === b.type)?.name || b.type}
              </div>
            )}
            <div style={{ pointerEvents: designing ? "none" : undefined }}>
              <BlockBody block={b} rooms={ordered} {...p} />
            </div>
          </section>
        );
      })}
      <style>{`
        @keyframes weeredBlockIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
        @media (max-width: 760px) { .weered-home-canvas > section { grid-column: span 12 !important; } }
      `}</style>
    </div>
  );
}

function Title({
  children,
  font,
  accent,
}: {
  children: React.ReactNode;
  font: string;
  accent: string;
}) {
  return (
    <div
      style={{
        fontFamily: font,
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: accent,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

export function youTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const list = u.searchParams.get("list");
    let id = "";
    if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
    else if (u.pathname.startsWith("/watch")) id = u.searchParams.get("v") || "";
    else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] || "";
    else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2] || "";
    if (id) return `https://www.youtube-nocookie.com/embed/${id}${list ? `?list=${list}` : ""}`;
    if (list) return `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`;
  } catch {}
  return null;
}

export function spotifyEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("spotify.com")) return null;
    const m = u.pathname.match(/\/(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/);
    return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
}

export function Countdown({ at }: { at: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Date.parse(at) - now;
  if (!at || Number.isNaN(ms))
    return <div style={{ opacity: 0.6 }}>Set a date in Design mode.</div>;
  if (ms <= 0) return <div style={{ fontSize: 28, fontWeight: 900 }}>It's on.</div>;
  const s = Math.floor(ms / 1000);
  const parts = [
    [Math.floor(s / 86400), "days"],
    [Math.floor((s % 86400) / 3600), "hrs"],
    [Math.floor((s % 3600) / 60), "min"],
    [s % 60, "sec"],
  ] as const;
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {parts.map(([n, l]) => (
        <div key={l} style={{ textAlign: "center", minWidth: 46 }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 900,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {String(n).padStart(2, "0")}
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              opacity: 0.6,
            }}
          >
            {l}
          </div>
        </div>
      ))}
    </div>
  );
}

function BlockBody({ block, rooms, ...p }: CanvasProps & { block: Block; rooms: Room[] }) {
  const { accent, displayFont: font } = p;
  const pr = block.props || {};
  const pad: React.CSSProperties = { padding: 18 };
  const lobby = encodeURIComponent(p.lobbyId);

  // Upcoming only (from an hour ago, fixed for this mount): the oldest 50
  // left a lobby with a long past showing an empty calendar.
  const [since] = useState(() => new Date(Date.now() - 3600_000).toISOString());
  const events = useJson<any[]>(
    block.type === "events"
      ? `${API}/lobbies/${lobby}/events?limit=50&from=${encodeURIComponent(since)}`
      : null,
    (j) =>
      (Array.isArray(j?.events) ? j.events : [])
        .filter((e: any) => Date.parse(e.startsAt) >= Date.now() - 3600_000)
        .slice(0, pr.limit || 5),
    [],
  );
  const posts = useJson<any[]>(
    block.type === "feed"
      ? `${API}/forum/posts?lobbyId=${lobby}&sort=new&limit=${pr.limit || 5}`
      : null,
    (j) => (Array.isArray(j?.posts) ? j.posts : []),
    [],
  );

  switch (block.type) {
    case "welcome":
      return (
        <div
          style={{
            ...pad,
            padding: "34px 28px",
            textAlign: pr.align === "center" ? "center" : "left",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: "clamp(26px, 4vw, 44px)",
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-.01em",
              color: "#fff",
              textShadow: `0 0 28px ${accent}99, 0 2px 0 ${accent}55`,
            }}
          >
            {pr.title || "Welcome in"}
          </div>
          {pr.body && (
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 15,
                lineHeight: 1.55,
                opacity: 0.82,
                whiteSpace: "pre-wrap",
                maxWidth: 680,
                marginInline: pr.align === "center" ? "auto" : undefined,
              }}
            >
              {pr.body}
            </p>
          )}
          {pr.cta && (
            <button
              onClick={() => p.onNavigate(pr.ctaTab || "rooms")}
              style={{
                marginTop: 18,
                padding: "11px 20px",
                borderRadius: 10,
                border: "none",
                background: accent,
                color: "#0b0b0f",
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: `0 8px 24px ${accent}55`,
              }}
            >
              {pr.cta} →
            </button>
          )}
        </div>
      );

    case "rooms":
      return (
        <div style={pad}>
          <Title font={font} accent={accent}>
            {pr.title || "Rooms"}
          </Title>
          <div style={{ display: "grid", gap: 8 }}>
            {rooms.slice(0, pr.limit || 6).map((r) => (
              <a
                key={r.id}
                href={`/room/${encodeURIComponent(r.id)}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.06)",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: (r.onlineCount || 0) > 0 ? "#22c55e" : "rgba(255,255,255,.2)",
                    boxShadow: (r.onlineCount || 0) > 0 ? "0 0 8px #22c55e" : "none",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.minLevel ? "🔒 " : ""}
                  {r.name}
                </span>
                <span style={{ fontSize: 12, opacity: 0.6 }}>
                  {r.onlineCount ? `${r.onlineCount} in` : "open"}
                </span>
              </a>
            ))}
            {!rooms.length && <div style={{ opacity: 0.6, fontSize: 13 }}>No rooms yet.</div>}
          </div>
        </div>
      );

    case "events":
      return (
        <div style={pad}>
          <Title font={font} accent={accent}>
            {pr.title || "Up next"}
          </Title>
          <div style={{ display: "grid", gap: 8 }}>
            {events.map((e: any) => {
              const d = new Date(e.startsAt);
              return (
                <button
                  key={e.id}
                  onClick={() => p.onNavigate("events")}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    textAlign: "left",
                    padding: 10,
                    borderRadius: 10,
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid rgba(255,255,255,.06)",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      textAlign: "center",
                      flexShrink: 0,
                      borderRadius: 8,
                      background: `${accent}22`,
                      padding: "4px 0",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        color: accent,
                      }}
                    >
                      {d.toLocaleDateString(undefined, { month: "short" })}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>
                      {d.getDate()}
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.title}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>
                      {d.toLocaleDateString(undefined, { weekday: "long" })} ·{" "}
                      {d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                </button>
              );
            })}
            {!events.length && (
              <div style={{ opacity: 0.6, fontSize: 13 }}>Nothing on the calendar yet.</div>
            )}
          </div>
        </div>
      );

    case "feed":
      return (
        <div style={pad}>
          <Title font={font} accent={accent}>
            {pr.title || "Latest"}
          </Title>
          <div style={{ display: "grid", gap: 8 }}>
            {posts.map((x: any) => (
              <button
                key={x.id}
                onClick={() => p.onNavigate("feed")}
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderRadius: 10,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.06)",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14 }}>{x.title || "Untitled"}</div>
                {x.body && (
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.65,
                      marginTop: 3,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {String(x.body).replace(/[#*_>`]/g, "")}
                  </div>
                )}
              </button>
            ))}
            {!posts.length && <div style={{ opacity: 0.6, fontSize: 13 }}>No posts yet.</div>}
          </div>
        </div>
      );

    case "game":
      return p.gameEl ? (
        <div style={{ height: 620, display: "flex", flexDirection: "column", overflow: "auto" }}>
          {p.gameEl}
        </div>
      ) : (
        <div style={{ ...pad, opacity: 0.7 }}>
          This lobby has no game integration yet. Pick one when you create a lobby, or request your
          game on the request board.
        </div>
      );

    case "stream": {
      if (!pr.channel)
        return <div style={{ ...pad, opacity: 0.6 }}>Set a Twitch channel in Design mode.</div>;
      const parent = typeof window !== "undefined" ? window.location.hostname : "weered.ca";
      return (
        <div style={{ aspectRatio: "16 / 9", width: "100%" }}>
          <iframe
            title={`${pr.channel} on Twitch`}
            src={`https://player.twitch.tv/?channel=${encodeURIComponent(pr.channel)}&parent=${parent}&muted=true`}
            allowFullScreen
            style={{ width: "100%", height: "100%", border: 0 }}
          />
        </div>
      );
    }

    case "video":
    case "music": {
      const src = (block.type === "music" && spotifyEmbed(pr.url)) || youTubeEmbed(pr.url);
      if (!src)
        return (
          <div style={{ ...pad, opacity: 0.6 }}>
            {block.type === "music"
              ? "Paste a Spotify or YouTube playlist link in Design mode."
              : "Paste a YouTube link in Design mode."}
          </div>
        );
      const spotify = src.includes("spotify.com");
      return (
        <div>
          {pr.title && (
            <div style={{ padding: "14px 18px 0" }}>
              <Title font={font} accent={accent}>
                {pr.title}
              </Title>
            </div>
          )}
          <div style={spotify ? { height: 352 } : { aspectRatio: "16 / 9" }}>
            <iframe
              title={pr.title || "Embedded media"}
              src={src}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              loading="lazy"
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          </div>
        </div>
      );
    }

    case "image": {
      if (!pr.url)
        return <div style={{ ...pad, opacity: 0.6 }}>Paste an image link in Design mode.</div>;
      const img = (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pr.url}
          alt={pr.caption || ""}
          style={{ width: "100%", display: "block", objectFit: "cover", maxHeight: 520 }}
        />
      );
      return (
        <figure style={{ margin: 0 }}>
          {pr.link ? (
            <a href={pr.link} target="_blank" rel="noopener noreferrer">
              {img}
            </a>
          ) : (
            img
          )}
          {pr.caption && (
            <figcaption style={{ padding: "10px 14px", fontSize: 13, opacity: 0.75 }}>
              {pr.caption}
            </figcaption>
          )}
        </figure>
      );
    }

    case "links":
      return (
        <div style={pad}>
          <Title font={font} accent={accent}>
            {pr.title || "Links"}
          </Title>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(pr.items || []).map((it: any, i: number) => (
              <a
                key={i}
                href={it.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: `1px solid ${accent}55`,
                  background: `${accent}14`,
                  color: "inherit",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {it.label || it.url} ↗
              </a>
            ))}
            {!(pr.items || []).length && (
              <div style={{ opacity: 0.6, fontSize: 13 }}>Add links in Design mode.</div>
            )}
          </div>
        </div>
      );

    case "countdown":
      return (
        <div style={pad}>
          <Title font={font} accent={accent}>
            {pr.label || "Countdown"}
          </Title>
          <Countdown at={pr.at} />
        </div>
      );

    case "stats": {
      const online = rooms.reduce((n, r) => n + (r.onlineCount || 0), 0);
      const stat = (n: number | undefined, l: string) => (
        <div>
          <div
            style={{
              fontFamily: font,
              fontSize: 30,
              fontWeight: 900,
              lineHeight: 1,
              color: "#fff",
            }}
          >
            {n ?? "—"}
          </div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              opacity: 0.6,
              marginTop: 4,
            }}
          >
            {l}
          </div>
        </div>
      );
      return (
        <div style={pad}>
          <Title font={font} accent={accent}>
            {pr.title || "Pulse"}
          </Title>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {stat(p.counts?.members, "members")}
            {stat(online, "online")}
            {stat(rooms.length || p.counts?.rooms, "rooms")}
          </div>
        </div>
      );
    }

    case "requests":
      return (
        <div style={{ ...pad, paddingBottom: 12 }}>
          <RequestBoard
            lobbyId={p.lobbyId}
            compact
            limit={pr.limit || 5}
            accent={accent}
            title={pr.title || undefined}
          />
        </div>
      );

    case "rules":
      return (
        <div style={pad}>
          <Title font={font} accent={accent}>
            {pr.title || "House rules"}
          </Title>
          <ol
            style={{
              margin: 0,
              paddingLeft: 20,
              display: "grid",
              gap: 6,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {String(pr.body || "")
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .map((l, i) => (
                <li key={i}>{l.replace(/^[-*\d.)\s]+/, "")}</li>
              ))}
          </ol>
        </div>
      );
  }
  return null;
}
