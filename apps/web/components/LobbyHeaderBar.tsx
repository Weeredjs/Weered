"use client";
import InviteModal from "./InviteModal";

import React from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "./WeeredProvider";
import { ui } from "./weeredUi";

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
  for (const v of vals) { const s = String(v ?? "").trim(); if (s) return s; }
  return "";
}

// Module type → display label
const MODULE_LABELS: Record<string, string> = {
  BUNGIE: "Destiny 2",
  TWITCH: "Twitch",
  YOUTUBE: "YouTube",
  REDDIT: "Reddit",
  CUSTOM: "Custom",
};

export default function LobbyHeaderBar({
  title = "Lobby",
  subtitle,
  lobbyId,
}: {
  title?: string;
  subtitle?: string;
  lobbyId?: string;
}) {
  const router = useRouter();
  const w = useWeered() as any;

  const [mode, setMode]         = React.useState<Mode>("rooms");
  const [q, setQ]               = React.useState("");
  const [showLobbyInvite, setShowLobbyInvite] = React.useState(false);
  const [open, setOpen]         = React.useState(false);
  const [idx, setIdx]           = React.useState(0);

  // Search results from API
  const [pinnedResults, setPinnedResults] = React.useState<PinnedLobby[]>([]);
  const [roomResults, setRoomResults]     = React.useState<RoomResult[]>([]);
  const [searching, setSearching]         = React.useState(false);

  // People list from WeeredProvider
  const people: PersonLite[] = React.useMemo(
    () => (Array.isArray(w?.users) ? w.users : []),
    [w?.users]
  );

  // ── Debounced API search ───────────────────────────────────────────────────
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
        const token = typeof window !== "undefined"
          ? localStorage.getItem("weered:token") ?? ""
          : "";
        const res = await fetch(
          `https://api.weered.ca/lobbies/search?q=${encodeURIComponent(query)}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : {}
        );
        if (res.ok) {
          const data = await res.json();
          setPinnedResults(Array.isArray(data.pinned) ? data.pinned : []);
          setRoomResults(Array.isArray(data.rooms) ? data.rooms : []);
        }
      } catch {
        // silently fail — no results
      } finally {
        setSearching(false);
      }
    }, 220);

    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [q, mode]);

  // ── People filter (local, no API) ─────────────────────────────────────────
  const peopleResults = React.useMemo(() => {
    if (mode !== "people" || !q.trim()) return [];
    const lower = q.trim().toLowerCase();
    return people
      .filter(u => pickFirstString(u?.name, u?.username, u?.id).toLowerCase().includes(lower))
      .slice(0, 10);
  }, [mode, q, people]);

  // Flat list for keyboard navigation
  // Sections: [pinned lobbies] [rooms] [people]
  type NavItem =
    | { kind: "pinned"; lobby: PinnedLobby }
    | { kind: "room";   room: RoomResult }
    | { kind: "person"; person: PersonLite };

  const navItems: NavItem[] = React.useMemo(() => {
    const items: NavItem[] = [];
    for (const l of pinnedResults) items.push({ kind: "pinned", lobby: l });
    for (const r of roomResults)   items.push({ kind: "room",   room: r });
    for (const p of peopleResults) items.push({ kind: "person", person: p });
    return items;
  }, [pinnedResults, roomResults, peopleResults]);

  React.useEffect(() => { setIdx(0); }, [q, mode]);

  function choose(i: number) {
    const item = navItems[i];
    if (!item) return;
    setOpen(false);
    if (item.kind === "pinned") { router.push(`/lobby/${item.lobby.id}`); return; }
    if (item.kind === "room")   { router.push(`/room/${item.room.id}`);   return; }
    if (item.kind === "person") {
      try {
        window.dispatchEvent(new CustomEvent("weered:overlay:open", {
          detail: {
            sheet: "profile",
            userId: pickFirstString(item.person?.id, item.person?.username, item.person?.name),
          },
        }));
      } catch {}
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(cur => Math.min(cur + 1, Math.max(0, navItems.length - 1))); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setIdx(cur => Math.max(0, cur - 1)); return; }
    if (e.key === "Enter" && open && navItems.length) { e.preventDefault(); choose(idx); return; }
  }

  function openBrowse() {
    window.dispatchEvent(new CustomEvent("weered:lobby:browse"));
  }

  const hasResults = navItems.length > 0;
  const showDropdown = open && q.trim().length >= 2;

  return (
    <div className={ui.panel} style={{ position: "relative", flexShrink: 0 }}>
      <div className={ui.panelHeader}>
        <div className="min-w-0">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className={ui.panelTitle}>{title}</div>
            {subtitle && <div className={`${ui.muted} text-xs truncate`}>{subtitle}</div>}
          </div>
          <div className={`${ui.muted} text-xs mt-0.5`}>
            Browse content, find rooms, and connect with people.
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode tabs */}
          <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            {(["rooms", "people"] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                className={
                  "rounded-lg px-2 py-1 text-xs font-semibold " +
                  (mode === m ? "bg-white/15" : "opacity-70 hover:bg-white/10")
                }
                onClick={() => setMode(m)}
              >
                {m === "rooms" ? "Rooms" : "People"}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
            <input
              className="weered-input w-full"
              placeholder={mode === "rooms" ? "Search rooms or lobbies…" : "Search people"}
              value={q}
              onChange={e => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={onKeyDown}
            />

            {/* Dropdown */}
            {showDropdown && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "calc(100% + 6px)",
                  zIndex: 5000,
                  borderRadius: 14,
                  border: "1px solid var(--weered-border2)",
                  background: "var(--weered-panel2)",
                  overflow: "hidden",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
              >
                {/* Loading state */}
                {searching && !hasResults && (
                  <div style={{ padding: "12px 14px", fontSize: 12, opacity: 0.45, textAlign: "center" }}>
                    Searching…
                  </div>
                )}

                {/* Empty state */}
                {!searching && !hasResults && (
                  <div style={{ padding: "12px 14px", fontSize: 12, opacity: 0.4, textAlign: "center" }}>
                    No results for "{q}"
                  </div>
                )}

                {/* ── Pinned lobbies section ─────────────────────────────── */}
                {pinnedResults.length > 0 && (
                  <>
                    <SectionLabel label="LOBBIES" />
                    {pinnedResults.map((lobby, i) => {
                      const globalIdx = i;
                      const active = globalIdx === idx;
                      const accent = lobby.accentColor ?? "#7C3AED";
                      return (
                        <button
                          key={lobby.id}
                          type="button"
                          onMouseEnter={() => setIdx(globalIdx)}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => choose(globalIdx)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "10px 12px",
                            border: "none",
                            borderLeft: `3px solid ${active ? accent : "transparent"}`,
                            cursor: "pointer",
                            background: active ? `${accent}18` : "transparent",
                            color: "rgba(243,244,246,.98)",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            transition: "background 0.1s, border-color 0.1s",
                          }}
                        >
                          {/* Logo or accent dot */}
                          {lobby.logoUrl ? (
                            <img
                              src={lobby.logoUrl}
                              alt=""
                              style={{
                                width: 30, height: 30,
                                borderRadius: 6,
                                objectFit: "cover",
                                flexShrink: 0,
                                border: `1px solid ${accent}44`,
                              }}
                            />
                          ) : (
                            <div style={{
                              width: 30, height: 30,
                              borderRadius: 6,
                              flexShrink: 0,
                              background: `${accent}33`,
                              border: `1px solid ${accent}55`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 13,
                            }}>
                              📌
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 2,
                            }}>
                              <span style={{
                                fontWeight: 800,
                                fontSize: 13,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                                {lobby.name}
                              </span>
                              {lobby.verified && (
                                <span style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: "#22C55E",
                                  background: "rgba(34,197,94,0.12)",
                                  border: "1px solid rgba(34,197,94,0.25)",
                                  padding: "1px 5px",
                                  borderRadius: 4,
                                  letterSpacing: "0.08em",
                                  flexShrink: 0,
                                }}>
                                  ✓ VERIFIED
                                </span>
                              )}
                              {lobby.moduleType && lobby.moduleType !== "NONE" && (
                                <span style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: accent,
                                  background: `${accent}22`,
                                  border: `1px solid ${accent}44`,
                                  padding: "1px 5px",
                                  borderRadius: 4,
                                  letterSpacing: "0.08em",
                                  flexShrink: 0,
                                }}>
                                  {MODULE_LABELS[lobby.moduleType] ?? lobby.moduleType}
                                </span>
                              )}
                            </div>
                            {lobby.description && (
                              <div style={{
                                fontSize: 11,
                                opacity: 0.5,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                                {lobby.description}
                              </div>
                            )}
                          </div>

                          {/* Room/member counts */}
                          {lobby._count && (
                            <div style={{
                              fontSize: 11,
                              opacity: 0.5,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                              textAlign: "right",
                            }}>
                              <div>{lobby._count.rooms} rooms</div>
                              <div>{lobby._count.members} members</div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </>
                )}

                {/* ── Rooms section ─────────────────────────────────────── */}
                {roomResults.length > 0 && (
                  <>
                    <SectionLabel label="ROOMS" />
                    {roomResults.map((room, i) => {
                      const globalIdx = pinnedResults.length + i;
                      const active = globalIdx === idx;
                      const accent = room.lobby?.accentColor ?? "#7C3AED";
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onMouseEnter={() => setIdx(globalIdx)}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => choose(globalIdx)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "9px 12px",
                            border: "none",
                            borderLeft: `3px solid ${active ? accent : "transparent"}`,
                            cursor: "pointer",
                            background: active ? "rgba(124,58,237,.14)" : "transparent",
                            color: "rgba(243,244,246,.98)",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            transition: "background 0.1s",
                          }}
                        >
                          {/* Room icon */}
                          <div style={{
                            width: 26, height: 26,
                            borderRadius: 6,
                            flexShrink: 0,
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                          }}>
                            {room.locked ? "🔒" : "#"}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 700,
                              fontSize: 13,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
                              {room.name}
                            </div>
                            {room.lobby && (
                              <div style={{ fontSize: 11, opacity: 0.45 }}>
                                in {room.lobby.name}
                              </div>
                            )}
                          </div>

                          <div style={{ fontSize: 11, opacity: 0.5, whiteSpace: "nowrap", flexShrink: 0 }}>
                            {typeof room._count?.members === "number"
                              ? `${room._count.members} online`
                              : room.locked ? "locked" : "open"}
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}

                {/* ── People section ────────────────────────────────────── */}
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
                          onMouseDown={e => e.preventDefault()}
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
                          <div style={{
                            width: 26, height: 26,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: "rgba(124,58,237,0.25)",
                            border: "1px solid rgba(124,58,237,0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                          }}>
                            {pickFirstString(person?.name, person?.username, "?").charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontWeight: 700,
                              fontSize: 13,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
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

          {/* Browse button */}
          <button type="button" className="weered-btn" onClick={openBrowse}>
            Browse Rooms
          </button>
          <button type="button" className="weered-btn" onClick={() => setShowLobbyInvite(true)}>
            Invite
          </button>

          <button
            type="button"
            className="weered-btn"
            onClick={() => { setQ(""); setOpen(false); }}
            disabled={!q.trim()}
          >
            Clear
          </button>
        </div>
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

// ── Section divider label ──────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      padding: "7px 14px 4px",
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: "0.12em",
      color: "rgba(148,163,184,0.35)",
      borderTop: "1px solid rgba(255,255,255,0.05)",
    }}>
      {label}
    </div>
  );
}
