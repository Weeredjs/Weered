"use client";
import { useCallback, useEffect, useState } from "react";
import { AuditLog, apiFetch } from "./shared";
import { ago, words } from "./TodayTab";

/** A few words on what changed, from the entry's meta. */
function detail(l: AuditLog): string {
  const m = l.meta || {};
  if (m.from && m.to) return `${m.from} → ${m.to}`;
  if (m.tier) return String(m.tier);
  if (m.did) return words(m.did);
  if (m.decision) return words(m.decision);
  if (m.note) return `“${String(m.note).slice(0, 80)}”`;
  if (m.reason) return `“${String(m.reason).slice(0, 80)}”`;
  return "";
}

const TONE: [RegExp, string][] = [
  [/ban|kick|delete|close|clear|remove/, "248 113 113"],
  [/role|tier|subscription/, "var(--o-a)"],
  [/appeal|report|bug/, "251 191 36"],
];
const toneOf = (a: string) => TONE.find(([re]) => re.test(a))?.[1] || "var(--o-mute)";

// Every staff action (2026-11-02: actions on anything but a person failed to
// save, and appeals, bug reports and outreach were never recorded).
export function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async (before?: string) => {
    setLoading(true);
    const j = await apiFetch(
      `/staff/audit${before ? `?before=${encodeURIComponent(before)}` : ""}`,
    ).catch(() => null);
    const page: AuditLog[] = j?.logs || [];
    setLogs((cur) => (before ? [...cur, ...page] : page));
    setMore(!!j?.more);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const f = filter.trim().toLowerCase();
  const shown = f
    ? logs.filter((l) =>
        `${l.action} ${words(l.action)} ${l.actorName} ${l.targetName || ""}`
          .toLowerCase()
          .includes(f),
      )
    : logs;

  return (
    <div style={{ maxWidth: 920 }}>
      <div className="wops-tool">
        <input
          className="wops-input"
          placeholder="Filter by action, staff member or target"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter the audit log"
        />
      </div>
      <div className="wops-card" style={{ padding: "4px 16px" }}>
        {shown.length === 0 && !loading ? (
          <div className="wops-muted" style={{ padding: "10px 0" }}>
            Nothing recorded{f ? " that matches" : ""}.
          </div>
        ) : (
          <div className="wops-feed">
            {shown.map((l) => {
              const d = detail(l);
              return (
                <div key={l.id} className="wops-feed-row">
                  <b style={{ flex: "0 0 auto" }}>{l.actorName || "Staff"}</b>
                  <span>
                    <span style={{ color: `rgb(${toneOf(l.action)})`, fontWeight: 600 }}>
                      {words(l.action)}
                    </span>
                    {l.targetName ? ` · ${l.targetName}` : ""}
                    {d ? <span className="wops-note"> · {d}</span> : null}
                  </span>
                  <span className="wops-when" title={new Date(l.createdAt).toLocaleString()}>
                    {ago(l.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {loading && (
        <div className="wops-muted" style={{ marginTop: 10 }}>
          Loading…
        </div>
      )}
      {more && !loading && (
        <button
          type="button"
          className="wops-btn"
          style={{ marginTop: 12 }}
          onClick={() => void load(logs[logs.length - 1]?.createdAt)}
        >
          Older entries
        </button>
      )}
    </div>
  );
}
