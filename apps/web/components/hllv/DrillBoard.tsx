"use client";
// One drill's attendance: who on the roll was there, by the server's count,
// with an officer's hand on top. Refreshes itself while the drill runs.
import React, { useEffect, useState } from "react";
import { API, authHeaders, S } from "./shared";
import { STATUS_COLOR } from "./Muster";

type Row = {
  name: string;
  nameKey: string;
  squad: string;
  rollStatus: string;
  auto: string;
  status: string;
  manual: boolean;
  note: string;
  seenPolls: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  clan: string;
};
type Unlisted = { name: string; nameKey: string; clan: string; seenPolls: number; auto: string };
type View = {
  drill: {
    id: string;
    title: string;
    windowStart: string;
    windowEnd: string;
    polls: number;
    status: string;
  };
  rows: Row[];
  unlisted: Unlisted[];
  counts: {
    present: number;
    partial: number;
    absent: number;
    leave: number;
    excused: number;
    roll: number;
  };
};

const MARKS = ["PRESENT", "LOA", "ELOA", "AWOL", "EXCUSED"] as const;

export default function DrillBoard({
  lobbyId,
  drillId,
  accent,
  canManage,
  onBack,
  onRollChanged,
}: {
  lobbyId: string;
  drillId: string;
  accent: string;
  canManage: boolean;
  onBack: () => void;
  onRollChanged: () => void;
}) {
  const base = `${API}/muster/${encodeURIComponent(lobbyId)}`;
  const [v, setV] = useState<View | null>(null);
  const [busy, setBusy] = useState("");

  const load = async () => {
    try {
      const j = await fetch(`${base}/drills/${drillId}`, { cache: "no-store" }).then((r) =>
        r.json(),
      );
      if (j?.ok) setV(j);
    } catch {}
  };
  useEffect(() => {
    void load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillId]);

  const mark = async (nameKey: string, status: string) => {
    setBusy(nameKey);
    try {
      await fetch(`${base}/drills/${drillId}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ nameKey, status }),
      });
      await load();
    } finally {
      setBusy("");
    }
  };
  const addToRoll = async (u: Unlisted) => {
    setBusy(u.nameKey);
    try {
      await fetch(`${base}/roll`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: u.name }),
      });
      onRollChanged();
      await load();
    } finally {
      setBusy("");
    }
  };

  if (!v) return <div style={{ ...S.muted, marginTop: 12 }}>Opening the drill…</div>;
  const d = v.drill;
  const running = d.status === "RUNNING";
  const t = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

  return (
    <div>
      <div style={{ ...S.row, marginTop: 12, flexWrap: "wrap" }}>
        <button style={S.btnQuiet} onClick={onBack}>
          ← Drills
        </button>
        <div style={{ fontWeight: 800, fontSize: 14, color: "rgba(236,242,250,.95)" }}>
          {d.title}
        </div>
        <span
          style={{
            ...S.badge,
            color: running ? "#8FBF7F" : accent,
            border: `1px solid ${running ? "#8FBF7F55" : accent + "55"}`,
          }}
        >
          {running ? "TAKING ATTENDANCE" : d.status}
        </span>
      </div>
      <div style={{ ...S.muted, marginTop: 4, fontSize: 12 }}>
        {new Date(d.windowStart).toLocaleString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}{" "}
        → {t(d.windowEnd)} · {d.polls} read{d.polls === 1 ? "" : "s"} of the server so far
        {d.status === "SCHEDULED" && " · nothing yet; the watch starts ten minutes before"}
      </div>

      <div style={{ ...S.card, marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          ["Present", v.counts.present, STATUS_COLOR.PRESENT],
          ["Partial", v.counts.partial, STATUS_COLOR.PARTIAL],
          ["Absent", v.counts.absent, STATUS_COLOR.AWOL],
          ["On leave", v.counts.leave, STATUS_COLOR.LOA],
          ["Excused", v.counts.excused, STATUS_COLOR.EXCUSED],
        ].map(([l, n, c]) => (
          <div key={String(l)}>
            <div style={{ ...S.big, fontSize: 22, color: String(c) }}>{n as number}</div>
            <div
              style={{
                ...S.muted,
                fontSize: 10.5,
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              {l}
            </div>
          </div>
        ))}
        <div style={{ marginLeft: "auto", alignSelf: "center", ...S.muted, fontSize: 11.5 }}>
          of {v.counts.roll} on the roll
        </div>
      </div>

      {v.rows.length === 0 && (
        <div style={S.card}>
          <div style={S.muted}>
            The roll is empty, so there is nobody to mark. Add the platoon on the Roll tab.
          </div>
        </div>
      )}

      {v.rows.length > 0 && (
        <div style={{ ...S.card, overflowX: "auto" }}>
          {v.rows.map((r) => (
            <div
              key={r.nameKey}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "5px 0",
                borderTop: "1px solid rgba(255,255,255,.04)",
                fontSize: 12.5,
                flexWrap: "wrap",
              }}
            >
              <span style={{ minWidth: 150, color: "rgba(236,242,250,.92)", fontWeight: 600 }}>
                {r.clan && <span style={{ color: accent, marginRight: 5 }}>[{r.clan}]</span>}
                {r.name}
              </span>
              <span style={{ ...S.muted, minWidth: 90, fontSize: 11.5 }}>{r.squad}</span>
              <span
                style={{
                  ...S.badge,
                  color: STATUS_COLOR[r.status] || "rgba(226,232,240,.8)",
                  border: `1px solid ${(STATUS_COLOR[r.status] || "#888") + "55"}`,
                  minWidth: 64,
                  textAlign: "center",
                }}
              >
                {r.status}
                {r.manual ? " ✎" : ""}
              </span>
              <span style={{ ...S.muted, fontSize: 11, minWidth: 120 }}>
                {r.seenPolls > 0
                  ? `${r.seenPolls}/${d.polls} reads · ${t(r.firstSeenAt)}–${t(r.lastSeenAt)}`
                  : d.polls > 0
                    ? "not seen"
                    : ""}
              </span>
              {canManage && (
                <span style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                  {MARKS.map((m) => (
                    <button
                      key={m}
                      disabled={busy === r.nameKey}
                      onClick={() => mark(r.nameKey, m)}
                      style={{
                        ...S.btnQuiet,
                        fontSize: 10,
                        padding: "2px 7px",
                        color: r.manual && r.status === m ? STATUS_COLOR[m] : undefined,
                        borderColor: r.manual && r.status === m ? STATUS_COLOR[m] : undefined,
                      }}
                    >
                      {m}
                    </button>
                  ))}
                  {r.manual && (
                    <button
                      disabled={busy === r.nameKey}
                      onClick={() => mark(r.nameKey, "AUTO")}
                      style={{ ...S.btnQuiet, fontSize: 10, padding: "2px 7px", opacity: 0.7 }}
                      title="Back to what the server said"
                    >
                      auto
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {v.unlisted.length > 0 && (
        <>
          <div style={S.kick}>On the server, not on the roll · {v.unlisted.length}</div>
          <div style={S.card}>
            {v.unlisted.map((u) => (
              <div
                key={u.nameKey}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "4px 0",
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: "rgba(236,242,250,.85)", minWidth: 150 }}>
                  {u.clan && <span style={{ color: accent, marginRight: 5 }}>[{u.clan}]</span>}
                  {u.name}
                </span>
                <span style={{ ...S.muted, fontSize: 11 }}>
                  {u.seenPolls}/{d.polls} reads
                </span>
                {canManage && (
                  <button
                    style={{ ...S.btnQuiet, fontSize: 10, padding: "2px 8px", marginLeft: "auto" }}
                    disabled={busy === u.nameKey}
                    onClick={() => addToRoll(u)}
                  >
                    + Add to roll
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ ...S.muted, fontSize: 11.5, marginTop: 6 }}>
        Present means seen in at least two reads and a quarter of them; one read is Partial. A
        pencil means an officer set it. Leave and Excused never count against anyone in the quarter.
      </div>
    </div>
  );
}
