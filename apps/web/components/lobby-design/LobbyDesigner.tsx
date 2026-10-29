"use client";

// Design mode chrome: the top bar (undo, redo, domain, discard, publish), the
// left panel (blocks to drop on the Home canvas, the tab strip, the lobby's
// words and room order), the inspector for the selected block, and the theme
// dock along the bottom. The lobby itself renders the draft live underneath,
// so every change is visible the moment it's made.
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  BLOCK_CATALOG,
  SIZE_LABEL,
  TAB_BLURB,
  TAB_DEFAULT_LABEL,
  newBlock,
  starterBlocks,
  type Block,
  type BlockSize,
  type BlockType,
  type EffectId,
  type EntranceId,
  type FontId,
  type HeroMode,
  type LobbyLayout,
  type TabId,
} from "../../lib/lobbyLayout";
import {
  EFFECT_LABEL,
  FONT_LABEL,
  FONT_STACK,
  PRESET_BY_ID,
  SWATCH_WHEEL,
  THEME_PRESETS,
} from "../../lib/lobbyThemePresets";
import type { DesignState } from "./useLobbyDesign";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type Room = { id: string; name: string };

export type DesignerProps = {
  lobbyId: string;
  lobbyName: string;
  description: string;
  accent: string;
  design: DesignState;
  /** Tabs this lobby can show at all (e.g. LFG only where there's a board). */
  availableTabs: TabId[];
  hasGame: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onShowTab: (t: TabId) => void;
  domain: { host: string | null; status: string | null };
  onDomainChange: (d: { host: string | null; status: string | null }) => void;
  onPublished: (fields: { name?: string; description?: string }) => void;
};

const panel: React.CSSProperties = {
  position: "fixed",
  zIndex: 99990,
  background: "rgba(14,14,20,.92)",
  backdropFilter: "blur(14px) saturate(140%)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 16,
  boxShadow: "0 24px 60px rgba(0,0,0,.55)",
  color: "rgba(243,244,246,.92)",
};

const chip = (on: boolean, accent: string): React.CSSProperties => ({
  padding: "7px 11px",
  borderRadius: 999,
  border: `1px solid ${on ? accent : "rgba(255,255,255,.12)"}`,
  background: on ? `${accent}22` : "rgba(255,255,255,.03)",
  color: on ? "#fff" : "rgba(243,244,246,.75)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

const label: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "rgba(243,244,246,.5)",
  margin: "14px 0 8px",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(0,0,0,.35)",
  color: "inherit",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

export default function LobbyDesigner(p: DesignerProps) {
  const { design, accent } = p;
  const d = design.draft;
  const [leftTab, setLeftTab] = useState<"blocks" | "tabs" | "lobby">("blocks");
  const [leftOpen, setLeftOpen] = useState(true);
  const [dockOpen, setDockOpen] = useState(true);
  const [domainOpen, setDomainOpen] = useState(false);
  const [name, setName] = useState(p.lobbyName);
  const [desc, setDesc] = useState(p.description);
  const [confetti, setConfetti] = useState(0);
  const selected = d.blocks.find((b) => b.id === p.selectedId) || null;

  useEffect(() => setName(p.lobbyName), [p.lobbyName]);
  useEffect(() => setDesc(p.description), [p.description]);
  // Make room on the right while the inspector is open.
  useEffect(() => {
    const d = document.documentElement;
    if (selected) d.setAttribute("data-weered-inspecting", "1");
    else d.removeAttribute("data-weered-inspecting");
    return () => d.removeAttribute("data-weered-inspecting");
  }, [selected]);
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1100) {
      setLeftOpen(false);
      setDockOpen(false);
    }
  }, []);

  const set = design.setDraft;
  const ensureHome = (l: LobbyLayout): LobbyLayout =>
    l.tabs.find((t) => t.id === "home" && !t.hidden)
      ? l
      : { ...l, tabs: l.tabs.map((t) => (t.id === "home" ? { ...t, hidden: false } : t)) };

  const addBlock = (type: BlockType, beforeId: string | null = null) => {
    const b = newBlock(type);
    set((l) => {
      const blocks = [...l.blocks];
      const i = beforeId ? blocks.findIndex((x) => x.id === beforeId) : -1;
      if (i >= 0) blocks.splice(i, 0, b);
      else blocks.push(b);
      return ensureHome({ ...l, blocks });
    });
    p.onShowTab("home");
    p.onSelect(b.id);
  };

  const patchBlock = (id: string, fn: (b: Block) => Block) =>
    set((l) => ({ ...l, blocks: l.blocks.map((b) => (b.id === id ? fn(b) : b)) }));

  const moveTab = (from: number, to: number) =>
    set((l) => {
      const tabs = [...l.tabs];
      const [t] = tabs.splice(from, 1);
      tabs.splice(to, 0, t);
      return { ...l, tabs };
    });

  const pickPreset = (id: string) => {
    const pr = PRESET_BY_ID[id];
    if (!pr) return;
    set((l) => ({
      ...l,
      theme: { ...l.theme, preset: id, accent: pr.accent, effect: pr.effect, font: pr.font },
    }));
  };

  const publish = async () => {
    const extra: { name?: string; description?: string } = {};
    if (name.trim() && name.trim() !== p.lobbyName) extra.name = name.trim();
    if (desc !== p.description) extra.description = desc;
    const ok = await design.publish(extra);
    if (ok) {
      setConfetti((n) => n + 1);
      p.onPublished(extra);
    }
  };

  const tabsShown = d.tabs.filter((t) => p.availableTabs.includes(t.id));

  // Portalled to <body>: the page sits inside the shell's own stacking context,
  // where site banners would cover the panels whatever their z-index.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          ...panel,
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px 8px 16px",
          borderRadius: 999,
          maxWidth: "calc(100vw - 24px)",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontWeight: 900,
            letterSpacing: ".04em",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: accent, fontSize: 16 }}>✦</span> Design mode
        </span>
        <span
          style={{ width: 1, height: 20, background: "rgba(255,255,255,.12)", margin: "0 4px" }}
        />
        <IconBtn title="Undo (Ctrl+Z)" disabled={!design.canUndo} onClick={design.undo}>
          ↶
        </IconBtn>
        <IconBtn title="Redo (Ctrl+Shift+Z)" disabled={!design.canRedo} onClick={design.redo}>
          ↷
        </IconBtn>
        <button style={chip(leftOpen, accent)} onClick={() => setLeftOpen((v) => !v)}>
          Build
        </button>
        <button style={chip(dockOpen, accent)} onClick={() => setDockOpen((v) => !v)}>
          Theme
        </button>
        <button style={chip(domainOpen, accent)} onClick={() => setDomainOpen(true)}>
          {p.domain.host ? `🌐 ${p.domain.host}` : "🌐 Your domain"}
        </button>
        <span
          style={{
            fontSize: 12,
            color: "rgba(243,244,246,.55)",
            minWidth: 70,
            textAlign: "center",
          }}
        >
          {design.saving === "saving"
            ? "Publishing…"
            : design.saving === "saved"
              ? "● Live"
              : design.saving === "error"
                ? "Couldn't publish"
                : design.dirty
                  ? "Unpublished"
                  : "Up to date"}
        </span>
        <button
          style={{ ...chip(false, accent), color: "rgba(243,244,246,.7)" }}
          onClick={() => {
            if (design.dirty && !window.confirm("Throw away the unpublished changes?")) return;
            design.discard();
          }}
        >
          Discard
        </button>
        <button
          onClick={publish}
          disabled={design.saving === "saving"}
          style={{
            padding: "9px 18px",
            borderRadius: 999,
            border: "none",
            background: accent,
            color: "#0b0b0f",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: `0 6px 20px ${accent}66`,
          }}
        >
          Publish
        </button>
        <IconBtn
          title="Leave Design mode"
          onClick={() => {
            if (
              design.dirty &&
              !window.confirm(
                "Leave with unpublished changes? They stay saved as a draft in this browser.",
              )
            )
              return;
            design.setDesigning(false);
            p.onSelect(null);
          }}
        >
          ✕
        </IconBtn>
      </div>

      {/* ── Left: build panel ──────────────────────────────────────────── */}
      {leftOpen && (
        <div
          style={{
            ...panel,
            top: 76,
            left: 12,
            bottom: dockOpen ? 228 : 12,
            width: 300,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 8,
              borderBottom: "1px solid rgba(255,255,255,.08)",
            }}
          >
            {(["blocks", "tabs", "lobby"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setLeftTab(k)}
                style={{ ...chip(leftTab === k, accent), flex: 1 }}
              >
                {k === "blocks" ? "Blocks" : k === "tabs" ? "Tabs & layout" : "Lobby"}
              </button>
            ))}
          </div>
          <div style={{ overflow: "auto", padding: "4px 14px 16px", flex: 1 }}>
            {leftTab === "blocks" && (
              <BlocksPalette
                accent={accent}
                onAdd={addBlock}
                hasBlocks={d.blocks.length > 0}
                onStarter={() => {
                  set((l) =>
                    ensureHome({ ...l, blocks: starterBlocks(p.hasGame), landing: "home" }),
                  );
                  p.onShowTab("home");
                }}
              />
            )}
            {leftTab === "tabs" && (
              <TabsEditor
                accent={accent}
                layout={d}
                tabs={tabsShown}
                onMove={(from, to) => {
                  const a = d.tabs.findIndex((t) => t.id === tabsShown[from].id);
                  const b = d.tabs.findIndex((t) => t.id === tabsShown[to].id);
                  moveTab(a, b);
                }}
                onPatch={(id, patch) =>
                  set((l) => ({
                    ...l,
                    tabs: l.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
                  }))
                }
                onLanding={(id) =>
                  set((l) => ({
                    ...l,
                    landing: id,
                    tabs: l.tabs.map((t) => (t.id === id ? { ...t, hidden: false } : t)),
                  }))
                }
                onHero={(h) => set((l) => ({ ...l, hero: h }))}
                onShow={p.onShowTab}
              />
            )}
            {leftTab === "lobby" && (
              <LobbyWords
                accent={accent}
                lobbyId={p.lobbyId}
                name={name}
                desc={desc}
                onName={setName}
                onDesc={setDesc}
                roomOrder={d.roomOrder}
                onRoomOrder={(ids) => set((l) => ({ ...l, roomOrder: ids }))}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Right: inspector ───────────────────────────────────────────── */}
      {selected && (
        <div
          style={{
            ...panel,
            top: 76,
            right: 12,
            width: 320,
            maxHeight: `calc(100vh - ${dockOpen ? 316 : 100}px)`,
            overflow: "auto",
            padding: 16,
          }}
        >
          <Inspector
            accent={accent}
            block={selected}
            index={d.blocks.findIndex((b) => b.id === selected.id)}
            count={d.blocks.length}
            onPatch={(fn) => patchBlock(selected.id, fn)}
            onMove={(dir) =>
              set((l) => {
                const blocks = [...l.blocks];
                const i = blocks.findIndex((b) => b.id === selected.id);
                const j = i + dir;
                if (j < 0 || j >= blocks.length) return l;
                [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
                return { ...l, blocks };
              })
            }
            onDuplicate={() =>
              set((l) => {
                const i = l.blocks.findIndex((b) => b.id === selected.id);
                const copy = {
                  ...newBlock(selected.type),
                  size: selected.size,
                  props: { ...selected.props },
                };
                const blocks = [...l.blocks];
                blocks.splice(i + 1, 0, copy);
                return { ...l, blocks };
              })
            }
            onRemove={() => {
              set((l) => ({ ...l, blocks: l.blocks.filter((b) => b.id !== selected.id) }));
              p.onSelect(null);
            }}
            onClose={() => p.onSelect(null)}
          />
        </div>
      )}

      {/* ── Bottom: theme dock ─────────────────────────────────────────── */}
      {dockOpen && (
        <ThemeDock
          accent={accent}
          layout={d}
          set={set}
          onPreset={pickPreset}
          onClose={() => setDockOpen(false)}
        />
      )}

      {domainOpen && (
        <DomainModal
          lobbyId={p.lobbyId}
          accent={accent}
          domain={p.domain}
          onChange={p.onDomainChange}
          onClose={() => setDomainOpen(false)}
        />
      )}
      {confetti > 0 && <Confetti key={confetti} accent={accent} />}
    </>,
    document.body,
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(255,255,255,.04)",
        color: "inherit",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        fontSize: 15,
      }}
    >
      {children}
    </button>
  );
}

// ── Blocks palette ─────────────────────────────────────────────────────────
function BlocksPalette({
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
function TabsEditor({
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
function LobbyWords({
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
    fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/rooms`)
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

// ── Inspector ──────────────────────────────────────────────────────────────
function Inspector({
  accent,
  block,
  index,
  count,
  onPatch,
  onMove,
  onDuplicate,
  onRemove,
  onClose,
}: {
  accent: string;
  block: Block;
  index: number;
  count: number;
  onPatch: (fn: (b: Block) => Block) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const meta = BLOCK_CATALOG.find((c) => c.type === block.type);
  const pr = block.props;
  const setProp = (k: string, v: any) => onPatch((b) => ({ ...b, props: { ...b.props, [k]: v } }));
  const field = (k: string, lbl: string, ph = "", multiline = false) => (
    <div>
      <div style={label}>{lbl}</div>
      {multiline ? (
        <textarea
          value={pr[k] ?? ""}
          placeholder={ph}
          rows={4}
          onChange={(e) => setProp(k, e.target.value)}
          style={{ ...input, resize: "vertical" }}
          aria-label={lbl}
        />
      ) : (
        <input
          value={pr[k] ?? ""}
          placeholder={ph}
          onChange={(e) => setProp(k, e.target.value)}
          style={input}
          aria-label={lbl}
        />
      )}
    </div>
  );
  return (
    <div>
      <div
        style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: accent,
            }}
          >
            Block
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>
            {meta?.icon} {meta?.name}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{meta?.blurb}</div>
        </div>
        <IconBtn title="Close" onClick={onClose}>
          ✕
        </IconBtn>
      </div>

      <div style={label}>Width</div>
      <div style={{ display: "flex", gap: 6 }}>
        {(["s", "m", "l", "full"] as BlockSize[]).map((s) => (
          <button
            key={s}
            style={{ ...chip(block.size === s, accent), flex: 1, padding: "7px 4px" }}
            onClick={() => onPatch((b) => ({ ...b, size: s }))}
          >
            {SIZE_LABEL[s]}
          </button>
        ))}
      </div>

      {block.type === "welcome" && (
        <>
          {field("title", "Headline", "Welcome in")}
          {field("body", "Copy", "", true)}
          {field("cta", "Button", "Jump in")}
          <div style={label}>Button opens</div>
          <select
            value={pr.ctaTab || "rooms"}
            onChange={(e) => setProp("ctaTab", e.target.value)}
            style={input}
            aria-label="Button opens"
          >
            {(Object.keys(TAB_DEFAULT_LABEL) as TabId[]).map((t) => (
              <option key={t} value={t}>
                {TAB_DEFAULT_LABEL[t]}
              </option>
            ))}
          </select>
          <div style={label}>Align</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["left", "center"].map((a) => (
              <button
                key={a}
                style={{ ...chip((pr.align || "left") === a, accent), flex: 1 }}
                onClick={() => setProp("align", a)}
              >
                {a === "left" ? "Left" : "Centre"}
              </button>
            ))}
          </div>
        </>
      )}
      {block.type === "rules" && (
        <>
          {field("title", "Title", "House rules")}
          {field("body", "One rule per line", "", true)}
        </>
      )}
      {block.type === "stream" && field("channel", "Twitch channel", "e.g. timbosdojo")}
      {(block.type === "video" || block.type === "music") && (
        <>
          {field(
            "url",
            block.type === "music" ? "Spotify or YouTube playlist link" : "YouTube link",
            "https://",
          )}
          {field("title", "Title (optional)")}
        </>
      )}
      {block.type === "image" && (
        <>
          {field("url", "Image link (https)", "https://")}
          {field("caption", "Caption")}
          {field("link", "Clicking it opens (optional)", "https://")}
        </>
      )}
      {block.type === "countdown" && (
        <>
          {field("label", "What's coming", "Season finale")}
          <div style={label}>When</div>
          <input
            type="datetime-local"
            value={pr.at ? toLocalInput(pr.at) : ""}
            onChange={(e) =>
              setProp("at", e.target.value ? new Date(e.target.value).toISOString() : "")
            }
            style={input}
            aria-label="When"
          />
        </>
      )}
      {block.type === "links" && (
        <>
          {field("title", "Title", "Links")}
          <div style={label}>Links</div>
          <div style={{ display: "grid", gap: 6 }}>
            {(pr.items || []).map((it: any, i: number) => (
              <div
                key={i}
                style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: 4 }}
              >
                <input
                  value={it.label}
                  placeholder="Label"
                  onChange={(e) =>
                    setProp(
                      "items",
                      pr.items.map((x: any, j: number) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    )
                  }
                  style={{ ...input, padding: "6px 8px" }}
                  aria-label="Link label"
                />
                <input
                  value={it.url}
                  placeholder="https://"
                  onChange={(e) =>
                    setProp(
                      "items",
                      pr.items.map((x: any, j: number) =>
                        j === i ? { ...x, url: e.target.value } : x,
                      ),
                    )
                  }
                  style={{ ...input, padding: "6px 8px" }}
                  aria-label="Link address"
                />
                <button
                  onClick={() =>
                    setProp(
                      "items",
                      pr.items.filter((_: any, j: number) => j !== i),
                    )
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                  aria-label="Remove link"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              style={chip(false, accent)}
              onClick={() => setProp("items", [...(pr.items || []), { label: "", url: "" }])}
            >
              + Add link
            </button>
          </div>
        </>
      )}
      {["rooms", "events", "feed", "requests", "stats"].includes(block.type) &&
        field("title", "Heading (optional)")}
      {["rooms", "events", "feed", "requests"].includes(block.type) && (
        <>
          <div style={label}>Show up to</div>
          <input
            type="range"
            min={1}
            max={12}
            value={pr.limit || 6}
            onChange={(e) => setProp("limit", Number(e.target.value))}
            style={{ width: "100%", accentColor: accent }}
            aria-label="How many to show"
          />
          <div style={{ fontSize: 12, opacity: 0.6 }}>{pr.limit || 6}</div>
        </>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 18, flexWrap: "wrap" }}>
        <button style={chip(false, accent)} disabled={index <= 0} onClick={() => onMove(-1)}>
          ↑ Earlier
        </button>
        <button style={chip(false, accent)} disabled={index >= count - 1} onClick={() => onMove(1)}>
          ↓ Later
        </button>
        <button style={chip(false, accent)} onClick={onDuplicate}>
          Duplicate
        </button>
        <button
          style={{ ...chip(false, accent), borderColor: "rgba(239,68,68,.4)", color: "#fca5a5" }}
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Theme dock ─────────────────────────────────────────────────────────────
function ThemeDock({
  accent,
  layout,
  set,
  onPreset,
  onClose,
}: {
  accent: string;
  layout: LobbyLayout;
  set: (fn: (l: LobbyLayout) => LobbyLayout) => void;
  onPreset: (id: string) => void;
  onClose: () => void;
}) {
  const th = layout.theme;
  const preset = th.preset ? PRESET_BY_ID[th.preset] : null;
  const setTheme = (patch: Partial<LobbyLayout["theme"]>) =>
    set((l) => ({ ...l, theme: { ...l.theme, ...patch } }));
  const swatches = [...new Set([...(preset?.swatches || []), ...SWATCH_WHEEL])];
  const surprise = () => {
    const pr = THEME_PRESETS[Math.floor(Math.random() * THEME_PRESETS.length)];
    const effects = Object.keys(EFFECT_LABEL) as EffectId[];
    const fonts = Object.keys(FONT_LABEL) as FontId[];
    set((l) => ({
      ...l,
      theme: {
        ...l.theme,
        preset: pr.id,
        accent: pr.swatches[Math.floor(Math.random() * pr.swatches.length)],
        effect: effects[Math.floor(Math.random() * effects.length)],
        font: fonts[Math.floor(Math.random() * fonts.length)],
      },
    }));
  };
  return (
    <div
      style={{
        ...panel,
        left: 12,
        right: 12,
        bottom: 12,
        height: 204,
        padding: "12px 14px",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ ...label, margin: "0 0 8px" }}>Theme</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ ...chip(false, accent), padding: "4px 10px" }} onClick={surprise}>
              🎲 Surprise me
            </button>
            <button style={{ ...chip(false, accent), padding: "4px 10px" }} onClick={onClose}>
              Hide
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, flex: 1 }}>
          <button
            onClick={() => setTheme({ preset: undefined, effect: undefined, font: undefined })}
            style={presetCard(
              !th.preset,
              accent,
              "repeating-linear-gradient(45deg, #1f1f27 0 8px, #17171d 8px 16px)",
            )}
          >
            <span style={presetName}>Stock</span>
          </button>
          {THEME_PRESETS.map((pr) => (
            <button
              key={pr.id}
              onClick={() => onPreset(pr.id)}
              style={presetCard(th.preset === pr.id, pr.accent, pr.art)}
              title={pr.tagline}
            >
              <span style={{ display: "flex", gap: 3, position: "absolute", top: 8, left: 8 }}>
                {pr.swatches.slice(0, 4).map((s) => (
                  <i
                    key={s}
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 99,
                      background: s,
                      display: "block",
                      border: "1px solid rgba(0,0,0,.4)",
                    }}
                  />
                ))}
              </span>
              <span style={{ ...presetName, fontFamily: FONT_STACK[pr.font] }}>{pr.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ minWidth: 0, overflow: "auto" }}>
        <div style={{ ...label, margin: "0 0 6px" }}>Accent</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
          {swatches.slice(0, 20).map((s) => (
            <button
              key={s}
              onClick={() => setTheme({ accent: s })}
              aria-label={`Accent ${s}`}
              style={{
                width: 20,
                height: 20,
                borderRadius: 99,
                background: s,
                border: th.accent === s ? "2px solid #fff" : "1px solid rgba(0,0,0,.5)",
                boxShadow: th.accent === s ? `0 0 0 2px ${s}` : "none",
                cursor: "pointer",
              }}
            />
          ))}
          <input
            type="color"
            value={th.accent || accent}
            onChange={(e) => setTheme({ accent: e.target.value })}
            aria-label="Custom accent"
            style={{ width: 26, height: 22, border: "none", background: "none", padding: 0 }}
          />
        </div>
        <div style={{ ...label, margin: "10px 0 6px" }}>Atmosphere</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {(Object.keys(EFFECT_LABEL) as EffectId[]).map((e) => (
            <button
              key={e}
              style={{
                ...chip((th.effect || "none") === e, accent),
                padding: "4px 9px",
                fontSize: 11,
              }}
              onClick={() => setTheme({ effect: e })}
            >
              {EFFECT_LABEL[e]}
            </button>
          ))}
        </div>
        <div style={{ ...label, margin: "10px 0 6px" }}>Type · entrance · extras</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {(Object.keys(FONT_LABEL) as FontId[]).map((f) => (
            <button
              key={f}
              style={{
                ...chip((th.font || "default") === f, accent),
                padding: "4px 9px",
                fontSize: 11,
                fontFamily: FONT_STACK[f],
              }}
              onClick={() => setTheme({ font: f })}
            >
              {FONT_LABEL[f]}
            </button>
          ))}
          {(["none", "fade", "rise", "glitch"] as EntranceId[]).map((en) => (
            <button
              key={en}
              style={{
                ...chip((th.entrance || "none") === en, accent),
                padding: "4px 9px",
                fontSize: 11,
              }}
              onClick={() => setTheme({ entrance: en })}
            >
              {en === "none" ? "No entrance" : en[0].toUpperCase() + en.slice(1)}
            </button>
          ))}
          <button
            style={{ ...chip(!!th.sparkle, accent), padding: "4px 9px", fontSize: 11 }}
            onClick={() => setTheme({ sparkle: !th.sparkle })}
          >
            ✨ Cursor sparkle
          </button>
        </div>
        {th.effect && th.effect !== "none" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 11, opacity: 0.6 }}>Intensity</span>
            <input
              type="range"
              min={0.2}
              max={1.5}
              step={0.1}
              value={th.intensity ?? 1}
              onChange={(e) => setTheme({ intensity: Number(e.target.value) })}
              style={{ flex: 1, accentColor: accent }}
              aria-label="Effect intensity"
            />
          </div>
        )}
      </div>
    </div>
  );
}

const presetCard = (on: boolean, accent: string, art: string): React.CSSProperties => ({
  position: "relative",
  flex: "0 0 132px",
  height: 104,
  borderRadius: 12,
  border: on ? `2px solid ${accent}` : "1px solid rgba(255,255,255,.12)",
  boxShadow: on ? `0 0 0 3px ${accent}44, 0 8px 22px ${accent}33` : "none",
  background: art,
  cursor: "pointer",
  overflow: "hidden",
  transform: on ? "translateY(-2px)" : "none",
  transition: "transform .15s, box-shadow .15s",
});
const presetName: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  padding: "16px 10px 8px",
  background: "linear-gradient(transparent, rgba(0,0,0,.75))",
  color: "#fff",
  fontWeight: 900,
  fontSize: 13,
  textAlign: "left",
};

// ── Domain ─────────────────────────────────────────────────────────────────
function DomainModal({
  lobbyId,
  accent,
  domain,
  onChange,
  onClose,
}: {
  lobbyId: string;
  accent: string;
  domain: { host: string | null; status: string | null };
  onChange: (d: { host: string | null; status: string | null }) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(domain.host || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dnsRec, setDnsRec] = useState<{ type: string; name: string; value: string } | null>(null);
  const base = `${API}/lobbies/${encodeURIComponent(lobbyId)}/admin/domain`;

  const call = async (method: string, url: string, body?: any) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.message || j.error || "Something went wrong.");
      return j;
    } catch (e: any) {
      setMsg(e?.message || "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // Re-derive the DNS record for an existing domain.
    if (domain.host && !dnsRec) {
      const labels = domain.host.split(".");
      setDnsRec(
        labels.length === 2
          ? { type: "A", name: "@", value: "142.93.148.29" }
          : { type: "CNAME", name: labels[0], value: "weered.ca" },
      );
    }
  }, [domain.host, dnsRec]);

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Your domain"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99995,
        background: "rgba(0,0,0,.6)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...panel, position: "relative", width: "min(520px, 100%)", padding: 24 }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: accent,
          }}
        >
          Your domain
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>
          Put this lobby on your own address.
        </div>
        <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
          Members type your domain and land right here, with a secure certificate. The lobby stays
          listed in the Weered network.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="club.example.com"
            style={input}
            aria-label="Domain"
          />
          <button
            disabled={busy || !value.trim()}
            onClick={async () => {
              const j = await call("PUT", base, { domain: value });
              if (j) {
                onChange({ host: j.domain, status: j.status });
                setDnsRec(j.dns);
                setValue(j.domain);
              }
            }}
            style={{
              padding: "9px 16px",
              borderRadius: 9,
              border: "none",
              background: accent,
              color: "#0b0b0f",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
        {domain.host && dnsRec && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{domain.host}</strong>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "3px 9px",
                  borderRadius: 99,
                  background: domain.status === "live" ? "#22c55e22" : "#f59e0b22",
                  color: domain.status === "live" ? "#86efac" : "#fcd34d",
                }}
              >
                {domain.status === "live" ? "● Live" : "Waiting for DNS"}
              </span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, margin: "10px 0 6px" }}>
              Add this record where your domain's DNS is managed:
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr 1fr",
                gap: 6,
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
              }}
            >
              <span style={{ opacity: 0.5 }}>Type</span>
              <span style={{ opacity: 0.5 }}>Name</span>
              <span style={{ opacity: 0.5 }}>Value</span>
              <span>{dnsRec.type}</span>
              <span>{dnsRec.name}</span>
              <span>{dnsRec.value}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                disabled={busy}
                onClick={async () => {
                  const j = await call("POST", `${base}/verify`);
                  if (j) {
                    onChange({ host: j.domain, status: j.status });
                    setMsg(
                      j.status === "live"
                        ? "Live. Your domain points here."
                        : "Not pointing here yet. DNS can take a few minutes to an hour.",
                    );
                  }
                }}
                style={chip(false, accent)}
              >
                Check DNS
              </button>
              {domain.status === "live" && (
                <a
                  href={`https://${domain.host}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...chip(true, accent), textDecoration: "none" }}
                >
                  Open {domain.host} ↗
                </a>
              )}
              <button
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm(`Release ${domain.host}?`)) return;
                  const j = await call("DELETE", base);
                  if (j) {
                    onChange({ host: null, status: null });
                    setDnsRec(null);
                    setValue("");
                  }
                }}
                style={{ ...chip(false, accent), marginLeft: "auto", color: "#fca5a5" }}
              >
                Remove
              </button>
            </div>
          </div>
        )}
        {msg && <div style={{ marginTop: 12, fontSize: 13, color: "#fcd34d" }}>{msg}</div>}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "none",
            border: "none",
            color: "inherit",
            fontSize: 18,
            cursor: "pointer",
          }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Publish confetti ───────────────────────────────────────────────────────
function Confetti({ accent }: { accent: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const colors = [accent, "#ffffff", "#facc15", "#22d3ee", "#f472b6"];
    const ps = Array.from({ length: 180 }, () => ({
      x: c.width / 2,
      y: 70,
      vx: (Math.random() - 0.5) * 18,
      vy: Math.random() * -6 - 2,
      r: Math.random() * 6 + 3,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      col: colors[Math.floor(Math.random() * colors.length)],
    }));
    let raf = 0;
    let t = 0;
    const tick = () => {
      t++;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const q of ps) {
        q.vy += 0.35;
        q.vx *= 0.99;
        q.x += q.vx;
        q.y += q.vy;
        q.rot += q.vr;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.col;
        ctx.globalAlpha = Math.max(0, 1 - t / 150);
        ctx.fillRect(-q.r / 2, -q.r / 4, q.r, q.r / 2);
        ctx.restore();
      }
      if (t < 150) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [accent]);
  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: 99999, pointerEvents: "none" }}
    />
  );
}
