"use client";

// Home's four ways in (Search, Browse, Create, Change) and the chat, wherever
// the viewer puts them: tiles on Home, rows in a sidebar (James 2026-11-05:
// "The only thing that will be there is Search, Browse, Create, Change...
// Have a home chat and presence connection. Everything should work
// everywhere so the design can pick it up"). Listed in lib/shellLayout.ts
// (ANY_CORES); styled in styles/51-start.css.
import React from "react";
import { useRouter } from "next/navigation";
import LobbySearch from "../LobbySearch";
import LobbyChatPanel from "../LobbyChatPanel";
import { useWeered, useRoomUsers } from "../WeeredProvider";
import { startDesign } from "../../lib/shellDesign";
import { avatarBg } from "../../lib/avatarColor";
import { CORE_META, type AnyCore, type ShellRegion } from "../../lib/shellLayout";

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
}: {
  id: AnyCore;
  region: ShellRegion;
  /** For the chat: the room it shows (Home passes its own). */
  roomId?: string;
}) {
  if (id === "homechat") return <ChatHere region={region} roomId={roomId} />;
  return <WayIn id={id} region={region} />;
}

function WayIn({ id, region }: { id: Exclude<AnyCore, "homechat">; region: ShellRegion }) {
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
  // Search holds its own box, so it isn't one big button.
  if (id === "search")
    return (
      <div className={cls}>
        {head}
        <div className="weered-wayin-search">
          <LobbySearch width="100%" placeholder="Lobbies, rooms, games…" />
        </div>
      </div>
    );
  return (
    <button type="button" className={cls} onClick={go}>
      {head}
      {!rail && (
        <span className="weered-wayin-go" aria-hidden>
          →
        </span>
      )}
    </button>
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
        <span className="weered-chathere-title">{rid === "lobby" ? "Home chat" : "Chat"}</span>
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
