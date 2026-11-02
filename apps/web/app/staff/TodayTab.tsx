"use client";
import type { ReactNode } from "react";
import { ArrowRight, RefreshCw, TriangleAlert } from "lucide-react";
import type { NavId } from "./shared";

/** GET /staff/today (apps/api/src/routes/staffToday.ts). SUPPORT gets the queue only. */
export type TodayData = {
  ok: boolean;
  role: string;
  queue: {
    reports: {
      open: number;
      latest: {
        id: string;
        targetType: string;
        reason: string;
        note?: string | null;
        createdAt: string;
      }[];
    };
    appeals: { pending: number; oldest: { id: string; name: string; createdAt: string }[] };
    bugs: {
      open: number;
      latest: { id: string; category: string; page: string; body: string; createdAt: string }[];
    };
  };
  outreach?: {
    due: number;
    list: { id: string; name: string; company: string; date: string | null }[];
  };
  pulse?: {
    inRoomsNow: number;
    accounts: number;
    signups24h: number;
    messages24h: number;
    paying: number;
    tiered: number;
  };
  site?: {
    maintenanceMode: boolean;
    registrationOpen: boolean;
    registrationCap: number;
    waitlist: number;
    aiEnabled: boolean;
  };
  recent?: {
    id: string;
    actorName: string;
    action: string;
    targetName?: string | null;
    createdAt: string;
  }[];
};

export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** "HATE_SPEECH" → "Hate speech"; "tier_change" → "Tier change". */
export function words(code: string) {
  const t = String(code || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

const BUG_KIND: Record<string, string> = {
  BUG: "Bug",
  LOBBY_MODULE_REQUEST: "Module request",
  FEEDBACK: "Feedback",
};

/** A follow-up is a calendar date ("2026-11-20"): read it as local, never UTC. */
function followUp(date: string | null) {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const label = day.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return day < today ? `overdue since ${label}` : "due today";
}

function QueueCard({
  title,
  count,
  unit,
  calm,
  onOpen,
  children,
}: {
  title: string;
  count: number;
  unit: string;
  calm: string;
  onOpen: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="wops-card" data-tone={count ? "hot" : undefined}>
      <div className="wops-card-top">{title}</div>
      <div className="wops-big">
        {count}
        <small>{unit}</small>
      </div>
      {count ? <ul className="wops-list">{children}</ul> : <div className="wops-calm">{calm}</div>}
      <button type="button" className="wops-card-link" onClick={onOpen}>
        Open {title.toLowerCase()} <ArrowRight size={14} />
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="wops-card wops-stat">
      <div className="wops-card-top">{label}</div>
      <div className="wops-big">{value.toLocaleString()}</div>
    </div>
  );
}

export function TodayTab({
  data,
  error,
  onOpen,
  onRefresh,
  updatedAt,
}: {
  data: TodayData | null;
  error: string;
  onOpen: (id: NavId) => void;
  onRefresh: () => void;
  updatedAt: number;
}) {
  if (!data) return <div className="wops-muted">{error || "Loading…"}</div>;
  const { queue, outreach, pulse, site, recent } = data;
  const full = !!(site && site.registrationCap && pulse && pulse.accounts >= site.registrationCap);

  return (
    <div>
      {site?.maintenanceMode && (
        <div className="wops-alert" role="status">
          <TriangleAlert size={18} />
          Maintenance mode is on: members see the maintenance page.
          {data.role === "GOD" && (
            <button
              type="button"
              className="wops-btn"
              style={{ marginLeft: "auto" }}
              onClick={() => onOpen("config")}
            >
              Config
            </button>
          )}
        </div>
      )}

      <section className="wops-section">
        <h2 className="wops-section-title">
          Needs a person
          <small>
            Updated {ago(new Date(updatedAt).toISOString())} ·{" "}
            <button
              type="button"
              className="wops-card-link"
              style={{ margin: 0 }}
              onClick={onRefresh}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </small>
        </h2>
        <div className="wops-grid">
          <QueueCard
            title="Reports"
            count={queue.reports.open}
            unit="open"
            calm="Nothing reported."
            onOpen={() => onOpen("reports")}
          >
            {queue.reports.latest.slice(0, 3).map((r) => (
              <li key={r.id}>
                <b>{words(r.reason)}</b> on a {words(r.targetType).toLowerCase()}{" "}
                <span className="wops-when">{ago(r.createdAt)}</span>
              </li>
            ))}
          </QueueCard>
          <QueueCard
            title="Ban appeals"
            count={queue.appeals.pending}
            unit="waiting"
            calm="No one is waiting."
            onOpen={() => onOpen("appeals")}
          >
            {queue.appeals.oldest.map((a) => (
              <li key={a.id}>
                <b>{a.name || "Someone"}</b>{" "}
                <span className="wops-when">waiting {ago(a.createdAt).replace(" ago", "")}</span>
              </li>
            ))}
          </QueueCard>
          <QueueCard
            title="Bug reports"
            count={queue.bugs.open}
            unit="open"
            calm="No open bugs."
            onOpen={() => onOpen("bugs")}
          >
            {queue.bugs.latest.map((b) => (
              <li key={b.id}>
                <b>{BUG_KIND[b.category] || words(b.category)}</b> {b.body}{" "}
                <span className="wops-when">{ago(b.createdAt)}</span>
              </li>
            ))}
          </QueueCard>
          {outreach && (
            <QueueCard
              title="Follow-ups"
              count={outreach.due}
              unit="due"
              calm="No follow-ups due."
              onOpen={() => onOpen("outreach")}
            >
              {outreach.list.slice(0, 3).map((c) => (
                <li key={c.id}>
                  <b>{c.name}</b>
                  {c.company ? `, ${c.company}` : ""}{" "}
                  <span className="wops-when">{followUp(c.date)}</span>
                </li>
              ))}
            </QueueCard>
          )}
        </div>
      </section>

      {pulse && (
        <section className="wops-section">
          <h2 className="wops-section-title">
            Pulse <small>last 24 hours</small>
          </h2>
          <div
            className="wops-grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))" }}
          >
            <Stat label="In a room now" value={pulse.inRoomsNow} />
            <Stat label="New accounts" value={pulse.signups24h} />
            <Stat label="Messages" value={pulse.messages24h} />
            <Stat label="Accounts" value={pulse.accounts} />
            <Stat label="Paying" value={pulse.paying} />
            <Stat label="Hold a tier" value={pulse.tiered} />
          </div>
        </section>
      )}

      {site && (
        <section className="wops-section">
          <h2 className="wops-section-title">Site</h2>
          <div className="wops-chips">
            <span className="wops-chip">
              <i
                className="wops-dot"
                data-tone={!site.registrationOpen || full ? "warn" : undefined}
              />
              {!site.registrationOpen
                ? "Sign-ups closed"
                : full
                  ? "Sign-ups full"
                  : "Sign-ups open"}
              {site.registrationCap > 0 && pulse
                ? ` · ${pulse.accounts.toLocaleString()} of ${site.registrationCap.toLocaleString()}`
                : ""}
            </span>
            {site.waitlist > 0 && (
              <span className="wops-chip">
                <i className="wops-dot" data-tone="warn" />
                {site.waitlist.toLocaleString()} on the waitlist
              </span>
            )}
            <span className="wops-chip">
              <i className="wops-dot" data-tone={site.aiEnabled ? undefined : "off"} />
              AI {site.aiEnabled ? "on" : "off"}
            </span>
            <span className="wops-chip">
              <i className="wops-dot" data-tone={site.maintenanceMode ? "warn" : "off"} />
              Maintenance {site.maintenanceMode ? "on" : "off"}
            </span>
          </div>
        </section>
      )}

      {recent && (
        <section className="wops-section">
          <h2 className="wops-section-title">Recent staff actions</h2>
          <div className="wops-card">
            {recent.length === 0 ? (
              <div className="wops-muted">Nothing recorded yet.</div>
            ) : (
              <div className="wops-feed">
                {recent.map((a) => (
                  <div key={a.id} className="wops-feed-row">
                    <b>{a.actorName || "Staff"}</b>
                    <span>
                      {words(a.action)}
                      {a.targetName ? `: ${a.targetName}` : ""}
                    </span>
                    <span className="wops-when">{ago(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="wops-card-link" onClick={() => onOpen("audit")}>
              Open the audit log <ArrowRight size={14} />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
