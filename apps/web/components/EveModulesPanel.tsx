"use client";

import React, { useCallback, useEffect, useState } from "react";
import EmptyState from "./EmptyState";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT_EVE = "#d4af37";
const PORTRAIT = (id: string | number, size = 128) =>
  `https://images.evetech.net/characters/${id}/portrait?size=${size}`;
const CORP_LOGO = (id: string | number, size = 64) =>
  `https://images.evetech.net/corporations/${id}/logo?size=${size}`;
const ALLIANCE_LOGO = (id: string | number, size = 64) =>
  `https://images.evetech.net/alliances/${id}/logo?size=${size}`;
const ZKILL_CHAR = (id: string | number) => `https://zkillboard.com/character/${id}/`;
const ZKILL_KILL = (id: string | number) => `https://zkillboard.com/kill/${id}/`;
const SHIP_RENDER = (id: string | number, size = 64) =>
  `https://images.evetech.net/types/${id}/render?size=${size}`;

function timeAgo(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch { return ""; }
}

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  return r.json();
}

const S = {
  card: { borderRadius: 2, border: "1px solid rgba(212,175,55,.18)", background: "rgba(20,18,12,.85)", padding: "12px 14px" } as React.CSSProperties,
  btn: { padding: "7px 14px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)", fontFamily: "inherit" } as React.CSSProperties,
  btnPri: { padding: "7px 14px", borderRadius: 2, border: "1px solid rgba(212,175,55,.45)", background: "rgba(212,175,55,.14)", fontSize: 12, cursor: "pointer", color: "rgb(244,212,108)", fontWeight: 700, fontFamily: "inherit", letterSpacing: ".3px" } as React.CSSProperties,
  label: { fontSize: 10, fontWeight: 700, opacity: 0.5, letterSpacing: ".8px", textTransform: "uppercase" as const, marginBottom: 5 } as React.CSSProperties,
};

type TabId = "live" | "character" | "killboard" | "sov" | "market" | "news" | "newpilots" | "corp";

type EveCard = {
  characterId: string;
  characterName: string;
  corpId: number | null;
  corpName: string | null;
  corpTicker: string | null;
  allianceId: number | null;
  allianceName: string | null;
  allianceTicker: string | null;
  securityStatus: number | null;
  birthday: string | null;
};

type EveLive = {
  online: boolean | null;
  lastLogin: string | null;
  lastLogout: string | null;
  loginCount: number | null;
  system: { id: number; name: string | null } | null;
  ship:   { id: number; name: string | null; customName: string | null } | null;
  trainingSkill: { id: number; name: string | null; finishedLevel: number; finishDate: string | null; startDate: string | null } | null;
  queueLength: number;
};

function fmtEta(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "complete";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function CharacterTab() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [card, setCard] = useState<EveCard | null>(null);
  const [live, setLive] = useState<EveLive | null>(null);

  const load = useCallback(async () => {
    const j = await apiFetch("/eve/me");
    if (j?.ok && j.linked) {
      setLinked(true);
      setCard(j.character);
      apiFetch("/eve/me/live").then(r => {
        if (r?.ok && r.linked && r.live) setLive(r.live);
      });
    } else {
      setLinked(false);
      setCard(null);
      setLive(null);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (linked === null) {
    return <div style={{ padding: 24, opacity: 0.4, fontSize: 12 }}>Loading capsuleer...</div>;
  }

  if (!linked) {
    return (
      <div style={{ padding: "24px 8px", textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🛰️</div>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: "rgb(244,212,108)" }}>Link your capsuleer</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 16, lineHeight: 1.5 }}>
          We use CCP's official ESI OAuth. Phase 1 scopes are minimal: public character data, current location, skills, killmails. No wallet access, no mail access, no asset access. You can revoke at any time on the EVE Online community page.
        </div>
        <a href={`${API}/auth/eve?token=${typeof window !== "undefined" ? localStorage.getItem("weered_token") || "" : ""}`} style={{ ...S.btnPri, display: "inline-block", textDecoration: "none" }}>
          Link with EVE Online
        </a>
      </div>
    );
  }

  if (!card) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...S.card, display: "flex", gap: 14, alignItems: "center" }}>
        <img src={PORTRAIT(card.characterId, 128)} alt={`${card.characterName} portrait`} style={{ width: 96, height: 96, borderRadius: 2, border: "1px solid rgba(212,175,55,.3)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "rgb(244,212,108)", marginBottom: 4 }}>{card.characterName}</div>
          {card.corpName && (
            <div style={{ fontSize: 12, opacity: 0.85, display: "flex", alignItems: "center", gap: 6 }}>
              {card.corpId && <img src={CORP_LOGO(card.corpId, 32)} alt="" style={{ width: 16, height: 16 }} />}
              {card.corpName} <span style={{ opacity: 0.5 }}>[{card.corpTicker}]</span>
            </div>
          )}
          {card.allianceName && (
            <div style={{ fontSize: 12, opacity: 0.7, display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              {card.allianceId && <img src={ALLIANCE_LOGO(card.allianceId, 32)} alt="" style={{ width: 16, height: 16 }} />}
              {card.allianceName} <span style={{ opacity: 0.55 }}>&lt;{card.allianceTicker}&gt;</span>
            </div>
          )}
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6 }}>
            Sec status: <span style={{ color: (card.securityStatus ?? 0) >= 0 ? "#86efac" : "#fca5a5" }}>{card.securityStatus?.toFixed(2) ?? "—"}</span>
            {card.birthday && <span style={{ marginLeft: 12 }}>Born: {new Date(card.birthday).toLocaleDateString()}</span>}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
            <a href={ZKILL_CHAR(card.characterId)} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration: "none", fontSize: 11 }}>zKillboard ↗</a>
            <a href={`https://evewho.com/character/${card.characterId}`} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration: "none", fontSize: 11 }}>EveWho ↗</a>
          </div>
        </div>
      </div>

      {live && (
        <div style={{ ...S.card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div style={S.label}>Online</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: live.online ? "#86efac" : "rgba(255,255,255,.55)" }}>
              {live.online === null ? "—" : live.online ? "● In space" : "○ Offline"}
            </div>
            {!live.online && live.lastLogout && (
              <div style={{ fontSize: 10, opacity: 0.45, marginTop: 2 }}>Last seen: {new Date(live.lastLogout).toLocaleString()}</div>
            )}
          </div>
          <div>
            <div style={S.label}>Current system</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{live.system?.name || (live.system?.id ? `#${live.system.id}` : "—")}</div>
          </div>
          <div>
            <div style={S.label}>Flying</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{live.ship?.name || (live.ship?.id ? `#${live.ship.id}` : "—")}</div>
            {live.ship?.customName && <div style={{ fontSize: 10, opacity: 0.5, marginTop: 1, fontStyle: "italic" }}>&ldquo;{live.ship.customName}&rdquo;</div>}
          </div>
          <div>
            <div style={S.label}>Training</div>
            {live.trainingSkill ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {live.trainingSkill.name || `Skill #${live.trainingSkill.id}`} <span style={{ opacity: 0.5, fontWeight: 500 }}>→ {live.trainingSkill.finishedLevel}</span>
                </div>
                <div style={{ fontSize: 10, opacity: 0.55, marginTop: 1 }}>
                  ETA: {fmtEta(live.trainingSkill.finishDate)}
                  {live.queueLength > 1 && <span style={{ marginLeft: 8 }}>· {live.queueLength - 1} more in queue</span>}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.5 }}>No active training</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KillboardTab() {
  const [kills, setKills] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    const j = await apiFetch("/eve/kills/global");
    setKills(j?.ok ? j.kills || [] : []);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (kills === null) return <div style={{ padding: 24, opacity: 0.4, fontSize: 12 }}>Loading killmails...</div>;
  if (kills.length === 0) {
    return (
      <EmptyState
        compact
        title="No kills to show right now."
        hint="The biggest recent nullsec killmails appear here, live from zKillboard — check back shortly."
      />
    );
  }

  const max = Math.max(1, ...kills.map((k: any) => k.value || 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ ...S.card, background: "rgba(212,175,55,.06)", fontSize: 12, opacity: 0.78, lineHeight: 1.5 }}>
        🔥 Biggest recent kills across <strong>nullsec</strong> — live from zKillboard. Link your capsuleer on the <strong>Capsuleer</strong> tab to surface kills involving this lobby.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {kills.map((k: any) => (
          <a
            key={k.killId}
            href={ZKILL_KILL(k.killId)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...S.card, position: "relative", overflow: "hidden", textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px" }}
          >
            <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(3, Math.round((k.value / max) * 100))}%`, background: "rgba(252,165,165,.08)", zIndex: 0 }} />
            {k.shipTypeId && (
              <img src={SHIP_RENDER(k.shipTypeId, 64)} alt="" style={{ width: 40, height: 40, borderRadius: 2, flexShrink: 0, position: "relative", zIndex: 1, border: "1px solid rgba(255,255,255,.08)", background: "rgba(0,0,0,.3)" }} />
            )}
            <div style={{ minWidth: 0, flex: 1, position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {k.ship || "Unknown ship"}
                {k.solo && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 800, color: "#fbbf24", letterSpacing: ".05em" }}>SOLO</span>}
                {k.npc && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, opacity: 0.45 }}>NPC</span>}
              </div>
              <div style={{ fontSize: 10.5, opacity: 0.6, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {k.victimName || "—"}{k.victimCorp ? ` · ${k.victimCorp}` : ""}
              </div>
              <div style={{ fontSize: 10, opacity: 0.4, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {k.system || "—"} · {k.attackers} attacker{k.attackers === 1 ? "" : "s"}{k.time ? ` · ${timeAgo(k.time)}` : ""}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "rgb(244,212,108)", fontVariantNumeric: "tabular-nums" }}>{fmtIsk(k.value)}</div>
              <div style={{ fontSize: 9, opacity: 0.4, letterSpacing: ".05em" }}>ISK</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

const STAT_ICON = {
  pilots: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 6.2a3 3 0 0 1 0 5.6M18 19a5 5 0 0 0-3-4.6" />
    </svg>
  ),
  kills: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="7.5" /><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  incursion: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5 22 20H2L12 2.5z" /><path d="M12 9.5v4.5" /><circle cx="12" cy="17" r=".4" fill="currentColor" stroke="currentColor" />
    </svg>
  ),
} as const;

function StatBox({ label, value, accent, sub, icon }: { label: string; value: string; accent?: string; sub?: string; icon?: React.ReactNode }) {
  const a = accent || "rgb(244,212,108)";
  return (
    <div style={{ ...S.card, padding: "11px 13px", borderLeft: `2px solid ${a}`, display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon && <span style={{ color: a, display: "inline-flex", opacity: 0.85 }}>{icon}</span>}
        <span style={{ ...S.label, marginBottom: 0 }}>{label}</span>
      </div>
      <div style={{ fontSize: 27, fontWeight: 800, color: a, fontVariantNumeric: "tabular-nums", lineHeight: 1.02, letterSpacing: "-.015em" }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, opacity: 0.4, letterSpacing: ".05em", textTransform: "uppercase" }}>{sub}</div>}
    </div>
  );
}

function SystemRow({ rank, name, id, right, rightColor, pct, barColor }: { rank: number; name: string | null; id: number; right: string; rightColor?: string; pct?: number; barColor?: string }) {
  const lead = rank === 1;
  return (
    <a
      href={`https://evemaps.dotlan.net/system/${encodeURIComponent((name || "").replace(/ /g, "_"))}`}
      target="_blank" rel="noopener noreferrer"
      style={{ position: "relative", display: "flex", justifyContent: "space-between", fontSize: 12, textDecoration: "none", color: "inherit", padding: "4px 8px", overflow: "hidden", borderRadius: 2 }}
    >
      {pct != null && (
        <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(3, Math.round(pct * 100))}%`, background: barColor || "rgba(252,165,165,.12)", zIndex: 0 }} />
      )}
      <span style={{ position: "relative", zIndex: 1, fontWeight: lead ? 700 : 400 }}><span style={{ opacity: 0.4, marginRight: 8, fontWeight: 400 }}>{rank}</span>{name || `#${id}`}</span>
      <span style={{ position: "relative", zIndex: 1, color: rightColor || "rgba(255,255,255,.7)", fontWeight: 700, whiteSpace: "nowrap" }}>{right}</span>
    </a>
  );
}

function LiveTab() {
  const [pulse, setPulse] = useState<any | null>(null);
  const [fw, setFw] = useState<any | null>(null);

  const load = useCallback(async () => {
    apiFetch("/eve/live/pulse").then(j => { if (j?.ok) setPulse(j); });
    apiFetch("/eve/fw/leaderboard").then(j => { if (j?.ok) setFw(j); });
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, [load]);

  const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString());

  if (pulse === null) return <div style={{ padding: 24, opacity: 0.4, fontSize: 12 }}>Reading New Eden...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <StatBox label="Pilots online" value={fmt(pulse.players)} accent="#86efac" sub="Tranquility · live" icon={STAT_ICON.pilots} />
        <StatBox label="Ships killed / hr" value={fmt(pulse.totalShipKills)} accent="#fca5a5" sub="New Eden · 60 min" icon={STAT_ICON.kills} />
        <StatBox label="Incursions" value={fmt(pulse.incursions)} sub="Sansha's Nation" icon={STAT_ICON.incursion} />
      </div>

      <div style={S.card}>
        <div style={S.label}>🔥 Most dangerous systems · last hour</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 6 }}>
          {(() => {
            const arr = pulse.dangerous || [];
            const max = Math.max(1, ...arr.map((s: any) => s.shipKills || 0));
            return arr.map((s: any, i: number) => (
              <SystemRow key={s.id} rank={i + 1} name={s.name} id={s.id} right={`${s.shipKills} kills`} rightColor="#fca5a5" pct={(s.shipKills || 0) / max} barColor="rgba(252,165,165,.11)" />
            ));
          })()}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.label}>🚀 Busiest systems · jumps / hour</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 6 }}>
          {(() => {
            const arr = pulse.busiest || [];
            const max = Math.max(1, ...arr.map((s: any) => s.jumps || 0));
            return arr.map((s: any, i: number) => (
              <SystemRow key={s.id} rank={i + 1} name={s.name} id={s.id} right={`${(s.jumps || 0).toLocaleString()} jumps`} rightColor="#7dd3fc" pct={(s.jumps || 0) / max} barColor="rgba(125,211,252,.10)" />
            ));
          })()}
        </div>
      </div>

      {fw?.pilots?.length > 0 && (
        <div style={S.card}>
          <div style={S.label}>🏆 Top faction-warfare pilots · {fw.period}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 6 }}>
            {(() => {
              const max = Math.max(1, ...fw.pilots.map((p: any) => p.kills || 0));
              return fw.pilots.map((p: any, i: number) => (
                <div key={p.id} style={{ position: "relative", display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 8px", alignItems: "center", overflow: "hidden", borderRadius: 2 }}>
                  <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(3, Math.round(((p.kills || 0) / max) * 100))}%`, background: "rgba(244,212,108,.10)", zIndex: 0 }} />
                  <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 7, minWidth: 0, fontWeight: i === 0 ? 700 : 400 }}>
                    <span style={{ opacity: 0.4, fontWeight: 400 }}>{i + 1}</span>
                    <img src={PORTRAIT(p.id, 32)} alt="" style={{ width: 18, height: 18, borderRadius: 2, flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  </span>
                  <span style={{ position: "relative", zIndex: 1, color: "rgb(244,212,108)", fontWeight: 700, whiteSpace: "nowrap" }}>{(p.kills || 0).toLocaleString()} kills</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function NewsTab() {
  const [items, setItems] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    const j = await apiFetch("/eve/news");
    setItems(j?.ok ? j.items || [] : []);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 600_000);
    return () => clearInterval(t);
  }, [load]);

  if (items === null) return <div style={{ padding: 24, opacity: 0.4, fontSize: 12 }}>Loading news...</div>;
  if (items.length === 0) return <EmptyState compact title="No recent EVE news." hint="Pulled from across the web; check back shortly." />;

  const isToday = (d: string) => {
    try { const t = new Date(d); const now = new Date(); return t.toDateString() === now.toDateString(); } catch { return false; }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((n: any, i: number) => {
        const fresh = n.pubDate && isToday(n.pubDate);
        return (
          <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{ ...S.card, borderLeft: fresh ? "2px solid rgba(134,239,172,.55)" : "2px solid rgba(212,175,55,.3)", textDecoration: "none", color: "inherit", display: "flex", gap: 11, alignItems: "flex-start", padding: "11px 13px" }}>
            <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 2, background: "rgba(212,175,55,.12)", border: "1px solid rgba(212,175,55,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "rgb(244,212,108)" }}>
              {(n.source || "E").trim().charAt(0).toUpperCase()}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgb(244,212,108)", lineHeight: 1.35 }}>{n.title}</div>
              <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                {fresh && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#86efac", boxShadow: "0 0 5px #86efac", flexShrink: 0 }} />}
                <span>{n.source}{n.pubDate && <span>{n.source ? " · " : ""}{(() => { try { return new Date(n.pubDate).toLocaleDateString(); } catch { return ""; } })()}</span>}</span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

const SOV_EVENT_LABEL: Record<number, string> = {
  1: "TCU defense", 2: "IHUB defense", 3: "Station defense", 4: "Station freeport",
};

function SovTab() {
  const [camps, setCamps] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    const j = await apiFetch("/eve/sovereignty/campaigns");
    setCamps(j?.ok ? j.campaigns || [] : []);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, [load]);

  if (camps === null) return <div style={{ padding: 24, opacity: 0.4, fontSize: 12 }}>Loading contested space...</div>;
  if (camps.length === 0) {
    return <EmptyState compact title="No active sov campaigns right now." hint="When alliances fight over sovereignty, contested systems show here live from CCP's ESI." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ ...S.card, background: "rgba(212,175,55,.06)", fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
        Live sovereignty campaigns across New Eden, straight from ESI. These are the systems where alliances are fighting for space right now.
      </div>
      {camps.map((c: any) => {
        const def = Math.round((c.defenderScore ?? 0) * 100);
        const atk = Math.round((c.attackersScore ?? 0) * 100);
        return (
          <div key={c.campaignId} style={{ ...S.card, borderLeft: "2px solid rgba(212,175,55,.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <a
                  href={`https://evemaps.dotlan.net/system/${encodeURIComponent((c.system?.name || "").replace(/ /g, "_"))}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, fontWeight: 800, color: "rgb(244,212,108)", textDecoration: "none" }}
                >
                  {c.system?.name || `System #${c.system?.id}`} ↗
                </a>
                <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>
                  {SOV_EVENT_LABEL[c.eventType] || `Event ${c.eventType}`}
                  {c.defender?.name && <span> · defender {c.defender.name}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#86efac", width: 56, flexShrink: 0 }}>{def}% def</span>
              <div style={{ flex: 1, height: 6, borderRadius: 2, overflow: "hidden", display: "flex", background: "rgba(255,255,255,.05)" }}>
                <span style={{ width: `${def}%`, background: "rgba(134,239,172,.65)" }} />
                <span style={{ width: `${atk}%`, background: "rgba(252,165,165,.6)" }} />
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fca5a5", width: 56, flexShrink: 0, textAlign: "right" }}>atk {atk}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmtIsk(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

function MarketTab() {
  const [data, setData] = useState<{ items: any[]; region: string } | null>(null);

  const load = useCallback(async () => {
    const j = await apiFetch("/eve/market/signals");
    setData(j?.ok ? { items: j.items || [], region: j.region || "Jita" } : { items: [], region: "Jita" });
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 300_000);
    return () => clearInterval(t);
  }, [load]);

  if (data === null) return <div style={{ padding: 24, opacity: 0.4, fontSize: 12 }}>Loading market...</div>;
  if (data.items.length === 0) {
    return <EmptyState compact title="Market data unavailable." hint="Live mineral prices come from Fuzzwork's Jita aggregates — try again shortly." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ ...S.card, background: "rgba(212,175,55,.06)", fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
        Live <strong>{data.region}</strong> mineral prices for industrialists. Buy = highest buy order, Sell = lowest sell order.
      </div>
      <div style={{ ...S.card, borderLeft: "2px solid rgba(212,175,55,.5)", padding: "12px 14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr .9fr .9fr .7fr", fontSize: 10, fontWeight: 700, opacity: 0.5, letterSpacing: ".5px", textTransform: "uppercase", paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          <div>Mineral</div>
          <div style={{ textAlign: "right" }}>Buy</div>
          <div style={{ textAlign: "right" }}>Sell</div>
          <div style={{ textAlign: "right" }}>Spread</div>
        </div>
        {data.items.map((it: any) => {
          const spread = it.buy && it.sell && it.sell > 0 ? ((it.sell - it.buy) / it.sell) * 100 : null;
          return (
            <div key={it.id} style={{ display: "grid", gridTemplateColumns: "1.3fr .9fr .9fr .7fr", alignItems: "center", fontSize: 13, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
              <div style={{ fontWeight: 600 }}>{it.name}</div>
              <div style={{ textAlign: "right", color: "#86efac", fontVariantNumeric: "tabular-nums" }}>{fmtIsk(it.buy)}</div>
              <div style={{ textAlign: "right", color: "rgb(244,212,108)", fontVariantNumeric: "tabular-nums" }}>{fmtIsk(it.sell)}</div>
              <div style={{ textAlign: "right", fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: spread == null ? "rgba(255,255,255,.3)" : spread > 8 ? "#86efac" : "rgba(255,255,255,.55)" }}>
                {spread == null ? "—" : `${spread.toFixed(1)}%`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewPilotsTab() {
  const sections = [
    {
      title: "Your first hour",
      items: [
        { href: "https://wiki.eveuniversity.org/Crash_course_for_newbros", label: "Crash course for newbros (EVE Uni Wiki)" },
        { href: "https://www.eveonline.com/news/view/eve-online-tutorial-guide", label: "Official tutorial guide" },
        { href: "https://www.youtube.com/c/EveOnline", label: "CCP's video tutorials" },
      ],
    },
    {
      title: "Your first week",
      items: [
        { href: "https://wiki.eveuniversity.org/Career_Agents", label: "Career Agents (10 agent series, free ships)" },
        { href: "https://wiki.eveuniversity.org/SOE_Epic_Arc", label: "Sisters of EVE Epic Arc (best newbro storyline)" },
        { href: "https://www.eveuniversity.org/", label: "Join EVE University (free training corp)" },
      ],
    },
    {
      title: "Your first month",
      items: [
        { href: "https://wiki.eveuniversity.org/Skill_training_plans", label: "Skill training plans by playstyle" },
        { href: "https://wiki.eveuniversity.org/Choosing_a_career", label: "Choosing a career (PvP / indy / WH / null)" },
        { href: "https://forums.eveonline.com/c/communications-center/recruitment-center/55", label: "Corporation recruitment forum" },
      ],
    },
    {
      title: "Tools you'll want",
      items: [
        { href: "https://zkillboard.com/", label: "zKillboard — every PvP kill, public" },
        { href: "https://www.fuzzwork.co.uk/", label: "Fuzzwork — market prices" },
        { href: "https://evemaps.dotlan.net/", label: "Dotlan — sovereignty + jump maps" },
        { href: "https://github.com/pyfa-org/Pyfa", label: "Pyfa — fitting tool (desktop)" },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...S.card, background: "rgba(212,175,55,.06)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "rgb(244,212,108)", marginBottom: 4 }}>Welcome, capsuleer.</div>
        <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
          EVE's first 30 days are infamously rough. This lobby is a no-judgement room — ask anything in chat, no question is too basic. The links below are the curriculum we wish someone had handed us on day one.
        </div>
      </div>

      {sections.map(s => (
        <div key={s.title} style={S.card}>
          <div style={S.label}>{s.title}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {s.items.map(it => (
              <a key={it.href} href={it.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "rgb(244,212,108)", textDecoration: "none" }}>
                → {it.label}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LookupTab() {
  const [mode, setMode] = useState<"character" | "corp">("character");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [character, setCharacter] = useState<any>(null);
  const [charNotFound, setCharNotFound] = useState(false);
  const [corp, setCorp] = useState<any>(null);
  const [corpNotFound, setCorpNotFound] = useState(false);

  async function lookupCharacter(name: string) {
    setSearching(true);
    setCharacter(null);
    setCharNotFound(false);
    const search = await apiFetch(`/eve/search/character?q=${encodeURIComponent(name)}`);
    const first = search?.results?.[0];
    if (!first?.id) {
      setCharNotFound(true);
      setSearching(false);
      return;
    }
    const detail = await apiFetch(`/eve/character/${first.id}`);
    if (detail?.ok) setCharacter(detail.character);
    else setCharNotFound(true);
    setSearching(false);
  }

  async function lookupCorp(id: string) {
    setSearching(true);
    setCorp(null);
    setCorpNotFound(false);
    if (!/^\d+$/.test(id)) {
      setCorpNotFound(true);
      setSearching(false);
      return;
    }
    const j = await apiFetch(`/eve/corp/${id}`);
    if (j?.ok) setCorp(j.corp);
    else setCorpNotFound(true);
    setSearching(false);
  }

  const placeholder = mode === "character" ? "Chribba" : "98388312";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={S.card}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button
            onClick={() => setMode("character")}
            style={{
              ...(mode === "character" ? S.btnPri : S.btn),
              fontSize: 11, padding: "5px 12px",
            }}
          >👤 Character</button>
          <button
            onClick={() => setMode("corp")}
            style={{
              ...(mode === "corp" ? S.btnPri : S.btn),
              fontSize: 11, padding: "5px 12px",
            }}
          >🏢 Corp by ID</button>
        </div>
        <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 10 }}>
          {mode === "character"
            ? "Search any capsuleer by their in-game name. Try Chribba, The Mittani, or Gigx."
            : "Paste a corporation ID (find it on the corp's zKillboard or EveWho page)."}
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (mode === "character") lookupCharacter(q.trim());
            else lookupCorp(q.trim());
          }}
          style={{ display: "flex", gap: 6 }}
        >
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={placeholder}
            style={{ flex: 1, padding: "8px 12px", borderRadius: 2, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", fontFamily: "inherit" }}
          />
          <button type="submit" disabled={searching || !q.trim()} style={{ ...S.btnPri, opacity: searching || !q.trim() ? 0.5 : 1 }}>
            {searching ? "..." : "Look up"}
          </button>
        </form>
      </div>

      {mode === "character" && charNotFound && (
        <div style={{ ...S.card, fontSize: 12, opacity: 0.55 }}>No character found by that name.</div>
      )}

      {mode === "character" && character && (
        <div style={{ ...S.card, display: "flex", gap: 14, alignItems: "center" }}>
          <img src={PORTRAIT(character.id, 128)} alt={`${character.name} portrait`} style={{ width: 80, height: 80, borderRadius: 2, border: "1px solid rgba(212,175,55,.3)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "rgb(244,212,108)" }}>{character.name}</div>
            {character.corpName && (
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                {character.corpId && <img src={CORP_LOGO(character.corpId, 32)} alt="" style={{ width: 14, height: 14 }} />}
                {character.corpName} <span style={{ opacity: 0.5 }}>[{character.corpTicker}]</span>
              </div>
            )}
            {character.allianceName && (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                {character.allianceId && <img src={ALLIANCE_LOGO(character.allianceId, 32)} alt="" style={{ width: 14, height: 14 }} />}
                {character.allianceName} <span style={{ opacity: 0.55 }}>&lt;{character.allianceTicker}&gt;</span>
              </div>
            )}
            <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6 }}>
              Sec status: <span style={{ color: (character.securityStatus ?? 0) >= 0 ? "#86efac" : "#fca5a5" }}>{character.securityStatus?.toFixed(2) ?? "—"}</span>
              {character.birthday && <span style={{ marginLeft: 12 }}>Born: {new Date(character.birthday).toLocaleDateString()}</span>}
            </div>
            <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
              <a href={ZKILL_CHAR(character.id)} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration: "none", fontSize: 11 }}>zKill ↗</a>
              <a href={`https://evewho.com/character/${character.id}`} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration: "none", fontSize: 11 }}>EveWho ↗</a>
            </div>
          </div>
        </div>
      )}

      {mode === "corp" && corpNotFound && (
        <div style={{ ...S.card, fontSize: 12, opacity: 0.55 }}>No corp found by that ID.</div>
      )}

      {mode === "corp" && corp && (
        <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "center" }}>
          <img src={CORP_LOGO(corp.id, 64)} alt={`${corp.name} logo`} style={{ width: 56, height: 56, borderRadius: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{corp.name} <span style={{ opacity: 0.5, fontWeight: 500 }}>[{corp.ticker}]</span></div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
              {corp.memberCount} members
              {corp.allianceId && <span> · alliance {corp.allianceId}</span>}
            </div>
            <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
              <a href={`https://zkillboard.com/corporation/${corp.id}/`} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration: "none", fontSize: 11 }}>zKill ↗</a>
              <a href={`https://evewho.com/corporation/${corp.id}`} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration: "none", fontSize: 11 }}>EveWho ↗</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TABS: { id: TabId; label: string }[] = [
  { id: "live",      label: "Live" },
  { id: "character", label: "Capsuleer" },
  { id: "killboard", label: "Killboard" },
  { id: "sov",       label: "Sov" },
  { id: "market",    label: "Market" },
  { id: "news",      label: "News" },
  { id: "newpilots", label: "New Pilots" },
  { id: "corp",      label: "Lookup" },
];

const TAB_ICON: Record<TabId, React.ReactNode> = {
  live:      (<><path d="M5 5a9.5 9.5 0 0 0 0 14M19 5a9.5 9.5 0 0 1 0 14M8 8a5 5 0 0 0 0 8M16 8a5 5 0 0 1 0 8" /><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" /></>),
  character: (<><circle cx="12" cy="8" r="4" fill="currentColor" stroke="none" /><path d="M4 21v-1.5a8 8 0 0 1 16 0V21z" fill="currentColor" stroke="none" /></>),
  killboard: (<><circle cx="12" cy="12" r="8" /><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" /><circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" /></>),
  sov:       (<path d="M5 22V3M5 3h12l-2.5 3.5L17 10H5" />),
  market:    (<path d="M3 17l5.5-5.5 3.5 3.5 7.5-7.5M22 7h-5M22 7v5" />),
  news:      (<><path d="M4 5h13v14H4z" /><path d="M17 9h3v8a2 2 0 0 1-2 2h-1" /><path d="M7 9h7M7 13h7M7 16.5h4" /></>),
  newpilots: (<path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" fill="currentColor" stroke="none" />),
  corp:      (<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>),
};

export default function EveModulesPanel({
  lobbyId: _lobbyId,
  gameName: _gameName = "EVE Online",
  accentColor = ACCENT_EVE,
  style,
}: {
  lobbyId: string;
  gameName?: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  const [tab, setTab] = useState<TabId>("live");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}>
      <div style={{ display: "flex", gap: 8, padding: "10px 12px 10px", flexShrink: 0, flexWrap: "wrap" }}>
        <style>{`@keyframes weeredTabCorona{0%{opacity:.5;transform:rotate(0deg) scale(.98)}50%{opacity:.95;transform:rotate(7deg) scale(1.05)}100%{opacity:.5;transform:rotate(0deg) scale(.98)}}@keyframes weeredCrackPulse{0%,100%{opacity:.8}50%{opacity:1}}`}</style>
        {TABS.map(t => {
          const active = tab === t.id;
          const CLIP = "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)";
          return (
            <span key={t.id} style={{ position: "relative", display: "inline-flex" }}>
              {active && (
                <>
                  <span
                    aria-hidden
                    style={{
                      position: "absolute", top: -18, bottom: -18, left: -22, right: -22,
                      background: "conic-gradient(from 12deg at 50% 55%, transparent 0 6deg, rgba(255,182,72,.95) 9deg, transparent 13deg 41deg, rgba(255,182,72,.72) 45deg, transparent 49deg 96deg, rgba(255,182,72,.9) 100deg, transparent 105deg 151deg, rgba(255,182,72,.64) 155deg, transparent 160deg 211deg, rgba(255,182,72,.85) 215deg, transparent 220deg 271deg, rgba(255,182,72,.7) 275deg, transparent 280deg 331deg, rgba(255,182,72,.8) 335deg, transparent 340deg 360deg)",
                      WebkitMaskImage: "radial-gradient(ellipse at center, #000 8%, rgba(0,0,0,.6) 36%, transparent 72%)",
                      maskImage: "radial-gradient(ellipse at center, #000 8%, rgba(0,0,0,.6) 36%, transparent 72%)",
                      filter: "blur(2.5px)",
                      animation: "weeredTabCorona 90s ease-in-out infinite",
                      pointerEvents: "none", zIndex: 0,
                    }}
                  />
                  <span
                    aria-hidden
                    style={{
                      position: "absolute", top: -3, bottom: -3, left: -3, right: -3,
                      clipPath: CLIP,
                      background: "rgba(255,184,74,.95)",
                      WebkitMaskImage: "conic-gradient(from 28deg at 50% 50%, #000 0deg, rgba(0,0,0,.28) 40deg, #000 92deg, rgba(0,0,0,.45) 150deg, #000 206deg, rgba(0,0,0,.3) 266deg, #000 320deg, rgba(0,0,0,.5) 360deg)",
                      maskImage: "conic-gradient(from 28deg at 50% 50%, #000 0deg, rgba(0,0,0,.28) 40deg, #000 92deg, rgba(0,0,0,.45) 150deg, #000 206deg, rgba(0,0,0,.3) 266deg, #000 320deg, rgba(0,0,0,.5) 360deg)",
                      animation: "weeredCrackPulse 90s ease-in-out infinite",
                      pointerEvents: "none", zIndex: 1,
                    }}
                  />
                  <span
                    aria-hidden
                    style={{
                      position: "absolute", top: -1, bottom: -1, left: -1, right: -1,
                      clipPath: CLIP,
                      background: "linear-gradient(135deg, rgba(120,70,28,.95) 0%, rgba(70,40,15,.92) 100%)",
                      pointerEvents: "none", zIndex: 2,
                    }}
                  />
                </>
              )}
              <button
                onClick={() => setTab(t.id)}
                style={{
                  position: "relative",
                  zIndex: 3,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 18px",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "var(--font-rajdhani), 'Bank Gothic', 'Arial Narrow', sans-serif",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)",
                  color: active ? "#ffc24d" : "rgba(148,163,184,.6)",
                  background: active ? "#0a0813" : "transparent",
                  boxShadow: "none",
                  transition: "color .15s",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  {TAB_ICON[t.id]}
                </svg>
                {t.label}
              </button>
            </span>
          );
        })}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14 }}>
        {tab === "live" && <LiveTab />}
        {tab === "character" && <CharacterTab />}
        {tab === "killboard" && <KillboardTab />}
        {tab === "sov" && <SovTab />}
        {tab === "market" && <MarketTab />}
        {tab === "news" && <NewsTab />}
        {tab === "newpilots" && <NewPilotsTab />}
        {tab === "corp" && <LookupTab />}
      </div>
    </div>
  );
}
