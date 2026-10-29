"use client";

// Shared bits for the create-lobby composer: the section shell, label style,
// and the one stylesheet the composer needs (keyframes and the two-column
// breakpoint cannot be inline styles).
import React from "react";

export const TEXT = "rgba(243,244,246,.94)";
export const MUTED = "rgba(203,213,225,.62)";
export const FAINT = "rgba(148,163,184,.45)";
export const PANEL = "var(--weered-panel2, #0b0b12)";
export const BORDER = "var(--weered-border, rgba(148,163,184,.18))";

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".6px",
  textTransform: "uppercase",
  color: "rgba(255,255,255,.42)",
  marginBottom: 8,
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.10)",
  color: TEXT,
  fontSize: 14,
  fontWeight: 600,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  transition: "border-color .15s, box-shadow .15s",
};

export function Section({
  id,
  n,
  title,
  kicker,
  accent,
  children,
}: {
  id: string;
  n: number;
  title: string;
  kicker: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-step={n}
      aria-labelledby={`${id}-h`}
      className="cz-section"
      style={{
        scrollMarginTop: 72,
        borderRadius: 18,
        border: `1px solid ${BORDER}`,
        background: `linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.012)), ${PANEL}`,
        padding: "22px 20px",
        marginBottom: 18,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          opacity: 0.55,
        }}
      />
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
        <span
          aria-hidden
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
            fontWeight: 800,
            color: accent,
            letterSpacing: "1px",
          }}
        >
          {String(n).padStart(2, "0")}
        </span>
        <div style={{ minWidth: 0 }}>
          <h2
            id={`${id}-h`}
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: "-0.4px",
              color: TEXT,
            }}
          >
            {title}
          </h2>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>{kicker}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Keyframes and breakpoints. Rendered once by the page. */
export function ComposerStyles() {
  return (
    <style>{`
.cz-shell{display:grid;grid-template-columns:minmax(0,1fr);gap:22px;max-width:1320px;margin:0 auto;padding:20px 16px 140px;box-sizing:border-box}
.cz-previewcol{min-width:0}
@media (min-width:1080px){
  .cz-shell{grid-template-columns:minmax(0,1fr) minmax(380px,460px);gap:28px;padding:28px 28px 140px}
  .cz-previewcol{position:sticky;top:16px;align-self:start}
}
.cz-games{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:10px}
.cz-presets{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.cz-feats{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
@media (max-width:520px){
  .cz-games{grid-template-columns:repeat(2,minmax(0,1fr))}
  .cz-presets{grid-template-columns:repeat(2,minmax(0,1fr))}
  .cz-feats{grid-template-columns:minmax(0,1fr)}
}
.cz-card{transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s,border-color .18s}
.cz-card:hover{transform:translateY(-3px)}
.cz-card:active{transform:translateY(0) scale(.98)}
.cz-card:focus-visible,.cz-chip:focus-visible,.cz-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
.cz-chip{transition:transform .15s,background .15s,border-color .15s,color .15s}
.cz-chip:hover{transform:translateY(-1px)}
.cz-rail::-webkit-scrollbar{display:none}
@keyframes cz-pop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
@keyframes cz-spin{to{transform:rotate(360deg)}}
@keyframes cz-flip{0%{transform:perspective(1200px) rotateY(0)}50%{transform:perspective(1200px) rotateY(90deg) scale(.94)}100%{transform:perspective(1200px) rotateY(0)}}
@keyframes cz-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes cz-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.8)}}
@keyframes cz-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes cz-ent-fade{from{opacity:0}to{opacity:1}}
@keyframes cz-ent-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes cz-ent-glitch{0%{opacity:0;clip-path:inset(40% 0 45% 0);transform:translateX(-8px) skewX(8deg)}20%{opacity:1;clip-path:inset(10% 0 70% 0);transform:translateX(6px)}40%{clip-path:inset(60% 0 5% 0);transform:translateX(-4px) skewX(-6deg)}60%{clip-path:inset(0 0 0 0);transform:translateX(2px);filter:hue-rotate(90deg)}100%{clip-path:inset(0 0 0 0);transform:none;filter:none}}
@keyframes cz-toast{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
@media (prefers-reduced-motion:reduce){
  .cz-card,.cz-chip{transition:none}
  .cz-card:hover,.cz-chip:hover{transform:none}
  .cz-anim{animation:none!important}
}
`}</style>
  );
}

/** Six-digit hex plus a two-digit alpha, for tints like `${accent}33`. */
export function alpha(hex: string, a: number): string {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#7c3aed";
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${h}${v}`;
}
