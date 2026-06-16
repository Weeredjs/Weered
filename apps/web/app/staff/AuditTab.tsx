"use client";
import { useState, useEffect } from "react";
import { AuditLog, S, apiFetch, fmtDate } from "./shared";

export function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch("/staff/audit").then((j) => {
      setLogs(j.logs || []);
      setLoading(false);
    });
  }, []);

  const actionColor = (a: string) => {
    if (a.includes("kick") || a.includes("delete") || a.includes("ban"))
      return "rgba(239,68,68,.85)";
    if (a.includes("role") || a.includes("tier")) return "rgba(124,58,237,.95)";
    if (a.includes("note")) return "rgba(14,165,233,.85)";
    if (a.includes("lock")) return "rgba(245,158,11,.85)";
    if (a.includes("clear")) return "rgba(239,68,68,.65)";
    if (a.includes("featured") || a.includes("config")) return "rgba(16,185,129,.85)";
    return "rgba(148,163,184,.75)";
  };

  const filtered = filter.trim()
    ? logs.filter((l) =>
        (l.action + l.actorName + (l.targetName || ""))
          .toLowerCase()
          .includes(filter.toLowerCase()),
      )
    : logs;

  return (
    <div>
      <input
        style={{ ...S.input, marginBottom: 14 }}
        placeholder="Filter by action, actor, target…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {loading && <div style={{ opacity: 0.4 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {filtered.map((l) => (
          <div
            key={l.id}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.07)",
              background: "rgba(255,255,255,.02)",
              fontSize: 12,
            }}
          >
            <span
              style={{
                color: actionColor(l.action),
                fontWeight: 700,
                minWidth: 130,
                flexShrink: 0,
              }}
            >
              {l.action}
            </span>
            <span style={{ opacity: 0.8, flexShrink: 0 }}>{l.actorName}</span>
            {l.targetName && (
              <>
                <span style={{ opacity: 0.35 }}>→</span>
                <span style={{ opacity: 0.75 }}>{l.targetName}</span>
              </>
            )}
            {l.meta && (
              <span
                style={{
                  opacity: 0.4,
                  fontFamily: "monospace",
                  fontSize: 10,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {JSON.stringify(l.meta)}
              </span>
            )}
            <span style={{ marginLeft: "auto", opacity: 0.35, whiteSpace: "nowrap", fontSize: 11 }}>
              {fmtDate(l.createdAt)}
            </span>
          </div>
        ))}
        {!filtered.length && !loading && (
          <div style={{ opacity: 0.4, fontSize: 13 }}>No audit logs.</div>
        )}
      </div>
    </div>
  );
}

export type Announcement = {
  id: string;
  message: string;
  level: string;
  pinned: boolean;
  sticky: boolean;
  createdByName: string;
  createdAt: string;
};
