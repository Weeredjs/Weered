"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "./WeeredProvider";
import { ui } from "./weeredUi";

type Mode = "rooms" | "people";
type RoomLite = { id: string; name: string; locked?: boolean; count?: number | null };
type PersonLite = { id?: string; name?: string; username?: string; role?: string };

function pickFirstString(...vals: any[]) {
  for (const v of vals) { const s = String(v ?? "").trim(); if (s) return s; }
  return "";
}

export default function LobbyHeaderBar({ title = "Lobby", subtitle }: { title?: string; subtitle?: string }) {
  const router = useRouter();
  const w = useWeered() as any;

  const [mode, setMode]   = React.useState<Mode>("rooms");
  const [q, setQ]         = React.useState("");
  const [open, setOpen]   = React.useState(false);
  const [idx, setIdx]     = React.useState(0);
  const [rooms, setRooms] = React.useState<RoomLite[]>([]);

  // Rooms list feed
  React.useEffect(() => {
    const onRooms = (ev: any) => setRooms(Array.isArray(ev?.detail) ? ev.detail : []);
    window.addEventListener("weered:rooms:updated", onRooms as any);
    return () => window.removeEventListener("weered:rooms:updated", onRooms as any);
  }, []);

  const people: PersonLite[] = React.useMemo(() => Array.isArray(w?.users) ? w.users : [], [w?.users]);
  const query = q.trim().toLowerCase();

  const results = React.useMemo(() => {
    if (!query) return [];
    if (mode === "rooms") {
      return (rooms || [])
        .filter(r => (r.name || r.id).toLowerCase().includes(query) || r.id.toLowerCase().includes(query))
        .slice(0, 10)
        .map(r => ({ kind: "room" as const, key: r.id, room: r }));
    }
    if (mode === "people") {
      return (people || [])
        .filter(u => pickFirstString(u?.name, u?.username, u?.id).toLowerCase().includes(query))
        .slice(0, 10)
        .map(u => ({ kind: "person" as const, key: pickFirstString(u?.id, u?.username, u?.name), person: u }));
    }
    return [];
  }, [mode, query, rooms, people]);

  React.useEffect(() => { setIdx(0); }, [mode, q]);

  function choose(i: number) {
    const r: any = results[i];
    if (!r) return;
    if (r.kind === "room") { router.push(`/room/${r.room.id}`); setOpen(false); return; }
    if (r.kind === "person") {
      try { window.dispatchEvent(new CustomEvent("weered:overlay:open", { detail: { sheet: "profile", userId: pickFirstString(r.person?.id, r.person?.username, r.person?.name) } })); } catch {}
      setOpen(false); return;
    }
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(cur => Math.min(cur + 1, Math.max(0, results.length - 1))); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setIdx(cur => Math.max(0, cur - 1)); return; }
    if (e.key === "Enter" && open && results.length) { e.preventDefault(); choose(idx); return; }
  }

  function openBrowse() {
    window.dispatchEvent(new CustomEvent("weered:lobby:browse"));
  }

  const placeholder = mode === "rooms" ? "Search rooms" : "Search people";

  return (
    <div className={ui.panel} style={{ position: "relative", flexShrink: 0 }}>
      <div className={ui.panelHeader}>
        <div className="min-w-0">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className={ui.panelTitle}>{title}</div>
            {subtitle && <div className={`${ui.muted} text-xs truncate`}>{subtitle}</div>}
          </div>
          <div className={`${ui.muted} text-xs mt-0.5`}>Browse content, find rooms, and connect with people.</div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode tabs — Rooms + People only (subreddits replaced by ContentHub) */}
          <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            {(["rooms", "people"] as Mode[]).map(m => (
              <button key={m} type="button"
                className={"rounded-lg px-2 py-1 text-xs font-semibold " + (mode === m ? "bg-white/15" : "opacity-70 hover:bg-white/10")}
                onClick={() => setMode(m)}>
                {m === "rooms" ? "Rooms" : "People"}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
            <input
              className="weered-input w-full"
              placeholder={placeholder}
              value={q}
              onChange={e => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onKeyDown={onKeyDown}
            />

            {open && q.trim() && results.length ? (
              <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 5000, borderRadius: 14, border: "1px solid var(--weered-border2)", background: "var(--weered-panel2)", overflow: "hidden" }}>
                {results.map((r: any, i: number) => {
                  const active = i === idx;
                  const base: React.CSSProperties = { width: "100%", textAlign: "left", padding: "10px 12px", border: "none", cursor: "pointer", background: active ? "rgba(124,58,237,.18)" : "transparent", color: "rgba(243,244,246,.98)", display: "flex", justifyContent: "space-between", gap: 10 };
                  if (r.kind === "room") return (
                    <button key={r.key} type="button" onMouseEnter={() => setIdx(i)} onMouseDown={e => e.preventDefault()} onClick={() => choose(i)} style={base}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.room.name || r.room.id}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>room · {r.room.locked ? "locked" : "open"}</div>
                      </div>
                      {typeof r.room.count === "number" && <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>{r.room.count} online</div>}
                    </button>
                  );
                  if (r.kind === "person") return (
                    <button key={r.key} type="button" onMouseEnter={() => setIdx(i)} onMouseDown={e => e.preventDefault()} onClick={() => choose(i)} style={base}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pickFirstString(r.person?.name, r.person?.username, r.person?.id)}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>person</div>
                      </div>
                    </button>
                  );
                  return null;
                })}
              </div>
            ) : null}
          </div>

          {/* Browse button */}
          <button type="button" className="weered-btn" onClick={openBrowse}>
            Browse Rooms
          </button>

          <button type="button" className="weered-btn" onClick={() => { setQ(""); setOpen(false); }} disabled={!q.trim()}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
