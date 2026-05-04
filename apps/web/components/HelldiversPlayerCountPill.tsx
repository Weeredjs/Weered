"use client";

import React from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

/**
 * Live HD2 concurrent-player pill.
 *
 * Polls the Slice D /helldivers/steam-players endpoint every 60s. The
 * endpoint itself caches Steam responses for 60s, so the worst case is a
 * 2-minute lag — fine for an ambient stat. Renders a tiny inline pill,
 * intended to sit next to the lobby title in the helldivers2 header.
 */
export default function HelldiversPlayerCountPill({
  accentColor,
}: {
  accentColor?: string;
}) {
  const [count, setCount] = React.useState<number | null>(null);
  const [errored, setErrored] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchOnce = async () => {
      try {
        const r = await fetch(`${API}/helldivers/steam-players`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!alive) return;
        if (j?.ok && typeof j.count === "number") {
          setCount(j.count);
          setErrored(false);
        } else {
          setErrored(true);
        }
      } catch {
        if (alive) setErrored(true);
      }
      if (alive) timer = setTimeout(fetchOnce, 60_000);
    };
    fetchOnce();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (errored && count === null) return null;

  const accent = accentColor || "#FFD700";
  const display =
    count === null
      ? "…"
      : count >= 1_000_000
      ? `${(count / 1_000_000).toFixed(1)}M`
      : count >= 1_000
      ? `${(count / 1_000).toFixed(1)}k`
      : String(count);

  return (
    <span
      title={count !== null ? `${count.toLocaleString()} Helldivers in active service` : "Helldivers online"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.04em",
        background: `${accent}18`,
        border: `1px solid ${accent}38`,
        color: accent,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          background: accent,
          boxShadow: `0 0 6px ${accent}`,
          animation: "pulse 2s ease-in-out infinite",
        }}
      />
      {display} ACTIVE
    </span>
  );
}
