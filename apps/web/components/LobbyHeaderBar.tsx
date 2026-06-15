"use client";
import InviteModal from "./InviteModal";
import HelldiversPlayerCountPill from "./HelldiversPlayerCountPill";
import SteamLobbyHeader from "./SteamLobbyHeader";

import React from "react";
import { useRouter } from "next/navigation";
import { useWeered, useRoomUsers } from "./WeeredProvider";
import { ui } from "./weeredUi";
import { weeredReport } from "../lib/report";
import { weeredToast } from "../lib/toast";

type Mode = "rooms" | "people";

type PinnedLobby = {
  id: string;
  name: string;
  description?: string;
  verified?: boolean;
  moduleType?: string;
  accentColor?: string;
  logoUrl?: string;
  _count?: { rooms: number; members: number };
};

type RoomResult = {
  id: string;
  name: string;
  locked?: boolean;
  lobbyId?: string;
  lobby?: { id: string; name: string; accentColor?: string; logoUrl?: string } | null;
  _count?: { members: number };
};

type PersonLite = { id?: string; name?: string; username?: string; role?: string };

function pickFirstString(...vals: any[]) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

const MODULE_LABELS: Record<string, string> = {
  BUNGIE: "Destiny 2",
  TWITCH: "Twitch",
  YOUTUBE: "YouTube",
  FEED: "Feed",
  CUSTOM: "Custom",
  NEWS: "News",
};

export default function LobbyHeaderBar({
  title = "Lobby",
  subtitle,
  lobbyId,
  accentColor,
  logoUrl,
  verified,
  steamAppId,
}: {
  title?: string;
  subtitle?: string;
  lobbyId?: string;
  accentColor?: string;
  logoUrl?: string;
  verified?: boolean;
  steamAppId?: string | null;
}) {
  const router = useRouter();
  const w = useWeered() as any;

  const accent = accentColor || undefined;
  const isBranded = !!(accentColor || logoUrl) && lobbyId && lobbyId !== "lobby";
  const initial = (title || lobbyId || "L").charAt(0).toUpperCase();

  const [mode, setMode] = React.useState<Mode>("rooms");
  const [q, setQ] = React.useState("");
  const [showLobbyInvite, setShowLobbyInvite] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [idx, setIdx] = React.useState(0);

  const [pinnedResults, setPinnedResults] = React.useState<PinnedLobby[]>([]);
  const [roomResults, setRoomResults] = React.useState<RoomResult[]>([]);
  const [searching, setSearching] = React.useState(false);

  const people: PersonLite[] = useRoomUsers(w?.activeRoomId) as any;

  const searchRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const query = q.trim();
    if (!query || query.length < 2 || mode === "people") {
      setPinnedResults([]);
      setRoomResults([]);
      return;
    }

    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const token =
          typeof window !== "undefined" ? (localStorage.getItem("weered_token") ?? "") : "";
        const res = await fetch(
          `https://api.weered.ca/lobbies/search?q=${encodeURIComponent(query)}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : {},
        );
        if (res.ok) {
          const data = await res.json();
          setPinnedResults(Array.isArray(data.pinned) ? data.pinned : []);
          setRoomResults(Array.isArray(data.rooms) ? data.rooms : []);
        }
      } catch {
      } finally {
        setSearching(false);
      }
    }, 220);

    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [q, mode]);

  const peopleResults = React.useMemo(() => {
    if (mode !== "people" || !q.trim()) return [];
    const lower = q.trim().toLowerCase();
    return people
      .filter((u) => pickFirstString(u?.name, u?.username, u?.id).toLowerCase().includes(lower))
      .slice(0, 10);
  }, [mode, q, people]);

  type NavItem =
    | { kind: "pinned"; lobby: PinnedLobby }
    | { kind: "room"; room: RoomResult }
    | { kind: "person"; person: PersonLite };

  const navItems: NavItem[] = React.useMemo(() => {
    const items: NavItem[] = [];
    for (const l of pinnedResults) items.push({ kind: "pinned", lobby: l });
    for (const r of roomResults) items.push({ kind: "room", room: r });
    for (const p of peopleResults) items.push({ kind: "person", person: p });
    return items;
  }, [pinnedResults, roomResults, peopleResults]);

  React.useEffect(() => {
    setIdx(0);
  }, [q, mode]);

  function choose(i: number) {
    const item = navItems[i];
    if (!item) return;
    setOpen(false);
    if (item.kind === "pinned") {
      router.push(`/lobby/${item.lobby.id}`);
      return;
    }
    if (item.kind === "room") {
      router.push(`/room/${item.room.id}`);
      return;
    }
    if (item.kind === "person") {
      try {
        window.dispatchEvent(
          new CustomEvent("weered:overlay:open", {
            detail: {
              sheet: "profile",
              userId: pickFirstString(item.person?.id, item.person?.username, item.person?.name),
            },
          }),
        );
      } catch {}
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((cur) => Math.min(cur + 1, Math.max(0, navItems.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((cur) => Math.max(0, cur - 1));
      return;
    }
    if (e.key === "Enter" && open && navItems.length) {
      e.preventDefault();
      choose(idx);
      return;
    }
  }

  function openBrowse() {
    window.dispatchEvent(new CustomEvent("weered:lobby:browse"));
  }

  const hasResults = navItems.length > 0;
  const showDropdown = open && q.trim().length >= 2;

  return (
    <div
      className={ui.panel}
      style={{
        position: "relative",
        flexShrink: 0,
        padding: 0,
      }}
    >
      {accent && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            zIndex: 2,
            background: `linear-gradient(90deg, transparent, ${accent}66 30%, ${accent} 50%, ${accent}66 70%, transparent)`,
            pointerEvents: "none",
          }}
        />
      )}

      <div
        className="weered-lobby-header-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          flexWrap: "wrap",
        }}
      >
        {(() => {
          const HAS_SPLASH = new Set(["windrose", "destiny2"]);
          const isTier2 = HAS_SPLASH.has(lobbyId ?? "");
          const replaySplash = () => {
            try {
              window.dispatchEvent(new CustomEvent("weered:splash:open", { detail: { lobbyId } }));
            } catch {}
          };
          const tier2CursorStyle: React.CSSProperties = isTier2 ? { cursor: "pointer" } : {};
          const tier2Title = isTier2 ? "Replay the intro · click to open" : undefined;

          if (lobbyId === "windrose") {
            return (
              <div
                onClick={isTier2 ? replaySplash : undefined}
                title={tier2Title}
                className={isTier2 ? "weered-tier2-logo" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                  padding: "2px 4px",
                  borderRadius: 6,
                  transition: "all 0.15s ease",
                  ...tier2CursorStyle,
                }}
              >
                <img
                  src="/brand/lobbies/windrose-wordmark-official.png"
                  alt="Windrose"
                  style={{
                    height: 26,
                    width: "auto",
                    maxWidth: 220,
                    objectFit: "contain",
                    flexShrink: 0,
                    filter: `drop-shadow(0 1px 3px ${accent || "#c9a066"}55)`,
                  }}
                />
                {verified && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: 5,
                      background: accent ? `${accent}20` : "rgba(88,0,229,.15)",
                      border: `1px solid ${accent || "#5800E5"}35`,
                      color: accent || "#5800E5",
                      letterSpacing: "0.05em",
                      flexShrink: 0,
                    }}
                  >
                    VERIFIED
                  </span>
                )}
              </div>
            );
          }

          return (
            <>
              {logoUrl ? (
                <div
                  onClick={isTier2 ? replaySplash : undefined}
                  title={tier2Title}
                  className={isTier2 ? "weered-tier2-logo" : undefined}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    flexShrink: 0,
                    background: "rgba(0,0,0,.4)",
                    border: `1px solid ${accent || "rgba(255,255,255,.08)"}33`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    transition: "all 0.15s ease",
                    ...tier2CursorStyle,
                  }}
                >
                  <img
                    src={logoUrl}
                    alt={title + " logo"}
                    style={{ width: 20, height: 20, objectFit: "contain" }}
                  />
                </div>
              ) : (
                <div
                  onClick={isTier2 ? replaySplash : undefined}
                  title={tier2Title}
                  className={isTier2 ? "weered-tier2-logo" : undefined}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    flexShrink: 0,
                    background: accent ? `${accent}15` : "rgba(88,0,229,.12)",
                    border: `1px solid ${accent || "#5800E5"}22`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 900,
                    color: accent || "#5800E5",
                    transition: "all 0.15s ease",
                    ...tier2CursorStyle,
                  }}
                >
                  {initial}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    letterSpacing: "-0.3px",
                    color: "rgba(243,244,246,.97)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {title}
                </span>
                {verified && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: 5,
                      background: accent ? `${accent}20` : "rgba(88,0,229,.15)",
                      border: `1px solid ${accent || "#5800E5"}35`,
                      color: accent || "#5800E5",
                      letterSpacing: "0.05em",
                      flexShrink: 0,
                    }}
                  >
                    VERIFIED
                  </span>
                )}
                {steamAppId ? (
                  <SteamLobbyHeader appId={String(steamAppId)} accentColor={accent || undefined} />
                ) : null}
              </div>
            </>
          );
        })()}

        <div
          className="weered-lobby-tabs flex gap-1 rounded-xl border border-white/10 bg-white/5 p-0.5"
          style={{ flexShrink: 0 }}
        >
          {(["rooms", "people"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={
                "weered-lobby-tab rounded-lg px-2 py-1 text-xs font-semibold " +
                (mode === m
                  ? "weered-lobby-tab-active bg-white/15"
                  : "opacity-70 hover:bg-white/10")
              }
              style={
                mode === m && accent ? { background: `${accent}25`, color: accent } : undefined
              }
              onClick={() => setMode(m)}
            >
              {m === "rooms" ? "Rooms" : "People"}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", flex: "1 1 120px", minWidth: 0 }}>
          <input
            className="weered-input w-full"
            placeholder={mode === "rooms" ? "Search rooms or lobbies…" : "Search people"}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (q.trim().length >= 2) setOpen(true);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            style={{ outline: "none", padding: "5px 10px", fontSize: 12 }}
          />
          {searching && (
            <div
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 10,
                opacity: 0.4,
              }}
            >
              …
            </div>
          )}

          {showDropdown && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                zIndex: 200,
                background: "rgba(12,12,20,0.98)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                overflow: "hidden",
                backdropFilter: "blur(12px)",
                maxHeight: 380,
                overflowY: "auto",
              }}
            >
              {!hasResults && !searching && (
                <div
                  style={{ padding: "12px 16px", fontSize: 12, opacity: 0.45, textAlign: "center" }}
                >
                  No results
                </div>
              )}

              {pinnedResults.length > 0 && (
                <>
                  <SectionLabel label="LOBBIES" />
                  {pinnedResults.map((lobby, i) => {
                    const active = i === idx;
                    const la = lobby.accentColor || accent || "#7C3AED";
                    return (
                      <button
                        key={lobby.id}
                        type="button"
                        onMouseEnter={() => setIdx(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(i)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          border: "none",
                          borderLeft: `3px solid ${active ? la : "transparent"}`,
                          cursor: "pointer",
                          background: active ? `${la}18` : "transparent",
                          color: "rgba(243,244,246,.98)",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          transition: "background 0.1s",
                        }}
                      >
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            flexShrink: 0,
                            background: lobby.logoUrl ? "rgba(0,0,0,0.3)" : `${la}28`,
                            border: `1px solid ${la}40`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          {lobby.logoUrl ? (
                            <img
                              src={lobby.logoUrl}
                              alt={lobby.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                padding: 3,
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 900, color: la }}>
                              {lobby.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 13,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {lobby.name}
                            </div>
                            {lobby.verified && (
                              <span
                                style={{
                                  fontSize: 9,
                                  padding: "1px 5px",
                                  borderRadius: 999,
                                  background: `${la}20`,
                                  border: `1px solid ${la}40`,
                                  color: la,
                                  flexShrink: 0,
                                }}
                              >
                                ✓
                              </span>
                            )}
                            {lobby.moduleType && lobby.moduleType !== "NONE" && (
                              <span
                                style={{
                                  fontSize: 9,
                                  opacity: 0.5,
                                  fontFamily: "monospace",
                                  flexShrink: 0,
                                }}
                              >
                                {MODULE_LABELS[lobby.moduleType] || lobby.moduleType}
                              </span>
                            )}
                          </div>
                          {lobby.description && (
                            <div
                              style={{
                                fontSize: 11,
                                opacity: 0.45,
                                marginTop: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {lobby.description}
                            </div>
                          )}
                        </div>

                        {lobby._count && (
                          <div
                            style={{
                              fontSize: 11,
                              opacity: 0.5,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                              textAlign: "right",
                            }}
                          >
                            <div>{lobby._count.rooms} rooms</div>
                            <div>{lobby._count.members} members</div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </>
              )}

              {roomResults.length > 0 && (
                <>
                  <SectionLabel label="ROOMS" />
                  {roomResults.map((room, i) => {
                    const globalIdx = pinnedResults.length + i;
                    const active = globalIdx === idx;
                    const ra = room.lobby?.accentColor ?? accent ?? "#7C3AED";
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onMouseEnter={() => setIdx(globalIdx)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(globalIdx)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "9px 12px",
                          border: "none",
                          borderLeft: `3px solid ${active ? ra : "transparent"}`,
                          cursor: "pointer",
                          background: active ? `${ra}18` : "transparent",
                          color: "rgba(243,244,246,.98)",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          transition: "background 0.1s",
                        }}
                      >
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            flexShrink: 0,
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                          }}
                        >
                          {room.locked ? "🔒" : "#"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {room.name}
                          </div>
                          {room.lobby && (
                            <div style={{ fontSize: 11, opacity: 0.45 }}>in {room.lobby.name}</div>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            opacity: 0.5,
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          {typeof room._count?.members === "number"
                            ? `${room._count.members} online`
                            : room.locked
                              ? "locked"
                              : "open"}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {peopleResults.length > 0 && (
                <>
                  <SectionLabel label="PEOPLE" />
                  {peopleResults.map((person, i) => {
                    const globalIdx = pinnedResults.length + roomResults.length + i;
                    const active = globalIdx === idx;
                    return (
                      <button
                        key={pickFirstString(person?.id, person?.username, person?.name)}
                        type="button"
                        onMouseEnter={() => setIdx(globalIdx)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(globalIdx)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "9px 12px",
                          border: "none",
                          borderLeft: `3px solid ${active ? "#7C3AED" : "transparent"}`,
                          cursor: "pointer",
                          background: active ? "rgba(124,58,237,.14)" : "transparent",
                          color: "rgba(243,244,246,.98)",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: "rgba(124,58,237,0.25)",
                            border: "1px solid rgba(124,58,237,0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {pickFirstString(person?.name, person?.username, "?")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {pickFirstString(person?.name, person?.username, person?.id)}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.45 }}>
                            {person?.role ?? "member"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="weered-btn"
          style={{ padding: "5px 10px", fontSize: 11 }}
          onClick={openBrowse}
        >
          Browse
        </button>
        <button
          type="button"
          className="weered-btn"
          style={{ padding: "5px 10px", fontSize: 11 }}
          onClick={() => setShowLobbyInvite(true)}
        >
          Invite
        </button>
        {lobbyId && lobbyId !== "lobby" && (
          <button
            type="button"
            className="weered-btn"
            title="Report this lobby"
            aria-label="Report this lobby"
            style={{ padding: "5px 8px", fontSize: 11, opacity: 0.6 }}
            onClick={async () => {
              const res = await weeredReport({ targetType: "LOBBY", targetId: lobbyId });
              if (res?.ok) weeredToast.success("Report submitted. Staff will review.");
              else if (res && !res.ok)
                weeredToast.error(
                  res.error === "report_rate_limit"
                    ? "You're reporting too fast. Try again shortly."
                    : "Report failed.",
                );
            }}
          >
            ⚐
          </button>
        )}
      </div>

      {showLobbyInvite && (
        <InviteModal
          type="LOBBY"
          targetId={lobbyId}
          targetName={title}
          onClose={() => setShowLobbyInvite(false)}
        />
      )}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "7px 14px 4px",
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.12em",
        color: "rgba(148,163,184,0.35)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {label}
    </div>
  );
}
