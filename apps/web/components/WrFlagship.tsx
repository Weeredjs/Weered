"use client";
import { useState, useEffect, useCallback } from "react";
import { BrassDivider, PAL, Rivet, S, WR_FONT_DISPLAY, WR_FONT_MONO, apiFetch } from "./WrShared";
import { timeAgo } from "./WrBounties";

export function LivePlayers() {
  const [count, setCount] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await apiFetch("/windrose/live-players");
      if (j?.ok && typeof j.players === "number") {
        setCount(j.players);
        setErr(null);
        setPulse(true);
        setTimeout(() => setPulse(false), 1400);
      } else {
        setErr("Steam unreachable");
      }
    } catch {
      setErr("Steam unreachable");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const display = count === null ? "—" : count.toLocaleString();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "22px 24px",
        minWidth: 260,
        background: `linear-gradient(180deg, ${PAL.stormDeep}ff 0%, ${PAL.abyss}ff 100%)`,
        border: `2px solid ${PAL.brass}`,
        position: "relative",
        boxShadow: `inset 0 0 40px ${PAL.ink}80, 0 0 0 1px ${PAL.brassLow}, 0 12px 40px ${PAL.ink}`,
      }}
    >
      <span style={{ position: "absolute", top: 6, left: 6 }}>
        <Rivet />
      </span>
      <span style={{ position: "absolute", top: 6, right: 6 }}>
        <Rivet />
      </span>
      <span style={{ position: "absolute", bottom: 6, left: 6 }}>
        <Rivet />
      </span>
      <span style={{ position: "absolute", bottom: 6, right: 6 }}>
        <Rivet />
      </span>

      <div style={{ ...S.label, marginBottom: 4 }}>Pirates at Sea · Live</div>
      <div
        style={{
          fontFamily: WR_FONT_DISPLAY,
          fontSize: 64,
          lineHeight: 1,
          color: pulse ? PAL.brassHi : PAL.brass,
          textShadow: pulse ? `0 0 24px ${PAL.brassHi}88` : `0 0 12px ${PAL.brass}40`,
          transition: "all .4s",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-1px",
        }}
      >
        {display}
      </div>
      <div
        style={{
          fontSize: 11,
          color: PAL.parchDim,
          marginTop: 6,
          fontFamily: WR_FONT_MONO,
          letterSpacing: "0.5px",
        }}
      >
        {err ? err : "Steam · refreshes every 60s"}
      </div>
    </div>
  );
}

export function LaunchStats() {
  const [data, setData] = useState<any | null>(null);
  useEffect(() => {
    apiFetch("/windrose/launch").then((j) => {
      if (j?.ok) setData(j);
    });
  }, []);

  const milestones = data?.milestones || [
    { label: "Units sold (48h)", value: "500,000", sub: "Early Access" },
    { label: "Peak CCU", value: "~100,000", sub: "Launch week" },
    { label: "Review score", value: "89%", sub: "Positive" },
  ];

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: `repeat(${milestones.length}, 1fr)`, gap: 12 }}
    >
      {milestones.map((m: any, i: number) => (
        <div
          key={i}
          style={{
            ...S.card,
            padding: "14px 16px",
            textAlign: "center",
            background: `linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`,
          }}
        >
          <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>{m.label}</div>
          <div
            style={{
              fontFamily: WR_FONT_DISPLAY,
              fontSize: 26,
              color: PAL.brassHi,
              lineHeight: 1,
              marginTop: 4,
            }}
          >
            {m.value}
          </div>
          <div style={{ fontSize: 10, color: PAL.parchDim, marginTop: 5, fontStyle: "italic" }}>
            {m.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FlagshipTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
        <LivePlayers />
        <div
          style={{
            ...S.card,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "22px 24px",
          }}
        >
          <div style={{ ...S.label, marginBottom: 8 }}>Kraken Express · Age of Piracy</div>
          <div
            style={{
              fontFamily: WR_FONT_DISPLAY,
              fontSize: 36,
              color: PAL.parchment,
              lineHeight: 1.1,
              letterSpacing: "0.5px",
            }}
          >
            Build. Sail. Survive the storm.
          </div>
          <div
            style={{
              fontSize: 14,
              color: PAL.parchDim,
              marginTop: 10,
              lineHeight: 1.55,
              fontStyle: "italic",
              maxWidth: 520,
            }}
          >
            Solo or eight-deep with the crew. Procedural isles, soulslite combat, naval warfare, and
            boss fights that bite back. Published by Pocketpair.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <a
              href="https://store.steampowered.com/app/3041230/Windrose/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...S.btnPrimary, textDecoration: "none", display: "inline-block" }}
            >
              Open on Steam
            </a>
            <a
              href="https://playwindrose.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...S.btn, textDecoration: "none", display: "inline-block" }}
            >
              playwindrose.com
            </a>
          </div>
        </div>
      </div>

      <BrassDivider />

      <div>
        <div style={{ ...S.label, marginBottom: 10, textAlign: "center" }}>
          Launch Week · 2026-04-14
        </div>
        <LaunchStats />
      </div>

      <BrassDivider />

      <ActivityTicker />

      <BrassDivider />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <FeatureBlock
          icon="⚓"
          title="Soulslite Combat"
          body="Challenging bosses. Weighty swings. Parries that matter. Not a Souls clone — a Souls-lite. Takes inspiration from Black Flag."
        />
        <FeatureBlock
          icon="🌊"
          title="Naval & Exploration"
          body="Procedural open world. Build a galleon, captain a crew of eight, discover isles, and weather real-time storms."
        />
        <FeatureBlock
          icon="🏴‍☠️"
          title="PvE, Solo or Co-op"
          body="Fully playable offline. Self-hosted or dedicated servers. 8-player co-op. No forced PvP."
        />
      </div>
    </div>
  );
}

export type ActivityEvent = {
  id: string;
  kind:
    | "bounty_post"
    | "bounty_settle"
    | "bounty_cancel"
    | "crew_publish"
    | "server_list"
    | "lfg_raise";
  ts: string;
  actor?: string | null;
  subject?: string | null;
  amount?: number | null;
  meta?: Record<string, any>;
};

export function ActivityTicker() {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await apiFetch("/windrose/activity");
      if (j?.ok && Array.isArray(j.events)) setEvents(j.events);
      else setEvents([]);
    } catch {
      setEvents([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const shown = expanded ? events || [] : (events || []).slice(0, 8);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#5db765",
            boxShadow: "0 0 8px #5db765",
            animation: "windrose-wave 1.2s ease-in-out infinite",
          }}
        />
        <span style={{ ...S.label, fontSize: 10 }}>On the Wire</span>
        <span
          style={{
            flex: 1,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${PAL.brass}40, transparent)`,
          }}
        />
        <span
          style={{
            fontFamily: WR_FONT_MONO,
            fontSize: 10,
            color: PAL.parchDim,
            letterSpacing: "0.5px",
          }}
        >
          last 14 days
        </span>
      </div>

      {loading ? (
        <div
          style={{
            ...S.card,
            padding: "14px 18px",
            textAlign: "center",
            fontSize: 12,
            color: PAL.parchDim,
            fontStyle: "italic",
          }}
        >
          Listening to the docks…
        </div>
      ) : !events || events.length === 0 ? (
        <div
          style={{
            ...S.card,
            padding: "14px 18px",
            textAlign: "center",
            fontSize: 12,
            color: PAL.parchDim,
            fontStyle: "italic",
          }}
        >
          Quiet harbour. Post a bounty or raise a flag to kick it off.
        </div>
      ) : (
        <>
          <div style={{ ...S.card, padding: "4px 0", display: "flex", flexDirection: "column" }}>
            {shown.map((e, i) => (
              <ActivityRow key={e.id} event={e} alt={i % 2 === 1} />
            ))}
          </div>
          {events.length > 8 && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button
                type="button"
                style={{ ...S.btn, fontSize: 10, padding: "5px 14px" }}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Show less" : `Show all ${events.length}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ActivityRow({ event, alt }: { event: ActivityEvent; alt: boolean }) {
  const { glyph, color } = (() => {
    switch (event.kind) {
      case "bounty_post":
        return { glyph: "☠", color: PAL.blood };
      case "bounty_settle":
        return { glyph: "⚔", color: "#5db765" };
      case "bounty_cancel":
        return { glyph: "✕", color: PAL.parchDim };
      case "crew_publish":
        return { glyph: "⚑", color: PAL.brassHi };
      case "server_list":
        return { glyph: "⚓", color: PAL.verdigris };
      case "lfg_raise":
        return { glyph: "🏴", color: PAL.brass };
      default:
        return { glyph: "·", color: PAL.parchDim };
    }
  })();

  const line = (() => {
    const amt = (event.amount || 0).toLocaleString();
    const actor = event.actor || "someone";
    const subject = event.subject || "…";
    switch (event.kind) {
      case "bounty_post":
        return (
          <>
            <strong style={{ color: PAL.parchment, fontStyle: "normal" }}>{actor}</strong> put{" "}
            <span
              style={{ color: PAL.brassHi, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
            >
              {amt} Paper
            </span>{" "}
            on <strong style={{ color: PAL.blood, fontStyle: "normal" }}>{subject}</strong>
          </>
        );
      case "bounty_settle":
        return (
          <>
            <strong style={{ color: PAL.parchment, fontStyle: "normal" }}>{actor}</strong> delivered
            on <strong style={{ color: PAL.blood, fontStyle: "normal" }}>{subject}</strong> ·{" "}
            <span style={{ color: "#5db765", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
              {amt} Paper
            </span>
          </>
        );
      case "bounty_cancel":
        return (
          <>
            <strong style={{ color: PAL.parchment, fontStyle: "normal" }}>{actor}</strong> pulled
            their bounty on{" "}
            <strong style={{ color: PAL.parchDim, fontStyle: "normal" }}>{subject}</strong>
          </>
        );
      case "crew_publish":
        return (
          <>
            <strong style={{ color: PAL.brassHi, fontStyle: "normal" }}>{subject}</strong>
            {event.meta?.tag ? (
              <span style={{ color: PAL.brass, fontFamily: WR_FONT_MONO, fontSize: 11 }}>
                {" "}
                [{event.meta.tag}]
              </span>
            ) : null}{" "}
            hoisted their colors
            {event.meta?.recruiting ? (
              <span style={{ color: "#5db765" }}> · recruiting</span>
            ) : null}
          </>
        );
      case "server_list":
        return (
          <>
            <strong style={{ color: PAL.parchment, fontStyle: "normal" }}>{subject}</strong> dropped
            anchor on the list
            {event.meta?.region ? (
              <span style={{ color: PAL.parchDim }}> · {event.meta.region}</span>
            ) : null}
            {event.meta?.framework ? (
              <span style={{ color: PAL.brass, fontSize: 11 }}> · {event.meta.framework}</span>
            ) : null}
          </>
        );
      case "lfg_raise":
        return (
          <>
            <strong style={{ color: PAL.parchment, fontStyle: "normal" }}>{actor}</strong> raised a
            flag
            {event.meta?.slots ? (
              <span style={{ color: PAL.brass }}> · need {event.meta.slots}</span>
            ) : null}
            {subject && subject !== "a run" ? (
              <span style={{ color: PAL.parchDim }}> · {subject}</span>
            ) : null}
          </>
        );
    }
  })();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        background: alt ? "rgba(255,255,255,0.015)" : "transparent",
        borderBottom: `1px solid ${PAL.brass}10`,
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          color,
        }}
      >
        {glyph}
      </span>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          color: PAL.parchment,
          fontStyle: "italic",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {line}
      </div>
      <span
        style={{
          fontFamily: WR_FONT_MONO,
          fontSize: 10,
          color: PAL.parchDim,
          flexShrink: 0,
          letterSpacing: "0.5px",
        }}
      >
        {timeAgo(event.ts)}
      </span>
    </div>
  );
}

export function FeatureBlock({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span
          style={{
            fontFamily: WR_FONT_DISPLAY,
            fontSize: 16,
            color: PAL.brassHi,
            letterSpacing: "0.5px",
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ fontSize: 13, color: PAL.parchDim, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}
