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
        // FILL THE SHELL, DON'T COMPUTE FROM 100vh. Measured in the desktop app
        // against the local stack: .weered-center is 958px tall with 18px top and
        // 80px bottom padding, so its content box is 860 — every viewport sum
        // overshoots it and .weered-shell (overflow: hidden) clips the difference,
        // which is what cut the composer's button row. 100% is exactly that box, on
        // web and desktop alike, whatever the title bar and footer are doing.
        height: "100%",
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

      <style>{`
        /* RECLAIM THE DEAD BAND UNDER THE FRAME. The global rule in
           40-core-layout.css is \`main { padding: var(--weered-pad-y) var(--weered-pad-x) 80px }\` —
           80px of breathing room at the end of a SCROLLING page. /lobby doesn't
           scroll; it's one full-height frame, so that band is a fixed strip of
           nothing under the composer that never shrinks, which is what makes the
           chat look like it isn't tracking the window (it is: measured 839px tall
           at a 1040 viewport, 699 at 900, 499 at 700).
           40px, not 0, because the fixed "🐛 feedback" pill lives in that band:
           measured at y 937-964 with the shell clipping at 972, and it overlaps
           the centre column at every width from 820 to 1920, so the composer's
           Send button has to stay clear of it.
           :has() scopes this to the page without touching any other route; where
           it isn't supported the band just stays 80px. */
        main:has(> .weered-lobby-page) { padding-bottom: 40px; }
      `}</style>
    </div>
  );
}
