"use client";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { GlobalRole, STAFF_ERRORS, StaffRoom, apiFetch } from "./shared";
import { ago } from "./TodayTab";

const SHOW = 100;
const FILTERS = [
  ["all", "All"],
  ["live", "Live now"],
  ["pinned", "Pinned"],
  ["lobby", "Lobby chats"],
  ["admin", "Admin chats"],
] as const;
const ERRORS: Record<string, string> = {
  ...STAFF_ERRORS,
  protected_room: "That chat belongs to its lobby or to staff; it can't be closed on its own.",
  not_found: "That room is gone.",
};

const hrefOf = (r: StaffRoom) =>
  r.kind === "lobby" ? `/lobby/${encodeURIComponent(r.id)}` : `/room/${encodeURIComponent(r.id)}`;

// Every room on Weered (rebuilt 2026-11-02). A lobby's own chat, its admin chat
// and ops chat are named for whose they are and can't be closed from here (they
// listed as "(unnamed)", and one click on Delete erased a lobby's history).
// Pins come from the database, so they survive a restart.
export function RoomsTab({ myRole }: { myRole: GlobalRole }) {
  const [rooms, setRooms] = useState<StaffRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [flash, setFlash] = useState<{ text: string; bad?: boolean } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const canEdit = myRole !== "SUPPORT";

  useEffect(() => {
    void apiFetch("/staff/rooms")
      .then((j) => setRooms(j.rooms || []))
      .finally(() => setLoading(false));
  }, []);

  const say = (j: any, ok: string) =>
    setFlash(
      j?.ok
        ? { text: ok }
        : { text: ERRORS[j?.error] || j?.error || "That didn't work.", bad: true },
    );

  async function rename(r: StaffRoom) {
    const name = editName.trim();
    if (!name) return;
    const j = await apiFetch(`/staff/rooms/${encodeURIComponent(r.id)}/rename`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    say(j, `Renamed to ${name}.`);
    if (j.ok) {
      setRooms((prev) => prev.map((x) => (x.id === r.id ? { ...x, name } : x)));
      setEditId(null);
    }
  }

  async function pin(r: StaffRoom) {
    const j = await apiFetch(`/staff/rooms/${encodeURIComponent(r.id)}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned: !r.pinned }),
    });
    say(j, r.pinned ? "Unpinned." : "Pinned.");
    if (j.ok)
      setRooms((prev) => prev.map((x) => (x.id === r.id ? { ...x, pinned: !r.pinned } : x)));
  }

  async function close(r: StaffRoom) {
    if (
      !confirm(
        `Close "${r.name || r.id}"? Everyone in it is sent out, and the room and its history are deleted.`,
      )
    )
      return;
    const j = await apiFetch(`/staff/rooms/${encodeURIComponent(r.id)}/close`, { method: "POST" });
    say(j, `Closed ${r.name || r.id}.`);
    if (j.ok) setRooms((prev) => prev.filter((x) => x.id !== r.id));
  }

  const matches = useMemo(() => {
    const f = q.trim().toLowerCase();
    return rooms
      .filter((r) =>
        filter === "live"
          ? (r.liveUsers || 0) > 0
          : filter === "pinned"
            ? r.pinned
            : filter === "lobby"
              ? r.kind === "lobby"
              : filter === "admin"
                ? r.kind === "admin" || r.kind === "ops"
                : true,
      )
      .filter((r) => !f || `${r.name} ${r.id} ${r.lobbyName || ""}`.toLowerCase().includes(f))
      .sort((a, b) => (b.liveUsers || 0) - (a.liveUsers || 0));
  }, [rooms, q, filter]);

  return (
    <div style={{ maxWidth: 980 }}>
      <div className="wops-tool">
        <input
          className="wops-input"
          placeholder="Find a room by name, id or lobby"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Find a room"
        />
        <div className="wops-seg" role="group" aria-label="Show">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="wops-note" style={{ marginBottom: 10 }}>
        {loading
          ? "Loading…"
          : matches.length > SHOW
            ? `Showing ${SHOW} of ${matches.length} (the busiest first). Search to narrow.`
            : `${matches.length} room${matches.length === 1 ? "" : "s"}.`}
      </div>
      {flash && (
        <div className="wops-flash" data-tone={flash.bad ? "bad" : undefined} role="status">
          {flash.text}
        </div>
      )}
      <div className="wops-rows">
        {matches.slice(0, SHOW).map((r) => {
          const plain = r.kind === "room" || !r.kind;
          return (
            <div key={r.id} className="wops-row">
              <div className="wops-row-who">
                {editId === r.id ? (
                  <input
                    className="wops-input"
                    style={{ minWidth: 0, width: "100%" }}
                    value={editName}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void rename(r);
                      if (e.key === "Escape") setEditId(null);
                    }}
                    aria-label="New room name"
                  />
                ) : (
                  <b>{r.name || <span className="wops-note">Untitled room</span>}</b>
                )}
                <span>
                  {r.id}
                  {r.lobbyName && r.kind === "room" ? ` · in ${r.lobbyName}` : ""} · {r.members}{" "}
                  member
                  {r.members === 1 ? "" : "s"}
                  {r.lastActiveAt ? ` · active ${ago(new Date(r.lastActiveAt).toISOString())}` : ""}
                </span>
              </div>
              {(r.liveUsers || 0) > 0 && <span className="wops-tag">{r.liveUsers} in now</span>}
              {r.pinned && (
                <span className="wops-tag" data-tone="staff">
                  Pinned
                </span>
              )}
              {r.locked && (
                <span className="wops-tag" data-tone="staff">
                  Locked
                </span>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {canEdit && plain && editId === r.id && (
                  <button type="button" className="wops-btn" onClick={() => void rename(r)}>
                    Save
                  </button>
                )}
                {canEdit && plain && editId !== r.id && (
                  <button
                    type="button"
                    className="wops-btn"
                    onClick={() => {
                      setEditId(r.id);
                      setEditName(r.name || "");
                    }}
                  >
                    Rename
                  </button>
                )}
                {canEdit && plain && (
                  <button type="button" className="wops-btn" onClick={() => void pin(r)}>
                    {r.pinned ? "Unpin" : "Pin"}
                  </button>
                )}
                {canEdit && plain && (
                  <button
                    type="button"
                    className="wops-btn"
                    style={{ borderColor: "rgb(248 113 113 / .4)" }}
                    onClick={() => void close(r)}
                  >
                    Close
                  </button>
                )}
                {r.kind !== "admin" && r.kind !== "ops" && (
                  <a
                    className="wops-btn"
                    href={hrefOf(r)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
