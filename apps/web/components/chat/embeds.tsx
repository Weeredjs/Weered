"use client";

import { useEffect, useState } from "react";
import { API } from "./chatShared";

const WEERED_BOUNTY_RE = /(?:https?:\/\/[^\s/]+)?\/windrose\/bounty\/([^\s/?#]+)/i;
const WEERED_HUNTER_RE = /(?:https?:\/\/[^\s/]+)?\/windrose\/hunter\/([^\s/?#]+)/i;
const WEERED_CREW_RE = /(?:https?:\/\/[^\s/]+)?\/crew\/([^\s/?#]+)/i;
const NEXUS_MOD_RE = /(?:https?:\/\/)?(?:www\.)?nexusmods\.com\/(windrose)\/mods\/(\d+)/i;

export type WeeredEmbedKind = "bounty" | "hunter" | "crew" | "nexus";
export function detectWeeredEmbed(url: string): { kind: WeeredEmbedKind; id: string } | null {
  let m = url.match(WEERED_BOUNTY_RE);
  if (m) return { kind: "bounty", id: decodeURIComponent(m[1]) };
  m = url.match(WEERED_HUNTER_RE);
  if (m) return { kind: "hunter", id: decodeURIComponent(m[1]) };
  m = url.match(WEERED_CREW_RE);
  if (m) return { kind: "crew", id: decodeURIComponent(m[1]) };
  m = url.match(NEXUS_MOD_RE);
  if (m) return { kind: "nexus", id: m[2] };
  return null;
}

const embedCache = new Map<string, any>();

export function WeeredBountyEmbed({ id, href }: { id: string; href: string }) {
  const [data, setData] = useState<any>(() => embedCache.get(`bounty:${id}`) ?? null);
  useEffect(() => {
    if (data) return;
    let cancelled = false;
    fetch(`${API}/windrose/bounties/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.ok && j.bounty) {
          embedCache.set(`bounty:${id}`, j.bounty);
          setData(j.bounty);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, data]);
  if (!data) return <EmbedSkeleton href={href} label="Windrose · Bounty" />;
  const statusColor =
    data.status === "OPEN"
      ? "#5db765"
      : data.status === "CLAIMED"
        ? "#e8c48a"
        : data.status === "SETTLED"
          ? "#c9a066"
          : "#a54848";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block", marginTop: 6 }}
    >
      <div
        style={{
          borderRadius: 3,
          border: `1px solid ${statusColor}55`,
          background:
            "radial-gradient(ellipse at 0% 0%, rgba(163,61,61,0.14), transparent 60%), linear-gradient(180deg, rgba(25,40,62,0.85), rgba(14,24,38,0.95))",
          overflow: "hidden",
          maxWidth: 340,
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "#c9a066",
              opacity: 0.8,
            }}
          >
            ☠ Windrose Bounty
          </span>
          <span
            style={{
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: statusColor,
            }}
          >
            {data.status}
          </span>
        </div>
        <div
          style={{
            fontFamily: "'Pirata One', Georgia, serif",
            fontSize: 22,
            color: "#e8c48a",
            lineHeight: 1.1,
            letterSpacing: "0.3px",
            textShadow: "0 2px 6px rgba(201,160,102,.3)",
          }}
        >
          {data.targetHandle}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span
            style={{
              fontFamily: "'Pirata One', Georgia, serif",
              fontSize: 20,
              color: "#fcd34d",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {Number(data.amount || 0).toLocaleString()}
          </span>
          <span
            style={{
              fontSize: 9,
              color: "#a89775",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            Paper
          </span>
        </div>
        {data.reason && (
          <div
            style={{
              fontSize: 12,
              color: "#e4d4b0",
              lineHeight: 1.4,
              fontStyle: "italic",
              opacity: 0.85,
            }}
          >
            "{String(data.reason).slice(0, 120)}
            {String(data.reason).length > 120 ? "…" : ""}"
          </div>
        )}
        <div style={{ fontSize: 10, color: "#a89775", fontStyle: "italic", marginTop: 2 }}>
          posted by {data.posterName}
          {data.claimantName ? ` · delivered by ${data.claimantName}` : ""}
        </div>
      </div>
    </a>
  );
}

export function WeeredHunterEmbed({ id, href }: { id: string; href: string }) {
  const [data, setData] = useState<any>(() => embedCache.get(`hunter:${id}`) ?? null);
  useEffect(() => {
    if (data) return;
    let cancelled = false;
    fetch(`${API}/windrose/hunter/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.ok) {
          embedCache.set(`hunter:${id}`, j);
          setData(j);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, data]);
  if (!data) return <EmbedSkeleton href={href} label="Windrose · Hunter" />;
  const u = data.user;
  const h = data.hunter;
  const tier =
    h.kills >= 40
      ? { label: "Reaper", color: "#a33d3d" }
      : h.kills >= 15
        ? { label: "Marshal", color: "#e8c48a" }
        : h.kills >= 5
          ? { label: "Tracker", color: "#f97316" }
          : h.kills >= 1
            ? { label: "Outlaw", color: "#5db765" }
            : null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block", marginTop: 6 }}
    >
      <div
        style={{
          borderRadius: 3,
          border: "1px solid rgba(201,160,102,0.45)",
          background: "linear-gradient(180deg, rgba(25,40,62,0.85), rgba(14,24,38,0.95))",
          overflow: "hidden",
          maxWidth: 340,
          padding: "12px 14px",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 3,
            flexShrink: 0,
            background: u.avatar
              ? `url(${u.avatar}) center/cover`
              : `linear-gradient(135deg, ${u.avatarColor || "#c9a066"}, #8a6b3e)`,
            border: "2px solid rgba(201,160,102,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Pirata One', Georgia, serif",
            fontSize: 22,
            color: "#0a1424",
            fontWeight: 700,
          }}
        >
          {!u.avatar && (u.name || "?").slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "#c9a066",
              opacity: 0.75,
            }}
          >
            Hunter Dossier
          </div>
          <div
            style={{
              fontFamily: "'Pirata One', Georgia, serif",
              fontSize: 18,
              color: "#e8c48a",
              letterSpacing: "0.3px",
              marginTop: 1,
            }}
          >
            {u.name}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 4,
              fontSize: 11,
              color: "#a89775",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            <span>
              <strong
                style={{
                  color: "#e4d4b0",
                  fontFamily: "'Pirata One', Georgia, serif",
                  fontSize: 13,
                }}
              >
                {h.kills.toLocaleString()}
              </strong>{" "}
              delivered
            </span>
            <span>·</span>
            <span>
              <strong
                style={{
                  color: "#fcd34d",
                  fontFamily: "'Pirata One', Georgia, serif",
                  fontSize: 13,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {h.totalEarned.toLocaleString()}
              </strong>{" "}
              earned
            </span>
            {h.rank && (
              <>
                <span>·</span>
                <span>
                  rank <strong style={{ color: "#e8c48a" }}>#{h.rank}</strong>
                </span>
              </>
            )}
          </div>
          {tier && (
            <div style={{ marginTop: 4 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  fontFamily: "ui-monospace, monospace",
                  color: tier.color,
                  background: `${tier.color}15`,
                  border: `1px solid ${tier.color}50`,
                }}
              >
                <span
                  style={{ width: 4, height: 4, borderRadius: "50%", background: tier.color }}
                />
                {tier.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

export function WeeredCrewEmbed({ id, href }: { id: string; href: string }) {
  const [data, setData] = useState<any>(() => embedCache.get(`crew:${id}`) ?? null);
  useEffect(() => {
    if (data) return;
    let cancelled = false;
    fetch(`${API}/crews/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.ok && j.crew) {
          embedCache.set(`crew:${id}`, j.crew);
          setData(j.crew);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, data]);
  if (!data) return <EmbedSkeleton href={href} label="Crew" />;
  const accent =
    data.accentColor && /^#[0-9a-f]{6}$/i.test(data.accentColor) ? data.accentColor : "#c9a066";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block", marginTop: 6 }}
    >
      <div
        style={{
          borderRadius: 3,
          border: `1px solid ${accent}55`,
          background: `linear-gradient(180deg, ${accent}10, rgba(14,24,38,0.95))`,
          overflow: "hidden",
          maxWidth: 340,
          padding: "12px 14px",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 3,
            flexShrink: 0,
            background: data.logoUrl
              ? `url(${data.logoUrl}) center/cover`
              : `linear-gradient(135deg, ${accent}, #8a6b3e)`,
            border: `2px solid ${accent}aa`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Pirata One', Georgia, serif",
            fontSize: 18,
            color: "#0a1424",
            fontWeight: 700,
          }}
        >
          {!data.logoUrl && (data.tag || data.name || "?").slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: accent,
              opacity: 0.8,
            }}
          >
            ⚑ Crew
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 1 }}>
            <span
              style={{
                fontFamily: "'Pirata One', Georgia, serif",
                fontSize: 18,
                color: "#e8c48a",
                letterSpacing: "0.3px",
              }}
            >
              {data.name}
            </span>
            {data.tag && (
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "ui-monospace, monospace",
                  color: accent,
                  letterSpacing: "1px",
                }}
              >
                [{data.tag}]
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 4,
              fontSize: 11,
              color: "#a89775",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            <span>
              <strong style={{ color: "#e4d4b0" }}>{data.memberCount}</strong> members
            </span>
            {data.homePort && (
              <>
                <span>·</span>
                <span style={{ color: "#e4d4b0" }}>{data.homePort}</span>
              </>
            )}
            {data.recruiting && (
              <>
                <span>·</span>
                <span style={{ color: "#5db765" }}>recruiting</span>
              </>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

export function NexusModEmbed({ id, href }: { id: string; href: string }) {
  const [data, setData] = useState<any>(() => embedCache.get(`nexus:${id}`) ?? null);
  useEffect(() => {
    if (data) return;
    let cancelled = false;
    const token = (typeof window !== "undefined" ? localStorage.getItem("weered_token") : "") || "";
    fetch(`${API}/mods/nexus:${encodeURIComponent(id)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.mod) {
          embedCache.set(`nexus:${id}`, j);
          setData(j);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, data]);
  if (!data) return <EmbedSkeleton href={href} label="Windrose · Mod" />;
  const mod = data.mod;
  const crewCount = Number(data.crewCount || 0);
  const nxmHref = `nxm://windrose/mods/${encodeURIComponent(id)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block", marginTop: 6 }}
    >
      <div
        style={{
          borderRadius: 3,
          border: "1px solid rgba(201,160,102,0.33)",
          background: "linear-gradient(180deg, rgba(36,28,18,0.85), rgba(14,24,38,0.95))",
          overflow: "hidden",
          maxWidth: 340,
          padding: "12px 14px",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 3,
            flexShrink: 0,
            background: mod.thumbnailUrl
              ? `url(${mod.thumbnailUrl}) center/cover`
              : "linear-gradient(135deg,#c9a066,#8a6b3e)",
            border: "1px solid rgba(201,160,102,0.5)",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "#c9a066",
                opacity: 0.8,
              }}
            >
              ⛬ Windrose · Mod
            </span>
            {mod.endorsements > 0 && (
              <span
                style={{ fontSize: 10, color: "#a89775", fontFamily: "ui-monospace, monospace" }}
              >
                ✦ {Number(mod.endorsements).toLocaleString()}
              </span>
            )}
          </div>
          <div
            style={{
              fontFamily: "'Pirata One', Georgia, serif",
              fontSize: 18,
              color: "#e8c48a",
              lineHeight: 1.1,
              letterSpacing: "0.3px",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {mod.name}
          </div>
          {mod.author && (
            <div style={{ fontSize: 10, color: "#a89775", fontStyle: "italic", marginTop: 2 }}>
              by {mod.author}
            </div>
          )}
          {mod.summary && (
            <div
              style={{
                fontSize: 11,
                color: "#e4d4b0",
                lineHeight: 1.4,
                marginTop: 4,
                opacity: 0.85,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {String(mod.summary).slice(0, 180)}
            </div>
          )}
          {crewCount > 0 && (
            <div
              style={{
                fontSize: 10,
                color: "#5db765",
                marginTop: 6,
                fontWeight: 700,
                letterSpacing: "0.5px",
              }}
            >
              {crewCount === 1 ? "1 crewmate runs this" : `${crewCount} crewmates run this`}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  window.location.href = nxmHref;
                } catch {}
              }}
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                padding: "4px 8px",
                borderRadius: 3,
                border: "1px solid rgba(201,160,102,0.5)",
                color: "#e8c48a",
                background: "rgba(201,160,102,0.08)",
                cursor: "pointer",
              }}
              title="Open in your Mod Manager"
            >
              Install
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                padding: "4px 8px",
                color: "#a89775",
              }}
            >
              Nexus ↗
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

export function EmbedSkeleton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block", marginTop: 6 }}
    >
      <div
        style={{
          borderRadius: 3,
          border: "1px solid rgba(201,160,102,0.22)",
          background: "rgba(14,24,38,0.55)",
          maxWidth: 340,
          padding: "12px 14px",
          fontSize: 11,
          color: "rgba(168,151,117,0.6)",
          fontStyle: "italic",
        }}
      >
        {label} · loading…
      </div>
    </a>
  );
}

export function LinkPreviewCard({ url }: { url: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/unfurl?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.ok && (j.title || j.description)) setData(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!data) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block", marginTop: 6 }}
    >
      <div
        style={{
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,.08)",
          background: "rgba(255,255,255,.03)",
          overflow: "hidden",
          maxWidth: 320,
          transition: "border-color .15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,.3)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}
      >
        {data.image && (
          <img
            src={data.image}
            alt={data.title || "Link preview"}
            style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
        <div style={{ padding: "8px 10px" }}>
          {data.siteName && (
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".5px",
                color: "rgba(124,58,237,.6)",
                marginBottom: 3,
              }}
            >
              {data.siteName}
            </div>
          )}
          {data.title && (
            <div
              style={
                {
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(243,244,246,.9)",
                  lineHeight: 1.3,
                  marginBottom: 3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                } as any
              }
            >
              {data.title}
            </div>
          )}
          {data.description && (
            <div
              style={
                {
                  fontSize: 11,
                  color: "rgba(148,163,184,.6)",
                  lineHeight: 1.4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                } as any
              }
            >
              {data.description}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
