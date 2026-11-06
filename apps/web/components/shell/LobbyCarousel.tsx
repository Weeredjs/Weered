"use client";

// Every lobby drifting past on Home, right to left: small and faint at the
// edges, full size in the middle (James 2026-11-06: "a half sized featured
// carousel of all 50 lobbies. Sort of drifting right to left but shrinking as
// they fade out to the side of the screen. Visa versa on the right. growing to
// the center"). The busy ones first. Hovering holds it, a drag scrubs it, a
// focused card comes to the middle, and a click goes in. One animation loop
// writes the cards' transforms directly (no re-render a frame) and stops while
// the strip is off screen; a card's picture loads the first time it comes near.
import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { avatarBg } from "../../lib/avatarColor";
import { hideBroken, sizedImage } from "../../lib/sizedImage";

export type DriftLobby = {
  id: string;
  name: string;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
  online: number;
  members: number;
};

/** The middle card's width; the strip is about half the old featured banner. */
const CARD_W = 264;
const CARD_H = Math.round((CARD_W * 9) / 16);
const SPACING = CARD_W + 18;
const MIN_SCALE = 0.5;
/** How fast the scale falls away from the middle. */
const FALL = 1.6;
/** Drift, in px a second at the middle. */
const SPEED = 24;
/** Enough cards that the loop's seam is never on screen. */
const MIN_CARDS = 14;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export default function LobbyCarousel({
  lobbies,
  onOpen,
}: {
  lobbies: DriftLobby[];
  onOpen?: (id: string) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLAnchorElement | null)[]>([]);
  // The order it first showed holds: counts that change later update the
  // cards without moving them under the viewer.
  const order = useRef<string[] | null>(null);
  if (!order.current && lobbies.length) order.current = lobbies.map((l) => l.id);
  const rank = new Map((order.current || []).map((id, i) => [id, i]));
  const shown = [...lobbies].sort(
    (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
  );
  // A short list goes round more than once, so the loop's seam stays hidden.
  const reps = shown.length ? Math.max(1, Math.ceil(MIN_CARDS / shown.length)) : 0;
  const ring = Array.from({ length: reps }, (_, r) =>
    shown.map((l) => ({ l, key: `${l.id}~${r}` })),
  ).flat();
  const n = ring.length;
  const dragged = useRef(false);

  useEffect(() => {
    const el = strip.current;
    if (!el || !n) return;
    const L = n * SPACING;
    let offset = 0;
    let speed = 0;
    let width = el.clientWidth;
    let raf = 0;
    let last = 0;
    let onScreen = true;
    let held = false;
    let focusAt: number | null = null;
    let drag: { x: number; moved: number } | null = null;
    const still = (() => {
      try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        return false;
      }
    })();

    const paint = () => {
      // R: how far from the middle a card is still on screen, in track px. A
      // card's screen position is the running sum of the scales inside it, so
      // they shrink towards the edges without piling up.
      const R = (width / 2 + (CARD_W * MIN_SCALE) / 2) / (1 - (1 - MIN_SCALE) / (FALL + 1));
      for (let i = 0; i < n; i++) {
        const c = cards.current[i];
        if (!c) continue;
        let u = (i * SPACING - offset) % L;
        if (u < 0) u += L;
        if (u > L / 2) u -= L;
        const a = Math.abs(u);
        if (a > R) {
          if (c.style.visibility !== "hidden") c.style.visibility = "hidden";
          continue;
        }
        const k = a / R;
        const s = 1 - (1 - MIN_SCALE) * Math.pow(k, FALL);
        const x =
          Math.sign(u) *
          (a - ((1 - MIN_SCALE) * Math.pow(a, FALL + 1)) / ((FALL + 1) * Math.pow(R, FALL)));
        c.style.visibility = "visible";
        c.style.transform = `translate3d(${x.toFixed(1)}px,0,0) scale(${s.toFixed(4)})`;
        c.style.opacity = (1 - smooth(0.55, 1, k)).toFixed(3);
        c.style.zIndex = String(1000 - Math.round(k * 1000));
        if (!c.dataset.seen) {
          c.dataset.seen = "1";
          c.querySelectorAll<HTMLImageElement>("img[data-src]").forEach((img) => {
            img.src = img.dataset.src || "";
          });
        }
      }
    };

    const step = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (focusAt !== null) {
        // The shortest way round to the focused card.
        let d = (focusAt - offset) % L;
        if (d > L / 2) d -= L;
        if (d < -L / 2) d += L;
        offset += d * Math.min(1, dt * 7);
      } else if (!drag) {
        const want = held || still ? 0 : SPEED;
        speed += (want - speed) * Math.min(1, dt * 3);
        offset += speed * dt;
      }
      paint();
      raf = onScreen ? requestAnimationFrame(step) : 0;
    };
    const run = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(step);
      }
    };

    paint();
    run();

    const ro = new ResizeObserver(() => {
      width = el.clientWidth;
      paint();
    });
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => {
      onScreen = !!e?.isIntersecting;
      if (onScreen) run();
    });
    io.observe(el);

    const enter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") held = true;
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === "mouse") held = false;
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      drag.x = e.clientX;
      drag.moved += Math.abs(dx);
      offset -= dx;
      if (drag.moved > 6) dragged.current = true;
    };
    const up = () => {
      drag = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragged.current = false;
      drag = { x: e.clientX, moved: 0 };
      focusAt = null;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    };
    // Tabbing to a card brings it to the middle and holds it there.
    const focusIn = (e: FocusEvent) => {
      const i = cards.current.indexOf(e.target as HTMLAnchorElement);
      if (i >= 0) focusAt = i * SPACING;
    };
    const focusOut = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node)) focusAt = null;
    };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", down);
    el.addEventListener("focusin", focusIn);
    el.addEventListener("focusout", focusOut);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      up();
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("focusin", focusIn);
      el.removeEventListener("focusout", focusOut);
    };
  }, [n]);

  if (!n) return null;
  return (
    <div
      ref={strip}
      className="weered-drift"
      role="region"
      aria-label={`${lobbies.length} lobbies`}
      style={{ ["--drift-h" as any]: `${CARD_H}px` }}
    >
      {ring.map(({ l, key }, i) => {
        const accent = l.accentColor || avatarBg(l.name || l.id);
        return (
          <Link
            key={key}
            ref={(a) => {
              cards.current[i] = a;
            }}
            href={`/lobby/${encodeURIComponent(l.id)}`}
            className="weered-drift-card"
            style={{
              width: CARD_W,
              height: CARD_H,
              marginLeft: -CARD_W / 2,
              marginTop: -CARD_H / 2,
              ["--drift-a" as any]: accent,
            }}
            draggable={false}
            tabIndex={i < lobbies.length ? 0 : -1}
            aria-hidden={i >= lobbies.length || undefined}
            onClick={(e) => {
              // The end of a drag isn't a click.
              if (dragged.current) {
                e.preventDefault();
                dragged.current = false;
                return;
              }
              onOpen?.(l.id);
            }}
          >
            <span className="weered-drift-face">
              {l.bannerUrl ? (
                <img
                  className="weered-drift-banner"
                  data-src={sizedImage(l.bannerUrl)}
                  alt=""
                  draggable={false}
                  decoding="async"
                  onError={hideBroken}
                />
              ) : null}
              <span className="weered-drift-scrim" />
              <span className="weered-drift-info">
                {l.logoUrl ? (
                  <img
                    className="weered-drift-logo"
                    data-src={sizedImage(l.logoUrl, 96)}
                    alt=""
                    draggable={false}
                    decoding="async"
                    onError={hideBroken}
                  />
                ) : (
                  <span className="weered-drift-logo is-letter">
                    {(l.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="weered-drift-words">
                  <span className="weered-drift-name">{l.name}</span>
                  <span className={`weered-drift-meta${l.online > 0 ? " is-live" : ""}`}>
                    {l.online > 0
                      ? `${l.online} online`
                      : `${l.members} member${l.members === 1 ? "" : "s"}`}
                  </span>
                </span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
