"use client";

// "Who lives here": a place's owner, on its Home (lib/place.ts). Their card
// from their profile: banner, avatar, status, rank, crew, bio, and what they
// play and stream. Any lobby can use it; it shows whoever owns the lobby.
import React, { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

type Profile = {
  id: string;
  name: string;
  bio?: string;
  statusText?: string | null;
  statusEmoji?: string | null;
  notorietyRank?: string;
  avatar?: string | null;
  avatarColor?: string | null;
  bannerUrl?: string | null;
  twitchLogin?: string | null;
  steamId?: string | null;
  xboxGamertag?: string | null;
  gameAccounts?: { gameType: string; displayName: string; platform?: string | null }[];
  primaryCrew?: { name: string; tag?: string; accentColor?: string | null } | null;
  currentRoomId?: string | null;
};

const pretty = (s: string) =>
  s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function OwnerBlock({
  lobbyId,
  props,
  accent,
  font,
}: {
  lobbyId: string;
  props: Record<string, any>;
  accent: string;
  font: string;
}) {
  const [p, setP] = useState<Profile | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const l = await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}`, {
          credentials: "include",
        }).then((r) => r.json());
        const owner = l?.lobby?.ownerId || l?.ownerId;
        if (!owner) throw new Error("no owner");
        const prof = await fetch(`${API}/profile/${encodeURIComponent(owner)}`, {
          credentials: "include",
        }).then((r) => r.json());
        if (alive) prof?.id ? setP(prof) : setGone(true);
      } catch {
        if (alive) setGone(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [lobbyId]);

  const title = props.title || "Who lives here";
  if (gone)
    return (
      <div style={{ padding: 18, opacity: 0.6, fontSize: 13 }}>{title}: their card shows here.</div>
    );
  if (!p)
    return <div style={{ padding: 18, minHeight: 120, opacity: 0.5, fontSize: 13 }}>{title}…</div>;

  const plays = [
    ...(p.gameAccounts || []).map((a) => ({
      k: a.gameType,
      t: `${pretty(a.gameType)} · ${a.displayName}`,
    })),
    ...(p.steamId ? [{ k: "steam", t: "Steam" }] : []),
    ...(p.xboxGamertag ? [{ k: "xbox", t: `Xbox · ${p.xboxGamertag}` }] : []),
  ].slice(0, 8);

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {p.bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- the owner's own banner
        <img
          src={p.bannerUrl}
          alt=""
          referrerPolicy="no-referrer"
          style={{ display: "block", width: "100%", height: 96, objectFit: "cover", opacity: 0.85 }}
        />
      )}
      <div style={{ padding: 18, display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div
          style={{
            flex: "0 0 auto",
            width: 72,
            height: 72,
            marginTop: p.bannerUrl ? -48 : 0,
            borderRadius: "50%",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            border: `3px solid ${accent}`,
            background: p.avatarColor || "#2a2440",
            color: "#fff",
            fontSize: 28,
            fontWeight: 900,
            boxShadow: `0 10px 30px -10px ${accent}`,
          }}
        >
          {p.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- the owner's avatar
            <img
              src={p.avatar}
              alt=""
              referrerPolicy="no-referrer"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            p.name.slice(0, 1).toUpperCase()
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: accent,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 24,
              fontWeight: 900,
              lineHeight: 1.1,
              marginTop: 2,
              overflowWrap: "anywhere",
            }}
          >
            {p.name}
          </div>
          {(p.statusEmoji || p.statusText) && (
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
              {p.statusEmoji} {p.statusText}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {p.notorietyRank && <Chip accent={accent}>{p.notorietyRank}</Chip>}
            {p.primaryCrew && (
              <Chip accent={p.primaryCrew.accentColor || accent}>
                {p.primaryCrew.tag ? `[${p.primaryCrew.tag}] ` : ""}
                {p.primaryCrew.name}
              </Chip>
            )}
            {p.currentRoomId && <Chip accent="#22c55e">● In a room now</Chip>}
          </div>
          {p.bio && (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 13.5,
                lineHeight: 1.5,
                opacity: 0.85,
                whiteSpace: "pre-wrap",
              }}
            >
              {p.bio}
            </p>
          )}
          {(plays.length > 0 || p.twitchLogin) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {plays.map((g) => (
                <span
                  key={g.k + g.t}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 99,
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: "rgba(255,255,255,.06)",
                    border: "1px solid rgba(255,255,255,.12)",
                  }}
                >
                  🎮 {g.t}
                </span>
              ))}
              {p.twitchLogin && (
                <a
                  href={`https://twitch.tv/${encodeURIComponent(p.twitchLogin)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "3px 9px",
                    borderRadius: 99,
                    fontSize: 11.5,
                    fontWeight: 800,
                    color: "#fff",
                    textDecoration: "none",
                    background: "#9146ff",
                  }}
                >
                  ● twitch.tv/{p.twitchLogin}
                </a>
              )}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link
              href={`/profile/${encodeURIComponent(p.id)}`}
              style={{ fontSize: 12.5, fontWeight: 800, color: accent, textDecoration: "none" }}
            >
              Their profile →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "3px 9px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: ".02em",
        color: "#fff",
        background: `${accent}33`,
        border: `1px solid ${accent}88`,
      }}
    >
      {children}
    </span>
  );
}
