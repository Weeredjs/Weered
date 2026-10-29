"use client";

// Design mode's left panel: the blocks palette, tabs & layout, and the lobby's words.
import React, { useEffect, useMemo, useState } from "react";
import {
  BLOCK_CATALOG,
  TAB_BLURB,
  TAB_DEFAULT_LABEL,
  type BlockType,
  type HeroMode,
  type LobbyLayout,
  type TabId,
} from "../../lib/lobbyLayout";
import { API, chip, input, label } from "./designerKit";

type Room = { id: string; name: string };

// ── Blocks palette ─────────────────────────────────────────────────────────
export function BlocksPalette({
  accent,
  onAdd,
  hasBlocks,
  onStarter,
}: {
  accent: string;
  onAdd: (t: BlockType) => void;
  hasBlocks: boolean;
  onStarter: () => void;
}) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const list = BLOCK_CATALOG.filter(
      (c) => !q || `${c.name} ${c.blurb}`.toLowerCase().includes(q.toLowerCase()),
    );
    const g: Record<string, typeof list> = {};
    for (const c of list) (g[c.group] ||= []).push(c);
    return g;
  }, [q]);
  return (
    <div>
      {!hasBlocks && (
        <button
          onClick={onStarter}
          style={{
            width: "100%",
            margin: "10px 0 4px",
            padding: "12px",
            borderRadius: 12,
            border: `1px solid ${accent}`,
            background: `linear-gradient(135deg, ${accent}33, transparent)`,
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          ✦ Start me off
          <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.7, marginTop: 2 }}>
            A Home page with a welcome, rooms, events and your game. Make it the landing tab.
          </div>
        </button>
      )}
      <input
        placeholder="Find a block…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ ...input, marginTop: 10 }}
        aria-label="Find a block"
      />
      {Object.entries(groups).map(([g, items]) => (
        <div key={g}>
          <div style={label}>{g}</div>
          <div style={{ display: "grid", gap: 6 }}>
            {items.map((c) => (
              <button
                key={c.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/x-weered-new", c.type);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onAdd(c.type)}
                title="Click to add, or drag onto the page"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 11,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "rgba(255,255,255,.03)",
                  color: "inherit",
                  textAlign: "left",
                  cursor: "grab",
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    display: "grid",
                    placeItems: "center",
                    background: `${accent}22`,
                    fontSize: 17,
                    flexShrink: 0,
                  }}
                >
                  {c.icon}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 800, fontSize: 13 }}>{c.name}</span>
                  <span style={{ display: "block", fontSize: 11, opacity: 0.6 }}>{c.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tabs & layout ──────────────────────────────────────────────────────────
export function TabsEditor({
  accent,
  layout,
  tabs,
  onMove,
  onPatch,
  onLanding,
  onHero,
  onShow,
}: {
  accent: string;
  layout: LobbyLayout;
  tabs: { id: TabId; label?: string; hidden?: boolean }[];
  onMove: (from: number, to: number) => void;
  onPatch: (id: TabId, patch: { label?: string; hidden?: boolean }) => void;
  onLanding: (id: TabId) => void;
  onHero: (h: HeroMode) => void;
  onShow: (t: TabId) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  return (
    <div>
      <div style={label}>Header</div>
      <div style={{ display: "flex", gap: 6 }}>
        {(["full", "compact", "hidden"] as HeroMode[]).map((h) => (
          <button
            key={h}
            style={{ ...chip(layout.hero === h, accent), flex: 1 }}
            onClick={() => onHero(h)}
          >
            {h === "full" ? "Banner" : h === "compact" ? "Slim" : "None"}
          </button>
        ))}
      </div>
      <div style={label}>Tabs · drag to reorder</div>
      <div style={{ display: "grid", gap: 6 }}>
        {tabs.map((t, i) => (
          <div
            key={t.id}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null && drag !== i) onMove(drag, i);
              setDrag(null);
            }}
            style={{
              padding: 10,
              borderRadius: 11,
              border: `1px solid ${layout.landing === t.id ? accent : "rgba(255,255,255,.08)"}`,
              background: drag === i ? `${accent}22` : "rgba(255,255,255,.03)",
              opacity: t.hidden ? 0.55 : 1,
              cursor: "grab",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ opacity: 0.4 }}>⋮⋮</span>
              <input
                value={t.label ?? ""}
                placeholder={TAB_DEFAULT_LABEL[t.id]}
                onChange={(e) => onPatch(t.id, { label: e.target.value.slice(0, 24) || undefined })}
                onFocus={() => onShow(t.id)}
                aria-label={`Label for the ${TAB_DEFAULT_LABEL[t.id]} tab`}
                style={{ ...input, padding: "6px 8px", flex: 1 }}
              />
              <button
                title={t.hidden ? "Show tab" : "Hide tab"}
                aria-label={t.hidden ? "Show tab" : "Hide tab"}
                disabled={layout.landing === t.id}
                onClick={() => onPatch(t.id, { hidden: !t.hidden })}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 15,
                  opacity: layout.landing === t.id ? 0.3 : 1,
                }}
              >
                {t.hidden ? "◌" : "👁"}
              </button>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 6,
              }}
            >
              <span style={{ fontSize: 11, opacity: 0.55 }}>{TAB_BLURB[t.id]}</span>
              <button
                onClick={() => onLanding(t.id)}
                style={{
                  ...chip(layout.landing === t.id, accent),
                  padding: "3px 8px",
                  fontSize: 10,
                }}
              >
                {layout.landing === t.id ? "★ Landing" : "Make landing"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Lobby words + room order ───────────────────────────────────────────────
export function LobbyWords({
  accent,
  lobbyId,
  name,
  desc,
  onName,
  onDesc,
  roomOrder,
  onRoomOrder,
}: {
  accent: string;
  lobbyId: string;
  name: string;
  desc: string;
  onName: (s: string) => void;
  onDesc: (s: string) => void;
  roomOrder: string[];
  onRoomOrder: (ids: string[]) => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  useEffect(() => {
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/rooms`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setRooms(Array.isArray(j?.rooms) ? j.rooms : []))
      .catch(() => {});
  }, [lobbyId]);
  const ordered = useMemo(() => {
    const rank = (id: string) => {
      const i = roomOrder.indexOf(id);
      return i < 0 ? 1e6 : i;
    };
    return [...rooms].sort((a, b) => rank(a.id) - rank(b.id));
  }, [rooms, roomOrder]);
  return (
    <div>
      <div style={label}>Name</div>
      <input
        value={name}
        onChange={(e) => onName(e.target.value.slice(0, 100))}
        style={input}
        aria-label="Lobby name"
      />
      <div style={label}>One-liner</div>
      <textarea
        value={desc}
        onChange={(e) => onDesc(e.target.value.slice(0, 500))}
        rows={3}
        style={{ ...input, resize: "vertical" }}
        aria-label="Lobby description"
      />
      <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>Saved when you publish.</div>
      <div style={label}>Room order · drag</div>
      <div style={{ display: "grid", gap: 6 }}>
        {ordered.map((r, i) => (
          <div
            key={r.id}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag === null || drag === i) return;
              const ids = ordered.map((x) => x.id);
              const [m] = ids.splice(drag, 1);
              ids.splice(i, 0, m);
              onRoomOrder(ids);
              setDrag(null);
            }}
            style={{
              padding: "9px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.08)",
              background: drag === i ? `${accent}22` : "rgba(255,255,255,.03)",
              cursor: "grab",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <span style={{ opacity: 0.4, marginRight: 8 }}>⋮⋮</span>
            {r.name}
          </div>
        ))}
        {!rooms.length && (
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            No rooms yet. Add them from the Admin page.
          </div>
        )}
      </div>
      <a
        href={`/lobby/${encodeURIComponent(lobbyId)}/admin`}
        style={{
          display: "inline-block",
          marginTop: 14,
          fontSize: 12,
          color: accent,
          fontWeight: 700,
        }}
      >
        Roles, rooms and moderation live in Admin →
      </a>
    </div>
  );
}
