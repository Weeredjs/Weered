"use client";

// The tag beside a name in the Town Square: the lobby that person is from, and
// a door into it (James 2026-11-12: "Everyone exists here like a shopping
// mall. Not isolated servers."). Public lobbies only (api lib/lobbyHomes.ts).

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cachedHome, homeOf, type LobbyHome } from "../../lib/lobbyHomes";

/** A lobby's accent as a soft border, or the house violet. */
function edge(accent: string | null): string {
  return accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? `${accent}80` : "rgba(167,139,250,.45)";
}

export function FromTag({ userId }: { userId: string }) {
  const router = useRouter();
  const [home, setHome] = useState<LobbyHome | null | undefined>(() => cachedHome(userId));

  useEffect(() => {
    if (home !== undefined || !userId) return;
    let alive = true;
    void homeOf(userId).then((h) => {
      if (alive) setHome(h);
    });
    return () => {
      alive = false;
    };
  }, [userId, home]);

  if (!home) return null;
  const href = `/lobby/${encodeURIComponent(home.id)}`;
  return (
    <a
      href={href}
      className="weered-fromtag"
      title={`From ${home.name}. Click to walk in.`}
      aria-label={`From ${home.name}. Walk in.`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(href);
      }}
      onMouseEnter={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        maxWidth: 160,
        marginLeft: 6,
        padding: "1px 7px 1px 3px",
        borderRadius: 999,
        border: `1px solid ${edge(home.accentColor)}`,
        background: "rgba(255,255,255,.05)",
        color: "var(--weered-muted, rgba(203,213,225,.88))",
        fontSize: 10.5,
        fontWeight: 700,
        lineHeight: "16px",
        textDecoration: "none",
        whiteSpace: "nowrap",
        flexShrink: 1,
        minWidth: 0,
        verticalAlign: "middle",
      }}
    >
      {home.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={home.logoUrl}
          alt=""
          width={14}
          height={14}
          loading="lazy"
          style={{ width: 14, height: 14, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
        />
      ) : (
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            margin: "0 2px",
            borderRadius: "50%",
            background: home.accentColor || "#a78bfa",
            flexShrink: 0,
          }}
        />
      )}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{home.name}</span>
    </a>
  );
}
