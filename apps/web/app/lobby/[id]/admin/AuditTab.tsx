"use client";
import { useState } from "react";
import { AdminAudit, S, fmtDate } from "./shared";

export function AuditTab({ lobbyId, initialLogs }: { lobbyId: string; initialLogs: AdminAudit[] }) {
  const [logs] = useState(initialLogs);
  const [filter, setFilter] = useState("");

  const actionColor = (a: string) => {
    if (a.includes("kick") || a.includes("delete") || a.includes("ban"))
      return "rgba(239,68,68,.85)";
    if (a.includes("role") || a.includes("rename")) return "rgba(124,58,237,.95)";
    if (a.includes("branding") || a.includes("module")) return "rgba(14,165,233,.85)";
    if (a.includes("pin")) return "rgba(245,158,11,.85)";
    return "rgba(148,163,184,.75)";
  };

  const filtered = filter.trim()
    ? logs.filter((l) =>
        (l.type + l.actorName + (l.note || "")).toLowerCase().includes(filter.toLowerCase()),
      )
    : logs;

  return (
    <div>
      <input
        style={{ ...S.input, marginBottom: 14 }}
        placeholder="Filter audit log..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
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
              style={{ color: actionColor(l.type), fontWeight: 700, minWidth: 130, flexShrink: 0 }}
            >
              {l.type}
            </span>
            <span style={{ opacity: 0.8, flexShrink: 0 }}>{l.actorName}</span>
            {l.note && (
              <span
                style={{
                  opacity: 0.5,
                  fontFamily: "monospace",
                  fontSize: 10,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {l.note}
              </span>
            )}
            <span style={{ marginLeft: "auto", opacity: 0.35, whiteSpace: "nowrap", fontSize: 11 }}>
              {fmtDate(l.ts)}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ opacity: 0.4, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
            No audit entries.
          </div>
        )}
      </div>
    </div>
  );
}
