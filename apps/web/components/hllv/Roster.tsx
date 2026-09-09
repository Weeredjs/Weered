"use client";
// Roster — who is on the unit's server right now, by team and squad.
//
// This is the thing a unit officer opens before a drill: is the platoon
// actually on, which squads formed, who took the mortar, is anyone in
// Command. The server tells us all of it over RCON; we show names, roles
// and scores and nothing that identifies an account.
import React, { useEffect, useState } from "react";
import {
  API,
  authHeaders,
  S,
  US,
  NVA,
  linkError,
  type LinkedServer,
  type Roster,
  type RosterPlayer,
  type RosterSquad,
  type Session,
} from "./shared";

const TYPE_ICON: Record<string, string> = {
  Infantry: "🪖",
  Recon: "🔭",
  Armor: "🛡",
  Mortar: "💥",
  Helicopter: "🚁",
  Command: "⭐",
};

function Player({ p, color }: { p: RosterPlayer; color: string }) {
  const total = p.score.combat + p.score.offense + p.score.defense + p.score.support;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: 8,
        alignItems: "baseline",
        padding: "3px 0",
        fontSize: 12.5,
      }}
    >
      <div
        style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {p.clan && <span style={{ color, fontWeight: 800, marginRight: 5 }}>[{p.clan}]</span>}
        <span style={{ color: "rgba(236,242,250,.92)", fontWeight: p.lead ? 800 : 500 }}>
          {p.name}
        </span>
        <span style={{ ...S.muted, fontSize: 11, marginLeft: 6 }}>
          {p.role}
          {p.level > 0 && ` · L${p.level}`}
        </span>
      </div>
      <span style={{ ...S.muted, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
        {p.kills}/{p.deaths}
      </span>
      <span
        style={{
          fontSize: 11.5,
          fontVariantNumeric: "tabular-nums",
          color: "rgba(236,242,250,.75)",
          minWidth: 36,
          textAlign: "right",
        }}
      >
        {total}
      </span>
    </div>
  );
}

function Squad({ sq, color }: { sq: RosterSquad; color: string }) {
  return (
    <div
      style={{
        marginBottom: 8,
        padding: "6px 8px",
        borderRadius: 8,
        background: "rgba(0,0,0,.18)",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}
      >
        <span style={{ fontWeight: 800, letterSpacing: ".08em", color }}>
          {TYPE_ICON[sq.type] || ""} {sq.name}
        </span>
        <span style={S.muted}>
          {sq.type} · {sq.players.length}
        </span>
      </div>
      {sq.players.map((p, i) => (
        <Player key={p.name + i} p={p} color={color} />
      ))}
    </div>
  );
}

function Team({ label, color, t }: { label: string; color: string; t: Roster["us"] }) {
  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div style={{ ...S.kick, color, marginTop: 4 }}>
        {label} · {t.count}
      </div>
      {t.commander && (
        <div
          style={{
            marginBottom: 8,
            padding: "6px 8px",
            borderRadius: 8,
            background: "rgba(0,0,0,.18)",
            border: `1px solid ${color}33`,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color }}>
            ⭐ COMMAND
          </div>
          <Player p={t.commander} color={color} />
        </div>
      )}
      {t.squads.map((sq) => (
        <Squad key={sq.index + sq.name} sq={sq} color={color} />
      ))}
      {t.unassigned.length > 0 && (
        <div
          style={{
            marginBottom: 8,
            padding: "6px 8px",
            borderRadius: 8,
            background: "rgba(0,0,0,.1)",
          }}
        >
          <div style={{ ...S.muted, fontSize: 11, marginBottom: 2 }}>
            No squad · {t.unassigned.length}
          </div>
          {t.unassigned.map((p, i) => (
            <Player key={p.name + i} p={p} color={color} />
          ))}
        </div>
      )}
      {t.count === 0 && <div style={S.muted}>Nobody on this side.</div>}
    </div>
  );
}

export default function RosterTab({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const [servers, setServers] = useState<LinkedServer[]>([]);
  const [pick, setPick] = useState<string>("");
  const [data, setData] = useState<{ session: Session; roster: Roster; fetchedAt: number } | null>(
    null,
  );
  const [err, setErr] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API}/hllv/${encodeURIComponent(lobbyId)}/servers`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setServers(j.servers || []);
          if (!pick && j.servers?.[0]) setPick(j.servers[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  useEffect(() => {
    if (!pick) return;
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`${API}/hllv/${encodeURIComponent(lobbyId)}/servers/${pick}/roster`, {
          cache: "no-store",
        });
        const j = await r.json();
        if (stop) return;
        if (j?.ok) {
          setData(j);
          setErr("");
        } else setErr(j?.error || "error");
      } catch {
        if (!stop) setErr("error");
      }
    };
    void load();
    const iv = setInterval(load, 20_000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [lobbyId, pick]);

  if (!loaded) return <div style={{ ...S.muted, marginTop: 12 }}>Raising the server…</div>;
  if (!servers.length)
    return (
      <div style={{ ...S.card, marginTop: 12 }}>
        <div style={S.muted}>
          The roster reads off a linked server. Link one on the Front Line tab and this becomes the
          live platoon list, by squad.
        </div>
      </div>
    );

  return (
    <div>
      {servers.length > 1 && (
        <div style={{ ...S.row, marginTop: 12, flexWrap: "wrap" }}>
          {servers.map((s) => (
            <button
              key={s.id}
              style={pick === s.id ? S.btn : S.btnQuiet}
              onClick={() => setPick(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {err && !data && (
        <div style={{ ...S.card, marginTop: 12 }}>
          <div style={S.muted}>{linkError(err)}</div>
        </div>
      )}

      {data && (
        <>
          <div
            style={{
              ...S.card,
              marginTop: 12,
              display: "flex",
              gap: 14,
              alignItems: "baseline",
              flexWrap: "wrap",
            }}
          >
            <div style={S.big}>{data.roster.total}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(236,242,250,.9)" }}>
              on {data.session.serverName || "the server"}
            </div>
            <div style={{ ...S.muted, fontSize: 11.5 }}>
              {data.session.map
                ? `${data.session.map} · ${data.session.mode}`
                : data.session.mapName}
              {err && (
                <span style={{ color: "#e8a08c" }}>
                  {" "}
                  · last good read {new Date(data.fetchedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Team label="US" color={US} t={data.roster.us} />
            <Team label="NVA" color={NVA} t={data.roster.nva} />
          </div>

          {data.roster.unassigned.length > 0 && (
            <div style={S.card}>
              <div style={{ ...S.muted, fontSize: 11, marginBottom: 2 }}>
                Not on a team yet · {data.roster.unassigned.length}
              </div>
              {data.roster.unassigned.map((p, i) => (
                <Player key={p.name + i} p={p} color={accent} />
              ))}
            </div>
          )}

          <div style={{ ...S.muted, fontSize: 11.5 }}>
            Kills/deaths and total score are this match. Refreshes every 20 seconds. Bold names lead
            their element.
          </div>
        </>
      )}
    </div>
  );
}
