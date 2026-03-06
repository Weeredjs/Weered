"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWeered } from "../WeeredProvider";
import RoomHeader, { RoomTab } from "./RoomHeader";
import RoomBody from "./RoomBody";
import RoomChatPanel from "../RoomChatPanel";
import { useOverlay } from "../overlays/OverlayProvider";

function safeCopy(s: string) {
  try {
    navigator.clipboard?.writeText?.(s);
  } catch {}
}

function safeJsonParse<T>(s: string | null, fallback: T): T {
  try {
    if (!s) return fallback;
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export default function RoomCanvas({ roomId }: { roomId: string }) {
  const w: any = useWeered();
  const { openSheet } = useOverlay();
  const [tab, setTab] = useState<RoomTab>("chat");

  const roomLabel = useMemo(() => {
    const name = String(w?.meta?.name || w?.meta?.title || w?.meta?.label || w?.admin?.name || "").trim();
    if (name) return name;
    try {
      return decodeURIComponent(roomId || "");
    } catch {
      return roomId || "";
    }
  }, [w?.meta?.name, w?.meta?.title, w?.meta?.label, w?.admin?.name, roomId]);

  const memberCount = Array.isArray(w?.users) ? w.users.length : 0;

  // ---- UI-only “Room Details” persistence (per room) ----
  const aboutKey = `weered.room.about.${roomId}`;
  const linksKey = `weered.room.links.${roomId}`;

  const [about, setAbout] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");

  useEffect(() => {
    // hydrate
    try {
      setAbout(String(localStorage.getItem(aboutKey) || ""));
      setLinks(safeJsonParse<string[]>(localStorage.getItem(linksKey), []));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    try {
      localStorage.setItem(aboutKey, about || "");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [about, roomId]);

  useEffect(() => {
    try {
      localStorage.setItem(linksKey, JSON.stringify(links || []));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, roomId]);

  const addLink = () => {
    const v = String(newLink || "").trim();
    if (!v) return;

    // super light normalization
    const normalized = v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`;
    if (links.includes(normalized)) {
      setNewLink("");
      return;
    }
    setLinks([normalized, ...links].slice(0, 20));
    setNewLink("");
  };

  const removeLink = (v: string) => {
    setLinks(links.filter((x) => x !== v));
  };

  const rightPane = useMemo(() => {
    if (tab === "media") {
      return (
        <div className="opacity-80">
          <div className="text-sm font-semibold mb-2">Media</div>
          <div className="text-sm opacity-70">Placeholder grid for tiles (images, links, livekit, embeds).</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="h-20 rounded-lg border border-white/10 bg-white/5" />
            <div className="h-20 rounded-lg border border-white/10 bg-white/5" />
            <div className="h-20 rounded-lg border border-white/10 bg-white/5" />
            <div className="h-20 rounded-lg border border-white/10 bg-white/5" />
          </div>
        </div>
      );
    }

    if (tab === "activity") {
      return (
        <div className="opacity-80">
          <div className="text-sm font-semibold mb-2">Activity</div>
          <div className="text-sm opacity-70">Joins, pins, uploads, mod actions (soon).</div>
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">testuser2 joined</div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">room created</div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">message pinned (soon)</div>
          </div>
        </div>
      );
    }

    // Default: Details
    const shareUrl =
      typeof window !== "undefined" ? `${window.location.origin}/room/${encodeURIComponent(roomId)}` : "";

    return (
      <div className="opacity-95">
        <div className="text-sm font-semibold mb-3">Room Details</div>

        <div className="space-y-2">
          {/* Room meta / quick copy */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold opacity-80">Room</div>
                <div className="text-sm font-semibold truncate">{roomLabel}</div>
                <div className="text-xs opacity-65 truncate">{roomId}</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs rounded-full border border-white/10 bg-black/10 px-2 py-1 hover:bg-white/10"
                  onClick={() => safeCopy(roomId)}
                  title="Copy id"
                >
                  Copy id
                </button>
                <button
                  type="button"
                  className="text-xs rounded-full border border-white/10 bg-black/10 px-2 py-1 hover:bg-white/10"
                  onClick={() => safeCopy(shareUrl)}
                  title="Copy link"
                >
                  Copy link
                </button>
              </div>
            </div>
          </div>

          {/* Pinned */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <div className="text-xs font-semibold opacity-80 mb-1">Pinned</div>
            <div className="text-sm opacity-70">Nothing pinned.</div>
          </div>

          {/* Links */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold opacity-80">Links</div>
              <span className="text-[11px] rounded-full border border-white/10 bg-black/10 px-2 py-0.5 opacity-70">
                UI-only
              </span>
            </div>

            <div className="flex gap-2">
              <input
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                placeholder="Paste a link…"
                className="flex-1 rounded-lg border border-white/10 bg-black/10 px-3 py-1.5 text-sm outline-none focus:border-white/20"
              />
              <button
                type="button"
                onClick={addLink}
                className="rounded-lg border border-violet-300/25 bg-violet-500/10 px-3 py-1.5 text-sm hover:bg-violet-500/15 text-violet-100 font-semibold"
              >
                Add
              </button>
            </div>

            {links.length ? (
              <div className="mt-3 space-y-2">
                {links.map((v) => (
                  <div key={v} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                    <a className="text-sm truncate hover:underline" href={v} target="_blank" rel="noreferrer">
                      {v}
                    </a>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs rounded-full border border-white/10 bg-black/10 px-2 py-1 hover:bg-white/10"
                        onClick={() => safeCopy(v)}
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        className="text-xs rounded-full border border-white/10 bg-black/10 px-2 py-1 hover:bg-white/10"
                        onClick={() => removeLink(v)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm opacity-70">No links yet.</div>
            )}
          </div>

          {/* About */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold opacity-80">About</div>
              <span className="text-[11px] rounded-full border border-white/10 bg-black/10 px-2 py-0.5 opacity-70">
                UI-only
              </span>
            </div>

            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={4}
              placeholder="Add a short description, rules, or context for this room…"
              className="w-full rounded-lg border border-white/10 bg-black/10 px-3 py-1.5 text-sm outline-none focus:border-white/20 resize-none"
            />
            <div className="mt-2 text-xs opacity-60">
              Saved locally for now. Later this becomes pinned + server-backed metadata.
            </div>
          </div>
        </div>
      </div>
    );
  }, [tab, roomId, roomLabel, memberCount, links, newLink, about]);

  const leftPane = useMemo(() => {
    if (tab !== "chat") {
      return (
        <div className="opacity-80">
          <div className="text-sm font-semibold mb-2">{tab === "media" ? "Media" : "Activity"}</div>
          <div className="text-sm opacity-70">
            Center panel is reserved for chat by default. Later we can let Media/Activity take over the canvas.
          </div>
        </div>
      );
    }

    return (
      <div className="min-w-0" style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-xs font-semibold text-white/75 tracking-wide">Room Chat</div>
          <span className="text-xs rounded-full border border-white/10 px-2 py-0.5 opacity-80">{roomId}</span>
        </div>

        <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column"}}>
          <RoomChatPanel roomId={roomId} style={{flex:1,minHeight:0,display:"flex",flexDirection:"column"}} />

<div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
  <div className="flex items-center justify-between">
    <div className="text-xs font-semibold text-white/75 tracking-wide">Modules</div>
    <div className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/55">coming soon</div>
  </div>
  <div className="mt-2 flex flex-wrap gap-2">
    {["Audio", "Video", "Games", "URL", "Tools"].map((x) => (
      <span key={x} className="text-[11px] rounded-full border border-white/10 bg-black/10 px-2 py-1 opacity-70">{x}</span>
    ))}
  </div>
</div>
        </div>
      </div>
    );
  }, [tab, roomId]);

  return (
    <div className="min-w-0">
      <RoomHeader
      onOpenDetails={() => openSheet("roomDetails", { roomId })}
      title={roomLabel}
      subtitle={`${roomLabel} • ${memberCount} online`}
      memberCount={memberCount}
    />

      <div className="flex gap-2 px-3 py-2 border-b border-white/10">
        {[
          { id: "chat", label: "Chat" },
          { id: "media", label: "Media" },
          { id: "activity", label: "Activity" },
        ].map((x) => {
          const active = tab === (x.id as any);
          return (
            <button
              key={x.id}
              onClick={() => setTab(x.id as any)}
              className={
                "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors " +
                (active
                  ? "border-violet-300/25 bg-violet-500/10 hover:bg-violet-500/15 text-violet-100"
                  : "border-white/10 bg-white/5 hover:bg-white/10 text-white/90")
              }
            >
              {x.label}
            </button>
          );
        })}
      </div>

      {tab === "chat" ? (
        <RoomBody left={leftPane} right={rightPane} />
      ) : tab === "media" ? (
        <div className="p-4 opacity-85">
          <div className="font-extrabold mb-1">Media</div>
          <div className="text-sm opacity-80">Placeholder panel. Next: attachments grid / voice / clips.</div>
        </div>
      ) : (
        <div className="p-4 opacity-85">
          <div className="font-extrabold mb-1">Activity</div>
          <div className="text-sm opacity-80">Placeholder panel. Next: joins/leaves, mod actions, room events.</div>
        </div>
      )}
    </div>
  );
}







