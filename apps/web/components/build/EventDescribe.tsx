"use client";

// Describe an event (James 2026-10-31: "Raid Friday 8pm, six spots, sherpa
// run"): the words become an event, or a run of weekly ones, shown for a yes
// before anything is posted. Used by the lobby's Events tab and Admin → Events.
import React, { useState } from "react";
import DescribeBox from "./DescribeBox";
import Proposal from "./Proposal";
import { describeJob } from "../../lib/aiBuild";
import { API, authHeaders } from "../../lib/apiClient";

type EventPlan = {
  title: string;
  startsAt: string;
  endsAt: string | null;
  details: string;
  category: string;
  repeatWeeks: number;
};

const fmt = (iso: string) => {
  try {
    return new Date(iso).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

/** The same wall-clock time `weeks` later here (setDate keeps it across DST). */
function weeksLater(iso: string, weeks: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + 7 * weeks);
  return d.toISOString();
}

export default function EventDescribe({
  lobbyId,
  accent,
  onCreated,
}: {
  lobbyId: string;
  accent: string;
  onCreated: () => void;
}) {
  const [plan, setPlan] = useState<EventPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function post() {
    if (!plan) return;
    setBusy(true);
    setErr("");
    let made = 0;
    for (let i = 0; i < Math.max(1, plan.repeatWeeks); i++) {
      try {
        const r = await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/events`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            title: plan.title,
            description: plan.details,
            category: plan.category,
            startsAt: weeksLater(plan.startsAt, i),
            endsAt: plan.endsAt ? weeksLater(plan.endsAt, i) : null,
            status: "PUBLISHED",
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.ok) break;
        made++;
      } catch {
        break;
      }
    }
    setBusy(false);
    if (made === 0) {
      setErr("Couldn't post the event.");
      return;
    }
    if (made < plan.repeatWeeks) setErr(`Posted ${made} of ${plan.repeatWeeks}; the rest didn't go through.`);
    else setPlan(null);
    onCreated();
  }

  return (
    <>
      <DescribeBox
        kind="event"
        accent={accent}
        className="db-in-tab"
        label="Describe an event"
        placeholder="Raid Friday 8pm, six spots, sherpa run"
        examples={["Movie night Saturday at 9", "Raid every Tuesday at 8, Warlocks welcome"]}
        onBuild={async (prompt) => {
          const j = await describeJob<EventPlan>("event", prompt, { lobbyId });
          setPlan(j.result);
          setErr("");
          return { summary: j.summary || "Here it is." };
        }}
      />
      {plan && (
        <Proposal
          accent={accent}
          title={plan.title}
          action={plan.repeatWeeks > 1 ? `Post all ${plan.repeatWeeks}` : "Post it"}
          busy={busy}
          error={err}
          onAction={post}
          onDismiss={() => setPlan(null)}
        >
          <dl>
            <dt>When</dt>
            <dd>
              {fmt(plan.startsAt)}
              {plan.endsAt ? ` to ${fmt(plan.endsAt)}` : ""}
            </dd>
            {plan.repeatWeeks > 1 && (
              <>
                <dt>Repeats</dt>
                <dd>Every week, {plan.repeatWeeks} times</dd>
              </>
            )}
            {plan.category && (
              <>
                <dt>Kind</dt>
                <dd>{plan.category}</dd>
              </>
            )}
            {plan.details && (
              <>
                <dt>Details</dt>
                <dd>{plan.details}</dd>
              </>
            )}
          </dl>
        </Proposal>
      )}
    </>
  );
}
