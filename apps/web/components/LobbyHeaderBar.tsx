"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered } from "./WeeredProvider";
import { ui } from "./weeredUi";

type Mode = "subreddits" | "rooms" | "people";

type RoomLite = { id: string; name: string; locked?: boolean; count?: number | null };
type PersonLite = { id?: string; name?: string; username?: string; role?: string };

function pickFirstString(...vals: any[]) {
 for (const v of vals) {
 const s = String(v ?? "").trim();
 if (s) return s;
 }
 return "";
}

export default function LobbyHeaderBar({ title = "Lobby", subtitle }: { title?: string; subtitle?: string }) {
 const router = useRouter();
 const { openSheet } = useOverlay();
 const w = useWeered() as any;

 const [mode, setMode] = React.useState<Mode>("subreddits");
 const [q, setQ] = React.useState("");
 const [open, setOpen] = React.useState(false);
 const [idx, setIdx] = React.useState(0);

 const [rooms, setRooms] = React.useState<RoomLite[]>([]);

 // rooms list feed (published by LobbyRoomsList)
 React.useEffect(() => {
 const onRooms = (ev: any) => {
 const list = Array.isArray(ev?.detail) ? ev.detail : [];
 setRooms(list);
 };
 window.addEventListener("weered:rooms:updated", onRooms as any);
 return () => window.removeEventListener("weered:rooms:updated", onRooms as any);
 }, []);

 const people: PersonLite[] = React.useMemo(() => {
 const list = Array.isArray(w?.users) ? w.users : [];
 return list;
 }, [w?.users]);

 const query = q.trim().toLowerCase();

 const results = React.useMemo(() => {
 if (!query) return [];

 if (mode === "rooms") {
 return (rooms || [])
 .filter((r) => (r.name || r.id).toLowerCase().includes(query) || r.id.toLowerCase().includes(query))
 .slice(0, 10)
 .map((r) => ({ kind: "room" as const, key: r.id, room: r }));
 }

 if (mode === "people") {
 return (people || [])
 .filter((u) => {
 const nm = pickFirstString(u?.name, u?.username, u?.id).toLowerCase();
 return nm.includes(query);
 })
 .slice(0, 10)
 .map((u) => ({
 kind: "person" as const,
 key: pickFirstString(u?.id, u?.username, u?.name),
 person: u,
 }));
 }

 // subreddits (v0): just suggest current typed string
 return [{ kind: "sub" as const, key: query, sub: query }];
 }, [mode, query, rooms, people]);

 React.useEffect(() => {
 setIdx(0);
 }, [mode, q]);

 function toggleDock() {
 window.dispatchEvent(new CustomEvent("weered:dock:toggle"));
 }

 function openProfileMe() {
 openSheet("profile", { userId: "me" });
 }

 function openSettings() {
 openSheet("settings");
 }

 function choose(i: number) {
 const r: any = results[i];
 if (!r) return;

 if (r.kind === "room") {
 router.push("/room/");
 setOpen(false);
 return;
 }

 if (r.kind === "person") {
 const uid = pickFirstString(r.person?.id, r.person?.username, r.person?.name);
 openSheet("profile", { userId: uid });
 setOpen(false);
 return;
 }

 if (r.kind === "sub") {
 // v0: just keep typed query; next we will actually select in browser
 setOpen(false);
 return;
 }
 }

 function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
 if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) setOpen(true);

 if (e.key === "Escape") {
 setOpen(false);
 return;
 }

 if (e.key === "ArrowDown") {
 e.preventDefault();
 setIdx((cur) => Math.min(cur + 1, Math.max(0, results.length - 1)));
 return;
 }

 if (e.key === "ArrowUp") {
 e.preventDefault();
 setIdx((cur) => Math.max(0, cur - 1));
 return;
 }

 if (e.key === "Enter") {
 if (open && results.length) {
 e.preventDefault();
 choose(idx);
 }
 return;
 }
 }

 return (
 <div className={`${ui.panel} mb-3`} style={{ position: "relative" }}>
 <div className={ui.panelHeader}>
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <div className={ui.panelTitle}>{title}</div>
 {subtitle ? <div className={`${ui.muted} text-xs truncate`}>{subtitle}</div> : null}
 </div>
 <div className={`${ui.muted} text-xs mt-0.5`}>Navigate, search, and manage the lobby.</div>
 </div>

 <div className="flex items-center gap-2">
 <button type="button" className={ui.btn} onClick={openProfileMe}>Profile</button>
 <button type="button" className={ui.btn} onClick={openSettings}>Settings</button>
 <button type="button" className={ui.btn} onClick={toggleDock}>Dock</button>
 </div>
 </div>

 <div className="px-4 pb-3">
 <div className="flex flex-wrap items-center gap-2">
 <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
 {(["subreddits","rooms","people"] as Mode[]).map((m) => (
 <button
 key={m}
 type="button"
 className={
 "rounded-lg px-2 py-1 text-xs font-semibold " +
 (mode === m ? "bg-white/15" : "opacity-70 hover:bg-white/10")
 }
 onClick={() => setMode(m)}
 >
 {m === "subreddits" ? "Subreddits" : m === "rooms" ? "Rooms" : "People"}
 </button>
 ))}
 </div>

 <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
 <input
 className="weered-input w-full"
 placeholder={mode === "subreddits" ? "Search subreddits (v0)" : mode === "rooms" ? "Search rooms" : "Search people"}
 value={q}
 onChange={(e) => { setQ(e.target.value); setOpen(true); }}
 onFocus={() => setOpen(true)}
 onBlur={() => setTimeout(() => setOpen(false), 120)}
 onKeyDown={onKeyDown}
 />

 {open && q.trim() && results.length ? (
 <div
 style={{
 position: "absolute",
 left: 0,
 right: 0,
 top: "calc(100% + 6px)",
 zIndex: 5000,
 borderRadius: 14,
 border: "1px solid var(--weered-border2, rgba(255,255,255,.10))",
 background: "var(--weered-panel2, rgba(0,0,0,.65))",
 overflow: "hidden",
 }}
 >
 {results.map((r: any, i: number) => {
 const active = i === idx;
 if (r.kind === "room") {
 const nm = r.room.name || r.room.id;
 return (
 <button
 key={r.key}
 type="button"
 onMouseEnter={() => setIdx(i)}
 onMouseDown={(e) => e.preventDefault()}
 onClick={() => choose(i)}
 style={{
 width: "100%",
 textAlign: "left",
 padding: "10px 12px",
 border: "none",
 cursor: "pointer",
 background: active ? "rgba(124,58,237,.18)" : "transparent",
 color: "rgba(243,244,246,.98)",
 display: "flex",
 justifyContent: "space-between",
 gap: 10,
 }}
 >
 <div style={{ minWidth: 0 }}>
 <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nm}</div>
 <div style={{ fontSize: 12, opacity: 0.7 }}>room ƒ€š‚· {r.room.locked ? "locked" : "open"}</div>
 </div>
 {typeof r.room.count === "number" ? (
 <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>{r.room.count} online</div>
 ) : null}
 </button>
 );
 }

 if (r.kind === "person") {
 const nm = pickFirstString(r.person?.name, r.person?.username, r.person?.id);
 const role = String(r.person?.role || r.person?.roomRole || "").toLowerCase();
 return (
 <button
 key={r.key}
 type="button"
 onMouseEnter={() => setIdx(i)}
 onMouseDown={(e) => e.preventDefault()}
 onClick={() => choose(i)}
 style={{
 width: "100%",
 textAlign: "left",
 padding: "10px 12px",
 border: "none",
 cursor: "pointer",
 background: active ? "rgba(124,58,237,.18)" : "transparent",
 color: "rgba(243,244,246,.98)",
 display: "flex",
 justifyContent: "space-between",
 gap: 10,
 }}
 >
 <div style={{ minWidth: 0 }}>
 <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nm}</div>
 <div style={{ fontSize: 12, opacity: 0.7 }}>person</div>
 </div>
 {role ? (
 <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>{role}</div>
 ) : null}
 </button>
 );
 }

 // sub
 return (
 <div key={r.key} style={{ padding: "10px 12px", fontSize: 12, opacity: 0.8 }}>
 Subreddits v1 coming next.
 </div>
 );
 })}
 </div>
 ) : null}
 </div>

 <button type="button" className="weered-btn" onClick={() => { setQ(""); setOpen(false); }} disabled={!q.trim()}>
 Clear
 </button>
 </div>

 <div className={`${ui.muted} text-[11px] mt-2`}>
 Rooms + People dropdown is live. Next: subreddit results + keyboard shortcuts.
 </div>
 </div>
 </div>
 );
}


