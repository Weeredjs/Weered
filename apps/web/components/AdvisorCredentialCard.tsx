"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWeered } from "./WeeredProvider";

const SERIF = "Georgia, 'Iowan Old Style', Cambria, 'Times New Roman', serif";
const UI_SANS = "'Segoe UI', Inter, system-ui, -apple-system, sans-serif";
const HAIR = "#1E3A5F";
const GOLD = "#C6A15B";
const GOLD_BRIGHT = "#D9B878";
const MUTED = "rgba(163,180,202,.72)";
const TEXT = "rgba(236,242,250,.95)";

function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

/**
 * Only let http(s) or inline image data URLs reach an <img src>. A stored
 * avatar is user-settable, so this blocks javascript:/vbscript:/other schemes
 * from being reflected into the DOM (XSS + navigation). Returns null otherwise.
 */
function safeImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^data:image\/(png|jpe?g|gif|webp|avif);/i.test(s)) return s;
  return null;
}

/** Halifax wall-clock, minute precision. Updates on the minute boundary. */
function useHalifaxTime(): string {
  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Halifax",
        hour: "numeric",
        minute: "2-digit",
      }),
    [],
  );
  const [t, setT] = useState(() => fmt.format(new Date()));
  useEffect(() => {
    let iv: any;
    // align to the next minute boundary, then tick per minute
    const align = setTimeout(
      () => {
        setT(fmt.format(new Date()));
        iv = setInterval(() => setT(fmt.format(new Date())), 60_000);
      },
      60_000 - (Date.now() % 60_000) + 250,
    );
    return () => {
      clearTimeout(align);
      if (iv) clearInterval(iv);
    };
  }, [fmt]);
  return t;
}

/** The Sign, mirrored quietly on the nameplate (same endpoint The Desk polls). */
function useSignState(): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    let stop = false;
    const read = async () => {
      try {
        const r = await fetch("/api/office/status");
        const j = await r.json();
        if (!stop && j && typeof j.open === "boolean") setOpen(j.open);
      } catch {}
    };
    void read();
    const iv = setInterval(read, 60_000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, []);
  return open;
}

/** A thin gold corner tick (certificate register). */
function Tick({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const s: React.CSSProperties = {
    position: "absolute",
    width: 9,
    height: 9,
    pointerEvents: "none",
    opacity: 0.4,
  };
  const b = `1px solid ${GOLD}`;
  if (pos === "tl") Object.assign(s, { top: 7, left: 7, borderTop: b, borderLeft: b });
  if (pos === "tr") Object.assign(s, { top: 7, right: 7, borderTop: b, borderRight: b });
  if (pos === "bl") Object.assign(s, { bottom: 7, left: 7, borderBottom: b, borderLeft: b });
  if (pos === "br") Object.assign(s, { bottom: 7, right: 7, borderBottom: b, borderRight: b });
  return <div aria-hidden style={s} />;
}

/**
 * The nameplate. Replaces the gamer UserCorner inside the office context: a quiet
 * brass-on-navy plaque — medallion, serif name, the firm, and two live details
 * (The Sign's state and Halifax time). No score, tier, crew, status, or burner.
 */
export default function AdvisorCredentialCard() {
  const { me } = useWeered() as any;

  const name = useMemo(() => pickFirstString(me?.name, me?.username, "Advisor"), [me]);
  const avatarUrl: string | null = safeImageUrl(me?.avatar);
  const initial = (name || "A").trim().slice(0, 1).toUpperCase();
  const time = useHalifaxTime();
  const signOpen = useSignState();

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 10,
        background: "radial-gradient(120% 90% at 20% 0%, #17335A 0%, #122A4A 55%, #102544 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.07), 0 0 0 1px " + HAIR + ", 0 10px 28px rgba(0,0,0,.4)",
        padding: "16px 16px 13px",
        marginBottom: 4,
        overflow: "hidden",
      }}
    >
      {/* Satin brass rule: the surface's single gold statement. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, rgba(217,184,120,0) 0%, ${GOLD_BRIGHT} 18%, ${GOLD} 55%, #A8853F 82%, rgba(168,133,63,0) 100%)`,
        }}
      />
      {/* Certificate corner ticks */}
      <Tick pos="tl" />
      <Tick pos="tr" />
      <Tick pos="bl" />
      <Tick pos="br" />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Medallion */}
        <div
          aria-hidden={!avatarUrl}
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            flexShrink: 0,
            background: "radial-gradient(closest-side, #0E2440 0%, #0A1D35 100%)",
            boxShadow:
              "0 0 0 1px #2C4E7C, inset 0 2px 4px rgba(0,0,0,.5), inset 0 -1px 0 rgba(255,255,255,.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            color: GOLD_BRIGHT,
            fontFamily: SERIF,
            fontSize: 19,
            lineHeight: 1,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name + " portrait"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initial
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.015em",
              lineHeight: 1.2,
              color: TEXT,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textShadow: "0 1px 0 rgba(0,0,0,.45)",
            }}
            title={name}
          >
            {name}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 3,
              fontFamily: UI_SANS,
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: MUTED,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              East Coast Employee Benefits
            </span>
          </div>
        </div>

        {/* Embossed anchor seal */}
        <div
          aria-hidden
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            flexShrink: 0,
            background: "radial-gradient(closest-side, #14304F 0%, #0F2440 100%)",
            boxShadow:
              "0 0 0 1px " +
              HAIR +
              ", inset 0 1px 0 rgba(255,255,255,.08), inset 0 -2px 3px rgba(0,0,0,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src="/brand/eceb-anchor-chrome.svg"
            alt=""
            style={{
              width: 19,
              height: 19,
              opacity: 0.92,
              filter:
                "drop-shadow(0 -1px 0 rgba(255,255,255,.18)) drop-shadow(0 1px 1px rgba(0,0,0,.6))",
            }}
          />
        </div>
      </div>

      <div
        aria-hidden
        style={{
          height: 1,
          background: `linear-gradient(90deg, ${HAIR} 0%, rgba(30,58,95,.25) 100%)`,
          margin: "12px 0 9px",
        }}
      />

      {/* Live line: The Sign's state + Halifax wall-clock */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          fontFamily: UI_SANS,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: MUTED,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              flexShrink: 0,
              background: signOpen ? "#3E7D5C" : "rgba(163,180,202,.45)",
              boxShadow: signOpen ? "0 0 0 1px rgba(62,125,92,.35)" : "none",
            }}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {signOpen == null ? "The Desk" : signOpen ? "Open for consultations" : "By appointment"}
          </span>
        </span>
        <span
          style={{
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums lining-nums",
            color: "rgba(163,180,202,.6)",
          }}
        >
          Halifax {time}
        </span>
      </div>
    </div>
  );
}
