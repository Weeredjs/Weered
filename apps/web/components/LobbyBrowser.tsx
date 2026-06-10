"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE as string) || "http://127.0.0.1:4000";

const PURPLE = "#5800E5";
const GREEN = "#22c55e";
const BG = "rgba(6,6,12,.97)";
const TEXT = "rgba(243,244,246,.95)";
const TEXT_DIM = "rgba(243,244,246,.55)";
const TEXT_MUTED = "rgba(243,244,246,.35)";
const BORDER = "rgba(255,255,255,.08)";
const MONO = "'SF Mono', 'Cascadia Mono', 'Fira Code', 'Consolas', monospace";

import type { Lobby } from "@weered/shared";

function hueFromId(id: string): number {
  return (
    Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % 360
  );
}

function InitialAvatar({
  id,
  name,
  size,
}: {
  id: string;
  name: string;
  size: number;
}) {
  const hue = hueFromId(id);
  const initial = (name || id || "?").trim().slice(0, 1).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        flexShrink: 0,
        background: `hsl(${hue}, 55%, 22%)`,
        border: `1.5px solid hsl(${hue}, 55%, 36%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        fontSize: size * 0.44,
        color: `hsl(${hue}, 80%, 82%)`,
        letterSpacing: "-0.02em",
      }}
    >
      {initial}
    </div>
  );
}

function LobbyLogo({
  lobby,
  size,
}: {
  lobby: Lobby;
  size: number;
}) {
  const [ok, setOk] = useState(true);
  if (lobby.logoUrl && ok) {
    return (
      <img
        src={lobby.logoUrl}
        alt={lobby.name + " logo"}
        width={size}
        height={size}
        style={{
          borderRadius: size * 0.28,
          objectFit: "cover",
          flexShrink: 0,
          border: `1.5px solid rgba(255,255,255,.1)`,
        }}
        onError={() => setOk(false)}
      />
    );
  }
  return <InitialAvatar id={lobby.id} name={lobby.name} size={size} />;
}

function PulseDot({ size = 8 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: GREEN,
        boxShadow: `0 0 6px ${GREEN}, 0 0 12px ${GREEN}55`,
        animation: "weeredPulse 2s ease-in-out infinite",
        flexShrink: 0,
      }}
    />
  );
}

function ModuleBadge({ type }: { type: string }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: 2,
        background: "rgba(88,0,229,.18)",
        border: `1px solid rgba(88,0,229,.35)`,
        color: "rgba(176,130,255,.9)",
        whiteSpace: "nowrap",
      }}
    >
      {type}
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span
      title="Verified"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: PURPLE,
        flexShrink: 0,
        fontSize: 11,
        lineHeight: 1,
        color: "#fff",
      }}
    >
      &#10003;
    </span>
  );
}

function LiveCard({
  lobby,
  onClick,
}: {
  lobby: Lobby;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: "0 0 auto",
        width: 180,
        padding: "14px 14px 12px",
        borderRadius: 2,
        border: `1px solid ${hovered ? "rgba(88,0,229,.5)" : BORDER}`,
        background: hovered
          ? "rgba(88,0,229,.12)"
          : "rgba(255,255,255,.03)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        transition: "all .2s ease",
        color: TEXT,
        textAlign: "center",
        boxShadow: hovered
          ? `0 0 20px rgba(88,0,229,.2)`
          : "none",
      }}
    >
      <LobbyLogo lobby={lobby} size={44} />
      <div
        style={{
          fontWeight: 800,
          fontSize: 13,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          width: "100%",
        }}
      >
        {lobby.name}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: GREEN,
          fontWeight: 600,
        }}
      >
        <PulseDot size={7} />
        {lobby.onlineCount} online
      </div>
    </button>
  );
}

function LobbyCard({
  lobby,
  onClick,
}: {
  lobby: Lobby;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const accent = lobby.accentColor || PURPLE;
  const hasBanner = !!lobby.bannerUrl;

  const bannerBg: React.CSSProperties = hasBanner
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(6,6,12,.15) 0%, rgba(6,6,12,.85) 70%, rgba(6,6,12,.98) 100%), url(${lobby.bannerUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        background: `linear-gradient(135deg, ${accent}22 0%, rgba(6,6,12,.95) 100%)`,
      };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        width: "100%",
        minHeight: 220,
        borderRadius: 2,
        border: `1px solid ${hovered ? `${accent}66` : BORDER}`,
        overflow: "hidden",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: 0,
        textAlign: "left",
        color: TEXT,
        transition: "all .25s ease",
        boxShadow: hovered
          ? `0 8px 32px rgba(0,0,0,.5), 0 0 24px ${accent}22`
          : "0 2px 12px rgba(0,0,0,.3)",
        transform: hovered ? "translateY(-2px)" : "none",
        ...bannerBg,
      }}
    >
      <div style={{ padding: "56px 16px 16px", position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <LobbyLogo lobby={lobby} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 15,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {lobby.name}
              </span>
              {lobby.verified && <VerifiedBadge />}
            </div>
          </div>
        </div>

        {lobby.description && (
          <div
            style={{
              fontSize: 12.5,
              lineHeight: "1.45",
              color: TEXT_DIM,
              marginBottom: 10,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {lobby.description}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {lobby.moduleType && <ModuleBadge type={lobby.moduleType} />}
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              color: TEXT_MUTED,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {lobby._count.members} members
          </span>
          {lobby.onlineCount > 0 && (
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: GREEN,
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontWeight: 600,
              }}
            >
              <PulseDot size={6} />
              {lobby.onlineCount} online
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes weeredPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: .55; transform: scale(.85); }
    }
    @keyframes weeredFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes weeredSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .weered-discover-scroll::-webkit-scrollbar {
      width: 6px;
    }
    .weered-discover-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .weered-discover-scroll::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,.1);
      border-radius: 3px;
    }
    .weered-live-strip::-webkit-scrollbar {
      height: 4px;
    }
    .weered-live-strip::-webkit-scrollbar-track {
      background: transparent;
    }
    .weered-live-strip::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,.08);
      border-radius: 2px;
    }
  `;
  document.head.appendChild(style);
}

export default function LobbyBrowser() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    injectStyles();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE + "/lobbies", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok && Array.isArray(json.lobbies)) {
        setLobbies(
          json.lobbies.map((l: any) => ({
            id: String(l.id || ""),
            name: String(l.name || l.id || ""),
            description: l.description ?? null,
            verified: Boolean(l.verified),
            pinned: Boolean(l.pinned),
            moduleType: l.moduleType ?? null,
            accentColor: l.accentColor ?? null,
            logoUrl: l.logoUrl ?? null,
            bannerUrl: l.bannerUrl ?? null,
            _count: {
              rooms: Number(l._count?.rooms ?? 0),
              members: Number(l._count?.members ?? 0),
            },
            onlineCount: Number(l.onlineCount ?? 0),
          }))
        );
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onBrowse = () => {
      setOpen(true);
      requestAnimationFrame(() => setVisible(true));
      load();
    };
    window.addEventListener("weered:lobby:browse", onBrowse);
    return () => window.removeEventListener("weered:lobby:browse", onBrowse);
  }, [load]);

  useEffect(() => {
    if (open) {
      load();
      intervalRef.current = setInterval(load, 8000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [open]);

  function close() {
    setVisible(false);
    setTimeout(() => {
      setOpen(false);
      setQ("");
    }, 200);
  }

  function goLobby(id: string) {
    router.push("/lobby/" + encodeURIComponent(id));
    close();
  }

  const filtered = lobbies
    .filter((l) => {
      if (!q.trim()) return true;
      const search = q.trim().toLowerCase();
      return (
        l.name.toLowerCase().includes(search) ||
        (l.description || "").toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (b.onlineCount !== a.onlineCount)
        return b.onlineCount - a.onlineCount;
      return b._count.members - a._count.members;
    });

  const live = filtered.filter((l) => l.onlineCount > 0);

  if (!open || !mounted) return null;

  const overlay = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9001,
        background: BG,
        backdropFilter: "blur(12px)",
        color: TEXT,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        opacity: visible ? 1 : 0,
        transition: "opacity .2s ease",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding: "18px 28px 14px",
          borderBottom: `1px solid ${BORDER}`,
          background: "rgba(6,6,12,.92)",
          backdropFilter: "blur(16px)",
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: "-.03em",
            flexShrink: 0,
          }}
        >
          Discover
        </div>

        <div style={{ flex: 1, maxWidth: 480 }}>
          <input
            ref={searchRef}
            placeholder="Search lobbies..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 14px",
              borderRadius: 2,
              border: `1px solid rgba(255,255,255,.1)`,
              background: "rgba(255,255,255,.04)",
              fontSize: 14,
              color: TEXT,
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color .15s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = `${PURPLE}88`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,.1)";
            }}
          />
        </div>

        {loading && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: TEXT_MUTED,
              fontFamily: MONO,
              flexShrink: 0,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span className="weered-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
            tuning in
          </span>
        )}

        <button
          onClick={() => { close(); router.push("/lobby/create"); }}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 20px", borderRadius: 2,
            background: "linear-gradient(135deg, rgba(88,0,229,.15), rgba(212,160,23,.10))",
            border: "1px solid rgba(212,160,23,.30)",
            cursor: "pointer", flexShrink: 0,
            transition: "all .2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(88,0,229,.25), rgba(212,160,23,.18))"; e.currentTarget.style.borderColor = "rgba(212,160,23,.50)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(88,0,229,.15), rgba(212,160,23,.10))"; e.currentTarget.style.borderColor = "rgba(212,160,23,.30)"; }}
        >
          <span style={{ fontSize: 18 }}>+</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#D4A017", letterSpacing: "-.2px" }}>Create Your Lobby</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", marginTop: 1 }}>Your game. Your rules.</div>
          </div>
        </button>

        <button
          onClick={close}
          style={{
            width: 36,
            height: 36,
            borderRadius: 2,
            border: `1px solid rgba(255,255,255,.1)`,
            background: "rgba(255,255,255,.04)",
            fontSize: 18,
            cursor: "pointer",
            color: TEXT_DIM,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all .15s",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,.08)";
            e.currentTarget.style.color = TEXT;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,.04)";
            e.currentTarget.style.color = TEXT_DIM;
          }}
          aria-label="Close"
        >
          &#x2715;
        </button>
      </div>

      <div
        className="weered-discover-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {live.length > 0 && (
          <div
            style={{
              padding: "24px 28px 8px",
              animation: "weeredSlideUp .35s ease both",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <PulseDot size={9} />
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: GREEN,
                }}
              >
                Live Now
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  color: TEXT_MUTED,
                }}
              >
                {live.length}
              </span>
            </div>

            <div
              className="weered-live-strip"
              style={{
                display: "flex",
                gap: 12,
                overflowX: "auto",
                paddingBottom: 12,
              }}
            >
              {live.map((lobby) => (
                <LiveCard
                  key={lobby.id}
                  lobby={lobby}
                  onClick={() => goLobby(lobby.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            padding: "20px 28px 40px",
            animation: "weeredSlideUp .4s ease .05s both",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: TEXT_MUTED,
              marginBottom: 16,
            }}
          >
            All Lobbies{" "}
            <span style={{ color: TEXT_MUTED, fontWeight: 500 }}>
              {filtered.length}
            </span>
          </div>

          {filtered.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 16,
              }}
            >
              {filtered.map((lobby) => (
                <LobbyCard
                  key={lobby.id}
                  lobby={lobby}
                  onClick={() => goLobby(lobby.id)}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "48px 0",
                textAlign: "center",
                color: TEXT_MUTED,
                fontSize: 14,
              }}
            >
              {loading
                ? "Tuning in..."
                : q.trim()
                  ? "Nothing matches that search."
                  : "No lobbies yet. Be the first to start one."}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
