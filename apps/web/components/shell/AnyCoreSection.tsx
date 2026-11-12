"use client";

// Home's four ways in (Search, Browse, Create, Change) and the chat, wherever
// the viewer puts them: tiles on Home, rows in a sidebar (James 2026-11-05:
// "The only thing that will be there is Search, Browse, Create, Change...
// Have a home chat and presence connection. Everything should work
// everywhere so the design can pick it up"). Listed in lib/shellLayout.ts
// (ANY_CORES); styled in styles/51-start.css. On Home each tile carries a
// picture of what it does, made from the real thing: lobbies' logos and
// banners, the layout gallery's pictures, the colourways (James 2026-11-06:
// "we need some sharp images for the buttons").
import React from "react";
import { useRouter } from "next/navigation";
import UniversalSearch from "../search/UniversalSearch";
import LobbyChatPanel from "../LobbyChatPanel";
import { useWeered, useRoomUsers } from "../WeeredProvider";
import { startDesign } from "../../lib/shellDesign";
import { avatarBg } from "../../lib/avatarColor";
import { hideBroken, sizedImage } from "../../lib/sizedImage";
import { PALETTES } from "../../lib/uiPrefs";
import { CORE_META, type AnyCore, type ShellRegion } from "../../lib/shellLayout";

/** What the tiles' pictures are made of. */
export type ArtLobby = {
  id: string;
  name: string;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
};

const ICONS: Record<Exclude<AnyCore, "homechat">, React.ReactNode> = {
  search: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  ),
  browse: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  ),
  create: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  change: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  ),
};

export default function AnyCoreSection({
  id,
  region,
  roomId,
  lobbies,
}: {
  id: AnyCore;
  region: ShellRegion;
  /** For the chat: the room it shows (Home passes its own). */
  roomId?: string;
  /** For the tiles' pictures (Home passes its list). */
  lobbies?: ArtLobby[];
}) {
  if (id === "homechat") return <ChatHere region={region} roomId={roomId} />;
  return <WayIn id={id} region={region} lobbies={lobbies || []} />;
}

function WayIn({
  id,
  region,
  lobbies,
}: {
  id: Exclude<AnyCore, "homechat">;
  region: ShellRegion;
  lobbies: ArtLobby[];
}) {
  const router = useRouter();
  const meta = CORE_META[id];
  const rail = region !== "home";
  const go = () => {
    if (id === "browse") window.dispatchEvent(new CustomEvent("weered:lobby:browse"));
    else if (id === "create") router.push("/lobby/create");
    else if (id === "change") {
      // Design lives on Home (ShellDesigner); from anywhere else, go there with it open.
      if (window.location.pathname === "/home") startDesign();
      else router.push("/home?design=1");
    }
  };
  const head = (
    <span className="weered-wayin-head">
      <span className="weered-wayin-icon" aria-hidden>
        {ICONS[id]}
      </span>
      <span className="weered-wayin-words">
        <span className="weered-wayin-title">{meta.name}</span>
        <span className="weered-wayin-sub">{meta.blurb}</span>
      </span>
    </span>
  );
  const cls = `weered-wayin weered-wayin-${id}${rail ? " is-rail" : ""}`;
  // A sidebar row is too small for a picture.
  const art = rail ? null : <WayInArt id={id} lobbies={lobbies} />;
  // Search holds its own box, so it isn't one big button.
  if (id === "search")
    return (
      <div className={cls}>
        {art}
        {head}
        <div className="weered-wayin-box">
          <UniversalSearch variant="tile" placeholder="Lobbies, rooms, people…" />
        </div>
      </div>
    );
  return (
    <button type="button" className={cls} onClick={go}>
      {art}
      {head}
      {!rail && (
        <span className="weered-wayin-go" aria-hidden>
          →
        </span>
      )}
    </button>
  );
}

/** Lobbies to draw from: the ones with the picture asked for, then stand-ins
 *  in their own colours, so a tile is never bare while the list loads. */
function pick(lobbies: ArtLobby[], key: "bannerUrl" | "logoUrl", count: number): ArtLobby[] {
  const have = lobbies.filter((l) => l[key]).slice(0, count);
  const fill = ["Weered", "Crew", "Lounge", "Arena", "Studio"].map((name) => ({ id: name, name }));
  return [...have, ...fill].slice(0, count);
}
const tint = (l: ArtLobby) => l.accentColor || avatarBg(l.name || l.id);

/** The layouts and colourways Change offers, as they look. */
const SHOTS = ["weered-violet", "clean-ocean", "social-ember"];
const DOTS = (["violet", "ocean", "aurora", "ember", "graphite"] as const).map(
  (p) => PALETTES[p].a,
);

function WayInArt({ id, lobbies }: { id: Exclude<AnyCore, "homechat">; lobbies: ArtLobby[] }) {
  if (id === "browse")
    return (
      <span className="weered-art weered-art-browse" aria-hidden>
        <span className="weered-art-stage">
          {pick(lobbies, "bannerUrl", 3).map((l, i) => (
            <span
              key={l.id}
              className={`weered-art-card is-${i}`}
              style={{ ["--card-a" as any]: tint(l) }}
            >
              {l.bannerUrl ? (
                <img
                  className="weered-art-card-banner"
                  src={sizedImage(l.bannerUrl, 256)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={hideBroken}
                />
              ) : null}
              {l.logoUrl ? (
                <img
                  className="weered-art-card-logo"
                  src={sizedImage(l.logoUrl, 48)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={hideBroken}
                />
              ) : null}
            </span>
          ))}
        </span>
      </span>
    );
  if (id === "search") {
    const chips = pick(lobbies, "logoUrl", 5);
    const chip = (l: ArtLobby, cls: string) =>
      l.logoUrl ? (
        <img
          className={cls}
          src={sizedImage(l.logoUrl, 96)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={hideBroken}
        />
      ) : (
        <span className={cls} style={{ background: tint(l) }}>
          {l.name.slice(0, 1)}
        </span>
      );
    return (
      <span className="weered-art weered-art-search" aria-hidden>
        <span className="weered-art-stage">
          {chips.map((l, i) =>
            i === 2 ? null : (
              <React.Fragment key={l.id}>{chip(l, `weered-art-chip is-${i}`)}</React.Fragment>
            ),
          )}
          {/* The lens, with the one it found under the glass. */}
          <span className="weered-art-lens">
            <span className="weered-art-lens-glass">
              {chips[2] ? chip(chips[2], "weered-art-chip is-found") : null}
            </span>
          </span>
        </span>
      </span>
    );
  }
  if (id === "create")
    return (
      <span className="weered-art weered-art-create" aria-hidden>
        <span className="weered-art-stage">
          <span className="weered-art-frame">
            <span className="weered-art-block is-banner" />
            <span className="weered-art-block is-chat">
              <i />
              <i />
              <i />
            </span>
            <span className="weered-art-block is-rooms">
              <i />
              <i />
              <i />
              <i />
            </span>
          </span>
          <span className="weered-art-spark">✦</span>
        </span>
      </span>
    );
  return (
    <span className="weered-art weered-art-change" aria-hidden>
      <span className="weered-art-stage">
        {SHOTS.map((k, i) => (
          <img
            key={k}
            className={`weered-art-shot is-${i}`}
            src={sizedImage(`/brand/layouts/${k}.webp`, 256)}
            alt=""
            loading="lazy"
            decoding="async"
            onError={hideBroken}
          />
        ))}
        <span className="weered-art-dots">
          {DOTS.map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </span>
      </span>
    </span>
  );
}

/** The chat of wherever the viewer is (Home's on Home, a lobby's in a lobby):
 *  a browser is in one room at a time, and only that room's chat reaches it
 *  (api sockets/messaging.ts). With the faces of who's here. */
function ChatHere({ region, roomId }: { region: ShellRegion; roomId?: string }) {
  const ctx = useWeered() as any;
  const rid = String(roomId || ctx?.joinedRoomId || ctx?.activeRoomId || "lobby");
  const here = (useRoomUsers(rid) as any[]).filter((u: any) => u?.id && u.id !== "operator");
  const rail = region !== "home";
  return (
    <section className={`weered-chathere${rail ? " is-rail" : ""}`} aria-label="Chat">
      <header className="weered-chathere-head">
        <span className="weered-chathere-title">{rid === "lobby" ? "Town Square" : "Chat"}</span>
        <span className="weered-chathere-count">
          <span className="weered-chathere-dot" aria-hidden />
          {here.length} here
        </span>
        <span className="weered-chathere-faces" aria-hidden>
          {here.slice(0, rail ? 5 : 9).map((u) => (
            <span
              key={u.id}
              className="weered-chathere-face"
              title={u.name}
              style={
                u.avatar
                  ? { backgroundImage: `url("${String(u.avatar).replace(/["\\]/g, "")}")` }
                  : { background: u.avatarColor || avatarBg(String(u.name || "?")) }
              }
            >
              {u.avatar
                ? null
                : String(u.name || "?")
                    .slice(0, 1)
                    .toUpperCase()}
            </span>
          ))}
        </span>
      </header>
      <div className="weered-chathere-body">
        <LobbyChatPanel roomId={rid} embedded />
      </div>
    </section>
  );
}
