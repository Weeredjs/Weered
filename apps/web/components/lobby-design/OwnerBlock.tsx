"use client";

// "Who lives here": a place's owner, on its Home (lib/place.ts). Their card
// from their profile: banner, avatar, status, rank, crew, bio, and what they
// play and stream. Any lobby can use it; it shows whoever owns the lobby.
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useWeered } from "../WeeredProvider";
import { placeOf, type Place } from "../../lib/place";
import { avatarFill } from "../../lib/avatarColor";
import CrewBadge from "../crew/CrewBadge";
import PlaceGate, { GATES } from "../PlaceGate";

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
  primaryCrew?: {
    name: string;
    tag?: string;
    accentColor?: string | null;
    tagShape?: string | null;
  } | null;
  /** Set only when this viewer may join them (their join setting). */
  currentRoomId?: string | null;
  currentRoomIsLobby?: boolean;
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
  const { me } = useWeered() as any;
  // Who can come in (components/PlaceGate.tsx): the owner switches it here;
  // a visitor the gate keeps out is told how to get in.
  const [place, setPlace] = useState<Place | null>(null);
  useEffect(() => {
    if (!p?.id || !lobbyId.startsWith("u-")) return;
    let alive = true;
    void placeOf(p.id).then((x) => alive && setPlace(x && x.id === lobbyId ? x : null));
    return () => {
      alive = false;
    };
  }, [p?.id, lobbyId]);

  useEffect(() => {
    let alive = true;
    void (async () => {
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
            background: avatarFill(!!p.avatar, p.name, false, p.avatarColor),
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
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {p.primaryCrew.tag && <CrewBadge crew={p.primaryCrew} size={13} />}
                  {p.primaryCrew.name}
                </span>
              </Chip>
            )}
            {/* A place is text only; where they're talking is a lobby room, one
                click away (James 2026-10-31: places mustn't pull from lobbies). */}
            {p.currentRoomId && (
              <a
                href={
                  p.currentRoomIsLobby
                    ? `/lobby/${encodeURIComponent(p.currentRoomId)}`
                    : `/room/${encodeURIComponent(p.currentRoomId)}`
                }
                style={{ textDecoration: "none" }}
              >
                <Chip accent="#22c55e">● In a room now · Join them →</Chip>
              </a>
            )}
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
          {place && me?.id === p.id && (
            <div style={{ marginTop: 12 }}>
              <PlaceGate value={place.gate || "anyone"} accent={accent} />
            </div>
          )}
          {place && me?.id !== p.id && place.gate && place.gate !== "anyone" && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                borderRadius: 10,
                fontSize: 12.5,
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.12)",
              }}
            >
              🚪 {GATES.find((g) => g.id === place.gate)?.label}:{" "}
              {place.gate === "friends"
                ? `only ${p.name}'s friends get in. Add them from their profile.`
                : place.gate === "ask"
                  ? "knock with Join, and they'll let you in."
                  : "closed right now."}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link
              href={`/profile/${encodeURIComponent(p.id)}`}
              style={{ fontSize: 12.5, fontWeight: 800, color: accent, textDecoration: "none" }}
            >
              {me?.id === p.id ? "Your profile →" : "Their profile →"}
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
