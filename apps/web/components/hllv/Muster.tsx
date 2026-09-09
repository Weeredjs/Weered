"use client";
// Muster — the unit's roll, its drills, and the quarter.
//
// The roll is in-game names, kept by officers, so nobody has to hold a
// Weered account to be counted. A drill is a window over one or more of the
// lobby's linked servers; the API polls their rosters through it and this
// tab shows who was there. The quarter view is the attendance sheet a unit
// keeps by hand today, filled in by the server.
import React, { useEffect, useMemo, useState } from "react";
import { API, authHeaders, S, type Game } from "./shared";
import DrillBoard from "./DrillBoard";

export type RollMember = {
  id: string;
  name: string;
  nameKey: string;
  squad: string;
  status: "ACTIVE" | "RESERVE" | "INACTIVE";
  note: string;
};
export type DrillRow = {
  id: string;
  eventId: string | null;
  title: string;
  serverIds: string[];
  windowStart: string;
  windowEnd: string;
  polls: number;
  status: "SCHEDULED" | "RUNNING" | "DONE";
  seen: number;
};
type ServerOpt = { id: string; name: string; framework: string };

const STATUS_COLOR: Record<string, string> = {
  PRESENT: "#8FBF7F",
  PARTIAL: "#E0B653",
  ABSENT: "rgba(148,163,184,.7)",
  AWOL: "#e8a08c",
  LOA: "#E0B653",
  ELOA: "#9CC3E6",
  EXCUSED: "#9CC3E6",
};
export { STATUS_COLOR };

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** datetime-local wants local wall time without zone; give it now + 1h on the hour. */
function defaultStart(): string {
  const d = new Date(Date.now() + 3_600_000);
  d.setMinutes(0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Muster({
  lobbyId,
  accent,
}: {
  lobbyId: string;
  game?: Game;
  accent: string;
}) {
  const base = `${API}/muster/${encodeURIComponent(lobbyId)}`;
  const [part, setPart] = useState<"drills" | "roll" | "quarter">("drills");
  const [canManage, setCanManage] = useState(false);
  const [roll, setRoll] = useState<RollMember[]>([]);
  const [drills, setDrills] = useState<DrillRow[]>([]);
  const [servers, setServers] = useState<ServerOpt[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");

  const loadRoll = async () => {
    try {
      const j = await fetch(`${base}/roll`, { headers: authHeaders(), cache: "no-store" }).then(
        (r) => r.json(),
      );
      if (j?.ok) {
        setRoll(j.members || []);
        setCanManage(!!j.canManage);
      }
    } catch {}
  };
  const loadDrills = async () => {
    try {
      const j = await fetch(`${base}/drills`, { headers: authHeaders(), cache: "no-store" }).then(
        (r) => r.json(),
      );
      if (j?.ok) {
        setDrills(j.drills || []);
        setServers(j.servers || []);
        setCanManage((c) => c || !!j.canManage);
      }
    } catch {}
  };
  useEffect(() => {
    Promise.all([loadRoll(), loadDrills()]).finally(() => setLoaded(true));
    const iv = setInterval(loadDrills, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  // ---- roll editing ----
  const [addName, setAddName] = useState("");
  const [addSquad, setAddSquad] = useState("");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);

  const post = async (path: string, body: any, method = "POST") => {
    setBusy(true);
    setErr("");
    try {
      // No content-type without a body: Fastify refuses an empty JSON body,
      // which is exactly what a DELETE looks like.
      const j = await fetch(`${base}${path}`, {
        method,
        headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...authHeaders() },
        body: body ? JSON.stringify(body) : undefined,
      }).then((r) => r.json());
      if (!j?.ok) setErr(j?.error === "mods_only" ? "Officers only." : j?.error || "Failed.");
      return j;
    } catch {
      setErr("Failed.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const addOne = async () => {
    if (!addName.trim()) return;
    const j = await post("/roll", { name: addName.trim(), squad: addSquad.trim() });
    if (j?.ok) {
      setAddName("");
      await loadRoll();
    }
  };
  const importPaste = async () => {
    if (!paste.trim()) return;
    const j = await post("/roll", { text: paste });
    if (j?.ok) {
      setPaste("");
      await loadRoll();
    }
  };
  const setMember = async (m: RollMember, patch: Partial<RollMember>) => {
    const j = await post(`/roll/${m.id}`, patch, "PATCH");
    if (j?.ok) await loadRoll();
  };
  const removeMember = async (m: RollMember) => {
    if (!confirm(`Remove ${m.name} from the roll?`)) return;
    const j = await post(`/roll/${m.id}`, null, "DELETE");
    if (j?.ok) await loadRoll();
  };

  // ---- new drill ----
  const [formOpen, setFormOpen] = useState(false);
  const [dTitle, setDTitle] = useState("");
  const [dStart, setDStart] = useState(defaultStart());
  const [dHours, setDHours] = useState("2");
  const [dServers, setDServers] = useState<string[]>([]);
  useEffect(() => {
    if (servers.length && !dServers.length) setDServers(servers.map((s) => s.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers.length]);

  const createDrill = async () => {
    const startsAt = new Date(dStart);
    if (!dTitle.trim() || Number.isNaN(startsAt.getTime())) return;
    const endsAt = new Date(startsAt.getTime() + Math.max(0.5, Number(dHours) || 2) * 3_600_000);
    const j = await post("/drills", {
      title: dTitle.trim(),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      serverIds: dServers,
    });
    if (j?.ok) {
      setDTitle("");
      setFormOpen(false);
      await loadDrills();
      setOpen(j.id);
    }
  };
  const removeDrill = async (d: DrillRow) => {
    if (!confirm(`Delete "${d.title}" and its attendance?`)) return;
    const j = await post(`/drills/${d.id}`, null, "DELETE");
    if (j?.ok) {
      if (open === d.id) setOpen(null);
      await loadDrills();
    }
  };

  const grouped = useMemo(() => {
    const g: Record<string, RollMember[]> = { ACTIVE: [], RESERVE: [], INACTIVE: [] };
    for (const m of roll) (g[m.status] || g.ACTIVE).push(m);
    return g;
  }, [roll]);

  const btn = (id: typeof part, label: string) => (
    <button key={id} style={part === id ? S.btn : S.btnQuiet} onClick={() => setPart(id)}>
      {label}
    </button>
  );

  if (!loaded) return <div style={{ ...S.muted, marginTop: 12 }}>Opening the muster book…</div>;

  return (
    <div>
      <div style={{ ...S.row, marginTop: 12, flexWrap: "wrap" }}>
        {btn("drills", `Drills${drills.length ? ` · ${drills.length}` : ""}`)}
        {btn("roll", `Roll · ${roll.length}`)}
        {btn("quarter", "The quarter")}
      </div>
      {err && <div style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>{err}</div>}

      {part === "drills" && open && (
        <DrillBoard
          lobbyId={lobbyId}
          drillId={open}
          accent={accent}
          canManage={canManage}
          onBack={() => {
            setOpen(null);
            void loadDrills();
          }}
          onRollChanged={loadRoll}
        />
      )}

      {part === "drills" && !open && (
        <>
          <div style={{ ...S.row, justifyContent: "space-between" }}>
            <div style={S.kick}>Drills</div>
            {canManage && !formOpen && (
              <button
                style={S.btnQuiet}
                onClick={() => setFormOpen(true)}
                disabled={!servers.length}
              >
                + Schedule a drill
              </button>
            )}
          </div>
          {!servers.length && (
            <div style={S.card}>
              <div style={S.muted}>
                Attendance reads off a linked server. Link one on the{" "}
                {drills.length ? "server" : "Front Line / Garrisons"} tab first.
              </div>
            </div>
          )}
          {formOpen && (
            <div style={S.card}>
              <div style={S.kick}>New drill</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  style={S.input}
                  placeholder="Title: Thursday platoon drill"
                  value={dTitle}
                  onChange={(e) => setDTitle(e.target.value)}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    style={S.input}
                    type="datetime-local"
                    value={dStart}
                    onChange={(e) => setDStart(e.target.value)}
                  />
                  <input
                    style={{ ...S.input, width: 90 }}
                    type="number"
                    min={0.5}
                    max={8}
                    step={0.5}
                    value={dHours}
                    onChange={(e) => setDHours(e.target.value)}
                    title="Length in hours"
                  />
                  <span style={{ ...S.muted, alignSelf: "center" }}>hours · your local time</span>
                </div>
                <div style={{ ...S.muted, fontSize: 12 }}>
                  Watch which server{servers.length > 1 ? "s" : ""}:
                </div>
                {servers.map((s) => (
                  <label
                    key={s.id}
                    style={{ ...S.muted, display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <input
                      type="checkbox"
                      checked={dServers.includes(s.id)}
                      onChange={(e) =>
                        setDServers((v) =>
                          e.target.checked ? [...v, s.id] : v.filter((x) => x !== s.id),
                        )
                      }
                    />
                    {s.name}{" "}
                    <span style={{ opacity: 0.6 }}>
                      · {s.framework === "hll-rcon" ? "WWII" : "Vietnam"}
                    </span>
                  </label>
                ))}
                <div style={{ ...S.muted, fontSize: 11.5 }}>
                  We watch from ten minutes before to ten minutes after, reading the roster every
                  two minutes.
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button style={S.btnQuiet} onClick={() => setFormOpen(false)} disabled={busy}>
                    Cancel
                  </button>
                  <button
                    style={S.btn}
                    onClick={createDrill}
                    disabled={busy || !dTitle.trim() || !dServers.length}
                  >
                    Schedule
                  </button>
                </div>
              </div>
            </div>
          )}
          {drills.length === 0 && servers.length > 0 && (
            <div style={S.card}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "rgba(236,242,250,.95)" }}>
                No drills yet.
              </div>
              <div style={{ ...S.muted, marginTop: 6 }}>
                Schedule one and the server takes the attendance: everyone on the roll who was on
                the box through the window is Present, the rest are Absent until an officer says
                LOA, ELOA, AWOL or Excused. Names that turned up but are not on the roll are listed
                so you can add them in one click.
              </div>
            </div>
          )}
          {drills.map((d) => {
            const c =
              d.status === "RUNNING"
                ? "#8FBF7F"
                : d.status === "DONE"
                  ? "rgba(148,163,184,.8)"
                  : accent;
            return (
              <div
                key={d.id}
                style={{ ...S.card, cursor: "pointer" }}
                onClick={() => setOpen(d.id)}
              >
                <div style={{ ...S.row, justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: "rgba(236,242,250,.95)" }}>
                    {d.title}
                  </div>
                  <span style={{ ...S.badge, color: c, border: `1px solid ${c}55` }}>
                    {d.status === "RUNNING" ? "TAKING ATTENDANCE" : d.status}
                  </span>
                </div>
                <div style={{ ...S.muted, marginTop: 4, fontSize: 12 }}>
                  {fmtWhen(d.windowStart)} →{" "}
                  {new Date(d.windowEnd).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {d.polls > 0 && (
                    <span>
                      {" "}
                      · {d.seen} seen over {d.polls} reads
                    </span>
                  )}
                </div>
                {canManage && (
                  <div style={{ marginTop: 8 }}>
                    <button
                      style={{ ...S.btnQuiet, fontSize: 11, padding: "3px 8px", opacity: 0.7 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeDrill(d);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {part === "roll" && (
        <>
          {canManage && (
            <div style={S.card}>
              <div style={S.kick}>Add to the roll</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  style={{ ...S.input, flex: 1, minWidth: 160 }}
                  placeholder="In-game name, exactly as the server shows it"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addOne()}
                />
                <input
                  style={{ ...S.input, width: 140 }}
                  placeholder="Squad"
                  value={addSquad}
                  onChange={(e) => setAddSquad(e.target.value)}
                />
                <button style={S.btn} onClick={addOne} disabled={busy || !addName.trim()}>
                  Add
                </button>
              </div>
              <div style={{ ...S.muted, marginTop: 10, fontSize: 12 }}>
                Or paste a list, one per line, with an optional comma and squad:
              </div>
              <textarea
                style={{
                  ...S.input,
                  width: "100%",
                  minHeight: 70,
                  marginTop: 6,
                  boxSizing: "border-box",
                }}
                placeholder={"Saltz, First Squad\nJeewa, First Squad\nSanchez, Second Squad"}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <button style={S.btnQuiet} onClick={importPaste} disabled={busy || !paste.trim()}>
                  Import
                </button>
              </div>
            </div>
          )}
          {roll.length === 0 && (
            <div style={S.card}>
              <div style={S.muted}>
                The roll is empty.{" "}
                {canManage
                  ? "Add the platoon above, or paste the roster."
                  : "An officer adds the platoon here."}
              </div>
            </div>
          )}
          {(["ACTIVE", "RESERVE", "INACTIVE"] as const).map((st) =>
            grouped[st].length ? (
              <div key={st}>
                <div style={S.kick}>
                  {st.toLowerCase()} · {grouped[st].length}
                </div>
                <div style={S.card}>
                  {grouped[st].map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        padding: "4px 0",
                        fontSize: 12.5,
                      }}
                    >
                      <span
                        style={{ color: "rgba(236,242,250,.92)", fontWeight: 600, minWidth: 140 }}
                      >
                        {m.name}
                      </span>
                      <span style={{ ...S.muted, flex: 1 }}>{m.squad}</span>
                      {canManage && (
                        <>
                          <select
                            style={{ ...S.input, padding: "3px 6px", fontSize: 11 }}
                            value={m.status}
                            onChange={(e) => setMember(m, { status: e.target.value as any })}
                          >
                            <option>ACTIVE</option>
                            <option>RESERVE</option>
                            <option>INACTIVE</option>
                          </select>
                          <button
                            style={{
                              ...S.btnQuiet,
                              fontSize: 11,
                              padding: "3px 8px",
                              opacity: 0.6,
                            }}
                            onClick={() => removeMember(m)}
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </>
      )}

      {part === "quarter" && <Quarter lobbyId={lobbyId} accent={accent} />}
    </div>
  );
}

function quarterBounds(): [string, string] {
  const now = new Date();
  const qs = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
  return [qs.toISOString().slice(0, 10), now.toISOString().slice(0, 10)];
}

function Quarter({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const base = `${API}/muster/${encodeURIComponent(lobbyId)}`;
  const [[from, to], setRange] = useState<[string, string]>(quarterBounds());
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch(`${base}/summary?from=${from}&to=${to}T23:59:59Z`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j?.ok && setData(j))
      .catch(() => {});
  }, [base, from, to]);
  const csv = `${base}/summary?from=${from}&to=${to}T23:59:59Z&format=csv`;
  return (
    <>
      <div style={{ ...S.row, marginTop: 12, flexWrap: "wrap" }}>
        <input
          style={S.input}
          type="date"
          value={from}
          onChange={(e) => setRange([e.target.value, to])}
        />
        <span style={S.muted}>to</span>
        <input
          style={S.input}
          type="date"
          value={to}
          onChange={(e) => setRange([from, e.target.value])}
        />
        <a href={csv} style={{ ...S.btnQuiet, textDecoration: "none", marginLeft: "auto" }}>
          Download CSV
        </a>
      </div>
      {!data ? (
        <div style={{ ...S.muted, marginTop: 10 }}>Adding it up…</div>
      ) : (
        <div style={{ ...S.card, marginTop: 10, overflowX: "auto" }}>
          <div style={{ ...S.muted, marginBottom: 8, fontSize: 12 }}>
            {data.drills.length} drill{data.drills.length === 1 ? "" : "s"} in range. Leave does not
            count against anyone.
          </div>
          <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 420 }}>
            <thead>
              <tr
                style={{ color: accent, textAlign: "left", fontSize: 10.5, letterSpacing: ".08em" }}
              >
                <th style={{ padding: "4px 8px 4px 0" }}>NAME</th>
                <th style={{ padding: "4px 8px" }}>SQUAD</th>
                <th style={{ padding: "4px 8px" }}>STATUS</th>
                <th style={{ padding: "4px 8px", textAlign: "right" }}>ATTENDED</th>
                <th style={{ padding: "4px 8px", textAlign: "right" }}>HELD</th>
                <th style={{ padding: "4px 8px", textAlign: "right" }}>%</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m: any) => (
                <tr key={m.name} style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
                  <td
                    style={{
                      padding: "4px 8px 4px 0",
                      color: "rgba(236,242,250,.92)",
                      fontWeight: 600,
                    }}
                  >
                    {m.name}
                  </td>
                  <td style={{ padding: "4px 8px", color: "rgba(148,163,184,.8)" }}>{m.squad}</td>
                  <td style={{ padding: "4px 8px", color: "rgba(148,163,184,.8)", fontSize: 11 }}>
                    {m.rollStatus}
                  </td>
                  <td
                    style={{
                      padding: "4px 8px",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {m.attended}
                  </td>
                  <td
                    style={{
                      padding: "4px 8px",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {m.held}
                  </td>
                  <td
                    style={{
                      padding: "4px 8px",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      color:
                        m.pct == null
                          ? "rgba(148,163,184,.5)"
                          : m.pct >= 75
                            ? "#8FBF7F"
                            : m.pct >= 50
                              ? "#E0B653"
                              : "#e8a08c",
                    }}
                  >
                    {m.pct == null ? "—" : `${m.pct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
