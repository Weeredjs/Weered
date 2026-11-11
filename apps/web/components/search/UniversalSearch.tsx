"use client";

// The one search (James 2026-11-06: "Just a search field. No people or rooms.
// Just search that taps into everything"): lobbies, rooms, people, crews and
// forum posts from the API's /search, whoever is in the room you're in first,
// and Weered's own pages and actions ("desktop", "settings", "what can you do
// here"), which is where Home's old header buttons went. The bar at the top of
// every page holds one (components/shell/UniversalBar.tsx) and Home's Search
// tile another. Styled in styles/42-bar.css.

import React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useWeered, useRoomUsers } from "../WeeredProvider";
import { useOverlay } from "../overlays/OverlayProvider";
import { FEEDBACK_EVENT } from "../BugReportButton";
import { startDesign } from "../../lib/shellDesign";
import { avatarFill } from "../../lib/avatarColor";
import { plural } from "../../lib/plural";
import { memberLabel } from "../../lib/socialProof";
import { hideBroken } from "../../lib/sizedImage";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

/** Opens "What can you do here?" wherever the bar is (UniversalBar mounts it). */
export const GUIDE_EVENT = "weered:guide:open";
/** Opens an invite to Weered itself, from the bar. */
export const INVITE_EVENT = "weered:invite:open";

type Lobby = {
  id: string;
  name: string;
  verified?: boolean;
  unlisted?: boolean;
  accentColor?: string | null;
  logoUrl?: string | null;
  members?: number;
};
type Room = {
  id: string;
  name: string;
  locked?: boolean;
  lobby?: { id: string; name: string; accentColor?: string | null; logoUrl?: string | null } | null;
  _count?: { members?: number };
};
type Person = {
  id: string;
  name?: string;
  usernameKey?: string;
  avatar?: string | null;
  avatarColor?: string | null;
  here?: boolean;
};
type Crew = {
  id: string;
  name: string;
  tag?: string;
  tagKey?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
  _count?: { members?: number };
};
type Post = { id: string; title: string; lobbyName?: string | null; commentCount?: number };
type Found = { lobbies: Lobby[]; rooms: Room[]; people: Person[]; crews: Crew[]; posts: Post[] };
const NONE: Found = { lobbies: [], rooms: [], people: [], crews: [], posts: [] };

type Go = {
  id: string;
  label: string;
  sub: string;
  /** Other words someone might type for it. */
  words: string;
  icon: string;
  /** Only for someone signed in. */
  mine?: boolean;
};

// Weered's own pages and actions. The first five are what an empty search offers.
export const GO_TO: Go[] = [
  {
    id: "browse",
    label: "Downtown",
    sub: "Every lobby, the busy ones first",
    words: "downtown browse all lobbies explore discover find city",
    icon: "▦",
  },
  {
    id: "create",
    label: "Create a lobby",
    sub: "Say what you want and it's built",
    words: "create new make build vibe code",
    icon: "+",
  },
  {
    id: "change",
    label: "Change your layout",
    sub: "Move sections, add blocks",
    words: "change design layout customize edit drip",
    icon: "✦",
    mine: true,
  },
  {
    id: "guide",
    label: "What can you do here?",
    sub: "A tour of Weered",
    words: "help guide tour how what",
    icon: "?",
  },
  {
    id: "desktop",
    label: "Desktop app",
    sub: "For Windows, Mac and Linux",
    words: "download windows mac linux install",
    icon: "⤓",
  },
  {
    id: "invite",
    label: "Invite a friend",
    sub: "A link into Weered",
    words: "invite friend link share",
    icon: "+",
    mine: true,
  },
  {
    id: "home",
    label: "Home",
    sub: "Your Home",
    words: "home start",
    icon: "⌂",
  },
  {
    id: "lobby",
    label: "The Lobby",
    sub: "Everyone's rooms and chat",
    words: "lobby main",
    icon: "◫",
  },
  {
    id: "look",
    label: "Your look",
    sub: "Colours, corners, effects",
    words: "look theme colour color appearance palette",
    icon: "◐",
    mine: true,
  },
  {
    id: "settings",
    label: "Settings",
    sub: "Account, privacy, notifications",
    words: "settings account password privacy notifications",
    icon: "⚙",
    mine: true,
  },
  {
    id: "profile",
    label: "Your profile",
    sub: "How others see you",
    words: "profile me card",
    icon: "☺",
    mine: true,
  },
  {
    id: "dms",
    label: "Messages",
    sub: "Your DMs and groups",
    words: "messages dms dm inbox",
    icon: "✉",
    mine: true,
  },
  {
    id: "friends",
    label: "Friends",
    sub: "Who's on",
    words: "friends people",
    icon: "☻",
    mine: true,
  },
  {
    id: "crew",
    label: "Your crew",
    sub: "Crew chat and roster",
    words: "crew clan team",
    icon: "⛨",
    mine: true,
  },
  {
    id: "forum",
    label: "Forum",
    sub: "Bugs, ideas, discussion",
    words: "forum posts board bugs features",
    icon: "☰",
  },
  {
    id: "upgrade",
    label: "Upgrade",
    sub: "Plans and pricing",
    words: "upgrade premium pricing plans subscribe",
    icon: "↑",
  },
  {
    id: "feedback",
    label: "Send feedback",
    sub: "A bug or an idea, straight to us",
    words: "feedback bug report idea suggestion contact",
    icon: "✎",
  },
];

/** The pages and actions a query names, the ones it starts first. */
export function goToFor(q: string, signedIn = true): Go[] {
  const t = q.trim().toLowerCase();
  const open = GO_TO.filter((g) => signedIn || !g.mine);
  if (!t) return open.slice(0, 5);
  const starts = (s: string) => s.split(/\s+/).some((w) => w.startsWith(t));
  const hits = open.filter(
    (g) => g.label.toLowerCase().includes(t) || starts(g.words) || starts(g.label.toLowerCase()),
  );
  return [
    ...hits.filter((g) => g.label.toLowerCase().startsWith(t)),
    ...hits.filter((g) => !g.label.toLowerCase().startsWith(t)),
  ].slice(0, 5);
}

type Item =
  | { kind: "go"; go: Go }
  | { kind: "lobby"; lobby: Lobby }
  | { kind: "room"; room: Room }
  | { kind: "person"; person: Person }
  | { kind: "crew"; crew: Crew }
  | { kind: "post"; post: Post };

const SECTION: Record<Item["kind"], string> = {
  go: "Go to",
  lobby: "Lobbies",
  room: "Rooms",
  person: "People",
  crew: "Crews",
  post: "Posts",
};

const LENS = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.6-3.6" />
  </svg>
);

export default function UniversalSearch({
  variant = "bar",
  placeholder = "Search everything: lobbies, rooms, people, crews, posts",
}: {
  variant?: "bar" | "tile";
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { openSheet } = useOverlay() as any;
  const w = useWeered() as any;
  const here = useRoomUsers(w?.activeRoomId) as any[];
  const listId = React.useId();

  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [idx, setIdx] = React.useState(0);
  const [found, setFound] = React.useState<Found>(NONE);
  const [searching, setSearching] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [at, setAt] = React.useState<React.CSSProperties | null>(null);

  const term = q.trim();

  React.useEffect(() => {
    if (term.length < 2) {
      setFound(NONE);
      setSearching(false);
      return;
    }
    const ctl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/search?q=${encodeURIComponent(term)}`, {
          credentials: "include",
          signal: ctl.signal,
        });
        const j = r.ok ? await r.json() : null;
        if (!ctl.signal.aborted)
          setFound({
            lobbies: j?.lobbies || [],
            rooms: j?.rooms || [],
            people: j?.people || [],
            crews: j?.crews || [],
            posts: j?.posts || [],
          });
      } catch {
      } finally {
        if (!ctl.signal.aborted) setSearching(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [term]);

  // Somewhere new: the list goes.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  // The list hangs off the page itself, under the box, so no tile or sidebar
  // it sits in can clip it or stack over it; it follows the box as things move.
  React.useLayoutEffect(() => {
    if (!open) return;
    let frame = 0;
    const place = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(Math.max(r.width, 300), 620, window.innerWidth - 16);
      setAt({
        top: r.bottom + 6,
        left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - width)),
        width,
        maxHeight: Math.max(160, Math.min(460, window.innerHeight - r.bottom - 18)),
      });
    };
    const soon = (e?: Event) => {
      if (e && listRef.current?.contains(e.target as Node)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("resize", soon);
    window.addEventListener("scroll", soon, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", soon);
      window.removeEventListener("scroll", soon, true);
    };
  }, [open]);

  const items: Item[] = React.useMemo(() => {
    const lower = term.toLowerCase();
    const go = goToFor(term, !!w?.me?.id).map((g) => ({ kind: "go" as const, go: g }));
    if (term.length < 2) return go;
    // Whoever is in the room with you comes first, then everyone else.
    const nearby: Person[] = lower
      ? (here || [])
          .filter((u) =>
            String(u?.name || "")
              .toLowerCase()
              .includes(lower),
          )
          .map((u) => ({
            id: String(u.id),
            name: u.name,
            avatar: u.avatar,
            avatarColor: u.avatarColor,
            here: true,
          }))
      : [];
    const seen = new Set(nearby.map((p) => p.id));
    const people = [...nearby, ...found.people.filter((p) => !seen.has(p.id))].slice(0, 6);
    // "settings", "desktop": a page named outright comes before the rest.
    const named =
      lower.length >= 3 && go.length > 0 && go[0].go.label.toLowerCase().startsWith(lower);
    return [
      ...(named ? go : []),
      ...found.lobbies.map((lobby) => ({ kind: "lobby" as const, lobby })),
      ...found.rooms.map((room) => ({ kind: "room" as const, room })),
      ...people.map((person) => ({ kind: "person" as const, person })),
      ...found.crews.map((crew) => ({ kind: "crew" as const, crew })),
      ...found.posts.map((post) => ({ kind: "post" as const, post })),
      ...(named ? [] : go),
    ];
  }, [term, found, here, w?.me?.id]);

  React.useEffect(() => {
    setIdx(0);
  }, [term]);

  // The keys' pick stays in view in a long list.
  React.useEffect(() => {
    listRef.current?.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  function run(go: Go) {
    const dock = (tab: string) =>
      window.dispatchEvent(new CustomEvent("weered:dock:open", { detail: { tab } }));
    switch (go.id) {
      case "browse":
        return window.dispatchEvent(new CustomEvent("weered:lobby:browse"));
      case "create":
        return router.push("/lobby/create");
      case "change":
        // Design lives on Home; from anywhere else, go there with it open.
        if (window.location.pathname === "/home") return startDesign();
        return router.push("/home?design=1");
      case "guide":
        return window.dispatchEvent(new CustomEvent(GUIDE_EVENT));
      case "desktop":
        return router.push("/desktop");
      case "invite":
        return window.dispatchEvent(new CustomEvent(INVITE_EVENT));
      case "home":
        return router.push("/home");
      case "lobby":
        return router.push("/lobby");
      case "look":
        return openSheet?.("settings", { tab: "appearance" });
      case "settings":
        return openSheet?.("settings");
      case "profile":
        return w?.me?.id ? openSheet?.("profile", { userId: String(w.me.id) }) : undefined;
      case "dms":
      case "friends":
      case "crew":
        return dock(go.id);
      case "forum":
        return router.push("/forum");
      case "upgrade":
        return router.push("/subscribe");
      case "feedback":
        return window.dispatchEvent(new Event(FEEDBACK_EVENT));
    }
  }

  function choose(i: number) {
    const it = items[i];
    if (!it) return;
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
    if (it.kind === "go") run(it.go);
    else if (it.kind === "lobby") router.push(`/lobby/${encodeURIComponent(it.lobby.id)}`);
    else if (it.kind === "room") router.push(`/room/${encodeURIComponent(it.room.id)}`);
    else if (it.kind === "person") openSheet?.("profile", { userId: it.person.id });
    else if (it.kind === "crew")
      router.push(`/crew/${encodeURIComponent(it.crew.tagKey || it.crew.id)}`);
    else router.push(`/forum/${encodeURIComponent(it.post.id)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const last = Math.max(0, items.length - 1);
      setIdx((c) => (e.key === "ArrowDown" ? Math.min(c + 1, last) : Math.max(0, c - 1)));
      return;
    }
    if (e.key === "Enter" && open && items.length) {
      e.preventDefault();
      choose(idx);
    }
  }

  const showList = open && (items.length > 0 || term.length >= 2);

  return (
    <div ref={boxRef} className={`weered-find is-${variant}`}>
      <span className="weered-find-lens" aria-hidden>
        {LENS}
      </span>
      <input
        ref={inputRef}
        className="weered-input weered-find-input"
        data-weered-search
        role="combobox"
        aria-label="Search everything"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && items[idx] ? `${listId}-${idx}` : undefined}
        value={q}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {searching && <span className="weered-find-busy" aria-hidden />}
      {showList &&
        at &&
        createPortal(
          <div
            ref={listRef}
            className={`weered-find-list is-${variant}`}
            id={listId}
            role="listbox"
            style={at}
          >
            {items.map((it, i) => (
              <React.Fragment key={`${it.kind}-${keyOf(it)}`}>
                {(i === 0 || items[i - 1].kind !== it.kind) && (
                  <div className="weered-find-section" role="presentation">
                    {term.length < 2 && it.kind === "go" ? "Jump to" : SECTION[it.kind]}
                  </div>
                )}
                <Row
                  id={`${listId}-${i}`}
                  item={it}
                  active={i === idx}
                  onHover={() => setIdx(i)}
                  onPick={() => choose(i)}
                />
              </React.Fragment>
            ))}
            {term.length >= 2 && !searching && !items.some((it) => it.kind !== "go") && (
              <div className="weered-find-none">Nothing on Weered called “{term}” yet.</div>
            )}
            {term.length >= 2 && searching && !items.some((it) => it.kind !== "go") && (
              <div className="weered-find-none">Searching…</div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

function keyOf(it: Item): string {
  switch (it.kind) {
    case "go":
      return it.go.id;
    case "lobby":
      return it.lobby.id;
    case "room":
      return it.room.id;
    case "person":
      return it.person.id;
    case "crew":
      return it.crew.id;
    case "post":
      return it.post.id;
  }
}

function Row({
  id,
  item,
  active,
  onHover,
  onPick,
}: {
  id: string;
  item: Item;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  let pic: React.ReactNode;
  let name: string;
  let sub: string;
  let tint: string | null | undefined;
  let round = false;
  switch (item.kind) {
    case "go":
      pic = item.go.icon;
      name = item.go.label;
      sub = item.go.sub;
      break;
    case "lobby":
      pic = <Logo src={item.lobby.logoUrl} name={item.lobby.name} />;
      name = item.lobby.name;
      sub = item.lobby.unlisted
        ? "Unlisted · by link only"
        : [item.lobby.verified ? "✓ Verified" : "Lobby", memberLabel(item.lobby.members)]
            .filter(Boolean)
            .join(" · ");
      tint = item.lobby.accentColor;
      break;
    case "room":
      pic = item.room.locked ? "🔒" : "#";
      name = item.room.name;
      sub = item.room.lobby?.name ? `in ${item.room.lobby.name}` : "Room";
      tint = item.room.lobby?.accentColor;
      break;
    case "person": {
      const who = item.person.name || item.person.usernameKey || "?";
      round = true;
      pic = item.person.avatar ? (
        <img src={item.person.avatar} alt="" onError={hideBroken} />
      ) : (
        who.charAt(0).toUpperCase()
      );
      tint = item.person.avatar
        ? null
        : avatarFill(false, who, false, item.person.avatarColor || null);
      name = who;
      sub = item.person.here
        ? "Here now"
        : item.person.usernameKey
          ? `@${item.person.usernameKey}`
          : "Person";
      break;
    }
    case "crew":
      pic = <Logo src={item.crew.logoUrl} name={item.crew.tagKey || item.crew.name} />;
      name = item.crew.name;
      sub = `${item.crew.tagKey ? `[${item.crew.tagKey}] · ` : ""}${plural(item.crew._count?.members ?? 0, "member")}`;
      tint = item.crew.accentColor;
      break;
    case "post":
      pic = "❝";
      name = item.post.title;
      sub = `${item.post.lobbyName ? `${item.post.lobbyName} · ` : "Forum · "}${plural(item.post.commentCount ?? 0, "reply", "replies")}`;
      break;
  }
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      tabIndex={-1}
      className={`weered-find-row${active ? " is-active" : ""}`}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
    >
      <span
        className={`weered-find-pic${round ? " is-round" : ""}`}
        style={tint ? { background: tint } : undefined}
        aria-hidden
      >
        {pic}
      </span>
      <span className="weered-find-words">
        <span className="weered-find-name">{name}</span>
        <span className="weered-find-sub">{sub}</span>
      </span>
    </button>
  );
}

function Logo({ src, name }: { src?: string | null; name: string }) {
  if (src) return <img src={src} alt="" onError={hideBroken} />;
  return <>{(name || "?").charAt(0).toUpperCase()}</>;
}
