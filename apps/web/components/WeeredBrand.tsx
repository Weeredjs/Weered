"use client";

import React from "react";

export default function WeeredBrand({
  showWordmark = true,
  size = 28,
}: {
  showWordmark?: boolean;
  size?: number;
}) {
  const s = size;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* Portal W icon (gradient only in icon, per brand rule) */}
      <svg width={s} height={s} viewBox="0 0 48 48" aria-label="Weered">
        <defs>
          <linearGradient id="weeredGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--weered-accent-1)" />
            <stop offset="100%" stopColor="var(--weered-accent-2)" />
          </linearGradient>
          <mask id="cut">
            <rect x="0" y="0" width="48" height="48" fill="white" />
            {/* subtle “portal cutout” slice */}
            <path d="M8 24 C 16 20, 32 20, 40 24 C 32 28, 16 28, 8 24 Z" fill="black" opacity="0.9"/>
          </mask>
        </defs>

        <rect x="2" y="2" width="44" height="44" rx="12" fill="var(--weered-bg)" stroke="rgba(148,163,184,0.25)" />
        <g mask="url(#cut)">
          <text
            x="24"
            y="33"
            textAnchor="middle"
            fontSize="26"
            fontWeight="900"
            fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
            fill="url(#weeredGrad)"
          >
            W
          </text>
        </g>
        {/* restore the “slice” as darker portal line */}
        <path d="M8 24 C 16 20, 32 20, 40 24 C 32 28, 16 28, 8 24 Z" fill="rgba(11,15,26,0.85)"/>
      </svg>

      {showWordmark ? (
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontWeight: 900, letterSpacing: 0.2, fontSize: 16 }}>weered</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>lobby</div>
        </div>
      ) : null}
    </div>
  );
}

