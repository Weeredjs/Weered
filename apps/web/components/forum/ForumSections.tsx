"use client";
// The section (sub-board) surface: the rail down the left of a lobby forum, and
// the modal a lobby owner or mod uses to create and order boards.
//
// Split out of ForumPage, which crossed the 1500-line tripwire. These three
// components only ever talk to each other and to the section endpoints, so they
// are the natural seam.
import React, { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { onActivate } from "@/lib/a11y";
import { FONT } from "./ForumHelpers";

export type Section = {
  id: string;
  lobbyId: string;
  slug: string;
  name: string;
  description: string;
  color?: string | null;
  icon?: string | null;
  order: number;
  postsOnly: boolean;
  postCount: number;
};

export default function SectionSidebar({
  sections,
  activeId,
  onSelect,
  canManage,
  onManage,
  drawerOpen,
  onCloseDrawer,
}: {
  sections: Section[];
  activeId: string;
  onSelect: (id: string) => void;
  canManage: boolean;
  onManage: () => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}) {
  const inner = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "12px 8px",
        height: "100%",
        overflow: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,.08) transparent",
      }}
    >
      <SectionRow
        active={!activeId}
        onClick={() => onSelect("")}
        icon="📋"
        name="All"
        count={sections.reduce((sum, s) => sum + s.postCount, 0)}
        description="All posts in this lobby"
      />
      {sections.map((s) => (
        <SectionRow
          key={s.id}
          active={activeId === s.id}
          onClick={() => onSelect(s.id)}
          icon={s.icon || "•"}
          name={s.name}
          count={s.postCount}
          color={s.color || undefined}
          description={s.description}
          postsOnly={s.postsOnly}
        />
      ))}
      {canManage && (
        <button
          onClick={onManage}
          style={{
            marginTop: 8,
            padding: "8px 10px",
            borderRadius: 6,
            background: "var(--weered-accent-bg, rgba(124,58,237,.12))",
            border: "1px dashed var(--weered-border2, rgba(124,58,237,.4))",
            color: "rgba(167,139,250,.85)",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "left",
          }}
        >
          + Manage sections
        </button>
      )}
    </div>
  );

  return (
    <>
      <aside
        className="forum-desktop-sidebar"
        style={{
          width: 200,
          flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,.06)",
          background: "rgba(255,255,255,.015)",
        }}
      >
        {inner}
      </aside>
      {drawerOpen && (
        <div
          onClick={onCloseDrawer}
          onKeyDown={onActivate(() => onCloseDrawer())}
          tabIndex={0}
          role="button"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,.6)",
            display: "flex",
          }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            style={{
              width: 240,
              height: "100%",
              background: "#0b0d11",
              borderRight: "1px solid rgba(255,255,255,.08)",
            }}
          >
            {inner}
          </aside>
        </div>
      )}
      <style>{`
        @media (max-width: 720px) {
          .forum-desktop-sidebar { display: none !important; }
          .forum-mobile-only { display: inline-block !important; }
        }
      `}</style>
    </>
  );
}

function SectionRow({
  active,
  onClick,
  icon,
  name,
  count,
  color,
  description,
  postsOnly,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  name: string;
  count: number;
  color?: string;
  description?: string;
  postsOnly?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={description || ""}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 6,
        background: active ? "var(--weered-accent-bg, rgba(124,58,237,.18))" : "transparent",
        border: active ? "1px solid var(--weered-accent-1, #7c3aed)" : "1px solid transparent",
        color: active ? "var(--weered-text, #fff)" : "rgba(255,255,255,.65)",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <span style={{ fontSize: 13, color: color || undefined, flexShrink: 0 }}>{icon}</span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontWeight: active ? 800 : 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name}
        {postsOnly && (
          <span style={{ marginLeft: 4, fontSize: 9, color: "rgba(245,158,11,.7)" }}>
            &#9474;mod
          </span>
        )}
      </span>
      <span style={{ fontSize: 10, opacity: 0.5, fontVariantNumeric: "tabular-nums" }}>
        {count}
      </span>
    </button>
  );
}

export function SectionManageModal({
  lobbyId,
  sections,
  editing,
  onClose,
  onSaved,
  onEdit,
}: {
  lobbyId: string;
  sections: Section[];
  editing: Section | null;
  onClose: () => void;
  onSaved: () => void;
  onEdit: (s: Section | null) => void;
}) {
  const [slug, setSlug] = useState(editing?.slug || "");
  const [name, setName] = useState(editing?.name || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [color, setColor] = useState(editing?.color || "");
  const [icon, setIcon] = useState(editing?.icon || "");
  const [postsOnly, setPostsOnly] = useState(!!editing?.postsOnly);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSlug(editing?.slug || "");
    setName(editing?.name || "");
    setDescription(editing?.description || "");
    setColor(editing?.color || "");
    setIcon(editing?.icon || "");
    setPostsOnly(!!editing?.postsOnly);
  }, [editing]);

  async function save() {
    if (!name.trim() || !slug.trim()) return;
    setBusy(true);
    const body = {
      lobbyId,
      slug: slug.trim(),
      name: name.trim(),
      description: description.trim(),
      color: color || null,
      icon: icon || null,
      postsOnly,
    };
    const path = editing ? `/forum/sections/${editing.id}` : `/forum/sections`;
    const method = editing ? "PATCH" : "POST";
    const data = await apiFetch<any>(path, { method, body: JSON.stringify(body) });
    setBusy(false);
    if (data?.ok) {
      onSaved();
      onEdit(null);
      if (!editing) {
        setSlug("");
        setName("");
        setDescription("");
        setColor("");
        setIcon("");
        setPostsOnly(false);
      }
    }
  }

  async function remove(s: Section, force = false) {
    if (
      !window.confirm(
        `Delete section "${s.name}"?${s.postCount > 0 ? `\n\n${s.postCount} post(s) will become uncategorized.` : ""}`,
      )
    )
      return;
    setBusy(true);
    const data = await apiFetch<any>(`/forum/sections/${s.id}${force ? "?force=true" : ""}`, {
      method: "DELETE",
      silent: true,
    });
    setBusy(false);
    if (data?.ok) {
      onSaved();
      return;
    }
    if (data?.error?.includes("force")) {
      if (window.confirm(`Section has ${data.postCount} post(s). Delete anyway?`)) remove(s, true);
    }
  }

  async function reorder(s: Section, dir: -1 | 1) {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((x) => x.id === s.id);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    const order = sorted.map((x, _i) => {
      if (x.id === s.id) return { id: x.id, order: swapWith.order };
      if (x.id === swapWith.id) return { id: x.id, order: s.order };
      return { id: x.id, order: x.order };
    });
    setBusy(true);
    const data = await apiFetch<any>(`/forum/sections/reorder`, {
      method: "POST",
      body: JSON.stringify({ lobbyId, order }),
    });
    setBusy(false);
    if (data?.ok) onSaved();
  }

  return (
    <div
      onClick={onClose}
      onKeyDown={onActivate(() => onClose())}
      tabIndex={0}
      role="button"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "85vh",
          background: "#0b0d11",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: 12,
          padding: 18,
          overflow: "auto",
          fontFamily: FONT,
          color: "rgba(243,244,246,.92)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Manage sections</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,.5)",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
          {sections.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 6,
                background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.06)",
              }}
            >
              <span style={{ fontSize: 14 }}>{s.icon || "•"}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{s.name}</span>
              <span style={{ fontSize: 10, opacity: 0.5 }}>{s.postCount} posts</span>
              <button onClick={() => reorder(s, -1)} disabled={i === 0 || busy} style={btnIcon}>
                &#9650;
              </button>
              <button
                onClick={() => reorder(s, 1)}
                disabled={i === sections.length - 1 || busy}
                style={btnIcon}
              >
                &#9660;
              </button>
              <button onClick={() => onEdit(s)} style={btnIcon}>
                &#9998;
              </button>
              <button onClick={() => remove(s)} style={{ ...btnIcon, color: "#ef4444" }}>
                &times;
              </button>
            </div>
          ))}
          {sections.length === 0 && (
            <div style={{ fontSize: 11, opacity: 0.5, padding: "12px 0" }}>
              No sections yet. Create one below.
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 14 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1,
              opacity: 0.6,
              marginBottom: 8,
            }}
          >
            {editing ? `EDIT: ${editing.name}` : "NEW SECTION"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              style={inputStyle}
            />
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="slug-like-this"
              style={inputStyle}
            />
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Icon (emoji)"
              style={inputStyle}
            />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#hexcolor"
              style={inputStyle}
            />
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            style={{ ...inputStyle, marginTop: 8, width: "100%", boxSizing: "border-box" }}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              fontSize: 11,
              opacity: 0.75,
            }}
          >
            <input
              type="checkbox"
              checked={postsOnly}
              onChange={(e) => setPostsOnly(e.target.checked)}
            />
            Mods-only posting
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            {editing && (
              <button
                onClick={() => onEdit(null)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,.1)",
                  background: "rgba(255,255,255,.04)",
                  color: "rgba(255,255,255,.5)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                New
              </button>
            )}
            <button
              onClick={save}
              disabled={busy || !name.trim() || !slug.trim()}
              style={{
                padding: "7px 18px",
                borderRadius: 8,
                border: "1px solid var(--weered-border2, rgba(124,58,237,.4))",
                background: "rgba(124,58,237,.3)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                opacity: busy || !name.trim() || !slug.trim() ? 0.4 : 1,
              }}
            >
              {editing ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,.1)",
  background: "rgba(0,0,0,.3)",
  color: "rgba(243,244,246,.92)",
  fontSize: 12,
  outline: "none",
  fontFamily: "inherit",
};

const btnIcon: React.CSSProperties = {
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.06)",
  color: "rgba(255,255,255,.65)",
  cursor: "pointer",
  padding: "3px 7px",
  fontSize: 10,
  borderRadius: 4,
  fontFamily: "inherit",
};
