"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { REASON_LABELS } from "./AppealsTab";
import { GlobalRole, STAFF_ERRORS, apiFetch, mayActOn } from "./shared";
import { ago } from "./TodayTab";

/** GET /staff/reports, with what each report is about (routes/staff.ts reportTargets). */
type Person = { id: string; usernameKey: string; role: string; banned: boolean };
type Target = {
  exists: boolean;
  name?: string;
  roomId?: string;
  lobbyId?: string | null;
  deleted?: boolean;
  person?: Person | null;
};
export type ReportRow = {
  id: string;
  reporterName: string;
  targetType: "MESSAGE" | "USER" | "ROOM" | "LOBBY";
  targetId: string;
  targetName: string | null;
  context: string | null;
  reason: string;
  note: string | null;
  status: string;
  bodySnapshot: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewerName: string | null;
  target: Target | null;
};

const FILTERS = ["OPEN", "ACTIONED", "REVIEWED", "DISMISSED", "ALL"] as const;
const FILTER_LABEL: Record<string, string> = {
  OPEN: "Open",
  ACTIONED: "Acted on",
  REVIEWED: "No action",
  DISMISSED: "Dismissed",
  ALL: "All",
};
const KIND: Record<string, string> = {
  MESSAGE: "a message",
  USER: "a person",
  ROOM: "a room",
  LOBBY: "a lobby",
};
const roomHref = (t: Target) =>
  t.lobbyId && t.lobbyId === t.roomId ? `/lobby/${t.lobbyId}` : `/room/${t.roomId}`;

// The Reports desk (2026-11-02): each report links to what it's about and
// offers the tool for its kind. "Acted on" is set by using a tool and records
// what was done; it used to be a label anyone could click (ops audit).
export function ReportsTab({ myRole }: { myRole: GlobalRole }) {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("OPEN");
  const [busy, setBusy] = useState("");
  const [flash, setFlash] = useState<{ text: string; bad?: boolean } | null>(null);
  const staff = myRole !== "SUPPORT";

  const load = useCallback(async () => {
    setLoading(true);
    const j = await apiFetch(`/staff/reports?status=${filter}`).catch(() => null);
    setReports(Array.isArray(j?.reports) ? j.reports : []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function close(r: ReportRow, status: "ACTIONED" | "REVIEWED" | "DISMISSED", did?: string) {
    const j = await apiFetch(`/staff/reports/${r.id}/action`, {
      method: "POST",
      body: JSON.stringify({ status, did }),
    });
    if (j?.ok) setReports((cur) => cur.filter((x) => x.id !== r.id || filter === "ALL"));
    return !!j?.ok;
  }

  /** Use a tool, then mark the report acted on with what was done. */
  async function act(r: ReportRow, did: string, label: string, run: () => Promise<any>) {
    setBusy(r.id);
    setFlash(null);
    const j = await run().catch(() => null);
    if (j?.ok) {
      await close(r, "ACTIONED", did);
      setFlash({ text: label });
    } else setFlash({ text: STAFF_ERRORS[j?.error] || j?.error || "That didn't work.", bad: true });
    setBusy("");
    if (filter === "ALL") void load();
  }

  const post = (url: string, body?: any) =>
    apiFetch(url, { method: "POST", body: JSON.stringify(body || {}) });

  function tools(r: ReportRow) {
    const t = r.target;
    if (!t?.exists) return <span className="wops-note">It no longer exists.</span>;
    const p = t.person;
    const out: ReactNode[] = [];
    if (r.targetType === "MESSAGE" && !t.deleted)
      out.push(
        <button
          key="rm"
          type="button"
          className="wops-btn"
          disabled={busy === r.id}
          onClick={() =>
            void act(r, "message_removed", "Message removed.", () =>
              post(`/staff/messages/${r.targetId}/delete`),
            )
          }
        >
          Remove message
        </button>,
      );
    if (p && mayActOn(myRole, p.role) && p.role !== "GOD") {
      out.push(
        <button
          key="kick"
          type="button"
          className="wops-btn"
          disabled={busy === r.id}
          onClick={() =>
            void act(r, "kicked", `${t.name || p.usernameKey} kicked for ten minutes.`, () =>
              post(`/staff/users/${p.id}/kick`),
            )
          }
        >
          Kick {r.targetType === "MESSAGE" ? "the author" : ""}
        </button>,
      );
      if (staff && !p.banned)
        out.push(
          <button
            key="ban"
            type="button"
            className="wops-btn"
            style={{ borderColor: "rgb(248 113 113 / .4)" }}
            disabled={busy === r.id}
            onClick={() => {
              if (!confirm(`Ban ${t.name || p.usernameKey} from Weered?`)) return;
              void act(r, "banned", `${t.name || p.usernameKey} is banned.`, () =>
                post(`/staff/users/${p.id}/ban`, {
                  reason: `Reported: ${REASON_LABELS[r.reason] || r.reason}`,
                }),
              );
            }}
          >
            Ban {r.targetType === "MESSAGE" ? "the author" : ""}
          </button>,
        );
    }
    if (r.targetType === "LOBBY" && staff)
      out.push(
        <button
          key="brand"
          type="button"
          className="wops-btn"
          disabled={busy === r.id}
          onClick={() =>
            void act(r, "branding_cleared", "Lobby branding cleared.", () =>
              post(`/staff/lobbies/${encodeURIComponent(r.targetId)}/clear-branding`),
            )
          }
        >
          Clear branding
        </button>,
      );
    if (r.targetType === "ROOM" && staff && t.roomId !== t.lobbyId)
      out.push(
        <button
          key="close"
          type="button"
          className="wops-btn"
          disabled={busy === r.id}
          onClick={() => {
            if (!confirm(`Close ${t.name}? This deletes the room and its history.`)) return;
            void act(r, "room_closed", "Room closed.", () =>
              post(`/staff/rooms/${encodeURIComponent(r.targetId)}/close`),
            );
          }}
        >
          Close room
        </button>,
      );
    if (p)
      out.push(
        <a
          key="who"
          className="wops-btn"
          href={`/staff?tab=users&q=${encodeURIComponent(p.usernameKey)}`}
        >
          {r.targetType === "MESSAGE" ? "Author" : "Person"} in Users
        </a>,
      );
    if (t.roomId)
      out.push(
        <a
          key="room"
          className="wops-btn"
          href={roomHref(t)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open room <ExternalLink size={13} />
        </a>,
      );
    if (r.targetType === "LOBBY")
      out.push(
        <a
          key="lobby"
          className="wops-btn"
          href={`/lobby/${encodeURIComponent(r.targetId)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open lobby <ExternalLink size={13} />
        </a>,
      );
    return out;
  }

  return (
    <div style={{ maxWidth: 920 }}>
      <div className="wops-tool">
        <div className="wops-seg" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
      </div>
      {flash && (
        <div className="wops-flash" data-tone={flash.bad ? "bad" : undefined} role="status">
          {flash.text}
        </div>
      )}
      {loading ? (
        <div className="wops-muted">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="wops-muted">
          {filter === "OPEN" ? "Nothing reported. The queue is clear." : "None here."}
        </div>
      ) : (
        <div className="wops-rows">
          {reports.map((r) => {
            const t = r.target;
            return (
              <div
                key={r.id}
                className="wops-card"
                data-tone={r.status === "OPEN" ? "hot" : undefined}
              >
                <div className="wops-card-top" style={{ flexWrap: "wrap" }}>
                  <b style={{ color: "var(--o-text)" }}>{REASON_LABELS[r.reason] || r.reason}</b>
                  <span>
                    on {KIND[r.targetType]}
                    {t?.name ? `: ${t.name}` : ""}
                  </span>
                  {r.status !== "OPEN" && (
                    <span className="wops-tag" data-tone="staff">
                      {FILTER_LABEL[r.status]}
                    </span>
                  )}
                  <span className="wops-when" style={{ marginLeft: "auto" }}>
                    {r.reporterName} · {ago(r.createdAt)}
                  </span>
                </div>
                {r.bodySnapshot && (
                  <blockquote
                    style={{
                      margin: "10px 0 0",
                      padding: "8px 12px",
                      borderLeft: "3px solid rgb(var(--o-a) / .5)",
                      background: "rgb(0 0 0 / .2)",
                      borderRadius: 8,
                      fontSize: 14,
                    }}
                  >
                    {r.bodySnapshot}
                    {t?.deleted && <span className="wops-note"> (removed)</span>}
                  </blockquote>
                )}
                {r.note && (
                  <div className="wops-note" style={{ marginTop: 8 }}>
                    Reporter&apos;s note: {r.note}
                  </div>
                )}
                {r.reviewerName && r.reviewedAt && (
                  <div className="wops-note" style={{ marginTop: 8 }}>
                    {FILTER_LABEL[r.status]} by {r.reviewerName}, {ago(r.reviewedAt)}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginTop: 12,
                    alignItems: "center",
                  }}
                >
                  {r.status === "OPEN" && tools(r)}
                  {r.status === "OPEN" && (
                    <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="wops-btn"
                        disabled={busy === r.id}
                        onClick={() => void close(r, "REVIEWED")}
                      >
                        No action needed
                      </button>
                      <button
                        type="button"
                        className="wops-btn"
                        disabled={busy === r.id}
                        onClick={() => void close(r, "DISMISSED")}
                      >
                        Dismiss
                      </button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
