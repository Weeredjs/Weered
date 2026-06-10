"use client";

import { useEffect } from "react";

export default function KeyboardShortcuts() {
  useEffect(() => {
    function isTypingTarget(el: Element | null): boolean {
      if (!el) return false;
      const tag = (el as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if ((el as HTMLElement).isContentEditable) return true;
      return false;
    }

    function firstVisible(nodes: NodeListOf<Element>): HTMLElement | null {
      for (const n of Array.from(nodes)) {
        const el = n as HTMLElement;
        const rect = el.getBoundingClientRect();
        const styled = getComputedStyle(el);
        if (rect.width === 0 || rect.height === 0) continue;
        if (styled.visibility === "hidden" || styled.display === "none") continue;
        if ((el as HTMLInputElement).disabled) continue;
        return el;
      }
      return null;
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isTypingTarget(document.activeElement)) return;
        const target = firstVisible(document.querySelectorAll("[data-weered-search]"));
        if (target) {
          e.preventDefault();
          target.focus();
          try {
            if ("select" in target && typeof (target as HTMLInputElement).select === "function") {
              (target as HTMLInputElement).select();
            }
          } catch {}
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
