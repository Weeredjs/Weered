"use client";

// The Downgrade (James 2026-11-04: "Oh you like discord? It can downgrade to
// that"): a lobby drawn the way the old place draws a server, as close as we
// can get while keeping their name, logo and font out. Server icons on the
// left, then channels, the chat, and who's online. It runs on the lobby's real
// rooms, chat and presence. #general is the lobby chat; the other text
// channels are read-only, voice channels list who's in them. Styles:
// app/styles/59-familiar.css. Mounted by ./Downgrade.tsx.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRoomMsgs, useWeered, type ChatMsg } from "../WeeredProvider";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type Room = { id: string; name: string; description?: string; defaultModule?: string | null };
type Person = {
  id: string;
  name?: string;
  avatar?: string | null;
  isAway?: boolean;
  roomId?: string;
};
type Lobby = { id: string; name: string; logoUrl?: string | null };

/** Small line icons drawn for this view (no one else's artwork). */
const I = {
  hash: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        d="M9 3 7 21M17 3l-2 18M4 8.5h17M3 15.5h17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  speaker: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path
        d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.5" fill="none" />
    </svg>
  ),
  bubble: (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
      <path
        d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
        fill="currentColor"
      />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  ),
  compass: (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" fill="currentColor" />
    </svg>
  ),
  mic: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M6 11a6 6 0 0 0 12 0M12 17v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ),
  phones: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="3" y="13" width="5" height="7" rx="2" fill="currentColor" />
      <rect x="16" y="13" width="5" height="7" rx="2" fill="currentColor" />
    </svg>
  ),
  cog: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" fill="none" />
      <path
        d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        d="m14 3 7 7-3 1-4 4 .5 4.5L13 21l-4-4-5 5M9 17l-2-2M13 21l-10-10 1.5-1.5L9 10l4-4 1-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <circle cx="9" cy="8" r="3.5" fill="currentColor" />
      <path d="M2.5 19a6.5 6.5 0 0 1 13 0z" fill="currentColor" />
      <circle cx="17" cy="9" r="2.6" fill="currentColor" opacity=".7" />
      <path d="M15.5 13.6A5 5 0 0 1 21.5 18h-4.2" fill="currentColor" opacity=".7" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.2" fill="none" />
      <path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  smile: (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="9" cy="10" r="1.3" fill="currentColor" />
      <circle cx="15" cy="10" r="1.3" fill="currentColor" />
      <path d="M8.5 14.5a4 4 0 0 0 7 0" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ),
  gift: (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <rect
        x="3.5"
        y="9"
        width="17"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M2.5 9h19M12 9v11M12 9S10 4 7.5 5.5 9 9 12 9zm0 0s2-5 4.5-3.5S15 9 12 9z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
    </svg>
  ),
};

/** Discord-style colour for a name, from the name itself. */
const NAME_COLOURS = ["#f2f3f5", "#c27c0e", "#1abc9c", "#e91e63", "#3498db", "#9b59b6", "#f1c40f"];
const nameColour = (n: string) => {
  let h = 0;
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return NAME_COLOURS[h % NAME_COLOURS.length];
};
const initials = (n: string) =>
  n
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

function stamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const day = (x: Date) => x.toDateString();
  if (day(d) === day(now)) return `Today at ${time}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (day(d) === day(y)) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString()} ${time}`;
}

function Face({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="fam-face" src={src} alt="" style={{ width: size, height: size }} />
  ) : (
    <span
      className="fam-face"
      style={{ width: size, height: size, background: nameColour(name), fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}

export default function FamiliarView({
  lobbyId,
  onUpgrade,
}: {
  lobbyId: string;
  /** Back to Weered. */
  onUpgrade: () => void;
}) {
  const ctx: any = useWeered();
  const [lobby, setLobby] = useState<(Lobby & { rooms: Room[] }) | null>(null);
  const [others, setOthers] = useState<Lobby[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [channel, setChannel] = useState("general");
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const msgs: ChatMsg[] = useRoomMsgs(lobbyId) || [];

  // #general is the lobby chat: it is the room the composer sends to.
  useEffect(() => {
    try {
      ctx?.setActiveRoomId?.(lobbyId);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  useEffect(() => {
    let live = true;
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (live && j?.ok && j.lobby)
          setLobby({
            id: j.lobby.id,
            name: j.lobby.name,
            logoUrl: j.lobby.logoUrl,
            rooms: j.lobby.rooms || [],
          });
      })
      .catch(() => {});
    fetch(`${API}/lobbies`)
      .then((r) => r.json())
      .then((j) => {
        if (live && Array.isArray(j?.lobbies))
          setOthers(j.lobbies.filter((l: Lobby) => l.id !== lobbyId && l.logoUrl).slice(0, 7));
      })
      .catch(() => {});
    const loadPeople = () =>
      fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/presence`, { credentials: "include" })
        .then((r) => r.json())
        .then((j) => live && Array.isArray(j?.users) && setPeople(j.users))
        .catch(() => {});
    loadPeople();
    const iv = setInterval(loadPeople, 30_000);
    return () => {
      live = false;
      clearInterval(iv);
    };
  }, [lobbyId]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, channel]);

  const rooms = lobby?.rooms || [];
  const voice = rooms.filter((r) => /voice|video|screen/i.test(String(r.defaultModule || "")));
  const textRooms = rooms.filter((r) => !voice.includes(r));
  const channels = [{ id: "general", name: "general", topic: "The lobby chat." }].concat(
    textRooms
      .filter((r) => r.name.toLowerCase() !== "general")
      .map((r) => ({ id: r.id, name: r.name, topic: r.description || "" })),
  );
  const current = channels.find((c) => c.id === channel) || channels[0]!;
  const onGeneral = current.id === "general";
  const name = String(lobby?.name || "Lobby");
  const me = ctx?.me || null;
  const myName = String(me?.name || me?.username || "Guest");
  const online = people.filter((p) => !p.isAway);
  const idle = people.filter((p) => p.isAway);

  // Messages from one person within seven minutes sit under one header.
  const groups = useMemo(() => {
    const out: { first: ChatMsg; rest: ChatMsg[] }[] = [];
    for (const m of msgs) {
      if (m.kind === "system") continue;
      const last = out[out.length - 1];
      if (
        last &&
        last.first.user?.id === m.user?.id &&
        m.ts - (last.rest.at(-1) || last.first).ts < 7 * 60_000
      )
        last.rest.push(m);
      else out.push({ first: m, rest: [] });
    }
    return out;
  }, [msgs]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !onGeneral) return;
    try {
      ctx?.setActiveRoomId?.(lobbyId);
      ctx?.sendChat?.(text);
    } catch {}
    setText("");
  };

  return (
    <div className="fam" role="application" aria-label={`${name}, the old way`}>
      <nav className="fam-rail" aria-label="Servers">
        <button type="button" className="fam-rail-icon fam-rail-home" title="Direct Messages">
          {I.bubble}
        </button>
        <div className="fam-rail-sep" />
        <div className="fam-rail-item" data-on>
          <span className="fam-rail-pill" />
          {lobby?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="fam-rail-icon" src={lobby.logoUrl} alt={name} title={name} />
          ) : (
            <span className="fam-rail-icon fam-rail-letters" title={name}>
              {initials(name)}
            </span>
          )}
        </div>
        {others.map((l) => (
          <a key={l.id} className="fam-rail-item" href={`/lobby/${l.id}`} title={l.name}>
            <span className="fam-rail-pill" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="fam-rail-icon" src={l.logoUrl!} alt={l.name} />
          </a>
        ))}
        <button type="button" className="fam-rail-icon fam-rail-add" title="Add a Server">
          {I.plus}
        </button>
        <a className="fam-rail-icon fam-rail-add" href="/explore" title="Explore">
          {I.compass}
        </a>
      </nav>

      <aside className="fam-side">
        <header className="fam-side-head">
          <span>{name}</span>
          {I.chevron}
        </header>
        <div className="fam-channels">
          <div className="fam-cat">
            {I.chevron}
            <span>Text Channels</span>
          </div>
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              className="fam-chan"
              data-on={c.id === current.id || undefined}
              onClick={() => setChannel(c.id)}
            >
              {I.hash}
              <span>{c.name}</span>
            </button>
          ))}
          {voice.length > 0 && (
            <div className="fam-cat">
              {I.chevron}
              <span>Voice Channels</span>
            </div>
          )}
          {voice.map((r) => {
            const inside = people.filter((p) => p.roomId === r.id);
            return (
              <div key={r.id}>
                <button type="button" className="fam-chan">
                  {I.speaker}
                  <span>{r.name}</span>
                </button>
                {inside.map((p) => (
                  <div key={p.id} className="fam-voice-user">
                    <Face name={p.name || "?"} src={p.avatar} size={24} />
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <footer className="fam-me">
          <span className="fam-me-face">
            <Face name={myName} src={me?.avatar} size={32} />
            <span className="fam-dot" />
          </span>
          <span className="fam-me-words">
            <b>{myName}</b>
            <span>Online</span>
          </span>
          <span className="fam-me-icons">
            <button type="button" aria-label="Mute">
              {I.mic}
            </button>
            <button type="button" aria-label="Deafen">
              {I.phones}
            </button>
            <button type="button" aria-label="User Settings">
              {I.cog}
            </button>
          </span>
        </footer>
      </aside>

      <main className="fam-chat">
        <header className="fam-chat-head">
          <span className="fam-chat-hash">{I.hash}</span>
          <b>{current.name}</b>
          {current.topic && (
            <>
              <span className="fam-divider" />
              <span className="fam-topic">{current.topic}</span>
            </>
          )}
          <span className="fam-head-icons">
            <span>{I.bell}</span>
            <span>{I.pin}</span>
            <span>{I.people}</span>
            <span className="fam-search">
              Search
              {I.search}
            </span>
          </span>
        </header>

        <div className="fam-messages" ref={listRef}>
          <div className="fam-welcome">
            <span className="fam-welcome-hash">{I.hash}</span>
            <h2>Welcome to #{current.name}!</h2>
            <p>This is the start of the #{current.name} channel.</p>
          </div>
          {onGeneral &&
            groups.map((g) => {
              const who = String(g.first.user?.name || "Someone");
              return (
                <div key={g.first.id} className="fam-msg">
                  <Face name={who} src={(g.first.user as any)?.avatar} />
                  <div className="fam-msg-body">
                    <div className="fam-msg-head">
                      <b style={{ color: nameColour(who) }}>{who}</b>
                      <time>{stamp(g.first.ts)}</time>
                    </div>
                    {[g.first, ...g.rest].map((m) => (
                      <p key={m.id}>{m.body}</p>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>

        <form className="fam-compose" onSubmit={send}>
          {onGeneral ? (
            <>
              <span className="fam-compose-plus">{I.plus}</span>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Message #${current.name}`}
                aria-label={`Message #${current.name}`}
                maxLength={2000}
              />
              <span className="fam-compose-icons">
                {I.gift}
                <span className="fam-gif">GIF</span>
                {I.smile}
              </span>
            </>
          ) : (
            <span className="fam-readonly">
              You do not have permission to send messages in this channel.
            </span>
          )}
        </form>

        <button type="button" className="fam-upgrade" onClick={onUpgrade}>
          ⬆ Upgrade back to Weered
        </button>
      </main>

      <aside className="fam-members" aria-label="Members">
        <div className="fam-members-head">Online — {online.length}</div>
        {online.map((p) => (
          <div key={p.id} className="fam-member">
            <span className="fam-me-face">
              <Face name={p.name || "?"} src={p.avatar} size={32} />
              <span className="fam-dot" />
            </span>
            <span style={{ color: nameColour(p.name || "?") }}>{p.name}</span>
          </div>
        ))}
        {idle.length > 0 && <div className="fam-members-head">Idle — {idle.length}</div>}
        {idle.map((p) => (
          <div key={p.id} className="fam-member" data-idle>
            <span className="fam-me-face">
              <Face name={p.name || "?"} src={p.avatar} size={32} />
              <span className="fam-dot fam-dot-idle" />
            </span>
            <span>{p.name}</span>
          </div>
        ))}
      </aside>
    </div>
  );
}
