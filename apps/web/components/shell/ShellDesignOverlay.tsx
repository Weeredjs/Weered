"use client";

// Design mode's editing surface over the real shell. Every section and block
// on the page gets an outline and a name tag; click one to inspect it, drag
// it to move it (between sidebars, or up and down), drop blocks in from the
// panel. A clear sheet under the outlines keeps the page itself from being
// clicked while designing, and passes the scroll wheel through.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  canPlace,
  findItem,
  itemIcon,
  itemName,
  keyOf,
  placeItem,
  regionsFor,
  REGION_LABEL,
  REGIONS,
  type ShellItem,
  type ShellRegion,
} from "../../lib/shellLayout";
import { editLayout, selectItem, useShellDesign } from "../../lib/shellDesign";

type Rect = { x: number; y: number; w: number; h: number };
type Box = Rect & { key: string; region: ShellRegion; clip: Rect };
type Target = { region: ShellRegion; index: number; ok: boolean };
type Drag = {
  item: ShellItem;
  fresh: boolean;
  x: number;
  y: number;
  sx: number;
  sy: number;
  active: boolean;
  target: Target | null;
};

const ROOTS: Record<ShellRegion, string> = {
  left: ".weered-shell .weered-left",
  right: ".weered-shell .weered-right",
  home: "[data-shell-scroller='home']",
};

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};
const inside = (x: number, y: number, r: Rect) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
function clipTo(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x),
    h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y),
  };
}

function measure(): { boxes: Box[]; roots: Partial<Record<ShellRegion, Rect>> } {
  const roots: Partial<Record<ShellRegion, Rect>> = {};
  for (const r of REGIONS) {
    const el = document.querySelector(ROOTS[r]);
    if (el) roots[r] = rectOf(el);
  }
  const boxes: Box[] = [];
  const add = (el: Element, key: string, region: ShellRegion) => {
    const root = roots[region];
    if (!root) return;
    const r = rectOf(el);
    boxes.push({ ...r, key, region, clip: clipTo(r, root) });
  };
  document.querySelectorAll(".weered-shell [data-shell-key][data-shell-region]").forEach((el) => {
    const key = el.getAttribute("data-shell-key") || "";
    const region = el.getAttribute("data-shell-region") as ShellRegion;
    if (key && REGIONS.includes(region)) add(el, key, region);
  });
  // The ID card is its own component; it is found by class.
  const card = document.querySelector(".weered-shell .weered-left-inner > .weered-usercorner");
  if (card && getComputedStyle(card).display !== "none") add(card, "card", "left");
  return { boxes, roots };
}

const scrollerOf = (region: ShellRegion): HTMLElement | null =>
  document.querySelector(ROOTS[region]) as HTMLElement | null;

// The panel's catalog starts drags of new blocks (and switched-off sections)
// through here; the mounted overlay takes them over.
let libraryDrag: ((item: ShellItem, e: React.PointerEvent) => void) | null = null;
let suppressClickUntil = 0;
export function beginLibraryDrag(item: ShellItem, e: React.PointerEvent) {
  libraryDrag?.(item, e);
}
/** True right after a drag ended, so the press that started it isn't also a click. */
export const justDragged = () => Date.now() < suppressClickUntil;

export default function ShellDesignOverlay({ accent }: { accent: string }) {
  const s = useShellDesign();
  const layout = s.draft?.layout;
  const [geo, setGeo] = useState<{ boxes: Box[]; roots: Partial<Record<ShellRegion, Rect>> }>(
    () => ({ boxes: [], roots: {} }),
  );
  const [hover, setHover] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const geoRef = useRef(geo);
  geoRef.current = geo;

  // Keep the outlines on their sections: measure every frame, re-render only
  // when something moved.
  useEffect(() => {
    let raf = 0;
    let sig = "";
    const tick = () => {
      const g = measure();
      const next = JSON.stringify(g);
      if (next !== sig) {
        sig = next;
        setGeo(g);
      }
      // Auto-scroll a sidebar or Home while dragging near its edge.
      const d = dragRef.current;
      if (d?.active) {
        for (const r of REGIONS) {
          const root = g.roots[r];
          if (!root || d.x < root.x || d.x > root.x + root.w) continue;
          const el = scrollerOf(r);
          if (!el) continue;
          if (d.y < root.y + 48 && d.y > root.y - 20) el.scrollTop -= 10;
          else if (d.y > root.y + root.h - 48 && d.y < root.y + root.h + 20) el.scrollTop += 10;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // A newly selected item that's out of view scrolls into it.
  useEffect(() => {
    if (!s.selected) return;
    const t = setTimeout(() => {
      const el =
        s.selected === "card"
          ? document.querySelector(".weered-shell .weered-left-inner > .weered-usercorner")
          : document.querySelector(
              `.weered-shell [data-shell-key="${CSS.escape(s.selected || "")}"]`,
            );
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [s.selected]);

  const targetAt = useCallback((x: number, y: number, item: ShellItem): Target | null => {
    const g = geoRef.current;
    const l = layoutRef.current;
    if (!l) return null;
    for (const region of REGIONS) {
      const root = g.roots[region];
      if (!root || !inside(x, y, root)) continue;
      if (!canPlace(item, region)) return { region, index: -1, ok: false };
      const list = l[region];
      const byKey = new Map(g.boxes.filter((b) => b.region === region).map((b) => [b.key, b]));
      let index = 0;
      list.forEach((it, i) => {
        const b = byKey.get(keyOf(it));
        if (!b) return;
        const wide = b.w > root.w * 0.72;
        const before =
          y > b.y + b.h || (y >= b.y && (wide ? y > b.y + b.h / 2 : x > b.x + b.w / 2));
        if (before) index = i + 1;
      });
      return { region, index, ok: true };
    }
    return null;
  }, []);

  const finish = useCallback((d: Drag) => {
    if (d.active) {
      suppressClickUntil = Date.now() + 350;
      const t = d.target;
      if (t?.ok) {
        editLayout((l) => placeItem(l, d.item, t.region, t.index));
        selectItem(keyOf(d.item));
      }
    } else if (!d.fresh) selectItem(keyOf(d.item));
  }, []);

  const start = useCallback(
    (item: ShellItem, fresh: boolean, e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const d: Drag = {
        item,
        fresh,
        x: e.clientX,
        y: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
        active: false,
        target: null,
      };
      dragRef.current = d;
      setDrag(d);
      const move = (ev: PointerEvent) => {
        const cur = dragRef.current;
        if (!cur) return;
        const active = cur.active || Math.hypot(ev.clientX - cur.sx, ev.clientY - cur.sy) > 5;
        const next: Drag = {
          ...cur,
          x: ev.clientX,
          y: ev.clientY,
          active,
          target: active ? targetAt(ev.clientX, ev.clientY, cur.item) : null,
        };
        dragRef.current = next;
        setDrag(next);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        const cur = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (cur) finish(cur);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [finish, targetAt],
  );

  useEffect(() => {
    libraryDrag = (item, e) => start(item, true, e);
    return () => {
      libraryDrag = null;
    };
  }, [start]);

  const wheel = (e: React.WheelEvent) => {
    const g = geoRef.current;
    for (const r of REGIONS) {
      const root = g.roots[r];
      if (root && inside(e.clientX, e.clientY, root)) {
        scrollerOf(r)?.scrollBy({ top: e.deltaY });
        return;
      }
    }
  };

  if (!layout) return null;
  const dragKey = drag?.active ? keyOf(drag.item) : null;
  const t = drag?.active ? drag.target : null;

  // Where a drop would land: a bar above the item it would go before, or
  // under the last one.
  let bar: Rect | null = null;
  if (t?.ok) {
    const root = geo.roots[t.region];
    const list = layout[t.region].filter((it) => keyOf(it) !== dragKey);
    const byKey = new Map(geo.boxes.filter((b) => b.region === t.region).map((b) => [b.key, b]));
    const full = layout[t.region];
    const at = full[t.index];
    // Over the dragged item itself the drop changes nothing; the bar sits at
    // its top, where it already is.
    const atBox = at ? byKey.get(keyOf(at)) : undefined;
    const last = [...list].reverse().find((it) => byKey.get(keyOf(it)));
    const lastBox = last ? byKey.get(keyOf(last)) : undefined;
    if (atBox) bar = { x: atBox.x, y: atBox.y - 7, w: atBox.w, h: 4 };
    else if (lastBox) bar = { x: lastBox.x, y: lastBox.y + lastBox.h + 3, w: lastBox.w, h: 4 };
    else if (root) bar = { x: root.x + 12, y: root.y + 12, w: root.w - 24, h: 4 };
    if (bar && root)
      bar = { ...bar, y: Math.max(root.y + 2, Math.min(bar.y, root.y + root.h - 6)) };
  }

  return (
    <>
      {/* The page under the outlines can't be clicked while designing. */}
      <div
        aria-hidden
        onPointerDown={() => selectItem(null)}
        onWheel={wheel}
        style={{ position: "fixed", inset: 0, zIndex: 99970, cursor: "default" }}
      />
      {geo.boxes.map((b) => {
        if (b.clip.w < 4 || b.clip.h < 4) return null;
        const sel = s.selected === b.key;
        const found = findItem(layout, b.key);
        const name = found ? itemName(found.item) : b.key;
        const dragging = dragKey === b.key;
        return (
          <div
            key={`${b.region}:${b.key}`}
            role="button"
            tabIndex={-1}
            aria-label={`${name}, ${REGION_LABEL[b.region]}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (found) start(found.item, false, e);
            }}
            onPointerEnter={() => setHover(b.key)}
            onPointerLeave={() => setHover((h) => (h === b.key ? null : h))}
            onWheel={wheel}
            style={{
              position: "fixed",
              left: b.clip.x,
              top: b.clip.y,
              width: b.clip.w,
              height: b.clip.h,
              zIndex: sel ? 99982 : 99980,
              borderRadius: 14,
              border: sel
                ? `2px solid ${accent}`
                : `1px dashed ${hover === b.key ? accent : "rgba(255,255,255,.28)"}`,
              boxShadow: sel ? `0 0 0 4px ${accent}33, 0 0 28px ${accent}33` : "none",
              background: dragging
                ? "rgba(0,0,0,.45)"
                : hover === b.key && !drag?.active
                  ? `${accent}10`
                  : "transparent",
              cursor: drag?.active ? "grabbing" : "grab",
              transition: "border-color .15s, box-shadow .2s, background .15s",
              touchAction: "none",
            }}
          >
            {(sel || hover === b.key) && (
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  right: 8,
                  maxWidth: "calc(100% - 16px)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: sel ? accent : "rgba(0,0,0,.66)",
                  color: sel ? "#0b0b0f" : "rgba(255,255,255,.78)",
                  pointerEvents: "none",
                  fontFamily: "var(--font-rajdhani), system-ui, sans-serif",
                }}
              >
                {name}
              </span>
            )}
          </div>
        );
      })}

      {bar && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: bar.x,
            top: bar.y,
            width: bar.w,
            height: bar.h,
            zIndex: 99985,
            borderRadius: 99,
            background: accent,
            boxShadow: `0 0 14px ${accent}`,
            pointerEvents: "none",
          }}
        />
      )}

      {drag?.active && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: drag.x + 14,
            top: drag.y + 10,
            zIndex: 99996,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 12px",
            borderRadius: 999,
            background: "rgba(14,14,20,.94)",
            border: `1px solid ${t && !t.ok ? "#ef4444" : accent}`,
            boxShadow: "0 12px 30px rgba(0,0,0,.5)",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 800,
            fontFamily: "var(--font-rajdhani), system-ui, sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          <span>{itemIcon(drag.item)}</span>
          {itemName(drag.item)}
          <span style={{ fontWeight: 600, opacity: 0.7 }}>
            {t ? (t.ok ? `→ ${REGION_LABEL[t.region]}` : onlyIn(drag.item)) : ""}
          </span>
        </div>
      )}
    </>
  );
}

/** Where a section is allowed, in words, for the "can't go there" hint. */
function onlyIn(item: ShellItem): string {
  const r = regionsFor(item);
  if (r.length === 1) return r[0] === "home" ? "only on Home" : "only in the left sidebar";
  return "sidebars only";
}
