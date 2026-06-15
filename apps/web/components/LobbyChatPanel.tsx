"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered, useRoomMsgs, useRoomUsers, useRoomTyping } from "./WeeredProvider";
import { avatarBg } from "../lib/avatarColor";
import { useUserHover } from "./UserHoverCard";
import EmptyState from "./EmptyState";
import { weeredConfirm } from "../lib/confirm";
import { weeredReport } from "../lib/report";
import { weeredToast } from "../lib/toast";
import RoleIcon, { TierIcon } from "./RoleIcon";
import FlairBadge from "./FlairBadge";
import { useEquippedFlair } from "../lib/useEquippedFlair";

function ChatFlair({ userId, size = "sm" }: { userId: string; size?: "sm" | "md" | "lg" }) {
  const f = useEquippedFlair(userId);
  if (!f || f.kind !== "BADGE") return null;
  return <FlairBadge flair={f as any} size={size} />;
}

function detectMentionAtCaret(
  value: string,
  caret: number,
): { query: string; start: number } | null {
  let i = caret - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === "@") {
      if (i === 0 || /\s/.test(value[i - 1])) {
        return { query: value.slice(i + 1, caret), start: i };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

function nameStyleFor(role?: string, tier?: string): React.CSSProperties {
  const r = String(role || "").toUpperCase();
  const t = String(tier || "").toUpperCase();
  if (r === "GOD") return { color: "#fcd34d", textShadow: "0 0 10px rgba(252,211,77,0.45)" };
  if (r === "STAFF") return { color: "#60a5fa", textShadow: "0 0 8px rgba(96,165,250,0.35)" };
  if (r === "SUPPORT") return { color: "#c4b5fd", textShadow: "0 0 8px rgba(196,181,253,0.35)" };
  if (r === "MOD") return { color: "#34d399", textShadow: "0 0 6px rgba(52,211,153,0.30)" };
  if (t === "KINGPIN") return { color: "#fcd34d", textShadow: "0 0 6px rgba(252,211,77,0.35)" };
  if (t === "FELON") return { color: "#fb923c", textShadow: "0 0 5px rgba(251,146,60,0.30)" };
  if (t === "INDICTED") return { color: "#a78bfa" };
  return {};
}

function runSlashCommand(
  raw: string,
  opts: {
    me?: any;
    send: (body: string) => void;
    openGif: (query?: string) => void;
    clear: () => void;
    tip: (toUsername: string, amount: number, note: string) => void;
  },
): boolean {
  if (!raw.startsWith("/")) return false;
  const [cmdRaw, ...rest] = raw.slice(1).split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const args = rest.join(" ").trim();
  const meName = String(opts.me?.name || "someone");
  switch (cmd) {
    case "me":
      if (!args) {
        weeredToast.error("Usage: /me does something");
        return true;
      }
      opts.send(`*${meName} ${args}*`);
      opts.clear();
      return true;
    case "tip": {
      const m = args.match(/^@?([a-zA-Z0-9][a-zA-Z0-9_-]{0,31})\s+(\d[\d,]*)(?:\s+(.+))?$/);
      if (!m) {
        weeredToast.error("Usage: /tip @user <amount> [note]");
        return true;
      }
      const toUsername = m[1];
      const amount = parseInt(m[2].replace(/,/g, ""), 10);
      const note = (m[3] || "").trim();
      if (!Number.isFinite(amount) || amount < 1) {
        weeredToast.error("Tip amount must be at least 1 Paper.");
        return true;
      }
      opts.tip(toUsername, amount, note);
      opts.clear();
      return true;
    }
    case "shrug":
      opts.send(`${args ? args + " " : ""}¯\\_(ツ)_/¯`);
      opts.clear();
      return true;
    case "tableflip":
      opts.send(`${args ? args + " " : ""}(╯°□°)╯︵ ┻━┻`);
      opts.clear();
      return true;
    case "unflip":
      opts.send(`${args ? args + " " : ""}┬─┬ ノ( ゜-゜ノ)`);
      opts.clear();
      return true;
    case "flip":
      opts.send(`${args ? args + " " : ""}（ノಠ益ಠ）ノ彡┻━┻`);
      opts.clear();
      return true;
    case "roll": {
      const m = args.match(/^(\d*)d(\d+)(?:\s*([+\-]\s*\d+))?$/i) || ["", "1", "20"];
      const n = Math.max(1, Math.min(20, parseInt(m[1] || "1", 10) || 1));
      const sides = Math.max(2, Math.min(1000, parseInt(m[2] || "20", 10) || 20));
      const mod = m[3] ? parseInt(m[3].replace(/\s+/g, ""), 10) : 0;
      const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
      const sum = rolls.reduce((a, b) => a + b, 0) + mod;
      const breakdown =
        n === 1
          ? `${rolls[0]}`
          : `${rolls.join(" + ")}${mod ? ` ${mod >= 0 ? "+" : "-"} ${Math.abs(mod)}` : ""} = ${sum}`;
      opts.send(`🎲 \`${n}d${sides}${mod ? (mod >= 0 ? `+${mod}` : mod) : ""}\` → ${breakdown}`);
      opts.clear();
      return true;
    }
    case "giphy":
      opts.openGif(args || undefined);
      opts.clear();
      return true;
    case "mod":
    case "mods": {
      const query = args;
      void (async () => {
        try {
          if (!query) {
            weeredToast("/mod <name> — drop a Windrose mod into chat. Try: /mod qol plus");
            return;
          }
          const token =
            (typeof window !== "undefined" ? localStorage.getItem("weered_token") : "") || "";
          const r = await fetch(
            `${API}/mods?search=${encodeURIComponent(query)}&limit=1&gameSlug=windrose`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            },
          );
          const j = await r.json();
          const hit = (j?.mods || [])[0];
          if (!hit?.sourceUrl) {
            weeredToast.error(`No mod matched "${query}".`);
            return;
          }
          opts.send(hit.sourceUrl);
        } catch {
          weeredToast.error("Mod lookup failed.");
        }
      })();
      opts.clear();
      return true;
    }
    case "help":
    case "commands": {
      const help = [
        "Slash commands:",
        "/me <action> — action emote",
        "/tip @user <amount> [note] — send Paper",
        "/shrug · /tableflip · /unflip · /flip — classics",
        "/roll 2d20 — dice roll (modifiers: /roll 1d20+3)",
        "/giphy <query> — opens GIF picker",
      ].join("\n");
      weeredToast(help);
      opts.clear();
      return true;
    }
    default:
      weeredToast.error(`Unknown command: /${cmdRaw}`);
      return true;
  }
}

type CrewFlairData = { tag: string; logoUrl: string | null; accentColor: string | null } | null;
const crewFlairCache = new Map<string, CrewFlairData>();
const crewFlairInflight = new Map<string, Promise<void>>();

function CrewFlair({ userId, size = 13 }: { userId: string; size?: number }) {
  const [flair, setFlair] = useState<CrewFlairData | undefined>(() =>
    crewFlairCache.has(userId) ? crewFlairCache.get(userId)! : undefined,
  );
  useEffect(() => {
    if (flair !== undefined) return;
    if (!userId) return;
    const existing = crewFlairInflight.get(userId);
    if (existing) {
      existing.then(() => setFlair(crewFlairCache.get(userId) ?? null));
      return;
    }
    const token = (typeof window !== "undefined" ? localStorage.getItem("weered_token") : "") || "";
    const p = fetch(`${API}/profile/${encodeURIComponent(userId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => {
        const pc = j?.primaryCrew;
        crewFlairCache.set(
          userId,
          pc
            ? {
                tag: String(pc.tag || ""),
                logoUrl: pc.logoUrl || null,
                accentColor: pc.accentColor || null,
              }
            : null,
        );
      })
      .catch(() => {
        crewFlairCache.set(userId, null);
      })
      .finally(() => {
        crewFlairInflight.delete(userId);
        setFlair(crewFlairCache.get(userId) ?? null);
      });
    crewFlairInflight.set(userId, p);
  }, [userId, flair]);
  if (!flair) return null;
  const accent =
    flair.accentColor && /^#[0-9a-f]{6}$/i.test(flair.accentColor)
      ? flair.accentColor
      : "rgba(201,160,102,0.7)";
  if (flair.logoUrl) {
    return (
      <span
        title={`Crew: [${flair.tag || ""}]`}
        style={{
          width: size,
          height: size,
          borderRadius: 3,
          display: "inline-block",
          backgroundImage: `url(${flair.logoUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          border: `1px solid ${accent}`,
          flexShrink: 0,
        }}
      />
    );
  }
  if (flair.tag) {
    return (
      <span
        title={`Crew: [${flair.tag}]`}
        style={{
          fontSize: Math.max(8, size - 4),
          fontWeight: 800,
          letterSpacing: "1px",
          padding: "0 4px",
          borderRadius: 2,
          color: accent,
          border: `1px solid ${accent}`,
          fontFamily: "ui-monospace, monospace",
          lineHeight: `${size}px`,
        }}
      >
        {flair.tag}
      </span>
    );
  }
  return null;
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const IMG_EXT = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;
const TENOR_RE = /https?:\/\/media\.tenor\.com\/[^\s]+/i;
const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

const WEERED_BOUNTY_RE = /(?:https?:\/\/[^\s/]+)?\/windrose\/bounty\/([^\s/?#]+)/i;
const WEERED_HUNTER_RE = /(?:https?:\/\/[^\s/]+)?\/windrose\/hunter\/([^\s/?#]+)/i;
const WEERED_CREW_RE = /(?:https?:\/\/[^\s/]+)?\/crew\/([^\s/?#]+)/i;
const NEXUS_MOD_RE = /(?:https?:\/\/)?(?:www\.)?nexusmods\.com\/(windrose)\/mods\/(\d+)/i;

type WeeredEmbedKind = "bounty" | "hunter" | "crew" | "nexus";
function detectWeeredEmbed(url: string): { kind: WeeredEmbedKind; id: string } | null {
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

function WeeredBountyEmbed({ id, href }: { id: string; href: string }) {
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

function WeeredHunterEmbed({ id, href }: { id: string; href: string }) {
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

function WeeredCrewEmbed({ id, href }: { id: string; href: string }) {
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

function NexusModEmbed({ id, href }: { id: string; href: string }) {
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

function EmbedSkeleton({ href, label }: { href: string; label: string }) {
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

function LinkPreviewCard({ url }: { url: string }) {
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

const MENTION_BODY_RE = /@([a-zA-Z0-9][a-zA-Z0-9_-]{1,31})/g;
const BOLD_RE = /\*\*([^*\n]+?)\*\*/g;
const ITALIC_RE = /(^|[^*])\*([^*\n]+?)\*(?!\*)/g;
const CODE_RE = /`([^`\n]+?)`/g;
const CARD_RE = /\[\[([^\]\n]{1,80})\]\]/g;

type InlineTok = {
  kind: "url" | "mention" | "bold" | "italic" | "code" | "card";
  start: number;
  end: number;
  value: string;
  raw: string;
};

type ChatAtt = {
  id: string;
  url: string;
  thumbUrl: string;
  w: number;
  h: number;
  trusted: boolean;
  expiresAt?: string | null;
};

function authHeadersChat(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

// Client-side screen — nsfwjs (lazy; the model ships in the package).
let _nsfwModel: any = null;
async function screenFile(file: File): Promise<{ ok: boolean }> {
  try {
    if (!_nsfwModel) {
      // Loaded from CDN at runtime — the embedded model shards break the
      // webpack minifier if bundled. Function() keeps both TS and webpack
      // from statically analyzing the import.
      const dynImport = new Function("u", "return import(u)") as (u: string) => Promise<any>;
      const nsfwjs = await dynImport("https://esm.sh/nsfwjs@4.3.0");
      _nsfwModel = await (nsfwjs.load ? nsfwjs.load() : nsfwjs.default.load());
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("decode"));
        img.src = url;
      });
      const preds: { className: string; probability: number }[] = await _nsfwModel.classify(img);
      const bad = preds.find(
        (p) => (p.className === "Porn" || p.className === "Hentai") && p.probability > 0.7,
      );
      return { ok: !bad };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return { ok: true }; // screen unavailable — the server re-screens
  }
}

function daysLeft(iso?: string | null): number | null {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000);
  return d > 0 ? d : 0;
}

function AttachmentBlock({
  att,
  mine,
  onOpen,
}: {
  att: ChatAtt;
  mine: boolean;
  onOpen: (att: ChatAtt) => void;
}) {
  const [revealed, setRevealed] = React.useState(false);
  const needsBlur = !att.trusted && !mine && !revealed;
  const maxW = 280;
  const ratio = att.w > 0 && att.h > 0 ? att.h / att.w : 0.66;
  const h = Math.min(280, Math.round(maxW * ratio));
  const exp = mine ? daysLeft(att.expiresAt) : null;
  return (
    <div style={{ marginTop: 5 }}>
      <div
        onClick={() => {
          if (needsBlur) setRevealed(true);
          else onOpen(att);
        }}
        style={{
          position: "relative",
          width: maxW,
          height: h,
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,.1)",
          cursor: "pointer",
          background: "rgba(0,0,0,.25)",
        }}
      >
        <img
          src={`${API}${att.thumbUrl}`}
          alt="attachment"
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            filter: needsBlur ? "blur(26px) saturate(.7)" : "none",
            transform: needsBlur ? "scale(1.1)" : "none",
            transition: "filter .25s",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
          }}
        />
        {needsBlur && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 10,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(243,244,246,.92)",
                textShadow: "0 1px 6px rgba(0,0,0,.8)",
              }}
            >
              From an unranked member
            </span>
            <span
              style={{
                fontSize: 10,
                color: "rgba(226,232,240,.75)",
                textShadow: "0 1px 6px rgba(0,0,0,.8)",
              }}
            >
              tap to view
            </span>
          </div>
        )}
      </div>
      {exp != null && (
        <div style={{ fontSize: 9, color: "rgba(148,163,184,.45)", marginTop: 3, paddingRight: 3 }}>
          expires in {exp}d · keep forever with Indicted
        </div>
      )}
    </div>
  );
}

function ChatBody({
  text,
  onMentionClick,
}: {
  text: string;
  onMentionClick?: (handle: string) => void;
}) {
  if (!text) return null;
  const imageUrls: string[] = [];
  const linkUrls: string[] = [];
  const weeredEmbeds: { url: string; kind: WeeredEmbedKind; id: string }[] = [];

  const lines = text.split(/\n/);
  const blockNodes: React.ReactNode[] = [];
  let blockKey = 0;

  for (const line of lines) {
    const isQuote = /^>\s?/.test(line);
    const content = isQuote ? line.replace(/^>\s?/, "") : line;
    const inlineNode = renderInline(content, imageUrls, linkUrls, weeredEmbeds, onMentionClick);
    if (isQuote) {
      blockNodes.push(
        <div
          key={blockKey++}
          style={{
            borderLeft: "3px solid var(--weered-accent-ring, rgba(124,58,237,0.55))",
            paddingLeft: 8,
            color: "var(--weered-muted, rgba(148,163,184,.85))",
            margin: "2px 0",
          }}
        >
          {inlineNode}
        </div>,
      );
    } else {
      blockNodes.push(<React.Fragment key={blockKey++}>{inlineNode}</React.Fragment>);
      if (blockKey < lines.length) blockNodes.push(<br key={`br-${blockKey}`} />);
    }
  }

  return (
    <>
      <div style={{ opacity: 0.95, wordBreak: "break-word" }}>{blockNodes}</div>
      {imageUrls.map((src, i) => (
        <a key={`img-${i}`} href={src} target="_blank" rel="noopener noreferrer">
          <img
            src={src}
            alt="Chat image"
            loading="lazy"
            style={{
              maxWidth: 280,
              maxHeight: 200,
              borderRadius: 8,
              marginTop: 4,
              border: "1px solid rgba(255,255,255,.1)",
              display: "block",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </a>
      ))}
      {weeredEmbeds.slice(0, 2).map((e, i) => {
        if (e.kind === "bounty")
          return <WeeredBountyEmbed key={`wb-${i}`} id={e.id} href={e.url} />;
        if (e.kind === "hunter")
          return <WeeredHunterEmbed key={`wh-${i}`} id={e.id} href={e.url} />;
        if (e.kind === "crew") return <WeeredCrewEmbed key={`wc-${i}`} id={e.id} href={e.url} />;
        if (e.kind === "nexus") return <NexusModEmbed key={`wn-${i}`} id={e.id} href={e.url} />;
        return null;
      })}
      {weeredEmbeds.length === 0 &&
        linkUrls.slice(0, 1).map((url, i) => <LinkPreviewCard key={`lp-${i}`} url={url} />)}
    </>
  );
}

const MTG_DECK_URL_RE =
  /^https?:\/\/(?:www\.)?(moxfield\.com\/decks\/[\w-]+|archidekt\.com\/decks\/\d+)/i;
type DeckLite = {
  source: "moxfield" | "archidekt";
  id: string;
  name: string;
  format: string | null;
  author: string | null;
  cardCount: number | null;
  colors: string[];
  commanders: string[];
  url: string;
  thumbnail: string | null;
};
const _mtgDeckCache = new Map<string, DeckLite | null>();
const _mtgDeckInflight = new Map<string, Promise<DeckLite | null>>();
async function fetchMoxfieldClient(deckId: string, url: string): Promise<DeckLite | null> {
  try {
    const r = await fetch(`https://api.moxfield.com/v2/decks/all/${encodeURIComponent(deckId)}`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    const commanders: string[] = [];
    const commandersBlock = j?.commanders ?? j?.boards?.commanders?.cards ?? {};
    for (const k of Object.keys(commandersBlock)) {
      const c = commandersBlock[k];
      const n = c?.card?.name || c?.name;
      if (n) commanders.push(n);
    }
    const colors: string[] = Array.isArray(j?.colors)
      ? j.colors
      : Array.isArray(j?.colorIdentity)
        ? j.colorIdentity
        : [];
    const cardCount =
      typeof j?.mainboardCount === "number"
        ? j.mainboardCount
        : typeof j?.boards?.mainboard?.count === "number"
          ? j.boards.mainboard.count
          : null;
    return {
      source: "moxfield",
      id: deckId,
      name: String(j?.name || "Untitled deck"),
      format: j?.format ?? null,
      author: j?.createdByUser?.userName ?? j?.createdByUser?.displayName ?? null,
      cardCount,
      colors,
      commanders,
      url,
      thumbnail: commanders[0]
        ? `https://api.scryfall.com/cards/named?format=image&version=art_crop&fuzzy=${encodeURIComponent(commanders[0])}`
        : null,
    };
  } catch {
    return null;
  }
}
function fetchMtgDeck(url: string): Promise<DeckLite | null> {
  const key = url.toLowerCase();
  if (_mtgDeckCache.has(key)) return Promise.resolve(_mtgDeckCache.get(key) ?? null);
  if (_mtgDeckInflight.has(key)) return _mtgDeckInflight.get(key)!;
  const moxMatch = url.match(/moxfield\.com\/decks\/([\w-]+)/i);
  const p: Promise<DeckLite | null> = moxMatch
    ? fetchMoxfieldClient(moxMatch[1], url)
    : fetch(`${API}/mtg/deck?url=${encodeURIComponent(url)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j?.ok && j?.deck ? (j.deck as DeckLite) : null))
        .catch(() => null);
  const cached = p
    .then((deck) => {
      _mtgDeckCache.set(key, deck);
      _mtgDeckInflight.delete(key);
      return deck;
    })
    .catch(() => {
      _mtgDeckInflight.delete(key);
      _mtgDeckCache.set(key, null);
      return null;
    });
  _mtgDeckInflight.set(key, cached);
  return cached;
}
function MtgDeckChip({ url }: { url: string }) {
  const [deck, setDeck] = React.useState<DeckLite | null>(
    _mtgDeckCache.get(url.toLowerCase()) ?? null,
  );
  React.useEffect(() => {
    if (deck !== null) return;
    let cancel = false;
    fetchMtgDeck(url).then((d) => {
      if (!cancel) setDeck(d);
    });
    return () => {
      cancel = true;
    };
  }, [url, deck]);
  const source = /moxfield/i.test(url) ? "moxfield" : "archidekt";
  if (!deck) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 6,
          background: "rgba(156,124,63,0.12)",
          color: "rgba(255,235,200,0.85)",
          border: "1px solid rgba(156,124,63,0.35)",
          fontSize: "0.92em",
          textDecoration: "none",
          fontWeight: 600,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {source} · deck link
      </a>
    );
  }
  const colorPips =
    deck.colors.length > 0
      ? deck.colors
          .map(
            (c) =>
              ({ W: "#fffcd8", U: "#b8d6f5", B: "#34292a", R: "#f29c93", G: "#9bd3a7" })[c] ||
              "#888",
          )
          .join(",")
      : "";
  return (
    <a
      href={deck.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        margin: "2px 0",
        borderRadius: 8,
        background: "linear-gradient(135deg, rgba(156,124,63,0.18) 0%, rgba(91,74,58,0.32) 100%)",
        color: "rgba(255,235,200,0.95)",
        border: "1px solid rgba(156,124,63,0.45)",
        textDecoration: "none",
        maxWidth: 380,
        verticalAlign: "middle",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {deck.thumbnail && (
        <img
          src={deck.thumbnail}
          alt=""
          style={{ width: 40, height: 30, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
        />
      )}
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {deck.name}
        </span>
        <span
          style={{
            display: "block",
            fontSize: "0.82em",
            opacity: 0.8,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {deck.commanders[0] ? `${deck.commanders[0]} · ` : ""}
          {deck.format || deck.source}
          {deck.author ? ` · ${deck.author}` : ""}
          {deck.cardCount ? ` · ${deck.cardCount} cards` : ""}
        </span>
      </span>
      {colorPips && (
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 2, flexShrink: 0 }}>
          {deck.colors.map((c, i) => (
            <span
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background:
                  { W: "#fffcd8", U: "#b8d6f5", B: "#34292a", R: "#f29c93", G: "#9bd3a7" }[c] ||
                  "#888",
                border: "1px solid rgba(0,0,0,0.3)",
              }}
            />
          ))}
        </span>
      )}
    </a>
  );
}

type ScryfallLite = {
  name: string;
  set: string;
  set_name: string;
  mana_cost: string | null;
  type_line: string | null;
  oracle_text: string | null;
  image: string | null;
  image_small: string | null;
  scryfall_uri: string;
  colors: string[];
  cmc: number;
};
const _mtgCardCache = new Map<string, ScryfallLite | null>();
const _mtgCardInflight = new Map<string, Promise<ScryfallLite | null>>();
function fetchMtgCard(name: string): Promise<ScryfallLite | null> {
  const key = name.trim().toLowerCase();
  if (_mtgCardCache.has(key)) return Promise.resolve(_mtgCardCache.get(key) ?? null);
  if (_mtgCardInflight.has(key)) return _mtgCardInflight.get(key)!;
  const p = fetch(`${API}/scryfall/card?name=${encodeURIComponent(name)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const card = j?.ok && j?.card ? (j.card as ScryfallLite) : null;
      _mtgCardCache.set(key, card);
      _mtgCardInflight.delete(key);
      return card;
    })
    .catch(() => {
      _mtgCardInflight.delete(key);
      _mtgCardCache.set(key, null);
      return null;
    });
  _mtgCardInflight.set(key, p);
  return p;
}
function MtgCardChip({ name }: { name: string }) {
  const [card, setCard] = React.useState<ScryfallLite | null>(
    _mtgCardCache.get(name.trim().toLowerCase()) ?? null,
  );
  const [hover, setHover] = React.useState(false);
  React.useEffect(() => {
    if (card !== null) return;
    let cancel = false;
    fetchMtgCard(name).then((c) => {
      if (!cancel) setCard(c);
    });
    return () => {
      cancel = true;
    };
  }, [name, card]);
  const display = card?.name || name;
  const href = card?.scryfall_uri || `https://scryfall.com/search?q=${encodeURIComponent(name)}`;
  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          padding: "0 6px",
          borderRadius: 4,
          background: "rgba(156,124,63,0.18)",
          color: "rgba(255,235,200,0.95)",
          border: "1px solid rgba(156,124,63,0.45)",
          fontWeight: 600,
          textDecoration: "none",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {display}
      </a>
      {hover && card?.image && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            zIndex: 60,
            pointerEvents: "none",
            background: "transparent",
          }}
        >
          <img
            src={card.image}
            alt={card.name}
            style={{
              width: 220,
              borderRadius: 12,
              boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
              display: "block",
            }}
          />
        </span>
      )}
    </span>
  );
}

function renderInline(
  text: string,
  imageUrls: string[],
  linkUrls: string[],
  weeredEmbeds: { url: string; kind: WeeredEmbedKind; id: string }[],
  onMentionClick?: (handle: string) => void,
): React.ReactNode {
  if (!text) return null;

  const toks: InlineTok[] = [];
  let m: RegExpExecArray | null;

  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    toks.push({ kind: "url", start: m.index, end: m.index + m[0].length, value: m[0], raw: m[0] });
  }
  CARD_RE.lastIndex = 0;
  while ((m = CARD_RE.exec(text)) !== null) {
    if (toks.some((t) => t.kind === "url" && m!.index >= t.start && m!.index < t.end)) continue;
    toks.push({
      kind: "card",
      start: m.index,
      end: m.index + m[0].length,
      value: m[1].trim(),
      raw: m[0],
    });
  }
  MENTION_BODY_RE.lastIndex = 0;
  while ((m = MENTION_BODY_RE.exec(text)) !== null) {
    if (toks.some((t) => t.kind === "url" && m!.index >= t.start && m!.index < t.end)) continue;
    toks.push({
      kind: "mention",
      start: m.index,
      end: m.index + m[0].length,
      value: m[1],
      raw: m[0],
    });
  }
  CODE_RE.lastIndex = 0;
  while ((m = CODE_RE.exec(text)) !== null) {
    toks.push({ kind: "code", start: m.index, end: m.index + m[0].length, value: m[1], raw: m[0] });
  }
  BOLD_RE.lastIndex = 0;
  while ((m = BOLD_RE.exec(text)) !== null) {
    if (toks.some((t) => t.kind === "code" && m!.index >= t.start && m!.index < t.end)) continue;
    toks.push({ kind: "bold", start: m.index, end: m.index + m[0].length, value: m[1], raw: m[0] });
  }
  ITALIC_RE.lastIndex = 0;
  while ((m = ITALIC_RE.exec(text)) !== null) {
    const starStart = m.index + m[1].length;
    const innerStart = starStart + 1;
    const innerEnd = innerStart + m[2].length;
    if (
      toks.some(
        (t) =>
          (t.kind === "code" || t.kind === "bold") && starStart >= t.start && starStart < t.end,
      )
    )
      continue;
    toks.push({
      kind: "italic",
      start: starStart,
      end: innerEnd + 1,
      value: m[2],
      raw: m[0].slice(m[1].length),
    });
  }
  toks.sort((a, b) => a.start - b.start);

  const keep: InlineTok[] = [];
  let prevEnd = -1;
  for (const t of toks) {
    if (t.start < prevEnd) continue;
    keep.push(t);
    prevEnd = t.end;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const t of keep) {
    if (t.start > cursor) parts.push(text.slice(cursor, t.start));
    if (t.kind === "url") {
      if (MTG_DECK_URL_RE.test(t.value)) {
        parts.push(<MtgDeckChip key={key++} url={t.value} />);
      } else {
        parts.push(
          <a
            key={key++}
            href={t.value}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#7c9dff",
              textDecoration: "underline",
              textUnderlineOffset: 2,
              wordBreak: "break-all",
            }}
          >
            {t.value}
          </a>,
        );
      }
      if (IMG_EXT.test(t.value) || TENOR_RE.test(t.value)) {
        imageUrls.push(t.value);
      } else {
        const weered = detectWeeredEmbed(t.value);
        if (weered) weeredEmbeds.push({ url: t.value, kind: weered.kind, id: weered.id });
        else linkUrls.push(t.value);
      }
    } else if (t.kind === "mention") {
      const handle = t.value;
      parts.push(
        <span
          key={key++}
          onClick={(e) => {
            e.stopPropagation();
            if (onMentionClick) onMentionClick(handle);
          }}
          style={{
            display: "inline-block",
            padding: "0 4px",
            borderRadius: 4,
            background: "var(--weered-accent-bg, rgba(124,58,237,0.18))",
            color: "var(--weered-accent-text, rgba(196,181,253,0.95))",
            fontWeight: 700,
            cursor: onMentionClick ? "pointer" : "default",
          }}
        >
          @{handle}
        </span>,
      );
    } else if (t.kind === "bold") {
      parts.push(
        <strong key={key++} style={{ fontWeight: 800 }}>
          {t.value}
        </strong>,
      );
    } else if (t.kind === "italic") {
      parts.push(
        <em key={key++} style={{ fontStyle: "italic" }}>
          {t.value}
        </em>,
      );
    } else if (t.kind === "code") {
      parts.push(
        <code
          key={key++}
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.92em",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 4,
            padding: "0 5px",
          }}
        >
          {t.value}
        </code>,
      );
    } else if (t.kind === "card") {
      parts.push(<MtgCardChip key={key++} name={t.value} />);
    }
    cursor = t.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

const TENOR_API_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY || "";
const TENOR_URL = "https://tenor.googleapis.com/v2";

function GifPicker({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${TENOR_URL}/featured?key=${TENOR_API_KEY}&limit=20&media_filter=tinygif,gif`)
      .then((r) => r.json())
      .then((j) => {
        setResults(j.results || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  function search() {
    if (!query.trim()) return;
    setLoading(true);
    fetch(
      `${TENOR_URL}/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(query)}&limit=20&media_filter=tinygif,gif`,
    )
      .then((r) => r.json())
      .then((j) => {
        setResults(j.results || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        right: 0,
        width: 320,
        maxHeight: 360,
        background: "#1a1a2e",
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 12,
        padding: 8,
        zIndex: 50,
        boxShadow: "0 8px 32px rgba(0,0,0,.5)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search GIFs..."
          style={{
            flex: 1,
            padding: "5px 8px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,.1)",
            background: "rgba(0,0,0,.3)",
            color: "rgba(243,244,246,.9)",
            fontSize: 12,
            outline: "none",
          }}
        />
        <button
          onClick={search}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid rgba(124,58,237,.3)",
            background: "rgba(124,58,237,.12)",
            color: "rgba(216,180,254,.9)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Go
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 4,
        }}
      >
        {loading && (
          <div
            style={{
              gridColumn: "1/-1",
              textAlign: "center",
              padding: 16,
              opacity: 0.4,
              fontSize: 12,
            }}
          >
            Loading...
          </div>
        )}
        {results.map((r: any) => {
          const tiny = r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || "";
          const full = r.media_formats?.gif?.url || tiny;
          if (!tiny) return null;
          return (
            <img
              key={r.id}
              src={tiny}
              alt="GIF"
              loading="lazy"
              onClick={() => {
                onSelect(full);
                onClose();
              }}
              style={{
                width: "100%",
                height: 80,
                objectFit: "cover",
                borderRadius: 6,
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,.06)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,.4)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.06)")}
            />
          );
        })}
      </div>
      <div style={{ fontSize: 9, textAlign: "right", opacity: 0.2, marginTop: 4 }}>
        Powered by Tenor
      </div>
    </div>
  );
}

const svgProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const Icons = {
  Smile: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  Reply: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  ),
  Forward: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
    </svg>
  ),
  More: (p: any = {}) => (
    <svg {...svgProps} fill="currentColor" stroke="none" {...p}>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  ),
  Copy: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Link: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  Unread: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22 6 12 13 2 6" />
    </svg>
  ),
  Speak: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
  Edit: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4c0-.55.45-1 1-1h4c.55 0 1 .45 1 1v2" />
    </svg>
  ),
  Flag: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  Pin: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14l-1.5-4.5a2 2 0 0 1 .5-2L20 9V3H4v6l1.5 1.5a2 2 0 0 1 .5 2L5 17z" />
    </svg>
  ),
  Gif: (p: any = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm3.3 3.2v2.6h1.5v.6H8.5c-.1.3-.4.5-.9.5-.7 0-1.2-.5-1.2-1.4S7 9.1 7.7 9.1c.5 0 .9.3 1 .6h1.1c-.1-.8-.9-1.6-2.1-1.6-1.5 0-2.4 1-2.4 2.5s.9 2.5 2.3 2.5c.8 0 1.4-.4 1.6-.9l.1.8h.8V10H7.3v-1.8zm5.3 0h-1.2v5.2h1.2V8.2zm1.4 0v5.2h1.2v-2h1.6v-.9h-1.6v-1.4h2.1v-.9h-3.3z" />
    </svg>
  ),
  Emoji: (p: any = {}) => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  Send: (p: any = {}) => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "😀",
    emojis: [
      "😀",
      "😂",
      "🤣",
      "😅",
      "😊",
      "😍",
      "🥰",
      "😘",
      "😎",
      "🤩",
      "🥳",
      "😭",
      "😤",
      "🤔",
      "🤫",
      "🤯",
      "🥶",
      "🥵",
      "😈",
      "👻",
    ],
  },
  {
    label: "👍",
    emojis: [
      "👍",
      "👎",
      "👏",
      "🙌",
      "🤝",
      "✌️",
      "🤞",
      "💪",
      "🫡",
      "🫶",
      "❤️",
      "🔥",
      "💯",
      "⭐",
      "✨",
      "💀",
      "🎉",
      "🎮",
      "🏆",
      "👀",
    ],
  },
  {
    label: "🎯",
    emojis: [
      "🎯",
      "🚀",
      "💡",
      "⚡",
      "🔫",
      "🗡️",
      "🛡️",
      "💣",
      "🎲",
      "🃏",
      "♟️",
      "🏹",
      "⚔️",
      "🧨",
      "💥",
      "💫",
      "🌟",
      "🔮",
      "🧿",
      "🎪",
    ],
  },
  {
    label: "🐸",
    emojis: [
      "🐸",
      "🐶",
      "🐱",
      "🦊",
      "🐺",
      "🦁",
      "🐯",
      "🦄",
      "🐉",
      "🦅",
      "🐍",
      "🦈",
      "🐙",
      "🦀",
      "🐝",
      "🦋",
      "🌈",
      "🌊",
      "☀️",
      "🌙",
    ],
  },
];

function MoreMenuItem({
  icon,
  label,
  onClick,
  danger,
  divider,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}) {
  const color = danger ? "rgba(252,165,165,.95)" : "var(--weered-text, rgba(243,244,246,.92))";
  const hoverBg = danger ? "rgba(239,68,68,.15)" : "rgba(124,58,237,.18)";
  return (
    <>
      {divider && (
        <div style={{ height: 1, margin: "4px 6px", background: "rgba(255,255,255,.06)" }} />
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "7px 10px",
          border: "none",
          background: "transparent",
          color,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 500,
          textAlign: "left",
          borderRadius: 5,
          transition: "background .1s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = hoverBg;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span
          style={{
            width: 16,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.85,
          }}
        >
          {icon}
        </span>
        <span style={{ flex: 1 }}>{label}</span>
      </button>
    </>
  );
}

function MoreMenu({
  msgId,
  body,
  userName,
  isMine,
  editable,
  deletable,
  roomId,
  isPinned,
  canPin,
  canKick,
  onClose,
  onAddReaction,
  onReply,
  onEdit,
  onDelete,
  onTogglePin,
  onKick,
}: {
  msgId: string;
  body: string;
  userName: string;
  isMine: boolean;
  editable: boolean;
  deletable: boolean;
  roomId: string;
  isPinned: boolean;
  canPin: boolean;
  canKick: boolean;
  onClose: () => void;
  onAddReaction: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onKick: () => void;
}) {
  const copy = async (txt: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      weeredToast.success(okMsg);
    } catch {
      weeredToast.error("Clipboard unavailable.");
    }
  };
  const handleForward = () => {
    copy(`↪ ${userName}: ${body}`, "Forward text copied — paste in any chat.");
    onClose();
  };
  const handleCopyText = () => {
    copy(body, "Message copied.");
    onClose();
  };
  const handleCopyLink = () => {
    const path =
      typeof window !== "undefined"
        ? window.location.pathname
        : `/room/${encodeURIComponent(roomId)}`;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://weered.ca";
    copy(`${origin}${path}?msg=${encodeURIComponent(msgId)}`, "Message link copied.");
    onClose();
  };
  const handleMarkUnread = () => {
    try {
      const key = `weered:unread:${roomId}`;
      localStorage.setItem(key, msgId);
      weeredToast("Marked unread from this message.");
    } catch {}
    onClose();
  };
  const handleSpeak = () => {
    try {
      const synth = (window as any).speechSynthesis;
      if (!synth) {
        weeredToast.error("Speech not supported in this browser.");
        return;
      }
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(body);
      utter.rate = 1;
      utter.pitch = 1;
      synth.speak(utter);
    } catch {
      weeredToast.error("Speak failed.");
    }
    onClose();
  };
  const handleReport = async () => {
    const res = await weeredReport({ targetType: "MESSAGE", targetId: msgId, context: roomId });
    if (res?.ok) weeredToast.success("Report submitted. Staff will review.");
    else if (res && !res.ok)
      weeredToast.error(
        res.error === "report_rate_limit"
          ? "You're reporting too fast. Try again in a few minutes."
          : "Report failed.",
      );
    onClose();
  };

  return (
    <div
      data-reaction-ui
      data-more-menu
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 22,
        right: 4,
        minWidth: 220,
        padding: 5,
        borderRadius: 8,
        background: "var(--weered-panel2, rgba(16,16,20,.98))",
        border: "1px solid var(--weered-border, rgba(255,255,255,.1))",
        boxShadow: "0 10px 32px rgba(0,0,0,.55)",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <MoreMenuItem icon={<Icons.Smile />} label="Add Reaction" onClick={onAddReaction} />
      <MoreMenuItem icon={<Icons.Reply />} label="Reply" onClick={onReply} />
      <MoreMenuItem icon={<Icons.Forward />} label="Forward" onClick={handleForward} />
      <MoreMenuItem divider icon={<Icons.Copy />} label="Copy Text" onClick={handleCopyText} />
      <MoreMenuItem icon={<Icons.Unread />} label="Mark Unread" onClick={handleMarkUnread} />
      <MoreMenuItem icon={<Icons.Link />} label="Copy Message Link" onClick={handleCopyLink} />
      <MoreMenuItem icon={<Icons.Speak />} label="Speak Message" onClick={handleSpeak} />
      {canPin && (
        <MoreMenuItem
          divider
          icon={<Icons.Pin />}
          label={isPinned ? "Unpin Message" : "Pin Message"}
          onClick={() => {
            onTogglePin();
            onClose();
          }}
        />
      )}
      {editable && (
        <MoreMenuItem divider icon={<Icons.Edit />} label="Edit Message" onClick={onEdit} />
      )}
      {deletable && (
        <MoreMenuItem icon={<Icons.Trash />} label="Delete Message" onClick={onDelete} danger />
      )}
      {!isMine && (
        <MoreMenuItem
          divider
          icon={<Icons.Flag />}
          label="Report Message"
          onClick={handleReport}
          danger
        />
      )}
      {canKick && (
        <MoreMenuItem
          divider
          icon={<Icons.Trash />}
          label={`Kick ${userName} from chat`}
          onClick={() => {
            onKick();
            onClose();
          }}
          danger
        />
      )}
    </div>
  );
}

function TypingIndicator({ roomId, meId }: { roomId: string; meId?: string }) {
  const liveTyping = useRoomTyping(roomId);
  const [, setTick] = useState(0);
  const fresh = Date.now() - 5000;
  const typing = liveTyping.filter((e: any) => e.userId !== meId && e.ts > fresh);
  useEffect(() => {
    if (!liveTyping.length) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [liveTyping.length]);
  if (!typing.length) return null;
  const names = typing.slice(0, 3).map((t: any) => t.name);
  const rest = typing.length - names.length;
  const label =
    names.length === 1
      ? `${names[0]} is typing\u2026`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing\u2026`
        : rest > 0
          ? `${names.join(", ")} and ${rest} other${rest === 1 ? "" : "s"} are typing\u2026`
          : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} are typing\u2026`;
  return (
    <div
      style={{
        padding: "4px 14px 2px",
        fontSize: 11,
        color: "var(--weered-muted, rgba(148,163,184,.70))",
        fontStyle: "italic",
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
        minHeight: 18,
      }}
    >
      <span style={{ display: "inline-flex", gap: 2 }}>
        <span
          style={{
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "currentColor",
            animation: "weered-typing 1.2s ease-in-out infinite",
          }}
        />
        <span
          style={{
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "currentColor",
            animation: "weered-typing 1.2s ease-in-out 0.2s infinite",
          }}
        />
        <span
          style={{
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "currentColor",
            animation: "weered-typing 1.2s ease-in-out 0.4s infinite",
          }}
        />
      </span>
      {label}
      <style>{`
        @keyframes weered-typing {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}

export default function LobbyChatPanel(
  props: {
    title?: string;
    style?: React.CSSProperties;
    roomId?: string;
    embedded?: boolean;
    hideInput?: boolean;
  } = {},
) {
  const { replaceTop } = useOverlay();
  const ctx: any = useWeered();

  const _lobbyMod =
    String(ctx?.currentLobbyId || "").toLowerCase() === "windrose" ? "WINDROSE" : undefined;
  const {
    openHover,
    scheduleClose: hoverClose,
    card: hoverCard,
  } = useUserHover({
    lobbyModuleType: _lobbyMod,
    onViewProfile: (id) => replaceTop("profile", { userId: id }),
    onMessage: (id, name) => {
      try {
        window.dispatchEvent(
          new CustomEvent("weered:dock:open", { detail: { mode: "dm", peer: { id, name } } }),
        );
      } catch {}
    },
  });

  const activeRoomId = String(ctx?.activeRoomId || "");
  const joinedRoomId = String(ctx?.joinedRoomId || "");
  const joinStatus = String(ctx?.joinStatus || "idle");

  const effectiveRoomId = (() => {
    let forced = String(props.roomId || "").trim();
    if (forced.startsWith("room:")) forced = forced.slice(5);
    try {
      forced = decodeURIComponent(forced);
    } catch {}
    return forced || activeRoomId;
  })();

  const metaByRoom = ctx?.metaByRoom || {};
  const adminByRoom = ctx?.adminByRoom || {};
  const statusByRoom = ctx?.statusByRoom || {};

  const msgs = useRoomMsgs(effectiveRoomId);
  const liveRoomUsers = useRoomUsers(effectiveRoomId);
  const meta = metaByRoom[effectiveRoomId] || ctx?.meta || null;
  const admin = adminByRoom[effectiveRoomId] || ctx?.admin || null;
  const effectiveJoinStatus = statusByRoom[effectiveRoomId] || joinStatus;

  const displayRoomName = String(
    meta?.name || meta?.title || meta?.label || admin?.name || "",
  ).trim();

  useEffect(() => {
    let forced = String(props.roomId || "").trim();
    if (!forced) return;
    if (forced.startsWith("room:")) forced = forced.slice(5);
    try {
      forced = decodeURIComponent(forced);
    } catch {}
    forced = String(forced || "").trim();
    if (!forced) return;
    try {
      ctx?.setActiveRoomId?.(forced);
    } catch {}
  }, [props.roomId]);

  const roomLabel = effectiveRoomId;

  const [text, setText] = useState("");
  const [mentionState, setMentionState] = useState<{
    query: string;
    start: number;
    index: number;
  } | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const [readTsSnapshot, setReadTsSnapshot] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!effectiveRoomId) return;
    try {
      const stored = Number(localStorage.getItem(`weered:lastRead:${effectiveRoomId}`)) || 0;
      if (stored === 0) {
        const now = Date.now();
        localStorage.setItem(`weered:lastRead:${effectiveRoomId}`, String(now));
        setReadTsSnapshot(now);
      } else {
        setReadTsSnapshot(stored);
      }
    } catch {
      setReadTsSnapshot(Date.now());
    }
  }, [effectiveRoomId]);
  const markRoomReadNow = useCallback(() => {
    if (!effectiveRoomId) return;
    try {
      localStorage.setItem(`weered:lastRead:${effectiveRoomId}`, String(Date.now()));
    } catch {}
  }, [effectiveRoomId]);
  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2500) return;
    lastTypingSentRef.current = now;
    try {
      (ctx as any)?.sendRaw?.({ type: "chat:typing" });
    } catch {}
  }, [ctx]);

  const mentionLookup = useMemo(() => {
    const out: Record<string, string> = { operator: "The Operator" };
    const roomUsers: any[] = liveRoomUsers;
    for (const u of roomUsers) {
      const key = String(u?.usernameKey || "").toLowerCase();
      if (key && u?.name) out[key] = u.name;
    }
    return out;
  }, [liveRoomUsers, effectiveRoomId]);

  const mentionCandidates = useMemo(() => {
    if (!mentionState) return [] as any[];
    const q = mentionState.query.toLowerCase();
    const roomUsers: any[] = liveRoomUsers;
    const myId = String(ctx?.me?.id || "");
    return roomUsers
      .filter((u) => u?.id && u.id !== myId && u?.name && u.name.toLowerCase().startsWith(q))
      .slice(0, 6);
  }, [mentionState, liveRoomUsers, effectiveRoomId, ctx?.me?.id]);

  const acceptMention = useCallback(
    (username: string) => {
      setMentionState((s) => {
        if (!s) return null;
        const before = text.slice(0, s.start);
        const after = text.slice(s.start + 1 + s.query.length);
        const next = `${before}@${username} ${after}`;
        setText(next);
        setTimeout(() => {
          const el = inputRef.current;
          if (el) {
            const pos = before.length + username.length + 2;
            el.focus();
            try {
              el.setSelectionRange(pos, pos);
            } catch {}
          }
        }, 0);
        return null;
      });
    },
    [text],
  );
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCat, setEmojiCat] = useState(0);
  const [gifOpen, setGifOpen] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string>("");

  const [damagePicker, setDamagePicker] = useState<null | {
    amount: number;
    attackName: string;
    sourceMsgId: string;
  }>(null);
  const [pickerTokens, setPickerTokens] = useState<any[]>([]);
  const [pickerCombatants, setPickerCombatants] = useState<any[]>([]);
  useEffect(() => {
    if (!damagePicker || !effectiveRoomId) return;
    let alive = true;
    (async () => {
      try {
        const tok = (ctx as any)?.token;
        const r = await fetch(`${API}/maps/${encodeURIComponent(effectiveRoomId)}`, {
          headers: tok ? { Authorization: `Bearer ${tok}` } : {},
        });
        const j = await r.json();
        if (!alive) return;
        setPickerTokens(Array.isArray(j?.tokens) ? j.tokens : []);
      } catch {
        if (alive) setPickerTokens([]);
      }
      try {
        const cache = (window as any).__weeredInitiative?.[effectiveRoomId];
        setPickerCombatants(Array.isArray(cache?.combatants) ? cache.combatants : []);
      } catch {
        setPickerCombatants([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [damagePicker, effectiveRoomId, ctx]);

  async function applyDamageToToken(tokenId: string) {
    if (!damagePicker) return;
    const t = pickerTokens.find((x) => x.id === tokenId);
    if (!t) return;
    const newHp = Math.max(0, (t.hp || 0) - damagePicker.amount);
    try {
      const tok = (ctx as any)?.token;
      await fetch(`${API}/maps/tokens/${encodeURIComponent(tokenId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: JSON.stringify({ hp: newHp }),
      });
      if (t.combatantId) {
        try {
          window.dispatchEvent(
            new CustomEvent("weered:dnd:combatant:damage", {
              detail: {
                roomId: effectiveRoomId,
                combatantId: t.combatantId,
                amount: damagePicker.amount,
              },
            }),
          );
        } catch {}
        try {
          (ctx as any)?.sendRaw?.({
            type: "dnd:combatant:damage",
            roomId: effectiveRoomId,
            combatantId: t.combatantId,
            amount: damagePicker.amount,
          });
        } catch {}
      }
      try {
        weeredToast.success(`-${damagePicker.amount} HP → ${t.name}`);
      } catch {}
    } catch {
      try {
        weeredToast.error("Failed to apply damage");
      } catch {}
    }
    setDamagePicker(null);
  }

  function applyDamageToCombatant(combatantId: string) {
    if (!damagePicker) return;
    const c = pickerCombatants.find((x) => x.id === combatantId);
    try {
      window.dispatchEvent(
        new CustomEvent("weered:dnd:combatant:damage", {
          detail: { roomId: effectiveRoomId, combatantId, amount: damagePicker.amount },
        }),
      );
    } catch {}
    try {
      (ctx as any)?.sendRaw?.({
        type: "dnd:combatant:damage",
        roomId: effectiveRoomId,
        combatantId,
        amount: damagePicker.amount,
      });
    } catch {}
    try {
      weeredToast.success(`-${damagePicker.amount} HP → ${c?.name || "combatant"}`);
    } catch {}
    setDamagePicker(null);
  }

  async function rollFollowupDamage(meta: any) {
    const lobbyId = String(ctx?.currentLobbyId || "");
    if (!lobbyId) {
      try {
        weeredToast.error("Not in a lobby");
      } catch {}
      return;
    }
    if (!meta?.damageExpression) return;
    try {
      const tok = (ctx as any)?.token;
      await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/dice/roll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: JSON.stringify({
          expression: meta.damageExpression,
          intent: "damage",
          attackName: meta.attackName,
          characterId: meta.characterId,
        }),
      });
    } catch {
      try {
        weeredToast.error("Damage roll failed");
      } catch {}
    }
  }
  const [editDraft, setEditDraft] = useState<string>("");
  const [hoveredMsgId, setHoveredMsgId] = useState<string>("");
  const [pickerMsgId, setPickerMsgId] = useState<string>("");
  const [moreMenuMsgId, setMoreMenuMsgId] = useState<string>("");
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    userName: string;
    body: string;
  } | null>(null);

  const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉", "😢", "😮", "🙌"];

  function toggleReaction(msgId: string, emoji: string) {
    try {
      (ctx as any)?.sendRaw?.({ type: "reaction:toggle", roomId: effectiveRoomId, msgId, emoji });
    } catch {}
    setPickerMsgId("");
  }

  useEffect(() => {
    if (!pickerMsgId) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (t && t.closest?.("[data-reaction-ui]")) return;
      setPickerMsgId("");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pickerMsgId]);

  useEffect(() => {
    if (!moreMenuMsgId) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (t && t.closest?.("[data-more-menu]")) return;
      setMoreMenuMsgId("");
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreMenuMsgId("");
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreMenuMsgId]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const emojiRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emojiOpen]);

  const insertEmoji = useCallback((emoji: string) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  }, []);

  const joinedStrict = Boolean(
    effectiveRoomId &&
    joinedRoomId &&
    effectiveRoomId === joinedRoomId &&
    effectiveJoinStatus === "joined",
  );
  const chatBlocked = props.embedded ? Boolean(meta?.chatDisabled) : Boolean(meta?.locked);
  const joinedByMeta = Boolean((meta || admin) && !chatBlocked && !admin?.locked);
  const canType = (joinedStrict || joinedByMeta) && !chatBlocked;
  const msgTrim = String(text || "").trim();
  const canSend = !!canType && msgTrim.length > 0; // attachment-only send handled via canSendNow below

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [msgs.length, effectiveRoomId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) markRoomReadNow();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [markRoomReadNow, effectiveRoomId]);

  const [pendingAtt, setPendingAtt] = React.useState<ChatAtt | null>(null);
  const [attBusy, setAttBusy] = React.useState(false);
  const [mediaElig, setMediaElig] = React.useState<any>(null);
  const [lockOpen, setLockOpen] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<ChatAtt | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const fetchElig = React.useCallback(async () => {
    try {
      const r = await fetch(`${API}/chat/media/eligibility`, { headers: { ...authHeadersChat() } });
      const j = await r.json();
      if (j?.ok) {
        setMediaElig(j);
        return j;
      }
    } catch {}
    return null;
  }, []);

  const handleFile = React.useCallback(
    async (file: File) => {
      if (!file || !file.type.startsWith("image/")) return;
      if (file.size > 8 * 1024 * 1024) {
        weeredToast.error("Images max 8MB.");
        return;
      }
      setAttBusy(true);
      try {
        const sc = await screenFile(file);
        if (!sc.ok) {
          weeredToast.error("That one didn\u2019t pass the door check.");
          return;
        }
        const dataUrl: string = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result || ""));
          fr.onerror = () => rej(new Error("read"));
          fr.readAsDataURL(file);
        });
        const r = await fetch(`${API}/chat/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeadersChat() },
          body: JSON.stringify({ image: dataUrl, roomId: effectiveRoomId }),
        });
        const j = await r.json();
        if (!j?.ok) {
          if (j?.error === "locked") {
            setMediaElig((e: any) => ({
              ...(e || {}),
              allowed: false,
              notoriety: j.notoriety,
              required: j.required,
            }));
            setLockOpen(true);
          } else if (j?.error === "media_banned")
            weeredToast.error("Media privileges are currently revoked.");
          else if (j?.error === "failed_screen" || j?.error === "blocked_content")
            weeredToast.error("That one didn\u2019t pass the door check.");
          else weeredToast.error("Upload failed.");
          return;
        }
        setPendingAtt(j.attachment as ChatAtt);
        try {
          if (!localStorage.getItem("weered:media:welcomed")) {
            localStorage.setItem("weered:media:welcomed", "1");
            weeredToast.success(
              "The Operator: You\u2019ve earned media privileges. Post like you\u2019ve got something to lose.",
            );
          }
        } catch {}
      } finally {
        setAttBusy(false);
      }
    },
    [effectiveRoomId],
  );

  const onAttachClick = React.useCallback(async () => {
    if (!canType || attBusy) return;
    const e = mediaElig || (await fetchElig());
    if (e && !e.allowed) {
      setLockOpen(true);
      return;
    }
    fileRef.current?.click();
  }, [canType, attBusy, mediaElig, fetchElig]);

  const canSendNow = canSend || (!!canType && !!pendingAtt);

  const onSend = () => {
    if (!canType) return;
    const msg = String(text || "").trim();
    if (!msg && !pendingAtt) return;
    if (msg.startsWith("/")) {
      const handled = runSlashCommand(msg, {
        me: ctx?.me,
        send: (body: string) => {
          try {
            ctx?.sendChat?.(body, replyingTo ? { replyToId: replyingTo.id } : undefined);
          } catch {}
        },
        openGif: (_q?: string) => {
          setGifOpen(true);
          setEmojiOpen(false);
        },
        clear: () => {
          setText("");
          setReplyingTo(null);
        },
        tip: (toUsername: string, amount: number, note: string) => {
          const token = (() => {
            try {
              return localStorage.getItem("weered_token") || "";
            } catch {
              return "";
            }
          })();
          fetch(`${API}/paper/tip`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ toUsername, amount, note }),
          })
            .then((r) => r.json())
            .then((j) => {
              if (j?.ok) {
                const recipientName = j.recipient?.name || toUsername;
                const noteStr = note ? ` — *${note}*` : "";
                try {
                  ctx?.sendChat?.(
                    `💰 tipped **${recipientName}** \`${amount.toLocaleString()} Paper\`${noteStr}`,
                  );
                } catch {}
                weeredToast.success(
                  `Sent ${amount.toLocaleString()} Paper to ${recipientName}. Balance: ${Number(j.balance || 0).toLocaleString()}`,
                );
              } else {
                weeredToast.error(j?.message || j?.error || "Tip failed.");
              }
            })
            .catch(() => weeredToast.error("Tip failed — network error."));
        },
      });
      if (handled) return;
    }
    try {
      ctx?.sendChat?.(msg, {
        ...(replyingTo ? { replyToId: replyingTo.id } : {}),
        ...(pendingAtt ? { attachmentId: pendingAtt.id } : {}),
      });
    } catch {}
    setText("");
    setPendingAtt(null);
    setReplyingTo(null);
    markRoomReadNow();
  };

  return (
    <>
      <div
        className="weered-chat-layout"
        style={{
          display: "flex",
          flexDirection: "row",
          height: "100%",
          minHeight: 0,
          ...props.style,
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0 }}
        >
          {!props.embedded && (
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-white/90">
                {props.title || "Lobby Chat"}
              </div>
              <div className="text-xs text-white/60 truncate">
                room: {displayRoomName ? `${displayRoomName}  (#${roomLabel})` : roomLabel}
              </div>
            </div>
          )}

          {(() => {
            const pinIds: string[] = Array.isArray(ctx?.pinnedByRoom?.[effectiveRoomId])
              ? ctx.pinnedByRoom[effectiveRoomId]
              : [];
            if (pinIds.length === 0) return null;
            const pinMsgs = pinIds
              .map((pid) => msgs.find((m: any) => String(m?.id || "") === pid))
              .filter(Boolean) as any[];
            if (pinMsgs.length === 0) return null;
            return (
              <details
                style={{
                  marginBottom: 8,
                  background: "linear-gradient(90deg, rgba(217,169,66,.08), rgba(217,169,66,.02))",
                  border: "1px solid rgba(217,169,66,.22)",
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              >
                <summary
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "rgba(232,196,138,.85)",
                    listStyle: "none",
                  }}
                >
                  <Icons.Pin />
                  Pinned · {pinMsgs.length}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 9, opacity: 0.6, letterSpacing: "1px" }}>
                    click to expand
                  </span>
                </summary>
                <div
                  style={{
                    padding: "4px 10px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {pinMsgs.map((pm) => {
                    const pid = String(pm?.id || "");
                    const puname = String(
                      pm?.user?.name || pm?.user?.id || pm?.name || pm?.author || "?",
                    );
                    const pbody = String(pm?.body || pm?.text || "");
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => {
                          try {
                            const el = document.querySelector(
                              `[data-msg-id="${pid}"]`,
                            ) as HTMLElement | null;
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                              const prev = el.style.background;
                              el.style.transition = "background 0.2s";
                              el.style.background = "rgba(232,196,138,0.18)";
                              setTimeout(() => {
                                el.style.background = prev;
                              }, 1200);
                            }
                          } catch {}
                        }}
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 8,
                          padding: "6px 10px",
                          border: "1px solid rgba(217,169,66,.18)",
                          borderRadius: 5,
                          background: "rgba(0,0,0,.15)",
                          color: "inherit",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}
                      >
                        <span
                          style={{ color: "rgba(232,196,138,0.9)", fontWeight: 700, flexShrink: 0 }}
                        >
                          {puname}
                        </span>
                        <span
                          style={{
                            opacity: 0.75,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                          }}
                        >
                          {pbody.length > 140 ? `${pbody.slice(0, 140)}…` : pbody}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </details>
            );
          })()}

          <div
            ref={listRef}
            data-weered-msglist
            style={{
              border: props.embedded ? "none" : "1px solid var(--weered-border)",
              borderRadius: props.embedded ? 0 : 14,
              padding: props.embedded ? "0 10px" : 10,
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              background: props.embedded ? "transparent" : "rgba(255,255,255,.02)",
              marginBottom: props.hideInput ? 0 : 10,
            }}
          >
            <style>{`[data-weered-msglist] > div { content-visibility: auto; contain-intrinsic-size: auto 56px; }`}</style>
            {msgs.length === 0 ? (
              <EmptyState title="Crickets." hint="Be the one who drops the first line." />
            ) : (
              msgs.map((m: any, i: number) => {
                if (m?.kind === "poker") {
                  const pMeta = m?.meta || {};
                  const action = String(pMeta.action || "").toLowerCase();
                  const amount = Number(pMeta.amount || 0);
                  const isAggressive =
                    action === "raise" || action === "bet" || action === "all-in";
                  const isFold = action === "fold";
                  const accent = isAggressive
                    ? "rgba(239,68,68,.85)"
                    : isFold
                      ? "rgba(148,163,184,.6)"
                      : "rgba(196,165,90,.85)";
                  const bgTint = isAggressive
                    ? "rgba(239,68,68,.06)"
                    : isFold
                      ? "rgba(148,163,184,.04)"
                      : "rgba(196,165,90,.05)";
                  const chipBg = isAggressive
                    ? "rgba(239,68,68,.18)"
                    : isFold
                      ? "rgba(148,163,184,.16)"
                      : "rgba(196,165,90,.18)";
                  const chipFg = isAggressive ? "#ef4444" : isFold ? "#94a3b8" : "#C4A55A";
                  const playerName = String(m?.user?.name || "player");
                  const verb = action.toUpperCase().replace("-", " ");
                  return (
                    <div
                      key={`poker-${m.id}-${i}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 12px",
                        margin: "4px 0",
                        fontSize: 12,
                        fontFamily: "monospace",
                        borderLeft: `2px solid ${accent}`,
                        background: bgTint,
                        borderRadius: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: "1px",
                          opacity: 0.45,
                        }}
                      >
                        POKER
                      </span>
                      <span style={{ fontWeight: 700, color: "rgba(243,244,246,.85)" }}>
                        {playerName}
                      </span>
                      <span
                        style={{
                          padding: "1px 6px",
                          borderRadius: 3,
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: "0.5px",
                          background: chipBg,
                          color: chipFg,
                        }}
                      >
                        {verb}
                      </span>
                      {amount > 0 && (
                        <span
                          style={{
                            marginLeft: "auto",
                            fontWeight: 800,
                            fontSize: 13,
                            color: chipFg,
                          }}
                        >
                          ${amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  );
                }
                if (m?.kind === "poker-winner") {
                  const wMeta = m?.meta || {};
                  const winners: any[] = Array.isArray(wMeta.winners) ? wMeta.winners : [];
                  const pot = Number(wMeta.pot || 0);
                  const reason = String(wMeta.reason || "showdown");
                  const isFold = reason === "fold";
                  const accent = "rgba(34,197,94,.9)";
                  const bgTint =
                    "linear-gradient(90deg, rgba(34,197,94,.10) 0%, rgba(196,165,90,.06) 100%)";
                  return (
                    <div
                      key={`pokerwin-${m.id}-${i}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        padding: "8px 12px",
                        margin: "6px 0",
                        fontSize: 12,
                        fontFamily: "monospace",
                        borderLeft: `3px solid ${accent}`,
                        background: bgTint,
                        borderRadius: 4,
                        boxShadow: "0 0 12px rgba(34,197,94,.15)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: "1px",
                          color: "#22c55e",
                        }}
                      >
                        ★ POT WON
                      </span>
                      {winners.map((w: any, wi: number) => (
                        <span
                          key={wi}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <span style={{ fontWeight: 800, color: "rgba(243,244,246,.95)" }}>
                            {String(w.userName || "winner")}
                          </span>
                          <span style={{ fontWeight: 800, color: "#22c55e" }}>
                            +${Number(w.amount || 0).toLocaleString()}
                          </span>
                          {w.hand && !isFold && (
                            <span
                              style={{
                                padding: "1px 6px",
                                borderRadius: 3,
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: "0.5px",
                                background: "rgba(196,165,90,.18)",
                                color: "#C4A55A",
                              }}
                            >
                              {String(w.hand)}
                            </span>
                          )}
                          {wi < winners.length - 1 && (
                            <span style={{ color: "rgba(243,244,246,.3)" }}>·</span>
                          )}
                        </span>
                      ))}
                      {isFold && (
                        <span style={{ fontSize: 10, opacity: 0.6, fontStyle: "italic" }}>
                          (others folded)
                        </span>
                      )}
                      <span
                        style={{ marginLeft: "auto", fontSize: 11, color: "rgba(243,244,246,.5)" }}
                      >
                        pot ${pot.toLocaleString()}
                      </span>
                    </div>
                  );
                }
                if (m?.kind === "trade") {
                  const tMeta = m?.meta || {};
                  const side = String(tMeta.side || "").toUpperCase();
                  const isLong = side === "BUY";
                  const traderName = String(m?.user?.name || "trader");
                  const sym = String(tMeta.symbol || "").replace(/USDT$/, "");
                  const qty = Number(tMeta.quantity || 0);
                  const px = Number(tMeta.price || 0);
                  const notional = qty * px;
                  return (
                    <div
                      key={`trade-${m.id}-${i}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 12px",
                        margin: "4px 0",
                        fontSize: 12,
                        fontFamily: "monospace",
                        borderLeft: `2px solid ${isLong ? "rgba(34,197,94,.6)" : "rgba(239,68,68,.6)"}`,
                        background: isLong ? "rgba(34,197,94,.04)" : "rgba(239,68,68,.04)",
                        borderRadius: 4,
                      }}
                    >
                      <span
                        style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", opacity: 0.4 }}
                      >
                        FAKEOUT
                      </span>
                      <span style={{ fontWeight: 700, color: "rgba(243,244,246,.85)" }}>
                        {traderName}
                      </span>
                      <span
                        style={{
                          padding: "1px 6px",
                          borderRadius: 3,
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: "0.5px",
                          background: isLong ? "rgba(34,197,94,.18)" : "rgba(239,68,68,.18)",
                          color: isLong ? "#22c55e" : "#ef4444",
                        }}
                      >
                        {isLong ? "LONG" : "SHORT"}
                      </span>
                      <span style={{ color: "rgba(243,244,246,.55)" }}>{sym}</span>
                      <span style={{ color: "rgba(243,244,246,.4)" }}>·</span>
                      <span style={{ color: "rgba(243,244,246,.6)" }}>
                        {qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </span>
                      <span style={{ color: "rgba(243,244,246,.4)" }}>@</span>
                      <span style={{ color: "rgba(243,244,246,.7)" }}>
                        $
                        {px >= 1
                          ? px.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : px.toFixed(6)}
                      </span>
                      <span
                        style={{ marginLeft: "auto", color: "rgba(243,244,246,.35)", fontSize: 11 }}
                      >
                        ${notional.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  );
                }
                if (m?.kind === "dice") {
                  const dMeta = m?.meta || {};
                  const isNat20 = !!dMeta.isNat20;
                  const isNat1 = !!dMeta.isNat1;
                  const accent = isNat20
                    ? "rgba(34,197,94,.85)"
                    : isNat1
                      ? "rgba(239,68,68,.85)"
                      : "rgba(196,165,90,.85)";
                  const bgTint = isNat20
                    ? "rgba(34,197,94,.06)"
                    : isNat1
                      ? "rgba(239,68,68,.06)"
                      : "rgba(196,165,90,.05)";
                  const chipBg = isNat20
                    ? "rgba(34,197,94,.18)"
                    : isNat1
                      ? "rgba(239,68,68,.18)"
                      : "rgba(196,165,90,.18)";
                  const chipFg = isNat20 ? "#22c55e" : isNat1 ? "#ef4444" : "#C4A55A";
                  const rollerName = String(m?.user?.name || "roller");
                  const expr = String(dMeta.expression || "");
                  const total = Number(dMeta.total || 0);
                  const rolls: number[] = Array.isArray(dMeta.rolls) ? dMeta.rolls : [];
                  const dropped: number[] = Array.isArray(dMeta.dropped) ? dMeta.dropped : [];
                  const modifier = Number(dMeta.modifier || 0);
                  const adv = !!dMeta.advantage;
                  const dis = !!dMeta.disadvantage;
                  const tag = isNat20
                    ? "NAT 20"
                    : isNat1
                      ? "NAT 1"
                      : adv
                        ? "ADV"
                        : dis
                          ? "DIS"
                          : expr.toUpperCase() || `D${dMeta.sides || ""}`;
                  return (
                    <div
                      key={`dice-${m.id}-${i}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 12px",
                        margin: "4px 0",
                        fontSize: 12,
                        fontFamily: "monospace",
                        borderLeft: `2px solid ${accent}`,
                        background: bgTint,
                        borderRadius: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: "1px",
                          opacity: 0.45,
                        }}
                      >
                        DICE TOWER
                      </span>
                      <span style={{ fontWeight: 700, color: "rgba(243,244,246,.85)" }}>
                        {rollerName}
                      </span>
                      <span
                        style={{
                          padding: "1px 6px",
                          borderRadius: 3,
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: "0.5px",
                          background: chipBg,
                          color: chipFg,
                        }}
                      >
                        {tag}
                      </span>
                      <span style={{ color: "rgba(243,244,246,.55)" }}>{expr}</span>
                      <span style={{ color: "rgba(243,244,246,.4)" }}>·</span>
                      <span style={{ color: "rgba(243,244,246,.6)" }}>
                        [{rolls.join(",")}]
                        {dropped.length > 0 && (
                          <span
                            style={{ textDecoration: "line-through", opacity: 0.4, marginLeft: 4 }}
                          >
                            {dropped.join(",")}
                          </span>
                        )}
                        {modifier !== 0 && <span> {modifier > 0 ? `+${modifier}` : modifier}</span>}
                      </span>
                      <span
                        style={{ marginLeft: "auto", fontWeight: 800, fontSize: 14, color: chipFg }}
                      >
                        {total}
                      </span>
                      {dMeta.intent === "attack" && dMeta.damageExpression && (
                        <button
                          onClick={() => rollFollowupDamage(dMeta)}
                          style={{
                            marginLeft: 8,
                            padding: "3px 8px",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                            background: "rgba(239,68,68,.18)",
                            color: "#f87171",
                            border: "1px solid rgba(239,68,68,.4)",
                            borderRadius: 3,
                            cursor: "pointer",
                          }}
                          title={`Roll ${dMeta.damageExpression}`}
                        >
                          Damage · {String(dMeta.damageExpression)}
                        </button>
                      )}
                      {dMeta.intent === "damage" && (
                        <button
                          onClick={() =>
                            setDamagePicker({
                              amount: total,
                              attackName: String(dMeta.attackName || "attack"),
                              sourceMsgId: String(m?.id || ""),
                            })
                          }
                          style={{
                            marginLeft: 8,
                            padding: "3px 8px",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                            background: "rgba(196,165,90,.18)",
                            color: "#C4A55A",
                            border: "1px solid rgba(196,165,90,.4)",
                            borderRadius: 3,
                            cursor: "pointer",
                          }}
                          title="Apply this damage to a token or combatant"
                        >
                          Apply HP →
                        </button>
                      )}
                    </div>
                  );
                }
                const uname = String(
                  m?.user?.name || m?.user?.id || m?.name || m?.username || m?.author || "?",
                );
                const mId = String(m?.id || "");
                const meId = String(ctx?.me?.id || "");
                const msgTs = Number(m?.ts || 0);
                const prevTs = i > 0 ? Number(msgs[i - 1]?.ts || 0) : 0;
                const myMsg = !!(meId && String(m?.user?.id || m?.userId || "") === meId);
                const showNewDivider =
                  !myMsg &&
                  readTsSnapshot > 0 &&
                  msgTs > readTsSnapshot &&
                  (i === 0 || prevTs <= readTsSnapshot);
                const meName = String(ctx?.me?.name || "");
                const msgUserId = String(m?.user?.id || m?.userId || "");
                const isMine = !!(meId && msgUserId === meId) || !!(meName && uname === meName);
                const ts = Number(m?.ts || 0);
                const editedAt = m?.editedAt ? Number(m.editedAt) : 0;
                const deletedAt = m?.deletedAt ? Number(m.deletedAt) : 0;
                const editable = isMine && !deletedAt && ts > 0 && Date.now() - ts < 15 * 60 * 1000;
                const deletable = isMine && !deletedAt;
                const isEditing = editingMsgId === mId && mId !== "";
                const msgAvatar = m?.user?.avatar || null;
                const isHovered = hoveredMsgId === mId;

                function commitEdit() {
                  const next = editDraft.trim();
                  if (!next || !mId) {
                    setEditingMsgId("");
                    return;
                  }
                  if (next !== String(m?.body || "")) {
                    try {
                      (ctx as any)?.sendRaw?.({
                        type: "chat:edit",
                        roomId: effectiveRoomId,
                        msgId: mId,
                        body: next,
                      });
                    } catch {}
                  }
                  setEditingMsgId("");
                  setEditDraft("");
                }

                async function handleDelete() {
                  const ok = await weeredConfirm({
                    title: "Delete this message?",
                    body: "It'll be wiped for everyone in this room.",
                    confirmLabel: "Delete",
                    destructive: true,
                  });
                  if (!ok) return;
                  try {
                    (ctx as any)?.sendRaw?.({
                      type: "chat:delete",
                      roomId: effectiveRoomId,
                      msgId: mId,
                    });
                  } catch {}
                }

                return (
                  <React.Fragment key={mId || i}>
                    {showNewDivider && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          margin: "10px 0 6px",
                          color: "#ef4444",
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: "2px",
                          textTransform: "uppercase",
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            height: 1,
                            background:
                              "linear-gradient(90deg, transparent, rgba(239,68,68,.45), rgba(239,68,68,.45))",
                          }}
                        />
                        <span
                          style={{
                            whiteSpace: "nowrap",
                            textShadow: "0 0 6px rgba(239,68,68,.35)",
                          }}
                        >
                          New
                        </span>
                        <span
                          style={{
                            flex: 1,
                            height: 1,
                            background:
                              "linear-gradient(90deg, rgba(239,68,68,.45), rgba(239,68,68,.45), transparent)",
                          }}
                        />
                      </div>
                    )}
                    <div
                      data-chat-message
                      data-msg-id={mId}
                      onMouseEnter={() => mId && setHoveredMsgId(mId)}
                      onMouseLeave={() => setHoveredMsgId((cur) => (cur === mId ? "" : cur))}
                      style={{ display: "flex", gap: 10, marginBottom: 8, position: "relative" }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          flexShrink: 0,
                          background: msgAvatar
                            ? "rgba(255,255,255,.08)"
                            : avatarBg(uname, isMine, m?.user?.avatarColor),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#fff",
                          overflow: "hidden",
                          opacity: deletedAt ? 0.4 : 1,
                        }}
                      >
                        {msgAvatar ? (
                          <img
                            src={msgAvatar}
                            alt={uname + " avatar"}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          uname.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1, opacity: deletedAt ? 0.55 : 1 }}>
                        {(() => {
                          const roomUsers: any[] = liveRoomUsers;
                          const umeta = msgUserId
                            ? roomUsers.find((u: any) => u?.id === msgUserId)
                            : undefined;
                          const uRole = umeta?.globalRole || m?.user?.globalRole;
                          const uTier = umeta?.tier || m?.user?.tier;
                          const nameStyle = nameStyleFor(uRole, uTier);
                          return (
                            <div
                              data-chat-username
                              style={{
                                fontWeight: 800,
                                fontSize: 13,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                              onMouseEnter={(e) => {
                                if (msgUserId)
                                  openHover(msgUserId, uname, e.currentTarget as HTMLElement);
                              }}
                              onMouseLeave={() => hoverClose(160)}
                            >
                              <span
                                className={
                                  (umeta as any)?.nameEffect
                                    ? "weered-name-" + (umeta as any).nameEffect
                                    : undefined
                                }
                                style={nameStyle}
                              >
                                {uname}
                              </span>
                              {uRole && String(uRole).toUpperCase() !== "USER" && (
                                <RoleIcon
                                  role={String(uRole).toUpperCase()}
                                  size={13}
                                  style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.5))" }}
                                />
                              )}
                              {msgUserId && <CrewFlair userId={msgUserId} size={13} />}
                              <span
                                className="chat-author-flair"
                                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                              >
                                {uTier && String(uTier).toUpperCase() !== "INNOCENT" && (
                                  <TierIcon
                                    tier={String(uTier).toUpperCase()}
                                    size={13}
                                    style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.5))" }}
                                  />
                                )}
                                {msgUserId && <ChatFlair userId={msgUserId} size="sm" />}
                              </span>
                              {editedAt > 0 && !deletedAt && (
                                <span
                                  title={new Date(editedAt).toLocaleString()}
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 500,
                                    color: "var(--weered-muted, rgba(148,163,184,.55))",
                                    marginLeft: 2,
                                  }}
                                >
                                  (edited)
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        {(m as any).replyTo?.id && !deletedAt && (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const el = document.querySelector(
                                  `[data-msg-id="${(m as any).replyTo.id}"]`,
                                ) as HTMLElement | null;
                                if (el) {
                                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                                  el.style.transition = "background 0.2s";
                                  const prev = el.style.background;
                                  el.style.background = "rgba(124,58,237,0.10)";
                                  setTimeout(() => {
                                    el.style.background = prev;
                                  }, 900);
                                }
                              } catch {}
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "2px 8px 2px 6px",
                              marginBottom: 3,
                              marginTop: -1,
                              fontSize: 11,
                              background: "transparent",
                              border: "none",
                              borderLeft:
                                "2px solid var(--weered-accent-ring, rgba(124,58,237,0.45))",
                              color: "var(--weered-muted, rgba(148,163,184,.75))",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              maxWidth: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span
                              style={{
                                color: "var(--weered-accent-text, rgba(196,181,253,.85))",
                                fontWeight: 700,
                              }}
                            >
                              ↩ {(m as any).replyTo.userName}
                            </span>
                            <span
                              style={{
                                opacity: 0.75,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {(m as any).replyTo.body}
                            </span>
                          </button>
                        )}
                        {deletedAt ? (
                          <div
                            style={{
                              fontSize: 12,
                              fontStyle: "italic",
                              color: "var(--weered-muted, rgba(148,163,184,.55))",
                            }}
                          >
                            [message deleted]
                          </div>
                        ) : isEditing ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              marginTop: 2,
                            }}
                          >
                            <textarea
                              autoFocus
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  commitEdit();
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  setEditingMsgId("");
                                  setEditDraft("");
                                }
                              }}
                              style={{
                                width: "100%",
                                minHeight: 60,
                                resize: "vertical",
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "1px solid var(--weered-border2, rgba(255,255,255,.18))",
                                background: "var(--weered-panel2, rgba(0,0,0,.25))",
                                color: "var(--weered-text, rgba(243,244,246,.95))",
                                fontFamily: "inherit",
                                fontSize: 13,
                                outline: "none",
                              }}
                            />
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                fontSize: 10,
                                color: "var(--weered-muted, rgba(148,163,184,.55))",
                              }}
                            >
                              <span>Enter to save</span>
                              <span>·</span>
                              <span>Esc to cancel</span>
                              <span style={{ flex: 1 }} />
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMsgId("");
                                  setEditDraft("");
                                }}
                                style={{
                                  padding: "3px 8px",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: "transparent",
                                  border: "1px solid var(--weered-border, rgba(255,255,255,.1))",
                                  borderRadius: 6,
                                  color: "var(--weered-muted, rgba(148,163,184,.75))",
                                  cursor: "pointer",
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={commitEdit}
                                style={{
                                  padding: "3px 10px",
                                  fontSize: 10,
                                  fontWeight: 800,
                                  background: "var(--weered-accent-bg, rgba(124,58,237,.18))",
                                  border:
                                    "1px solid var(--weered-accent-ring, rgba(124,58,237,.45))",
                                  borderRadius: 6,
                                  color: "var(--weered-accent-text, #c4b5fd)",
                                  cursor: "pointer",
                                }}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <ChatBody
                              text={m?.body || m?.text || ""}
                              onMentionClick={(h) => replaceTop("profile", { userId: h })}
                            />
                            {(m as any).attachment && (
                              <AttachmentBlock
                                att={(m as any).attachment as ChatAtt}
                                mine={String(m?.user?.id || "") === String(ctx?.me?.id || "")}
                                onOpen={(a) => setLightbox(a)}
                              />
                            )}
                          </>
                        )}
                        {Array.isArray((m as any).reactions) &&
                          (m as any).reactions.length > 0 &&
                          !deletedAt && (
                            <div
                              data-reaction-ui
                              style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}
                            >
                              {(m as any).reactions.map((r: any) => {
                                const mine =
                                  Array.isArray(r.users) &&
                                  String(ctx?.me?.id || "") &&
                                  r.users.includes(String(ctx?.me?.id || ""));
                                return (
                                  <button
                                    key={r.emoji}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleReaction(mId, r.emoji);
                                    }}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      padding: "2px 7px",
                                      borderRadius: 10,
                                      border: `1px solid ${mine ? "var(--weered-accent-ring, rgba(124,58,237,.55))" : "var(--weered-border, rgba(255,255,255,.1))"}`,
                                      background: mine
                                        ? "var(--weered-accent-bg, rgba(124,58,237,.18))"
                                        : "rgba(255,255,255,.04)",
                                      color: mine
                                        ? "var(--weered-accent-text, rgba(196,181,253,.95))"
                                        : "var(--weered-muted, rgba(148,163,184,.85))",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                      transition: "all .12s",
                                      lineHeight: 1.1,
                                    }}
                                  >
                                    <span style={{ fontSize: 13 }}>{r.emoji}</span>
                                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                      {r.count}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                      </div>
                      {mId && (isHovered || moreMenuMsgId === mId) && !isEditing && !deletedAt && (
                        <div
                          data-reaction-ui
                          data-more-menu
                          style={{
                            position: "absolute",
                            top: -14,
                            right: 4,
                            display: "flex",
                            gap: 1,
                            padding: 2,
                            borderRadius: 8,
                            background: "var(--weered-panel2, rgba(16,16,20,.98))",
                            border: "1px solid var(--weered-border, rgba(255,255,255,.1))",
                            boxShadow: "0 4px 14px rgba(0,0,0,.4)",
                            zIndex: 2,
                          }}
                        >
                          <button
                            type="button"
                            title="Add Reaction"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPickerMsgId((cur) => (cur === mId ? "" : mId));
                              setMoreMenuMsgId("");
                            }}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: "none",
                              background: "transparent",
                              color: "var(--weered-muted, rgba(148,163,184,.8))",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "background .1s, color .1s",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background =
                                "rgba(255,255,255,.08)";
                              (e.currentTarget as HTMLElement).style.color =
                                "var(--weered-text, rgba(243,244,246,.95))";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color =
                                "var(--weered-muted, rgba(148,163,184,.8))";
                            }}
                          >
                            <Icons.Smile />
                          </button>
                          <button
                            type="button"
                            title="Reply"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplyingTo({
                                id: mId,
                                userName: uname || "user",
                                body: String(m?.body || ""),
                              });
                              try {
                                inputRef.current?.focus();
                              } catch {}
                            }}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: "none",
                              background: "transparent",
                              color: "var(--weered-muted, rgba(148,163,184,.8))",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "background .1s, color .1s",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background =
                                "rgba(255,255,255,.08)";
                              (e.currentTarget as HTMLElement).style.color =
                                "var(--weered-text, rgba(243,244,246,.95))";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color =
                                "var(--weered-muted, rgba(148,163,184,.8))";
                            }}
                          >
                            <Icons.Reply />
                          </button>
                          <button
                            type="button"
                            title="More"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMoreMenuMsgId((cur) => (cur === mId ? "" : mId));
                              setPickerMsgId("");
                            }}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: "none",
                              background:
                                moreMenuMsgId === mId ? "rgba(255,255,255,.08)" : "transparent",
                              color:
                                moreMenuMsgId === mId
                                  ? "var(--weered-text, rgba(243,244,246,.95))"
                                  : "var(--weered-muted, rgba(148,163,184,.8))",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "background .1s, color .1s",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background =
                                "rgba(255,255,255,.08)";
                              (e.currentTarget as HTMLElement).style.color =
                                "var(--weered-text, rgba(243,244,246,.95))";
                            }}
                            onMouseLeave={(e) => {
                              if (moreMenuMsgId !== mId) {
                                (e.currentTarget as HTMLElement).style.background = "transparent";
                                (e.currentTarget as HTMLElement).style.color =
                                  "var(--weered-muted, rgba(148,163,184,.8))";
                              }
                            }}
                          >
                            <Icons.More />
                          </button>
                        </div>
                      )}
                      {moreMenuMsgId === mId &&
                        !deletedAt &&
                        !isEditing &&
                        (() => {
                          const meId = String(ctx?.me?.id || "");
                          const meRole = String(ctx?.me?.globalRole || "").toUpperCase();
                          const meIsElevated = ["GOD", "STAFF", "SUPPORT", "ADMIN"].includes(
                            meRole,
                          );
                          const ownerId = String(meta?.ownerId || "");
                          const mods = Array.isArray(meta?.mods) ? meta.mods.map(String) : [];
                          const canPin =
                            meIsElevated || (!!meId && (meId === ownerId || mods.includes(meId)));
                          const pinnedSet: string[] = Array.isArray(
                            ctx?.pinnedByRoom?.[effectiveRoomId],
                          )
                            ? ctx.pinnedByRoom[effectiveRoomId]
                            : [];
                          const isPinned = pinnedSet.includes(mId);
                          const targetRole = String(m?.user?.globalRole || "USER").toUpperCase();
                          const canKick =
                            meIsElevated && !isMine && !!msgUserId && targetRole !== "GOD";
                          return (
                            <MoreMenu
                              msgId={mId}
                              body={String(m?.body || "")}
                              userName={uname}
                              isMine={isMine}
                              editable={editable}
                              deletable={deletable}
                              roomId={effectiveRoomId}
                              isPinned={isPinned}
                              canPin={canPin}
                              canKick={canKick}
                              onClose={() => setMoreMenuMsgId("")}
                              onAddReaction={() => {
                                setPickerMsgId(mId);
                                setMoreMenuMsgId("");
                              }}
                              onReply={() => {
                                setReplyingTo({
                                  id: mId,
                                  userName: uname || "user",
                                  body: String(m?.body || ""),
                                });
                                try {
                                  inputRef.current?.focus();
                                } catch {}
                                setMoreMenuMsgId("");
                              }}
                              onEdit={() => {
                                setEditingMsgId(mId);
                                setEditDraft(String(m?.body || ""));
                                setMoreMenuMsgId("");
                              }}
                              onDelete={() => {
                                handleDelete();
                                setMoreMenuMsgId("");
                              }}
                              onTogglePin={() => {
                                try {
                                  (ctx as any)?.sendRaw?.({
                                    type: isPinned ? "chat:unpin" : "chat:pin",
                                    msgId: mId,
                                  });
                                } catch {}
                              }}
                              onKick={async () => {
                                const ok = await weeredConfirm({
                                  title: `Kick ${uname} from chat?`,
                                  body: `They'll be disconnected from every room they're in. Their socket will close. They can rejoin manually unless you also ban.`,
                                  confirmLabel: "Kick",
                                  destructive: true,
                                });
                                if (!ok) return;
                                try {
                                  const token =
                                    (typeof window !== "undefined"
                                      ? localStorage.getItem("weered_token")
                                      : "") || "";
                                  const r = await fetch(
                                    `${API}/staff/users/${encodeURIComponent(msgUserId)}/kick`,
                                    {
                                      method: "POST",
                                      headers: token
                                        ? {
                                            Authorization: `Bearer ${token}`,
                                            "Content-Type": "application/json",
                                          }
                                        : { "Content-Type": "application/json" },
                                    },
                                  );
                                  const j = await r.json().catch(() => ({}));
                                  if (j?.ok) weeredToast.success(`Kicked ${uname}.`);
                                  else
                                    weeredToast.error(
                                      j?.error === "forbidden"
                                        ? "Not authorized."
                                        : j?.error === "cannot_kick_god"
                                          ? "Cannot kick GOD."
                                          : "Kick failed.",
                                    );
                                } catch {
                                  weeredToast.error("Kick failed.");
                                }
                              }}
                            />
                          );
                        })()}
                      {pickerMsgId === mId && (
                        <div
                          data-reaction-ui
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute",
                            top: 18,
                            right: 4,
                            display: "flex",
                            gap: 2,
                            padding: 5,
                            borderRadius: 8,
                            background: "var(--weered-panel2, rgba(16,16,20,.98))",
                            border: "1px solid var(--weered-border, rgba(255,255,255,.1))",
                            boxShadow: "0 6px 20px rgba(0,0,0,.5)",
                            zIndex: 3,
                          }}
                        >
                          {QUICK_REACTIONS.map((e) => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => toggleReaction(mId, e)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 5,
                                border: "none",
                                background: "transparent",
                                cursor: "pointer",
                                fontSize: 16,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "background .1s, transform .1s",
                              }}
                              onMouseEnter={(ev) => {
                                (ev.currentTarget as HTMLElement).style.background =
                                  "rgba(255,255,255,.08)";
                                (ev.currentTarget as HTMLElement).style.transform = "scale(1.15)";
                              }}
                              onMouseLeave={(ev) => {
                                (ev.currentTarget as HTMLElement).style.background = "transparent";
                                (ev.currentTarget as HTMLElement).style.transform = "none";
                              }}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>

          {lightbox && (
            <div
              onClick={() => setLightbox(null)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 100000,
                background: "rgba(0,0,0,.82)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "zoom-out",
                padding: 24,
              }}
            >
              <img
                src={`${API}${lightbox.url}`}
                alt="attachment"
                style={{
                  maxWidth: "92vw",
                  maxHeight: "86vh",
                  borderRadius: 12,
                  boxShadow: "0 24px 80px rgba(0,0,0,.6)",
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <div
                style={{ position: "absolute", bottom: 18, display: "flex", gap: 14, fontSize: 12 }}
              >
                <a
                  href={`${API}${lightbox.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: "rgba(216,180,254,.9)", textDecoration: "none" }}
                >
                  Open original
                </a>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    fetch(`${API}/chat/attachments/${lightbox.id}/report`, {
                      method: "POST",
                      headers: { ...authHeadersChat() },
                    })
                      .then(() => weeredToast.success("Reported."))
                      .catch(() => {});
                    setLightbox(null);
                  }}
                  style={{ color: "rgba(252,165,165,.8)", cursor: "pointer" }}
                >
                  Report
                </span>
              </div>
            </div>
          )}
          <TypingIndicator roomId={effectiveRoomId} meId={ctx?.me?.id} />

          {!props.hideInput && (
            <div style={{ position: "relative", padding: "8px 10px 12px", flexShrink: 0 }}>
              {pendingAtt && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    padding: 6,
                    borderRadius: 10,
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid rgba(124,58,237,.25)",
                    width: "fit-content",
                  }}
                >
                  <img
                    src={`${API}${pendingAtt.thumbUrl}`}
                    alt="pending attachment"
                    style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 7 }}
                  />
                  <span style={{ fontSize: 11, color: "rgba(200,205,215,.75)" }}>Image ready</span>
                  <button
                    onClick={() => setPendingAtt(null)}
                    title="Remove"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "rgba(148,163,184,.7)",
                      cursor: "pointer",
                      fontSize: 13,
                      padding: "2px 6px",
                    }}
                  >
                    {"\u2715"}
                  </button>
                </div>
              )}
              {lockOpen && (
                <div
                  onClick={() => setLockOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "rgba(124,58,237,.08)",
                    border: "1px solid rgba(124,58,237,.3)",
                    cursor: "pointer",
                    width: "fit-content",
                  }}
                >
                  <span style={{ fontSize: 13 }}>{"\uD83D\uDD12"}</span>
                  <span style={{ fontSize: 11.5, color: "rgba(216,180,254,.9)" }}>
                    {mediaElig?.banned
                      ? "Media privileges are suspended."
                      : `Media privileges unlock at ${Number(mediaElig?.required ?? 100).toLocaleString()} rep. You\u2019re ${Math.max(0, Number(mediaElig?.required ?? 100) - Number(mediaElig?.notoriety ?? 0)).toLocaleString()} away.`}
                  </span>
                </div>
              )}
              {mentionState && mentionCandidates.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: 10,
                    right: 10,
                    bottom: "calc(100% - 4px)",
                    background: "var(--weered-panel2, rgba(18,18,26,.98))",
                    border: "1px solid var(--weered-border, rgba(124,58,237,.35))",
                    borderRadius: 10,
                    boxShadow: "0 10px 32px rgba(0,0,0,.55)",
                    padding: 4,
                    maxHeight: 240,
                    overflowY: "auto",
                    zIndex: 40,
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      color: "var(--weered-muted, rgba(148,163,184,.65))",
                      padding: "4px 8px 6px",
                    }}
                  >
                    Mention ·{" "}
                    {mentionCandidates.length === 1
                      ? "1 match"
                      : `${mentionCandidates.length} matches`}
                  </div>
                  {mentionCandidates.map((u: any, i: number) => {
                    const role = u?.globalRole;
                    const tier = u?.tier;
                    const nstyle = nameStyleFor(role, tier);
                    const active = i === mentionState.index;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          acceptMention(u.usernameKey || u.name);
                        }}
                        onMouseEnter={() => setMentionState((s) => (s ? { ...s, index: i } : null))}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: 6,
                          border: "none",
                          background: active ? "rgba(124,58,237,.18)" : "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                        }}
                      >
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: u.avatar
                              ? "rgba(255,255,255,.08)"
                              : avatarBg(u.name, false, u.avatarColor),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#fff",
                            overflow: "hidden",
                          }}
                        >
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt=""
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            String(u.name || "?")
                              .slice(0, 1)
                              .toUpperCase()
                          )}
                        </div>
                        <span
                          style={{
                            ...nstyle,
                            fontSize: 13,
                            fontWeight: 700,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {u.name}
                        </span>
                        {role && String(role).toUpperCase() !== "USER" && (
                          <RoleIcon
                            role={String(role).toUpperCase()}
                            size={12}
                            style={{ flexShrink: 0 }}
                          />
                        )}
                        {tier && String(tier).toUpperCase() !== "INNOCENT" && (
                          <TierIcon
                            tier={String(tier).toUpperCase()}
                            size={12}
                            style={{ flexShrink: 0 }}
                          />
                        )}
                      </button>
                    );
                  })}
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--weered-muted, rgba(148,163,184,.45))",
                      padding: "6px 10px 2px",
                      fontStyle: "italic",
                    }}
                  >
                    ↑↓ to browse · Tab / Enter to select · Esc to close
                  </div>
                </div>
              )}
              {replyingTo && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    marginBottom: 6,
                    borderRadius: 8,
                    borderLeft: "2px solid var(--weered-accent-ring, rgba(124,58,237,0.55))",
                    background: "var(--weered-accent-bg, rgba(124,58,237,0.08))",
                    fontSize: 11,
                  }}
                >
                  <span
                    style={{
                      color: "var(--weered-accent-text, rgba(196,181,253,0.9))",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ↩ Replying to <strong>{replyingTo.userName}</strong>
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--weered-muted, rgba(148,163,184,.75))",
                    }}
                  >
                    {replyingTo.body}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    title="Cancel reply"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: "none",
                      background: "transparent",
                      color: "var(--weered-muted, rgba(148,163,184,.75))",
                      cursor: "pointer",
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => {
                    const v = e.target.value;
                    setText(v);
                    if (v.length > 0) broadcastTyping();
                    const caret = e.target.selectionStart ?? v.length;
                    const m = detectMentionAtCaret(v, caret);
                    setMentionState(m ? { ...m, index: 0 } : null);
                  }}
                  onSelect={(e) => {
                    const el = e.currentTarget;
                    const m = detectMentionAtCaret(el.value, el.selectionStart ?? el.value.length);
                    setMentionState((prev) => {
                      if (!m) return null;
                      if (prev && prev.query === m.query && prev.start === m.start) return prev;
                      return { ...m, index: 0 };
                    });
                  }}
                  placeholder={
                    canType
                      ? "Message... (/ for commands · @ to mention)"
                      : chatBlocked
                        ? "Chat is locked."
                        : "Join/admit required..."
                  }
                  onPaste={(e) => {
                    const item = Array.from(e.clipboardData?.items || []).find((i) =>
                      i.type.startsWith("image/"),
                    );
                    const f = item?.getAsFile?.();
                    if (f) {
                      e.preventDefault();
                      void handleFile(f);
                    }
                  }}
                  onDrop={(e) => {
                    const f = e.dataTransfer?.files?.[0];
                    if (f && f.type.startsWith("image/")) {
                      e.preventDefault();
                      void handleFile(f);
                    }
                  }}
                  onDragOver={(e) => {
                    if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
                  }}
                  disabled={!canType}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,.10)",
                    background: "rgba(0,0,0,.15)",
                    color: canType ? "rgba(243,244,246,.9)" : "rgba(255,255,255,.5)",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "inherit",
                    cursor: canType ? "text" : "not-allowed",
                    boxSizing: "border-box" as any,
                  }}
                  onKeyDown={(e) => {
                    if (mentionState && mentionCandidates.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setMentionState((s) =>
                          s
                            ? { ...s, index: Math.min(mentionCandidates.length - 1, s.index + 1) }
                            : null,
                        );
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setMentionState((s) =>
                          s ? { ...s, index: Math.max(0, s.index - 1) } : null,
                        );
                        return;
                      }
                      if (e.key === "Tab" || e.key === "Enter") {
                        e.preventDefault();
                        const sel = mentionCandidates[mentionState.index];
                        if (sel?.name) acceptMention(sel.usernameKey || sel.name);
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setMentionState(null);
                        return;
                      }
                    }
                    if (e.key === "Enter" && canSendNow) onSend();
                  }}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.currentTarget.value = "";
                  }}
                />
                <button
                  onClick={() => {
                    void onAttachClick();
                  }}
                  disabled={!canType || attBusy}
                  title="Attach image"
                  style={{
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,.1)",
                    background: attBusy ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)",
                    width: 34,
                    height: 34,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: canType && !attBusy ? "pointer" : "not-allowed",
                    color: canType ? "rgba(200,205,215,.75)" : "rgba(255,255,255,.3)",
                    transition: "background .15s, color .15s",
                    flexShrink: 0,
                    fontSize: 15,
                  }}
                  aria-label="Attach image"
                >
                  {attBusy ? "\u23F3" : "\uD83D\uDCCE"}
                </button>
                <button
                  onClick={() => {
                    setGifOpen((v) => !v);
                    setEmojiOpen(false);
                  }}
                  disabled={!canType}
                  title="GIF"
                  style={{
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,.1)",
                    background: gifOpen ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)",
                    width: 34,
                    height: 34,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: canType ? "pointer" : "not-allowed",
                    color: canType
                      ? gifOpen
                        ? "rgba(216,180,254,.95)"
                        : "rgba(200,205,215,.75)"
                      : "rgba(255,255,255,.3)",
                    transition: "background .15s, color .15s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (canType && !gifOpen)
                      (e.currentTarget as HTMLElement).style.color = "rgba(243,244,246,.95)";
                  }}
                  onMouseLeave={(e) => {
                    if (canType && !gifOpen)
                      (e.currentTarget as HTMLElement).style.color = "rgba(200,205,215,.75)";
                  }}
                  aria-label="GIF"
                >
                  <Icons.Gif />
                </button>
                <button
                  onClick={() => {
                    setEmojiOpen((v) => !v);
                    setGifOpen(false);
                  }}
                  disabled={!canType}
                  title="Emoji"
                  style={{
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,.1)",
                    background: emojiOpen ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)",
                    width: 34,
                    height: 34,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: canType ? "pointer" : "not-allowed",
                    color: canType
                      ? emojiOpen
                        ? "rgba(216,180,254,.95)"
                        : "rgba(200,205,215,.75)"
                      : "rgba(255,255,255,.3)",
                    transition: "background .15s, color .15s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (canType && !emojiOpen)
                      (e.currentTarget as HTMLElement).style.color = "rgba(243,244,246,.95)";
                  }}
                  onMouseLeave={(e) => {
                    if (canType && !emojiOpen)
                      (e.currentTarget as HTMLElement).style.color = "rgba(200,205,215,.75)";
                  }}
                  aria-label="Emoji"
                >
                  <Icons.Emoji />
                </button>
                <button
                  onClick={onSend}
                  disabled={!canSendNow}
                  title="Send"
                  aria-label="Send"
                  style={{
                    borderRadius: 10,
                    border: canSendNow
                      ? "1px solid rgba(124,58,237,.35)"
                      : "1px solid rgba(255,255,255,.10)",
                    background: canSendNow ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)",
                    color: canSendNow ? "rgba(216,180,254,.95)" : "rgba(255,255,255,.4)",
                    width: 40,
                    height: 34,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: canSend ? "pointer" : "not-allowed",
                    transition: "all .15s",
                    flexShrink: 0,
                  }}
                >
                  <Icons.Send />
                </button>
              </div>

              {emojiOpen && (
                <div
                  ref={emojiRef}
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 6px)",
                    right: 0,
                    width: 280,
                    background: "#1a1a2e",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 12,
                    padding: 8,
                    zIndex: 50,
                    boxShadow: "0 8px 32px rgba(0,0,0,.5)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 2,
                      marginBottom: 6,
                      borderBottom: "1px solid rgba(255,255,255,.08)",
                      paddingBottom: 6,
                    }}
                  >
                    {EMOJI_CATEGORIES.map((cat, ci) => (
                      <button
                        key={ci}
                        onClick={() => setEmojiCat(ci)}
                        style={{
                          flex: 1,
                          background: ci === emojiCat ? "rgba(124,58,237,.2)" : "transparent",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 0",
                          fontSize: 14,
                          cursor: "pointer",
                        }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(8, 1fr)",
                      gap: 2,
                      maxHeight: 160,
                      overflow: "auto",
                    }}
                  >
                    {EMOJI_CATEGORIES[emojiCat].emojis.map((em, ei) => (
                      <button
                        key={ei}
                        onClick={() => insertEmoji(em)}
                        style={{
                          background: "transparent",
                          border: "none",
                          fontSize: 18,
                          padding: 4,
                          borderRadius: 6,
                          cursor: "pointer",
                          lineHeight: 1,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "rgba(255,255,255,.1)")
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {gifOpen && (
                <GifPicker
                  onSelect={(url) => {
                    ctx?.sendChat?.(effectiveRoomId, url);
                  }}
                  onClose={() => setGifOpen(false)}
                />
              )}
            </div>
          )}

          {!props.embedded && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => replaceTop("dock")}
                style={{
                  borderRadius: 12,
                  border: "1px solid var(--weered-border)",
                  background: "rgba(255,255,255,.04)",
                  color: "inherit",
                  fontWeight: 800,
                  padding: "8px 10px",
                }}
              >
                Open Dock
              </button>
            </div>
          )}
        </div>
        <aside className="weered-chat-members" aria-label="Room members">
          {(() => {
            const roomUsers: any[] = liveRoomUsers;
            if (roomUsers.length === 0) {
              return (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--weered-muted, rgba(148,163,184,.55))",
                    fontStyle: "italic",
                    padding: "8px 0",
                  }}
                >
                  No one's in here yet.
                </div>
              );
            }
            const rankOf = (u: any) => {
              const r = String(u?.globalRole || "").toUpperCase();
              const t = String(u?.tier || "").toUpperCase();
              if (r === "GOD") return 0;
              if (r === "STAFF" || r === "ADMIN") return 1;
              if (r === "SUPPORT") return 2;
              if (r === "MOD") return 3;
              if (t === "KINGPIN") return 4;
              if (t === "FELON") return 5;
              if (t === "INDICTED") return 6;
              return 7;
            };
            const sorted = [...roomUsers].sort((a, b) => {
              const d = rankOf(a) - rankOf(b);
              if (d !== 0) return d;
              return String(a?.name || "").localeCompare(String(b?.name || ""));
            });
            const myId = String(ctx?.me?.id || "");
            return (
              <>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: "var(--weered-muted, rgba(148,163,184,.7))",
                    marginBottom: 10,
                  }}
                >
                  In the room · {sorted.length}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {sorted.map((u: any) => {
                    const role = String(u?.globalRole || "").toUpperCase();
                    const tier = String(u?.tier || "").toUpperCase();
                    const ns = nameStyleFor(role, tier);
                    const isMe = myId && u.id === myId;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          if (!u.id || u.id === myId) return;
                          try {
                            window.dispatchEvent(
                              new CustomEvent("weered:dock:open", {
                                detail: { mode: "dm", peer: { id: u.id, name: u.name } },
                              }),
                            );
                          } catch {}
                        }}
                        onMouseEnter={(e) => {
                          if (u.id) openHover(u.id, u.name, e.currentTarget as HTMLElement);
                        }}
                        onMouseLeave={() => hoverClose(160)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          padding: "6px 8px",
                          border: "1px solid transparent",
                          borderRadius: 6,
                          background: "transparent",
                          cursor: isMe ? "default" : "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                          transition: "background .12s, border-color .12s",
                        }}
                        onMouseOver={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            "rgba(255,255,255,.04)";
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "rgba(255,255,255,.08)";
                        }}
                        onMouseOut={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                        }}
                      >
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: u?.avatar
                              ? "rgba(255,255,255,.08)"
                              : avatarBg(String(u?.name || "?"), false, u?.avatarColor),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#fff",
                            overflow: "hidden",
                          }}
                        >
                          {u?.avatar ? (
                            <img
                              src={u.avatar}
                              alt=""
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            String(u?.name || "?")
                              .slice(0, 1)
                              .toUpperCase()
                          )}
                        </div>
                        <span
                          style={{
                            ...ns,
                            fontSize: 12,
                            fontWeight: 700,
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {u?.name}
                          {isMe && (
                            <span
                              style={{
                                color: "var(--weered-muted, rgba(148,163,184,.55))",
                                fontWeight: 500,
                                marginLeft: 4,
                                fontStyle: "italic",
                              }}
                            >
                              (you)
                            </span>
                          )}
                        </span>
                        {role && role !== "USER" && <RoleIcon role={role} size={11} />}
                        {u.id && <CrewFlair userId={u.id} size={11} />}
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </aside>
        {damagePicker && (
          <div
            onClick={() => setDamagePicker(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#1a1410",
                color: "#f3f4f6",
                border: "1px solid rgba(196,165,90,.4)",
                borderRadius: 8,
                padding: 18,
                minWidth: 360,
                maxWidth: 520,
                maxHeight: "80vh",
                overflow: "auto",
                fontFamily: "var(--font-cormorant), serif",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-pirata), serif",
                    fontSize: 18,
                    color: "#F5D58A",
                  }}
                >
                  Apply {damagePicker.amount} damage
                </div>
                <button
                  onClick={() => setDamagePicker(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#888",
                    cursor: "pointer",
                    fontSize: 18,
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
                from {damagePicker.attackName}
              </div>

              {pickerTokens.length === 0 && pickerCombatants.length === 0 && (
                <div style={{ padding: "16px 0", textAlign: "center", opacity: 0.5 }}>
                  No targets — open the Battle Map or Initiative tab in the D&D module.
                </div>
              )}

              {pickerTokens.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "1px",
                      opacity: 0.55,
                      marginBottom: 6,
                    }}
                  >
                    MAP TOKENS
                  </div>
                  {pickerTokens.map((t) => (
                    <button
                      key={`tok-${t.id}`}
                      onClick={() => applyDamageToToken(t.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "8px 10px",
                        marginBottom: 4,
                        background: "rgba(255,255,255,.04)",
                        border: "1px solid rgba(255,255,255,.08)",
                        borderRadius: 4,
                        color: "#f3f4f6",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: t.color || "#C4A55A",
                        }}
                      />
                      <span style={{ flex: 1 }}>{t.name}</span>
                      <span style={{ fontSize: 11, opacity: 0.6 }}>
                        {t.hp}/{t.hpMax} HP
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {pickerCombatants.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "1px",
                      opacity: 0.55,
                      marginBottom: 6,
                    }}
                  >
                    INITIATIVE
                  </div>
                  {pickerCombatants.map((c) => (
                    <button
                      key={`cmb-${c.id}`}
                      onClick={() => applyDamageToCombatant(c.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "8px 10px",
                        marginBottom: 4,
                        background: "rgba(255,255,255,.04)",
                        border: "1px solid rgba(255,255,255,.08)",
                        borderRadius: 4,
                        color: "#f3f4f6",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ flex: 1 }}>{c.name}</span>
                      <span style={{ fontSize: 11, opacity: 0.6 }}>
                        {c.hpCurrent}/{c.hpMax} HP
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {hoverCard}
    </>
  );
}
