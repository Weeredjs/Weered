"use client";
import { ReportRow } from "./LobbiesTab";
import { REASON_LABELS } from "./AppealsTab";
import { useState, useEffect } from "react";
import { apiFetch } from "./shared";

export function ReportsTab() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"OPEN" | "REVIEWED" | "ACTIONED" | "DISMISSED" | "ALL">(
    "OPEN",
  );
  const [busyId, setBusyId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const j = await apiFetch(`/staff/reports?status=${filter}`);
      setReports(Array.isArray(j?.reports) ? j.reports : []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [filter]);

  async function action(id: string, status: "REVIEWED" | "ACTIONED" | "DISMISSED") {
    setBusyId(id);
    try {
      const j = await apiFetch(`/staff/reports/${id}/action`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      if (j?.ok) setReports((cur) => cur.filter((r) => r.id !== id));
    } catch {}
    setBusyId("");
  }

  async function clearBranding(lobbyId: string, reportId: string) {
    setBusyId(reportId);
    try {
      const j = await apiFetch(`/staff/lobbies/${encodeURIComponent(lobbyId)}/clear-branding`, {
        method: "POST",
      });
      if (j?.ok) {
        await apiFetch(`/staff/reports/${reportId}/action`, {
          method: "POST",
          body: JSON.stringify({ status: "ACTIONED" }),
        });
        setReports((cur) => cur.filter((r) => r.id !== reportId));
      }
    } catch {}
    setBusyId("");
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Reports</h2>
        <div style={{ display: "flex", gap: 4 }}>
          {(["OPEN", "REVIEWED", "ACTIONED", "DISMISSED", "ALL"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,.1)",
                background: filter === s ? "rgba(124,58,237,.2)" : "rgba(255,255,255,.03)",
                color: filter === s ? "rgb(196,181,253)" : "rgba(255,255,255,.7)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ padding: 20, opacity: 0.5, fontSize: 13 }}>Loading reports...</div>}
      {!loading && reports.length === 0 && (
        <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "rgba(255,255,255,.65)" }}>
            {filter === "OPEN" ? "Queue is clear." : "No reports in this view."}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 3 }}>
            {filter === "OPEN"
              ? "When users flag things, they land here."
              : "Change the filter to see more."}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {reports.map((r) => (
          <div
            key={r.id}
            style={{
              padding: 14,
              borderRadius: 10,
              background: "rgba(255,255,255,.02)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: 5,
                  background: "rgba(239,68,68,.15)",
                  border: "1px solid rgba(239,68,68,.3)",
                  color: "rgb(252,165,165)",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: ".05em",
                }}
              >
                {REASON_LABELS[r.reason] || r.reason}
              </span>
              <span
                style={{ fontSize: 11, color: "rgba(255,255,255,.4)", fontFamily: "monospace" }}
              >
                {r.targetType}
              </span>
              {r.status !== "OPEN" && (
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: 5,
                    background: "rgba(255,255,255,.05)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,.5)",
                  }}
                >
                  {r.status}
                </span>
              )}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>
                {new Date(r.createdAt).toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginBottom: 6 }}>
              <strong>{r.reporterName}</strong> reported{" "}
              {r.targetType === "USER" ? (
                <strong>{r.targetName || r.targetId}</strong>
              ) : (
                <code style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>{r.targetId}</code>
              )}
              {r.context && (
                <>
                  {" "}
                  in{" "}
                  <code style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>{r.context}</code>
                </>
              )}
            </div>
            {r.bodySnapshot && (
              <div
                style={{
                  padding: "8px 10px",
                  marginTop: 4,
                  marginBottom: 8,
                  borderRadius: 7,
                  background: "rgba(0,0,0,.3)",
                  border: "1px solid rgba(255,255,255,.05)",
                  fontSize: 12,
                  color: "rgba(255,255,255,.82)",
                  fontStyle: "italic",
                  lineHeight: 1.45,
                }}
              >
                "{r.bodySnapshot}"
              </div>
            )}
            {r.note && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginBottom: 8 }}>
                <strong>Note:</strong> {r.note}
              </div>
            )}
            {r.reviewerName && r.reviewedAt && (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", marginBottom: 8 }}>
                {r.status.toLowerCase()} by {r.reviewerName} on{" "}
                {new Date(r.reviewedAt).toLocaleString()}
              </div>
            )}
            {r.status === "OPEN" && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  disabled={busyId === r.id}
                  onClick={() => action(r.id, "ACTIONED")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(34,197,94,.4)",
                    background: "rgba(34,197,94,.1)",
                    color: "rgb(134,239,172)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Actioned
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => action(r.id, "REVIEWED")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "rgba(255,255,255,.04)",
                    color: "rgba(255,255,255,.7)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Reviewed
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => action(r.id, "DISMISSED")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,.08)",
                    background: "transparent",
                    color: "rgba(255,255,255,.5)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Dismiss
                </button>
                {r.targetType === "LOBBY" && (
                  <>
                    <span style={{ flex: 1 }} />
                    <a
                      href={`/lobby/${r.targetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "rgba(255,255,255,.04)",
                        color: "rgba(255,255,255,.7)",
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        textDecoration: "none",
                      }}
                    >
                      View ↗
                    </a>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => clearBranding(r.targetId, r.id)}
                      title="Remove this lobby's logo + banner"
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid rgba(245,158,11,.45)",
                        background: "rgba(245,158,11,.12)",
                        color: "rgb(253,230,138)",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Clear branding
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
