"use client";

// A member's alerts (James 2026-10-31: "ping me when four people are in the War
// Room"): Weered pings them when a room fills up to their number, once each
// time it does (30 minutes apart at most). Described or picked; lives in the
// lobby's room directory. api routes/lobbyExtras.ts saves, lib/lobbyAutomations.ts
// watches.
import React, { useCallback, useEffect, useState } from "react";
import DescribeBox from "./DescribeBox";
import Proposal from "./Proposal";
import { describeJob } from "../../lib/aiBuild";
import { alerts as api, extrasErrorText, type AlertSpec, type Automation } from "../../lib/lobbyExtras";

export default function AlertsPanel({
  lobbyId,
  lobbyName,
  accent,
  rooms,
}: {
  lobbyId: string;
  lobbyName: string;
  accent: string;
  rooms: { id: string; name: string }[];
}) {
  const [mine, setMine] = useState<Automation<AlertSpec>[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [plan, setPlan] = useState<AlertSpec | null>(null);
  const [roomId, setRoomId] = useState(lobbyId);
  const [n, setN] = useState(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    api
      .list(lobbyId)
      .then((a) => {
        setMine(a);
        setDenied(false);
      })
      .catch(() => {
        setMine([]);
        setDenied(true);
      });
  }, [lobbyId]);
  useEffect(() => load(), [load]);

  async function add(id: string, threshold: number) {
    setBusy(true);
    setErr("");
    try {
      await api.add(lobbyId, id, threshold);
      setPlan(null);
      load();
    } catch (e) {
      setErr(extrasErrorText(e));
    }
    setBusy(false);
  }

  const all = [{ id: lobbyId, name: `${lobbyName} (the lobby's chat)` }, ...rooms];
  const box: React.CSSProperties = {
    marginBottom: 18,
    padding: "14px 16px",
    borderRadius: 12,
    border: `1px solid ${accent}28`,
    background: `${accent}08`,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };

  if (denied)
    return (
      <div style={box}>
        <div style={{ fontSize: 12.5, opacity: 0.75 }}>Join this lobby to set alerts.</div>
      </div>
    );

  return (
    <div style={box}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(243,244,246,.85)" }}>
        Ping me when a room fills up
      </div>
      <DescribeBox
        kind="alert"
        accent={accent}
        placeholder="Ping me when four people are in the War Room"
        onBuild={async (prompt) => {
          const j = await describeJob<AlertSpec | null>("alert", prompt, { lobbyId });
          setPlan(j.result);
          setErr(j.result ? "" : "Couldn't tell which room. Pick it below.");
          return { summary: j.result ? j.summary || "Here it is." : "Pick the room below." };
        }}
      />
      {plan && (
        <Proposal
          accent={accent}
          title={`${plan.threshold} in ${plan.roomName}`}
          action="Set the alert"
          busy={busy}
          error={err}
          onAction={() => add(plan.roomId, plan.threshold)}
          onDismiss={() => setPlan(null)}
        >
          Weered pings you when {plan.threshold} people are in {plan.roomName}.
        </Proposal>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
        <span style={{ opacity: 0.65 }}>Or:</span>
        <input
          type="number"
          min={2}
          max={50}
          value={n}
          onChange={(e) => setN(Math.max(2, Math.min(50, Number(e.target.value) || 2)))}
          style={{
            width: 56,
            padding: "6px 8px",
            borderRadius: 8,
            border: `1px solid ${accent}22`,
            background: "rgba(0,0,0,.3)",
            color: "#f3f4f6",
            fontSize: 12,
          }}
        />
        <span style={{ opacity: 0.65 }}>people in</span>
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          style={{
            flex: 1,
            minWidth: 140,
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${accent}22`,
            background: "rgba(0,0,0,.3)",
            color: "#f3f4f6",
            fontSize: 12,
          }}
        >
          {all.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={() => add(roomId, n)}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: `1px solid ${accent}44`,
            background: `${accent}22`,
            color: "#f3f4f6",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Add
        </button>
      </div>
      {err && !plan && <div style={{ fontSize: 11.5, color: "#fca5a5" }}>{err}</div>}
      {mine && mine.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {mine.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                padding: "6px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,.04)",
              }}
            >
              <span aria-hidden>🔔</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {a.spec.threshold} in {a.spec.roomName}
                {a.lastResult ? <span style={{ opacity: 0.5 }}> · {a.lastResult}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => api.remove(lobbyId, a.id).then(load, load)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,.14)",
                  background: "transparent",
                  color: "rgba(243,244,246,.75)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
