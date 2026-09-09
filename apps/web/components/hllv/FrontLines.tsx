"use client";
// Front Line — the unit's own server, live over RCON.
//
// For Vietnam this IS the server tab: there is no public list, so the linked
// box is all there is, plus what Steam still tells us about the game as a
// whole. For WWII the same card sits inside the Garrisons tab beneath the
// Steam-list browser, adding what the list cannot see: score, clock, morale,
// queue, next map, and (via the Roster tab) who is on it.
//
// Either way the card shows the box the unit has linked: map and mode, the
// two sides by the numbers, and — the part a live browser never has — what
// this box normally looks like at this hour, from our own polling.
import React, { useEffect, useState } from "react";
import ServerRhythm from "../hll/ServerRhythm";
import {
  API,
  authHeaders,
  S,
  ALLIED,
  AXIS,
  linkError,
  sideName,
  matchTitle,
  type Game,
  type LinkedServer,
  type Session,
} from "./shared";
import { fmtClock, prettyLayer } from "../../lib/hllv/data";

type Intel = { playingNow: number | null; news: any[] };

const GAME_NAME: Record<Game, string> = { hll: "Hell Let Loose", hllv: "Vietnam" };

function Bar({ a, b, max }: { a: number; b: number; max: number }) {
  const w = (n: number) => `${Math.min(50, Math.round((n / Math.max(1, max)) * 100))}%`;
  return (
    <div
      style={{
        display: "flex",
        height: 6,
        borderRadius: 3,
        background: "rgba(255,255,255,.08)",
        overflow: "hidden",
      }}
    >
      <div style={{ width: w(a), background: ALLIED, transition: "width 600ms" }} />
      <div style={{ flex: 1 }} />
      <div style={{ width: w(b), background: AXIS, transition: "width 600ms" }} />
    </div>
  );
}

function Live({ s, accent }: { s: Session; accent: string }) {
  const al = sideName(s.alliedFaction, "allied");
  const ax = sideName(s.axisFaction, "axis");
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={S.big}>
          {s.players}
          <span style={{ fontSize: 14, opacity: 0.55 }}>/{s.maxPlayers}</span>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgba(236,242,250,.92)" }}>
          {matchTitle(s)}
        </div>
        {s.timeOfDay && s.timeOfDay !== "Day" && (
          <span style={{ ...S.badge, color: accent, border: `1px solid ${accent}55` }}>
            {s.timeOfDay}
          </span>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11.5,
            marginBottom: 4,
          }}
        >
          <span style={{ color: ALLIED, fontWeight: 800 }}>
            {al} {s.allied} · {s.alliedScore}
          </span>
          <span style={{ color: AXIS, fontWeight: 800 }}>
            {s.axisScore} · {s.axis} {ax}
          </span>
        </div>
        <Bar a={s.allied} b={s.axis} max={s.maxPlayers} />
      </div>
      <div
        style={{
          ...S.muted,
          marginTop: 8,
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          fontSize: 12,
        }}
      >
        <span>
          <b style={{ color: "rgba(236,242,250,.85)" }}>{fmtClock(s.remaining)}</b> left
        </span>
        {s.queue > 0 && (
          <span>
            queue <b style={{ color: "rgba(236,242,250,.85)" }}>{s.queue}</b>/{s.maxQueue}
          </span>
        )}
        {s.initialMorale > 0 && (
          <span>
            morale <b style={{ color: ALLIED }}>{s.alliedMorale}</b> ·{" "}
            <b style={{ color: AXIS }}>{s.axisMorale}</b>
          </span>
        )}
      </div>
    </>
  );
}

export default function FrontLines({
  lobbyId,
  game = "hllv",
  accent,
  onGo,
  showIntel = true,
}: {
  lobbyId: string;
  game?: Game;
  accent: string;
  onGo?: (tab: string) => void;
  /** The Steam strip (playing now + news). Vietnam has nowhere else to put
   *  it; the WWII panel already carries its own on Front Lines. */
  showIntel?: boolean;
}) {
  const [servers, setServers] = useState<LinkedServer[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [max, setMax] = useState(6);
  const [loaded, setLoaded] = useState(false);
  const [openRhythm, setOpenRhythm] = useState<string | null>(null);
  const [intel, setIntel] = useState<Intel>({ playingNow: null, news: [] });
  const [formOpen, setFormOpen] = useState(false);
  const [f, setF] = useState({ name: "", host: "", port: "", password: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const base = `${API}/hllv/${encodeURIComponent(lobbyId)}`;

  const load = async () => {
    try {
      const r = await fetch(`${base}/servers?game=${game}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const j = await r.json();
      if (j?.ok) {
        setServers(j.servers || []);
        setCanManage(!!j.canManage);
        if (j.max) setMax(j.max);
      }
    } catch {}
    setLoaded(true);
  };

  useEffect(() => {
    void load();
    const iv = setInterval(load, 45_000);
    if (showIntel)
      fetch(`${API}/hllv/intel?game=${game}`)
        .then((r) => r.json())
        .then(
          (j) => j?.ok && setIntel({ playingNow: j.playingNow, news: (j.news || []).slice(0, 3) }),
        )
        .catch(() => {});
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId, game]);

  const link = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`${base}/server/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...f, port: Number(f.port), game }),
      });
      const j = await r.json();
      if (!j?.ok) setErr(linkError(j?.error));
      else {
        setF({ name: "", host: "", port: "", password: "", note: "" });
        setFormOpen(false);
        await load();
      }
    } catch {
      setErr("Link failed.");
    }
    setBusy(false);
  };

  const unlink = async (id: string) => {
    if (!confirm("Unlink this server? Its history is kept.")) return;
    setBusy(true);
    try {
      await fetch(`${base}/servers/${id}/unlink`, { method: "POST", headers: authHeaders() });
      await load();
    } catch {}
    setBusy(false);
  };

  const nextUp = (s: LinkedServer) => {
    const rot = s.rotation;
    if (!rot?.maps?.length) return null;
    return rot.maps[(rot.current + 1) % rot.maps.length];
  };

  const form = (
    <div style={S.card}>
      <div style={S.kick}>Link a server over RCON</div>
      <div style={{ ...S.muted, marginBottom: 10 }}>
        The RCON host, port and password from your provider&rsquo;s panel. They stay on our server
        and are only ever used to read: match state, roster, rotation. Nothing is written to your
        box.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          style={S.input}
          placeholder={game === "hll" ? "Name: 5th BCT | EU Public" : "Name: 16th IR | Realism"}
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...S.input, flex: 1 }}
            placeholder="RCON host or IP"
            value={f.host}
            onChange={(e) => setF({ ...f, host: e.target.value })}
          />
          <input
            style={{ ...S.input, width: 100 }}
            placeholder="port"
            inputMode="numeric"
            value={f.port}
            onChange={(e) => setF({ ...f, port: e.target.value.replace(/\D/g, "") })}
          />
        </div>
        <input
          style={S.input}
          type="password"
          placeholder="RCON password"
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
          autoComplete="off"
        />
        <input
          style={S.input}
          placeholder="Note (optional): drills Thursday 20:00"
          value={f.note}
          onChange={(e) => setF({ ...f, note: e.target.value })}
        />
        {err && <div style={{ fontSize: 12, color: "#f87171" }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={S.btnQuiet} onClick={() => setFormOpen(false)} disabled={busy}>
            Cancel
          </button>
          <button
            style={S.btn}
            onClick={link}
            disabled={busy || !f.name || !f.host || !f.port || !f.password}
          >
            {busy ? "Talking to the server…" : "Link"}
          </button>
        </div>
      </div>
    </div>
  );

  const intelStrip = (
    <div style={{ ...S.card, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <div>
        <div style={S.big}>
          {intel.playingNow == null ? "—" : intel.playingNow.toLocaleString()}
        </div>
        <div style={{ ...S.muted, fontSize: 11 }}>playing {GAME_NAME[game]} on Steam right now</div>
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        {intel.news.length ? (
          intel.news.map((n) => (
            <a
              key={n.id}
              href={n.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                fontSize: 12,
                color: "rgba(226,232,240,.85)",
                textDecoration: "none",
                marginBottom: 3,
              }}
            >
              <span style={{ color: accent, fontWeight: 700 }}>›</span> {n.title}
            </a>
          ))
        ) : (
          <div style={{ ...S.muted, fontSize: 11.5 }}>Studio news lands here.</div>
        )}
      </div>
    </div>
  );

  const emptyState =
    game === "hll" ? (
      <>
        <div style={{ fontWeight: 800, fontSize: 14, color: "rgba(236,242,250,.95)" }}>
          Steam lists your server. RCON tells the rest.
        </div>
        <div style={{ ...S.muted, marginTop: 6 }}>
          Front Lines already shows your box&rsquo;s population and map off Steam&rsquo;s list. Link
          its RCON and this card adds the score, the match clock, morale, the queue and the next
          map, and the Roster tab shows who is on it by squad. No CRCON, nothing to install: the
          three fields from your host&rsquo;s panel. If Steam already tracks the box, its rhythm is
          confident from day one.
        </div>
      </>
    ) : (
      <>
        <div style={{ fontWeight: 800, fontSize: 14, color: "rgba(236,242,250,.95)" }}>
          Vietnam has no public server list. Your server does not need one.
        </div>
        <div style={{ ...S.muted, marginTop: 6 }}>
          Every Vietnam server has an RCON port. Link yours and this card becomes the live match:
          map, US against NVA, score, clock, queue, next map — and after a couple of weeks, what the
          box normally does on a Thursday at 20:00, so a drill night is planned against a pattern
          rather than a guess. The Roster tab shows who is on it, by squad.
        </div>
      </>
    );

  return (
    <div>
      {showIntel && <div style={{ marginTop: 12 }}>{intelStrip}</div>}

      <div style={{ ...S.row, justifyContent: "space-between" }}>
        <div style={S.kick}>
          {servers.length > 1 ? "Our servers" : "Our server"}
          {game === "hll" ? " · RCON" : ""}
        </div>
        {canManage && !formOpen && servers.length < max && (
          <button style={S.btnQuiet} onClick={() => setFormOpen(true)}>
            + Link a server
          </button>
        )}
      </div>

      {formOpen && form}

      {!loaded ? (
        <div style={S.muted}>Raising the server…</div>
      ) : servers.length === 0 && !formOpen ? (
        <div style={S.card}>
          {emptyState}
          {canManage ? (
            <button style={{ ...S.btn, marginTop: 10 }} onClick={() => setFormOpen(true)}>
              Link the server
            </button>
          ) : (
            <div style={{ ...S.muted, marginTop: 8, fontSize: 11.5 }}>
              An officer of this lobby links it from here.
            </div>
          )}
        </div>
      ) : (
        servers.map((s) => {
          const next = nextUp(s);
          return (
            <div key={s.id} style={S.card}>
              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: "rgba(236,242,250,.95)" }}>
                  {s.name}
                  {s.note && (
                    <span style={{ ...S.muted, fontWeight: 500, marginLeft: 8 }}>{s.note}</span>
                  )}
                </div>
                <span
                  style={{
                    ...S.badge,
                    color: s.live ? "#8FBF7F" : "#e8a08c",
                    border: `1px solid ${s.live ? "rgba(143,191,127,.4)" : "rgba(232,160,140,.4)"}`,
                  }}
                >
                  {s.live ? "LIVE" : "UNREACHABLE"}
                </span>
              </div>

              {s.live ? (
                <Live s={s.live} accent={accent} />
              ) : (
                <div style={S.muted}>
                  {linkError(s.error)}{" "}
                  {s.lastSeenAt && `Last answered ${new Date(s.lastSeenAt).toLocaleString()}.`}
                </div>
              )}

              {next && (
                <div style={{ ...S.muted, marginTop: 8, fontSize: 12 }}>
                  Next up:{" "}
                  <b style={{ color: "rgba(236,242,250,.85)" }}>
                    {next.map
                      ? [next.map, next.mode, next.attacker ? `${next.attacker} attack` : null]
                          .filter(Boolean)
                          .join(" · ")
                      : next.name || prettyLayer(next.id)}
                  </b>
                  {s.rotation && s.rotation.maps.length > 2 && (
                    <span style={{ opacity: 0.6 }}> · {s.rotation.maps.length} in rotation</span>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  style={openRhythm === s.id ? S.btn : S.btnQuiet}
                  onClick={() => setOpenRhythm(openRhythm === s.id ? null : s.id)}
                >
                  {openRhythm === s.id ? "Hide rhythm" : "What it normally does"}
                </button>
                <button style={S.btnQuiet} onClick={() => onGo?.("roster")}>
                  Who&rsquo;s on
                </button>
                {canManage && (
                  <button
                    style={{ ...S.btnQuiet, marginLeft: "auto", opacity: 0.7 }}
                    onClick={() => unlink(s.id)}
                    disabled={busy}
                  >
                    Unlink
                  </button>
                )}
              </div>
              {openRhythm === s.id && (
                <ServerRhythm serverId={s.rhythmId} accent={accent} livePlayers={s.live?.players} />
              )}
            </div>
          );
        })
      )}

      <div style={{ ...S.muted, marginTop: 6, fontSize: 11.5 }}>
        Live state refreshes every 45 seconds. The rhythm is our own polling of this box every ten
        minutes; it takes about three weeks before &ldquo;normally&rdquo; means anything and the
        card says so until then.
        {game === "hll" && " A box Steam already lists carries its history in from the start."}
      </div>
    </div>
  );
}
