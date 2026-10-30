"use client";

// One block in the viewer's own Weered: the lobby Design mode's blocks, drawn
// to fit where they sit. In a sidebar a block wears that sidebar's section
// card (so every site theme styles it like its neighbours) and stays compact;
// on Home it is a wide card on the 12-column grid.
import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { BLOCK_META, type ShellBlock, type ShellRegion } from "../../lib/shellLayout";
import { spotifyEmbed, youTubeEmbed } from "../lobby-design/LobbyHomeCanvas";

const RequestBoard = dynamic(() => import("../RequestBoard"), { ssr: false });
const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

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

const lobbyPath = (id: string) => `/lobby/${encodeURIComponent(id)}`;

/** An https link, or "". Settings are drawn as typed while designing, so
 *  every link is checked here before it reaches an href or a src. */
function https(u: unknown): string {
  if (typeof u !== "string" || !u) return "";
  try {
    const x = new URL(u);
    return x.protocol === "https:" ? x.toString() : "";
  } catch {
    return "";
  }
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div className="wsb-hint">{children}</div>;
}

function MiniCountdown({ at }: { at: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Date.parse(at) - now;
  if (!at || Number.isNaN(ms)) return <Hint>Pick a date in Design.</Hint>;
  if (ms <= 0) return <div className="wsb-count-done">It&apos;s on.</div>;
  const s = Math.floor(ms / 1000);
  const parts: [number, string][] = [
    [Math.floor(s / 86400), "days"],
    [Math.floor((s % 86400) / 3600), "hrs"],
    [Math.floor((s % 3600) / 60), "min"],
    [s % 60, "sec"],
  ];
  return (
    <div className="wsb-count">
      {parts.map(([n, l]) => (
        <div key={l}>
          <b>{String(n).padStart(2, "0")}</b>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

function Body({ block, wide }: { block: ShellBlock; wide: boolean }) {
  const p = block.props || {};
  const lobbyId: string = p.lobbyId || "";
  const scope = lobbyId || "lobby";
  const limit = Number(p.limit) || (wide ? 6 : 4);

  const rooms = useJson<any[]>(
    block.type === "rooms" || block.type === "stats"
      ? `${API}/lobbies/${encodeURIComponent(scope)}/rooms`
      : null,
    (j) => (Array.isArray(j?.rooms) ? j.rooms : []),
    [],
    30_000,
  );
  const lobby = useJson<any>(
    block.type === "stats" ? `${API}/lobbies/${encodeURIComponent(scope)}` : null,
    (j) => j?.lobby || null,
    null,
  );
  const events = useJson<any[]>(
    block.type === "events" ? `${API}/lobbies/${encodeURIComponent(scope)}/events?limit=50` : null,
    (j) =>
      (Array.isArray(j?.events) ? j.events : []).filter(
        (e: any) => Date.parse(e.startsAt) >= Date.now() - 3600_000,
      ),
    [],
  );
  const posts = useJson<any[]>(
    block.type === "feed"
      ? `${API}/forum/posts?sort=new&limit=${limit}${lobbyId ? `&lobbyId=${encodeURIComponent(lobbyId)}` : ""}`
      : null,
    (j) => (Array.isArray(j?.posts) ? j.posts : []),
    [],
  );

  switch (block.type) {
    case "welcome": {
      const raw = String(p.href || "");
      const href = raw.startsWith("/") && !raw.startsWith("//") ? raw : https(raw);
      const cta = p.cta ? (
        href.startsWith("/") ? (
          <Link href={href} className="wsb-cta">
            {p.cta} →
          </Link>
        ) : href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="wsb-cta">
            {p.cta} ↗
          </a>
        ) : (
          <span className="wsb-cta">{p.cta}</span>
        )
      ) : null;
      return (
        <div className="wsb-banner" style={{ textAlign: p.align === "center" ? "center" : "left" }}>
          <div className="wsb-banner-title">{p.title || "Welcome back"}</div>
          {p.body && <p className="wsb-banner-body">{p.body}</p>}
          {cta}
        </div>
      );
    }

    case "links": {
      const items = (Array.isArray(p.items) ? p.items : [])
        .map((it: any) => ({ label: String(it?.label || ""), url: https(it?.url) }))
        .filter((it: { url: string }) => it.url);
      if (!items.length) return <Hint>Add your links in Design.</Hint>;
      return (
        <div className="wsb-links">
          {items.map((it: { label: string; url: string }, i: number) => (
            <a key={i} href={it.url} target="_blank" rel="noopener noreferrer">
              {it.label || new URL(it.url).hostname.replace(/^www\./, "")} ↗
            </a>
          ))}
        </div>
      );
    }

    case "rules": {
      const lines = String(p.body || "")
        .split("\n")
        .map((l) => l.trim().replace(/^[-*\d.)\s]+/, ""))
        .filter(Boolean);
      if (!lines.length) return <Hint>One thing per line, in Design.</Hint>;
      return (
        <ol className="wsb-list">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      );
    }

    case "countdown":
      return <MiniCountdown at={p.at} />;

    case "image": {
      const src = https(p.url);
      const link = https(p.link);
      if (!src) return <Hint>Paste an image link in Design.</Hint>;
      // eslint-disable-next-line @next/next/no-img-element
      const img = <img src={src} alt={p.caption || ""} className="wsb-img" />;
      return (
        <figure className="wsb-figure">
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer">
              {img}
            </a>
          ) : (
            img
          )}
          {p.caption && <figcaption>{p.caption}</figcaption>}
        </figure>
      );
    }

    case "stream": {
      if (!p.channel) return <Hint>Set a Twitch channel in Design.</Hint>;
      const parent = typeof window !== "undefined" ? window.location.hostname : "weered.ca";
      return (
        <div className="wsb-embed">
          <iframe
            title={`${p.channel} on Twitch`}
            src={`https://player.twitch.tv/?channel=${encodeURIComponent(p.channel)}&parent=${parent}&muted=true`}
            allowFullScreen
          />
        </div>
      );
    }

    case "video":
    case "music": {
      const src = (block.type === "music" && spotifyEmbed(p.url)) || youTubeEmbed(p.url);
      if (!src)
        return (
          <Hint>
            {block.type === "music"
              ? "Paste a Spotify or YouTube playlist in Design."
              : "Paste a YouTube link in Design."}
          </Hint>
        );
      const spotify = src.includes("spotify.com");
      return (
        <div
          className={spotify ? "wsb-embed wsb-embed-spotify" : "wsb-embed"}
          style={spotify ? { aspectRatio: "auto", height: wide ? 352 : 152 } : undefined}
        >
          <iframe
            title={p.title || "Embedded media"}
            src={src}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      );
    }

    case "rooms": {
      const list = rooms.slice(0, limit);
      if (!list.length) return <Hint>No rooms open there yet.</Hint>;
      return (
        <div className="wsb-rows">
          {list.map((r: any) => {
            const n = Number(r.onlineCount || 0);
            return (
              <Link key={r.id} href={`/room/${encodeURIComponent(r.id)}`} className="wsb-row">
                <span className={n > 0 ? "wsb-dot is-live" : "wsb-dot"} />
                <span className="wsb-row-main">
                  {r.minLevel ? "🔒 " : ""}
                  {r.name}
                </span>
                <span className="wsb-row-side">{n ? `${n} in` : "open"}</span>
              </Link>
            );
          })}
        </div>
      );
    }

    case "events": {
      const list = events.slice(0, limit);
      if (!list.length) return <Hint>Nothing on the calendar there yet.</Hint>;
      return (
        <div className="wsb-rows">
          {list.map((e: any) => {
            const d = new Date(e.startsAt);
            return (
              <Link key={e.id} href={`${lobbyPath(scope)}?view=events`} className="wsb-row">
                <span className="wsb-date">
                  <i>{d.toLocaleDateString(undefined, { month: "short" })}</i>
                  <b>{d.getDate()}</b>
                </span>
                <span className="wsb-row-main">
                  {e.title}
                  <small>
                    {d.toLocaleDateString(undefined, { weekday: "short" })} ·{" "}
                    {d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </small>
                </span>
              </Link>
            );
          })}
        </div>
      );
    }

    case "stats": {
      const online = rooms.reduce((n, r) => n + Number(r.onlineCount || 0), 0);
      const members = lobby?._count?.members ?? lobby?.memberCount;
      return (
        <div className="wsb-stats">
          {(
            [
              [members, "members"],
              [online, "online"],
              [rooms.length, "rooms"],
            ] as [number | undefined, string][]
          ).map(([n, l]) => (
            <div key={l}>
              <b>{n ?? "—"}</b>
              <span>{l}</span>
            </div>
          ))}
        </div>
      );
    }

    case "feed": {
      if (!posts.length) return <Hint>No posts there yet.</Hint>;
      return (
        <div className="wsb-rows">
          {posts.slice(0, limit).map((x: any) => (
            <Link
              key={x.id}
              href={`/forum/${encodeURIComponent(x.id)}`}
              className="wsb-row wsb-post"
            >
              <span className="wsb-row-main">
                {x.title || "Untitled"}
                {wide && x.body && (
                  <small>
                    {String(x.body)
                      .replace(/[#*_>`]/g, "")
                      .slice(0, 160)}
                  </small>
                )}
              </span>
            </Link>
          ))}
        </div>
      );
    }

    case "requests":
      return (
        <RequestBoard
          lobbyId={lobbyId || undefined}
          compact
          limit={limit}
          title={p.title || undefined}
        />
      );
  }
  return null;
}

/** The heading a block shows over itself, or null for the ones that carry their own. */
function blockTitle(b: ShellBlock): string | null {
  const p = b.props || {};
  switch (b.type) {
    case "welcome":
    case "image":
    case "requests":
      return null;
    case "countdown":
      return p.label || "Countdown";
    case "stream":
      return p.channel ? `${p.channel} · live` : "Twitch";
    case "music":
      return p.title || "Soundtrack";
    case "video":
      return p.title || "YouTube";
    case "rules":
      return p.title || "List";
    default:
      return p.title || BLOCK_META[b.type]?.name || null;
  }
}

export default function ShellBlockView({
  block,
  region,
}: {
  block: ShellBlock;
  region: ShellRegion;
}) {
  const wide = region === "home";
  const title = blockTitle(block);
  return (
    <div
      className={`${wide ? "weered-shell-block-home" : "weered-rr-section"} weered-shell-block`}
      data-block={block.type}
    >
      {title && (
        <div>
          <div className="weered-rr-section-title">{title}</div>
        </div>
      )}
      <div className="weered-shell-block-body">
        <div className="wsb">
          <Body block={block} wide={wide} />
        </div>
      </div>
    </div>
  );
}
