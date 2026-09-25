"use client";

import React, { useEffect, useState } from "react";
import {
  VA,
  HEAD_FONT,
  Locked,
  SampleBanner,
  StatusChip,
  ago,
  hhmm,
  landingColor,
  vaFetch,
  type Airline,
  type Pirep,
  type PirepStatus,
} from "./vaShared";

/** The airline's PIREP log: every report, newest first, as vAMSYS files them. */

const FILTERS: { id: "" | PirepStatus; label: string }[] = [
  { id: "", label: "All" },
  { id: "ACCEPTED", label: "Accepted" },
  { id: "AWAITING_REVIEW", label: "Awaiting review" },
  { id: "REJECTED", label: "Rejected" },
];

export default function VaLogbook({
  lobbyId,
  airline,
  signedIn,
  onOpenPilot,
}: {
  lobbyId: string;
  airline: Airline | null;
  signedIn: boolean;
  onOpenPilot: (id: string) => void;
}) {
  const [status, setStatus] = useState<"" | PirepStatus>("");
  const [fleet, setFleet] = useState("");
  const [rows, setRows] = useState<Pirep[] | null>(null);
  const [total, setTotal] = useState(0);
  const [http, setHttp] = useState(0);

  useEffect(() => {
    const qs = new URLSearchParams({
      limit: "120",
      ...(status ? { status } : {}),
      ...(fleet ? { fleet } : {}),
    });
    const load = () =>
      vaFetch<{ pireps: Pirep[]; total: number }>(
        `/va/${encodeURIComponent(lobbyId)}/pireps?${qs}`,
      ).then((r) => {
        setHttp(r.status);
        if (r.status === 200 && r.data) {
          setRows(r.data.pireps);
          setTotal(r.data.total);
        }
      });
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [lobbyId, status, fleet]);

  if (http === 401 || http === 403)
    return <Locked need="crew" signedIn={signedIn} airline={airline} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SampleBanner text="Sample reports, filed by the demo airline's simulated flights. In production this is vAMSYS's PIREP feed, read through the Operations API." />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {FILTERS.map((f) => (
          <button
            key={f.id || "all"}
            type="button"
            className={`va-seg${status === f.id ? " on" : ""}`}
            onClick={() => setStatus(f.id)}
          >
            {f.label}
          </button>
        ))}
        <select
          value={fleet}
          onChange={(e) => setFleet(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${VA.line}`,
            background: VA.deep,
            color: VA.text,
          }}
        >
          <option value="">All types</option>
          <option value="A320-200">A320-200</option>
          <option value="A330-200">A330-200</option>
          <option value="A330-300">A330-300</option>
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: VA.muted }}>
          {total.toLocaleString("en-GB")} reports this month
        </span>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${VA.line}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 820 }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,.25)", color: VA.muted, textAlign: "left" }}>
              {[
                "Filed",
                "Flight",
                "Route",
                "Pilot",
                "Aircraft",
                "Block",
                "Landing",
                "Points",
                "Status",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 12px",
                    fontFamily: HEAD_FONT,
                    fontWeight: 600,
                    fontSize: 12,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((p) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${VA.line}` }}>
                <td style={{ padding: "9px 12px", color: VA.muted, whiteSpace: "nowrap" }}>
                  {ago(p.filedAt)}
                </td>
                <td
                  style={{
                    padding: "9px 12px",
                    fontFamily: HEAD_FONT,
                    fontSize: 16,
                    letterSpacing: ".04em",
                  }}
                >
                  {p.callsign}
                </td>
                <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                  {p.dep} <span style={{ color: VA.faint }}>→</span> {p.arr}
                </td>
                <td style={{ padding: "9px 12px" }}>
                  {p.pilotId ? (
                    <button
                      type="button"
                      onClick={() => onOpenPilot(p.pilotId!)}
                      style={{
                        background: "none",
                        border: 0,
                        padding: 0,
                        color: VA.ice,
                        cursor: "pointer",
                        textDecoration: "underline dotted",
                        textUnderlineOffset: 3,
                      }}
                    >
                      {p.pilotName}
                    </button>
                  ) : null}
                </td>
                <td style={{ padding: "9px 12px", color: VA.muted, whiteSpace: "nowrap" }}>
                  {p.fleet} <span style={{ color: VA.faint }}>{p.reg}</span>
                </td>
                <td style={{ padding: "9px 12px", fontVariantNumeric: "tabular-nums" }}>
                  {hhmm(p.blockMinutes)}
                </td>
                <td
                  style={{
                    padding: "9px 12px",
                    color: landingColor(p.landingRateFpm),
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.landingRateFpm} fpm{" "}
                  <span style={{ color: VA.faint, fontSize: 11 }}>{p.gForce.toFixed(2)}g</span>
                </td>
                <td style={{ padding: "9px 12px", fontVariantNumeric: "tabular-nums" }}>
                  {p.points}
                </td>
                <td style={{ padding: "9px 12px" }}>
                  <StatusChip status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows && <div style={{ padding: 30, color: VA.muted }}>Loading reports…</div>}
        {rows && !rows.length && (
          <div style={{ padding: 30, color: VA.muted }}>No reports match.</div>
        )}
      </div>
    </div>
  );
}
