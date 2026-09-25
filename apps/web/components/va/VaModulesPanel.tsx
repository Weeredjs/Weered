"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  VA,
  HEAD_FONT,
  CREW_LEVEL,
  STAFF_LEVEL,
  Card,
  vaFetch,
  type Hub,
  type VaLink,
} from "./vaShared";
import VaHub from "./VaHub";
import VaJoin from "./VaJoin";

const VaLiveMap = dynamic(() => import("./VaLiveMap"), { ssr: false });
const VaDepartureBoard = dynamic(() => import("./VaDepartureBoard"), { ssr: false });
const VaRoster = dynamic(() => import("./VaRoster"), { ssr: false });
const VaPilotSheet = dynamic(() => import("./VaRoster").then((m) => m.VaPilotSheet), {
  ssr: false,
});
const VaLogbook = dynamic(() => import("./VaLogbook"), { ssr: false });
const VaStaffDesk = dynamic(() => import("./VaStaffDesk"), { ssr: false });

/**
 * Virtual-airline crew hub (moduleType VIRTUAL_AIRLINE). The lobby's Modules
 * view. Tabs the viewer cannot use are shown locked rather than hidden, so a
 * visitor can see what joining opens up; the server enforces every one.
 */

type TabId = "hub" | "map" | "board" | "roster" | "logbook" | "links" | "staff" | "join";
const TABS: { id: TabId; label: string; need: 0 | 2 | 4 }[] = [
  { id: "hub", label: "Crew Hub", need: 0 },
  { id: "map", label: "Live Map", need: 0 },
  { id: "board", label: "Departures", need: CREW_LEVEL },
  { id: "roster", label: "Roster", need: CREW_LEVEL },
  { id: "logbook", label: "Logbook", need: CREW_LEVEL },
  { id: "links", label: "EFB & Tools", need: 0 },
  { id: "staff", label: "Staff Desk", need: STAFF_LEVEL },
  { id: "join", label: "Join", need: 0 },
];

function initialTab(): TabId {
  try {
    const t = new URLSearchParams(window.location.search).get("va") as TabId | null;
    if (t && TABS.some((x) => x.id === t)) return t;
  } catch {
    /* no window during prerender */
  }
  return "hub";
}

export default function VaModulesPanel({
  lobbyId,
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  const [hub, setHub] = useState<Hub | null>(null);
  const [err, setErr] = useState<number | null>(null);
  const [tab, setTab] = useState<TabId>("hub");
  const [pilot, setPilot] = useState<string | null>(null);

  useEffect(() => setTab(initialTab()), []);

  const load = useCallback(async () => {
    const r = await vaFetch<Hub>(`/va/${encodeURIComponent(lobbyId)}/hub`);
    if (r.status === 200 && r.data) {
      setHub(r.data);
      setErr(null);
    } else setErr(r.status);
  }, [lobbyId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const go = useCallback((t: string) => {
    const next = (TABS.some((x) => x.id === t) ? t : "hub") as TabId;
    setTab(next);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("va", next);
      window.history.replaceState(window.history.state, "", u.toString());
    } catch {
      /* ignore */
    }
  }, []);

  const level = hub?.me.level ?? 0;
  const crew = level >= CREW_LEVEL;
  const staff = !!hub?.me.isStaff;
  const openPilot = useCallback((id: string) => crew && setPilot(id), [crew]);
  const visibleTabs = TABS.filter((t) => t.id !== "staff" || staff);

  return (
    <div
      style={{
        ...style,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        color: VA.text,
        background: `radial-gradient(1200px 500px at 85% -10%, rgba(30,115,175,.22), transparent 60%), linear-gradient(180deg, ${VA.deep}, ${VA.night})`,
      }}
    >
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "10px 16px 0",
          borderBottom: `1px solid ${VA.line}`,
          overflowX: "auto",
          flexShrink: 0,
        }}
      >
        <img
          src="/brand/vocn/logo-outline.png"
          alt=""
          style={{ height: 22, width: "auto", marginRight: 14, marginBottom: 8, flexShrink: 0 }}
        />
        {visibleTabs.map((t) => {
          const locked = level < t.need;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              style={{
                position: "relative",
                flexShrink: 0,
                padding: "8px 12px 12px",
                background: "none",
                border: 0,
                cursor: "pointer",
                fontFamily: HEAD_FONT,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: on ? VA.text : locked ? "#4f6885" : VA.muted,
              }}
            >
              {locked ? "🔒 " : ""}
              {t.label}
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  right: 10,
                  bottom: -1,
                  height: 3,
                  borderRadius: 2,
                  background: on ? VA.sun : "transparent",
                  boxShadow: on ? `0 0 12px ${VA.sun}` : "none",
                }}
              />
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        {hub && <WhoAmI hub={hub} />}
      </nav>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16 }}>
        <style>{SHARED_CSS}</style>
        {!hub && !err && <div style={{ padding: 40, color: VA.muted }}>Contacting dispatch…</div>}
        {err && !hub && (
          <div style={{ padding: 40, color: VA.muted }}>
            The crew hub is not answering ({err}). It will retry.
          </div>
        )}
        {hub && tab === "hub" && (
          <VaHub hub={hub} lobbyId={lobbyId} onGo={go} onOpenPilot={openPilot} />
        )}
        {hub && tab === "map" && <VaLiveMap hub={hub} height="calc(100vh - 260px)" />}
        {hub && tab === "board" && hub.groupFlight && (
          <VaDepartureBoard
            lobbyId={lobbyId}
            flightKey={hub.groupFlight.key}
            airports={hub.airports}
            ranks={hub.ranks}
            airline={hub.airline}
            canBook={crew}
            signedIn={hub.me.signedIn}
          />
        )}
        {hub && tab === "roster" && (
          <VaRoster
            lobbyId={lobbyId}
            airline={hub.airline}
            signedIn={hub.me.signedIn}
            onOpenPilot={openPilot}
          />
        )}
        {hub && tab === "logbook" && (
          <VaLogbook
            lobbyId={lobbyId}
            airline={hub.airline}
            signedIn={hub.me.signedIn}
            onOpenPilot={openPilot}
          />
        )}
        {hub && tab === "links" && <Links links={hub.links} crew={crew} />}
        {hub && tab === "staff" && (
          <VaStaffDesk
            lobbyId={lobbyId}
            airline={hub.airline}
            signedIn={hub.me.signedIn}
            onOpenPilot={openPilot}
          />
        )}
        {hub && tab === "join" && <VaJoin hub={hub} publicLinks={hub.links} />}
      </div>

      {pilot && <VaPilotSheet lobbyId={lobbyId} pilotId={pilot} onClose={() => setPilot(null)} />}
    </div>
  );
}

function WhoAmI({ hub }: { hub: Hub }) {
  const lv = hub.me.level;
  const label = !hub.me.signedIn
    ? "Viewing as the public"
    : lv >= 5
      ? "Director"
      : lv >= STAFF_LEVEL
        ? "Operations staff"
        : lv >= CREW_LEVEL
          ? "Verified crew"
          : "Visitor · not yet crew";
  return (
    <div
      style={{
        flexShrink: 0,
        marginBottom: 8,
        padding: "5px 10px",
        borderRadius: 20,
        fontSize: 12,
        border: `1px solid ${lv >= CREW_LEVEL ? `${VA.sun}66` : VA.line}`,
        color: lv >= CREW_LEVEL ? VA.sun : VA.muted,
        whiteSpace: "nowrap",
      }}
      title="What this account can see. The server enforces it; this only says so."
    >
      {label}
      {hub.me.pilotId ? ` · ${hub.me.pilotId}` : ""}
    </div>
  );
}

function Links({ links, crew }: { links: VaLink[]; crew: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ color: VA.ice, fontSize: 14, lineHeight: 1.6, maxWidth: 820 }}>
          The hub sits on top of the tools the airline already runs. vAMSYS stays the operational
          backend, the EFB keeps its specialised job, and everything opens from here. A tool that
          allows being framed opens inside the hub; the rest open in a new tab.
        </div>
      </Card>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: 12,
        }}
      >
        {links.map((l) => (
          <a
            key={l.label}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              padding: 16,
              borderRadius: 12,
              textDecoration: "none",
              color: VA.text,
              background: VA.card,
              border: `1px solid ${/EFB/.test(l.label) ? `${VA.sun}77` : VA.line}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <span style={{ fontFamily: HEAD_FONT, fontSize: 20, fontWeight: 700 }}>
                {l.label}
              </span>
              <span style={{ color: VA.sun }}>↗</span>
            </div>
            {l.note && (
              <div style={{ fontSize: 12.5, color: VA.muted, marginTop: 4, lineHeight: 1.45 }}>
                {l.note}
              </div>
            )}
            <div
              style={{
                fontSize: 10.5,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: VA.faint,
                marginTop: 8,
              }}
            >
              {l.audience === "public" ? "Public" : l.audience === "staff" ? "Staff" : "Crew"}
            </div>
          </a>
        ))}
      </div>
      {!crew && (
        <div style={{ fontSize: 12.5, color: VA.muted }}>
          Crew tools appear here once your account is verified.
        </div>
      )}
    </div>
  );
}

// The board, roster and logbook share these controls; the board also defines
// them, but a visitor can open the roster first.
const SHARED_CSS = `
.va-btn { font:800 13px/1 ${HEAD_FONT}; letter-spacing:.14em; text-transform:uppercase; color:${VA.navy}; background:${VA.sun}; border:0; border-radius:6px; padding:9px 16px; cursor:pointer; transition: transform .12s, box-shadow .2s; display:inline-block; }
.va-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 0 18px rgba(255,205,0,.55); }
.va-btn:disabled { opacity:.55; cursor:default; }
.va-btn.ghost { background:transparent; color:${VA.sun}; border:1px solid ${VA.sun}88; }
a.va-btn, a.va-btn:visited { color:${VA.navy} !important; text-decoration:none; }
a.va-btn.ghost, a.va-btn.ghost:visited { color:${VA.sun} !important; }
.va-seg { font:700 14px/1 ${HEAD_FONT}; letter-spacing:.1em; text-transform:uppercase; padding:8px 14px; border-radius:8px; border:1px solid ${VA.line}; background:transparent; color:${VA.ice}; cursor:pointer; }
.va-seg.on { background:${VA.sun}; color:${VA.navy}; border-color:${VA.sun}; }
@keyframes vaPulse { 0%,100% { opacity:1 } 50% { opacity:.45 } }
`;
