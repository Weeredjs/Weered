"use client";

// Blizzard (the white colourway) and the rest of Weered disagree about one
// thing: most of the app was written for white text on dark glass, much of
// it in inline styles and per-page classes. The stylesheet (styles/99-nebula-
// blizzard.css) turns round what it can name; this catches the rest. While
// Blizzard is on, any text (or icon) whose colour is light and whose
// background is light gets marked, and the stylesheet paints marked text
// dark: `data-nb-dark="1"` for strong, `"2"` for faint. Text over a picture
// or on a solid dark fill (an accent button) is left white. Marks are inert
// in every other colourway, so switching away needs no clean-up.
import { useEffect } from "react";

const ROOTS =
  ".weered-shell, .weered-dock, .weered-sheet-root, .lobby-chat-drawer, .weered-rail-stack";

type RGBA = [number, number, number, number];
function parse(c: string): RGBA | null {
  const m = c.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
  if (!m) return null;
  let a = 1;
  if (m[4] !== undefined) a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [Number(m[1]), Number(m[2]), Number(m[3]), a];
}
const lum = (c: RGBA) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

/** "light", "dark" or null (transparent: look further up). */
function fillOf(cs: CSSStyleDeclaration): "light" | "dark" | null {
  const img = cs.backgroundImage;
  if (img && img !== "none") {
    if (/url\(/.test(img)) return "dark"; // a picture: keep its white type
    const stops = (img.match(/rgba?\([^)]*\)/g) || []).map(parse).filter(Boolean) as RGBA[];
    const solid = stops.filter((s) => s[3] > 0.5);
    if (solid.length) return solid.some((s) => lum(s) < 0.55) ? "dark" : "light";
  }
  const bg = parse(cs.backgroundColor);
  if (bg && bg[3] > 0.5) return lum(bg) < 0.55 ? "dark" : "light";
  return null;
}

function scan(root: ParentNode) {
  const cache = new Map<Element, "light" | "dark">();
  const fillAt = (el: Element | null): "light" | "dark" => {
    const path: Element[] = [];
    let found: "light" | "dark" = "light"; // the white page itself
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const hit = cache.get(e);
      if (hit) {
        found = hit;
        break;
      }
      path.push(e);
      const f = fillOf(getComputedStyle(e));
      if (f) {
        found = f;
        break;
      }
    }
    for (const p of path) cache.set(p, found);
    return found;
  };
  const els =
    root instanceof Element
      ? [root, ...root.querySelectorAll("*")]
      : [...root.querySelectorAll("*")];
  for (const el of els) {
    if (!(el instanceof HTMLElement)) continue;
    // Marked before: unmark if it has since moved onto a dark fill (a row
    // turned active, a button filled in).
    if (el.hasAttribute("data-nb-dark")) {
      if (fillAt(el) === "dark") el.removeAttribute("data-nb-dark");
      continue;
    }
    const own =
      [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent || "").trim()) ||
      !!el.querySelector(":scope > svg");
    if (!own) continue;
    const cs = getComputedStyle(el);
    const c = parse(cs.color);
    if (!c || lum(c) < 0.7 || c[3] < 0.15) continue;
    if (fillAt(el) !== "light") continue;
    el.setAttribute("data-nb-dark", c[3] < 0.75 ? "2" : "1");
  }
}

export default function BlizzardGuard() {
  useEffect(() => {
    const html = document.documentElement;
    const on = () =>
      html.getAttribute("data-weered-theme") === "nebula" &&
      html.getAttribute("data-weered-palette") === "blizzard" &&
      !html.hasAttribute("data-weered-lobby");
    let pending = new Set<Element>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      if (!on()) {
        pending.clear();
        return;
      }
      const batch = pending;
      pending = new Set();
      for (const el of batch) if (el.isConnected) scan(el);
    };
    const queue = (el: Element) => {
      pending.add(el);
      if (!timer) timer = setTimeout(flush, 120);
    };
    const all = () => document.querySelectorAll(ROOTS).forEach(queue);

    // New and changed content, inside Weered's own surfaces. Watched only
    // while Blizzard is on, so other colourways pay nothing for it.
    const mo = new MutationObserver((recs) => {
      for (const r of recs) {
        const t = r.type === "childList" ? r.target : r.target.parentElement;
        if (t instanceof Element && t.closest(ROOTS)) queue(t);
        if (r.type === "childList")
          r.addedNodes.forEach((n) => {
            if (n instanceof Element && (n.matches(ROOTS) || n.closest(ROOTS))) queue(n);
          });
      }
    });
    let watching = false;
    const sync = () => {
      if (on() && !watching) {
        mo.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["style", "class"],
        });
        watching = true;
      } else if (!on() && watching) {
        mo.disconnect();
        watching = false;
      }
      // Switching to Blizzard (or into a page that wears it) scans everything.
      if (on()) all();
    };
    const ho = new MutationObserver(sync);
    ho.observe(html, {
      attributes: true,
      attributeFilter: ["data-weered-palette", "data-weered-theme", "data-weered-lobby"],
    });
    sync();
    return () => {
      mo.disconnect();
      ho.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);
  return null;
}
