"use client";

// /lobby is The Lobby itself, not a directory page: the room list with the
// lobby chat beside it (LobbyHall, the same view every lobby opens on). Finding
// other lobbies is the header bar's Browse. The chat is room "lobby", the same
// thread the old page's drawer ("room:lobby") showed, so no history moves.

import { useEffect, useState } from "react";
import LobbyHeaderBar from "../../components/LobbyHeaderBar";
import LobbyHall from "../../components/LobbyHall";
import LobbyChatDrawer from "../../components/LobbyChatDrawer";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
const LOBBY_ID = "lobby";

type LobbyInfo = {
  name?: string;
  accentColor?: string | null;
  bannerUrl?: string | null;
  moduleType?: string | null;
};

export default function LobbyPage() {
  const [info, setInfo] = useState<LobbyInfo | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/lobbies/${LOBBY_ID}`)
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.ok !== false) setInfo(j?.lobby || j || null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const name = info?.name || "The Lobby";
  const accent = info?.accentColor || undefined;

  return (
    <div
      className="weered-lobby-page"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        // Same sizing as /lobby/[id]: 16px is the shell's top padding, --wtb-h the
        // desktop title bar and --shell-footer-h the SiteFooter strip (both 0px in a
        // plain browser). A flat 100vh put the chat composer under the footer in the
        // desktop app.
        height: "calc(100vh - 16px - var(--wtb-h, 0px) - var(--shell-footer-h, 0px))",
        minHeight: 0,
      }}
    >
      <LobbyHeaderBar />

      <div
        className="weered-lobby-body"
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <LobbyHall
          lobbyId={LOBBY_ID}
          lobbyName={name}
          accentColor={accent}
          bannerUrl={info?.bannerUrl || undefined}
          moduleType={info?.moduleType || undefined}
          style={{ flex: 1, minHeight: 0 }}
        />

        {/* Closed and tab-less: the chat is already inline. It stays mounted
            so the inline chat's Dial In can take the whole stage. */}
        <LobbyChatDrawer
          roomId={LOBBY_ID}
          title={`${name} · Chat`}
          accentColor={accent}
          defaultOpen={false}
          hideTab
        />
      </div>
    </div>
  );
}
