"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeered } from "./WeeredProvider";
import { ui } from "./weeredUi";

import ModeratorToolsPanel from "./ModeratorToolsPanel";
type Props = { contextLabel?: string };

type RoomRow = {
  id: string;
  name?: string;
  locked?: boolean;
  users?: number;
  memberCount?: number;
};

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";

function pickRoomIdFromPath(pathname: string | null | undefined) {
  if (!pathname) return "lobby";
  if (pathname === "/lobby") return "lobby";
  if (pathname.startsWith("/room/")) return decodeURIComponent(pathname.replace("/room/", ""));
  return "lobby";
}

function MicCamPill({ u }: { u: any }) {
  const mic = u?.micEnabled ?? u?.mic ?? u?.audioEnabled ?? u?.audio;
  const cam = u?.videoEnabled ?? u?.camEnabled ?? u?.cam ?? u?.video;

  const hasAny = mic !== undefined || cam !== undefined;
  if (!hasAny) return <span className={`${ui.muted} text-[11px]`}></span>;

  return (
    <span className={`${ui.muted} text-[11px]`}>
      {mic ? "mic" : "mic-off"} · {cam ? "cam" : "cam-off"}
    </span>
  );
}

function RoomsPanel({ currentRoomId }: { currentRoomId: string }) {
  const [q, setQ] = React.useState("");
  const [newRoom, setNewRoom] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const [rows, setRows] = React.useState<RoomRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(API_BASE + "/rooms", { cache: "no-store", credentials: "include" });
      const j = await r.json();
      const list = Array.isArray(j?.rooms) ? (j.rooms as RoomRow[]) : [];
      setRows(list);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function createRoom() {
    const id = newRoom.trim();
    if (!id) return;
    setCreating(true);
    setErr("");
    try {
      const r = await fetch(API_BASE + "/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, name: id }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "create failed");
      setNewRoom("");
      await load();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setCreating(false);
    }
  }

  React.useEffect(() => {
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = rows
    .map((r) => ({
      ...r,
      id: String((r as any).id || (r as any).roomId || ""),
      name: (r as any).name || (r as any).title || "",
      users: Number((r as any).users ?? (r as any).memberCount ?? 0),
      locked: !!(r as any).locked,
    }))
    .filter((r) => r.id)
    .filter((r) => {
      const s = (r.id + " " + (r.name || "")).toLowerCase();
      return s.includes(q.trim().toLowerCase());
    })
    .sort((a, b) => (b.users || 0) - (a.users || 0));

  return (
    <div className="mb-4">
      <div className={`${ui.muted} text-xs mb-2`}>Rooms</div>

      <div className="weered-panel2 p-3 overflow-hidden">
        {/* Create row */}
        <div className="flex gap-2 items-center">
          <input
            className="weered-input"
            placeholder="Create room | (e.g. lobby:r/all)"
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            style={{ width: "100%" }}
          />
          <button className="weered-btn" type="button" onClick={createRoom} disabled={creating || !newRoom.trim()}>
            {creating ? "" : "Create"}
          </button>
        </div>

        <div style={{ height: 8 }} />

        {/* Search row */}
        <div className="flex gap-2 items-center">
          <input
            className="weered-input"
            placeholder="Search rooms"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: "100%" }}
          />
          <button className="weered-btn" type="button" onClick={load} disabled={loading} title="Refresh">
            {loading ? "" : ""}
          </button>
        </div>

        <div style={{ height: 10 }} />

        {err ? (
          <div className={`${ui.muted} text-xs`}>Rooms error: {err}</div>
        ) : filtered.length === 0 ? (
          <div className={`${ui.muted} text-xs`}>{loading ? "Loading rooms..." : "No rooms found."}</div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {filtered.slice(0, 60).map((rm) => {
              const isActive = rm.id === currentRoomId;
              return (
                <Link
                  key={rm.id}
                  href={"/room/" + encodeURIComponent(rm.id)}
                  className={"weered-row block " + (isActive ? "weered-row-active" : "")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {rm.name || rm.id}
                        {rm.locked ? <span className={`${ui.muted} text-xs ml-2`}></span> : null}
                      </div>
                      {rm.name ? <div className={`${ui.muted} text-xs truncate`}>{rm.id}</div> : null}
                      <div className={`${ui.muted} text-xs truncate`}>{rm.users ?? 0} members</div>
                    </div>
                    <span className="px-2 py-1 rounded-full text-[11px] border border-white/10 bg-white/5 opacity-80">open</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CurrentRoomPanel({ currentRoomId }: { currentRoomId: string }) {
  const w = useWeered();
  const me = (w as any).me;
  const users = Array.isArray((w as any).users) ? (w as any).users : [];
  const roomId = (w as any).roomId || currentRoomId;

  const sample = users.slice(0, 6);

  return (
    <div className="mb-4">
      <div className={`${ui.muted} text-xs mb-2`}>Current room</div>

      <div className="weered-panel2 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{String(roomId || "unknown")}</div>
            <div className={`${ui.muted} text-xs`}>{users.length} online</div>
          </div>
          {me ? <span className="px-2 py-1 rounded-full text-[11px] border border-white/10 bg-white/5 opacity-80">you</span> : null}
        </div>

        {sample.length === 0 ? (
          <div className={`${ui.muted} text-xs`}>No presence users yet.</div>
        ) : (
          <div className="space-y-2">
            {sample.map((u: any) => {
              const name = String(u?.name || u?.username || u?.id || "user");
              const role = String(u?.role || u?.roomRole || "").toUpperCase();
              return (
                <div key={String(u?.id || name)} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {name} {role ? <span className={`${ui.muted} text-[10px] ml-2`}>{role}</span> : null}
                    </div>
                    <MicCamPill u={u} />
                  </div>
                  <span className="px-2 py-1 rounded-full text-[11px] border border-white/10 bg-white/5 opacity-80">live</span>
                </div>
              );
            })}
          </div>
        )}

        <div className={`${ui.muted} text-[11px] mt-2`}>
          Mic/cam renders only if those flags exist on presence users (we can wire later).
        </div>
      </div>
    </div>
  );
}

export default function RightRail({ contextLabel = "lobby" }: Props) {
  const pathname = usePathname();
  const ctxLabel = (() => {
    if (!pathname) return contextLabel;
    if (pathname === "/lobby") return "lobby";
    if (pathname.startsWith("/room/")) return "room: " + decodeURIComponent(pathname.replace("/room/", ""));
    return pathname;
  })();

  const currentRoomId = pickRoomIdFromPath(pathname);

  const w = useWeered() as any;
  const me = w?.me;
  const role = String(me?.role || me?.roomRole || "").toUpperCase();
  const isAdmin = role === "OWNER" || role === "ADMIN" || role === "MOD";
  return (
    <div className="hidden xl:block w-full">
      <div className={"weered-panel sticky top-3 max-h-[calc(100vh-24px)] overflow-hidden " + ui.panel}>
        <div className={ui.panelHeader}>
          <div className="min-w-0">
            <div className={ui.panelTitle}>Control Panel</div>
            <div className={`${ui.muted} text-xs truncate`}>context: {ctxLabel}</div>
          </div>
          <span className="px-2 py-1 rounded-full text-[11px] border border-white/10 bg-white/5 opacity-80">tools</span>
        </div>

        <div className={ui.panelBody + " overflow-auto"}>
          <RoomsPanel currentRoomId={currentRoomId} />
          <CurrentRoomPanel currentRoomId={currentRoomId} />

          <div className="mb-4">
            <div className={`${ui.muted} text-xs mb-2`}>Quick actions</div>
            <div className="grid grid-cols-2 gap-2">
              <a className="weered-btn" href="/lobby">Lobby</a>
              <a className="weered-btn" href="/lobby?sub=r/all">r/all</a>
              <a className="weered-btn" href="/room/@me">@me</a>
              <button className="weered-btn" type="button" onClick={() => location.reload()}>
                Refresh UI
              </button>
            </div>
          </div>

          {isAdmin ? (<ModeratorToolsPanel roomId={currentRoomId} title="Moderator Tools" />) : null}
        </div>
      </div>
    </div>
  );
}







