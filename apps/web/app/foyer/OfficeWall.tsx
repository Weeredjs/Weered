"use client";

// The office's wall (James 2026-11-12: "Make my office even more versatile.
// Actually have it as an office space. Add a note board, video player or
// youtube. Have it like a space people can walk into."):
// - The screen: a YouTube video everyone in the office watches together. It
//   rides the room's own youtube:* moves, the ones a Weered room's watch-
//   together uses; the server keeps the state and hands it to whoever walks in.
//   The host puts things on and drives it; a visitor watches.
// - The board: James's notes on the wall for every visitor, and a note a
//   visitor leaves for James alone (api lib/officeBoard.ts).

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

const API = "/api";
const SERIF = "Georgia, 'Iowan Old Style', Cambria, 'Times New Roman', serif";
const UIFONT = "'Segoe UI', Inter, system-ui, -apple-system, sans-serif";
const INK_TEXT = "rgba(236,242,250,.95)";
const MUTED_TEXT = "rgba(163,180,202,.72)";
const PAPER = "#F7F4EC";
const PAPER_INK = "#10233F";
const GOLD_GRAD = "linear-gradient(180deg,#D9B878,#C6A15B 55%,#A8853F)";
const GLASS: CSSProperties = {
  background: "rgba(9,23,42,.6)",
  backdropFilter: "blur(18px) saturate(1.25)",
  WebkitBackdropFilter: "blur(18px) saturate(1.25)",
  border: "1px solid rgba(255,255,255,.09)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.07), 0 24px 60px rgba(0,0,0,.4)",
};

// ---------------------------------------------------------------------------
// The screen's state, outside React: the server sends youtube:state the moment
// someone is seated, which can be before the screen has mounted.
// ---------------------------------------------------------------------------
export type YtState = {
  videoId: string;
  playing: boolean;
  position: number;
  updatedAt: number;
} | null;
type Frame = {
  type: string;
  videoId?: string;
  playing?: boolean;
  position?: number;
  updatedAt?: number;
};
type Listener = (f: Frame, s: YtState, local: boolean) => void;

let ytLast: YtState = null;
const ytListeners = new Set<Listener>();

/** Every youtube:* frame the office socket receives, and (local) the host's own moves. */
export function officeYt(f: Frame, local = false): void {
  const now = Date.now();
  if (f.type === "youtube:state") {
    ytLast = f.videoId
      ? {
          videoId: f.videoId,
          playing: !!f.playing,
          position: Number(f.position) || 0,
          updatedAt: Number(f.updatedAt) || now,
        }
      : null;
  } else if (f.type === "youtube:load" && f.videoId) {
    ytLast = { videoId: f.videoId, playing: false, position: 0, updatedAt: now };
  } else if ((f.type === "youtube:play" || f.type === "youtube:pause") && ytLast) {
    ytLast = {
      ...ytLast,
      playing: f.type === "youtube:play",
      position: Number(f.position) || 0,
      updatedAt: now,
    };
  } else if (f.type === "youtube:stop") {
    ytLast = null;
  } else {
    return;
  }
  ytListeners.forEach((fn) => fn(f, ytLast, local));
}

/** What's on the screen now, as far as this page knows. */
export function officeYtNow(): YtState {
  return ytLast;
}

/** Leaving the office: the next visit starts from what the server says. */
export function resetOfficeYt(): void {
  ytLast = null;
}

/** A YouTube link (watch, youtu.be, shorts, embed, live) or a bare id, to its id. */
export function youtubeId(input: string): string | null {
  const s = String(input || "").trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      id = url.searchParams.get("v");
      const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      if (!id && m) id = m[2];
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function loadYtApi(onReady: () => void): () => void {
  const w = window as any;
  if (w.YT?.Player) {
    onReady();
    return () => {};
  }
  if (!document.getElementById("yt-iframe-api")) {
    const s = document.createElement("script");
    s.id = "yt-iframe-api";
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }
  const t = setInterval(() => {
    if (w.YT?.Player) {
      clearInterval(t);
      onReady();
    }
  }, 200);
  return () => clearInterval(t);
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------
function OfficeScreen({ host, send }: { host: boolean; send: (f: Frame) => void }) {
  const [videoId, setVideoId] = useState<string | null>(ytLast?.videoId ?? null);
  const [apiReady, setApiReady] = useState(false);
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const holder = useRef<HTMLDivElement | null>(null);
  const player = useRef<any>(null);
  const playerVideo = useRef<string | null>(null);
  const syncing = useRef(false);
  const startOnReady = useRef(false);
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => loadYtApi(() => setApiReady(true)), []);

  const hold = (ms: number) => {
    syncing.current = true;
    setTimeout(() => {
      syncing.current = false;
    }, ms);
  };

  // Bring the player to a state: the position it should be at by now, playing or not.
  const apply = useCallback((s: YtState) => {
    const p = player.current;
    if (!p?.seekTo || !s || s.videoId !== playerVideo.current) return;
    hold(700);
    const target = s.position + (s.playing ? Math.max(0, Date.now() - s.updatedAt) / 1000 : 0);
    const cur = p.getCurrentTime?.() ?? 0;
    if (Math.abs(cur - target) > 2) p.seekTo(target, true);
    if (s.playing) p.playVideo?.();
    else p.pauseVideo?.();
  }, []);

  // One player while something is on; a new video loads into it.
  useEffect(() => {
    if (!apiReady || !videoId || !holder.current) return;
    if (player.current) {
      if (playerVideo.current !== videoId) {
        playerVideo.current = videoId;
        // The host's new video starts, and that start is the room's play; a
        // visitor's waits for it.
        if (host) player.current.loadVideoById?.(videoId);
        else {
          hold(900);
          player.current.cueVideoById?.(videoId);
        }
      }
      return;
    }
    const el = document.createElement("div");
    holder.current.appendChild(el);
    playerVideo.current = videoId;
    const YT = (window as any).YT;
    player.current = new YT.Player(el, {
      width: "100%",
      height: "100%",
      videoId,
      playerVars: { autoplay: 0, controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onReady: () => {
          if (host && startOnReady.current) {
            startOnReady.current = false;
            player.current?.playVideo?.();
          } else {
            apply(ytLast);
          }
        },
        // Only the host's player speaks for the room; a visitor's pause is their own.
        onStateChange: (e: any) => {
          if (!host || syncing.current) return;
          const S = (window as any).YT?.PlayerState;
          const position = player.current?.getCurrentTime?.() ?? 0;
          let f: Frame | null = null;
          if (e.data === S?.PLAYING) f = { type: "youtube:play", position };
          else if (e.data === S?.PAUSED) f = { type: "youtube:pause", position };
          if (f) {
            sendRef.current(f);
            officeYt(f, true);
          }
        },
      },
    });
  }, [apiReady, videoId, host, apply]);

  // Nothing on: the player goes, the wall stays.
  useEffect(() => {
    if (videoId) return;
    const p = player.current;
    player.current = null;
    playerVideo.current = null;
    try {
      p?.destroy?.();
    } catch {}
    if (holder.current) holder.current.innerHTML = "";
  }, [videoId]);

  useEffect(
    () => () => {
      try {
        player.current?.destroy?.();
      } catch {}
      player.current = null;
    },
    [],
  );

  useEffect(() => {
    const fn: Listener = (f, s, local) => {
      if (local) return;
      if (f.type === "youtube:stop" || !s) {
        setVideoId(null);
        return;
      }
      if (s.videoId !== playerVideo.current) {
        setVideoId(s.videoId);
        // The new video lands paused; the host's play follows.
        return;
      }
      apply(s);
    };
    ytListeners.add(fn);
    return () => {
      ytListeners.delete(fn);
    };
  }, [apply]);

  const putOn = () => {
    const id = youtubeId(link);
    if (!id) {
      setErr("That doesn't look like a YouTube link.");
      return;
    }
    setErr("");
    setLink("");
    const f = { type: "youtube:load", videoId: id };
    sendRef.current(f);
    officeYt(f, true);
    if (!player.current) startOnReady.current = true;
    setVideoId(id);
  };
  const takeOff = () => {
    const f = { type: "youtube:stop" };
    sendRef.current(f);
    officeYt(f, true);
    setVideoId(null);
  };

  if (!host && !videoId) return null;

  return (
    <section style={{ ...W.panel, flex: videoId ? "2 1 460px" : "1 1 300px" }}>
      <div style={W.head}>
        <span style={W.kicker}>The screen</span>
        {host && videoId && (
          <button style={W.quiet} onClick={takeOff} title="Turn the screen off for everyone">
            Turn it off
          </button>
        )}
      </div>
      <div
        ref={holder}
        style={{
          ...W.tv,
          display: videoId ? "block" : "none",
        }}
      />
      {host && (
        <div style={W.row}>
          <input
            className="fx-input"
            style={W.input}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && putOn()}
            placeholder={videoId ? "Another YouTube link" : "Paste a YouTube link"}
          />
          <button style={W.gold} onClick={putOn}>
            Put it on
          </button>
        </div>
      )}
      {host && !videoId && (
        <p style={W.hint}>Whatever you put on plays for everyone in the office, in step.</p>
      )}
      {err && <p style={{ ...W.hint, color: INK_TEXT }}>{err}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------
type Note = { id: string; body: string; by: string; byId: string; private: boolean; at: number };

function ago(at: number): string {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(at).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function NoteBoard({ host, getToken }: { host: boolean; getToken: () => string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;

  const load = useCallback(async () => {
    const tok = tokenRef.current();
    if (!tok) return;
    try {
      const r = await fetch(`${API}/office/board`, {
        headers: { Authorization: `Bearer ${tok}` },
        cache: "no-store",
      });
      const j = await r.json();
      if (j?.ok && Array.isArray(j.notes)) setNotes(j.notes);
    } catch {}
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  const pin = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`${API}/office/board`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenRef.current()}`,
        },
        body: JSON.stringify({ body }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.note) {
        setNotes((n) => [...n.filter((x) => x.id !== j.note.id), j.note]);
        setText("");
        if (!host) setMsg("Left for James. Only he sees it.");
      } else if (r.status === 429) {
        setMsg("That's a lot of notes. Try again in a few minutes.");
      } else if (j?.error === "board_full") {
        setMsg(host ? "The board is full. Take a note down first." : "The board is full just now.");
      } else {
        setMsg("That didn't stick. Try again.");
      }
    } catch {
      setMsg("That didn't stick. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const takeDown = async (id: string) => {
    setNotes((n) => n.filter((x) => x.id !== id));
    try {
      await fetch(`${API}/office/board/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenRef.current()}` },
      });
    } catch {}
    void load();
  };

  // The wall first, newest on top; notes left for James after.
  const shown = [...notes].sort((a, b) => Number(a.private) - Number(b.private) || b.at - a.at);

  return (
    <section style={{ ...W.panel, flex: "1 1 300px" }}>
      <div style={W.head}>
        <span style={W.kicker}>The board</span>
        {host && notes.some((n) => n.private) && (
          <span style={W.count}>{notes.filter((n) => n.private).length} left for you</span>
        )}
      </div>
      {shown.length === 0 ? (
        <p style={W.hint}>
          {host
            ? "Nothing pinned yet. What should people see when they walk in?"
            : "Nothing pinned up."}
        </p>
      ) : (
        <div style={W.notes}>
          {shown.map((n, i) => {
            const mine = !host && n.private;
            return (
              <article
                key={n.id}
                style={{
                  ...W.note,
                  background: n.private ? "#FBF1CF" : PAPER,
                  transform: `rotate(${i % 3 === 0 ? -0.8 : i % 3 === 1 ? 0.6 : -0.2}deg)`,
                }}
              >
                <span style={W.pin} aria-hidden="true" />
                <p style={W.noteBody}>{n.body}</p>
                <footer style={W.noteFoot}>
                  <span>
                    {n.private
                      ? mine
                        ? "Left for James · only he sees it"
                        : `From ${n.by} · just for you`
                      : n.by}
                    {" · "}
                    {ago(n.at)}
                  </span>
                  {(host || mine) && (
                    <button
                      style={W.x}
                      onClick={() => void takeDown(n.id)}
                      title="Take it down"
                      aria-label="Take this note down"
                    >
                      ×
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
      <div style={W.row}>
        <textarea
          className="fx-input"
          style={{ ...W.input, minHeight: 38, resize: "vertical" }}
          value={text}
          maxLength={400}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void pin();
            }
          }}
          placeholder={host ? "Pin a note for everyone who walks in" : "Leave James a note"}
        />
        <button style={W.gold} onClick={() => void pin()} disabled={busy}>
          {host ? "Pin it" : "Leave it"}
        </button>
      </div>
      {msg && <p style={W.hint}>{msg}</p>}
    </section>
  );
}

export default function OfficeWall({
  host,
  getToken,
  send,
}: {
  host: boolean;
  getToken: () => string;
  /** One of the room's youtube:* moves, out over the office socket. */
  send: (f: Frame) => void;
}) {
  return (
    <div style={W.wall}>
      <OfficeScreen host={host} send={send} />
      <NoteBoard host={host} getToken={getToken} />
    </div>
  );
}

const W: Record<string, CSSProperties> = {
  wall: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" },
  panel: {
    ...GLASS,
    borderRadius: 12,
    padding: "12px 14px 14px",
    minWidth: 0,
    color: INK_TEXT,
    fontFamily: UIFONT,
  },
  head: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    minHeight: 24,
  },
  kicker: {
    fontFamily: UIFONT,
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: ".22em",
    textTransform: "uppercase",
    color: MUTED_TEXT,
  },
  count: { fontFamily: SERIF, fontSize: 13, color: "#D9B878" },
  tv: {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    background: "#000",
    borderRadius: 8,
    overflow: "hidden",
    boxShadow: "0 0 0 1px rgba(255,255,255,.06), 0 14px 40px rgba(0,0,0,.45)",
    marginBottom: 10,
  },
  row: { display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10 },
  input: {
    flex: 1,
    minWidth: 0,
    boxSizing: "border-box",
    padding: "9px 11px",
    borderRadius: 4,
    border: "1px solid #1E3A5F",
    background: "#0A1D35",
    color: INK_TEXT,
    fontSize: 14,
    fontFamily: UIFONT,
  },
  gold: {
    padding: "9px 14px",
    borderRadius: 4,
    border: "1px solid #A8853F",
    background: GOLD_GRAD,
    color: PAPER_INK,
    fontWeight: 600,
    fontSize: 13.5,
    fontFamily: UIFONT,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  quiet: {
    background: "transparent",
    border: "1px solid #1E3A5F",
    borderRadius: 4,
    color: MUTED_TEXT,
    fontSize: 12,
    fontFamily: UIFONT,
    padding: "4px 10px",
    cursor: "pointer",
  },
  hint: { fontSize: 13, color: MUTED_TEXT, margin: "8px 0 0", lineHeight: 1.5 },
  notes: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))",
    gap: 14,
    padding: "6px 2px 4px",
    maxHeight: 360,
    overflow: "auto",
  },
  note: {
    position: "relative",
    color: PAPER_INK,
    borderRadius: 3,
    padding: "16px 12px 8px",
    boxShadow: "0 8px 18px rgba(0,0,0,.35), 0 1px 0 rgba(255,255,255,.6) inset",
    display: "flex",
    flexDirection: "column",
    minHeight: 90,
  },
  pin: {
    position: "absolute",
    top: 5,
    left: "50%",
    width: 9,
    height: 9,
    marginLeft: -4.5,
    borderRadius: "50%",
    background: "radial-gradient(circle at 35% 35%, #F3DCA4, #A8853F 70%)",
    boxShadow: "0 1px 2px rgba(0,0,0,.4)",
  },
  noteBody: {
    margin: 0,
    flex: 1,
    fontFamily: SERIF,
    fontSize: 14.5,
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  noteFoot: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 8,
    fontSize: 11,
    color: "rgba(16,35,63,.6)",
    fontFamily: UIFONT,
  },
  x: {
    background: "transparent",
    border: 0,
    color: "rgba(16,35,63,.55)",
    fontSize: 16,
    lineHeight: 1,
    cursor: "pointer",
    padding: "0 2px",
  },
};
