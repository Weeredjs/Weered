"use client";

// Design mode chrome: the top bar (undo, redo, domain, discard, publish), the
// left panel (blocks to drop on the Home canvas, the tab strip, the lobby's
// words and room order), the inspector for the selected block, and the theme
// dock along the bottom. The lobby itself renders the draft live underneath,
// so every change is visible the moment it's made.
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  newBlock,
  starterBlocks,
  type Block,
  type BlockType,
  type LobbyLayout,
  type TabId,
} from "../../lib/lobbyLayout";
import { PRESET_BY_ID } from "../../lib/lobbyThemePresets";
import type { DesignState } from "./useLobbyDesign";
import { IconBtn, chip, panel } from "./designerKit";
import { BlocksPalette, LobbyWords, TabsEditor } from "./DesignerPanels";
import { Inspector } from "./DesignerInspector";
import { ThemeDock } from "./DesignerTheme";
import { Confetti, DomainModal } from "./DesignerDomain";

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
  const [armed, setArmed] = useState(false);
  const canDiscard = design.dirty || name.trim() !== p.lobbyName || desc !== p.description;
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

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
        {/* Two-click confirm on the button itself, and disabled when there is
            nothing to throw away, so a click always visibly does something. */}
        <button
          disabled={!canDiscard}
          title={canDiscard ? "Throw away unpublished changes" : "Nothing to discard"}
          style={{
            ...chip(false, accent),
            ...(armed
              ? { background: "#dc2626", borderColor: "#dc2626", color: "#fff" }
              : { color: "rgba(243,244,246,.7)" }),
            opacity: canDiscard ? 1 : 0.4,
            cursor: canDiscard ? "pointer" : "default",
          }}
          onClick={() => {
            if (!armed) return setArmed(true);
            setArmed(false);
            design.discard();
            setName(p.lobbyName);
            setDesc(p.description);
            p.onSelect(null);
          }}
        >
          {armed ? "Throw it away?" : "Discard"}
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
            // Unpublished work stays saved as a draft in this browser.
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
