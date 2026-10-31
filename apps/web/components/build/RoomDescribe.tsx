"use client";

// Describe a room (James 2026-10-31: "a movie night room with a watch party"):
// a name, what it opens with and who gets in, shown for a yes before it's made.
// Lives in the lobby's room directory, beside the plain name box.
import React, { useState } from "react";
import DescribeBox from "./DescribeBox";
import Proposal from "./Proposal";
import { describeJob } from "../../lib/aiBuild";
import { API, authHeaders } from "../../lib/apiClient";

type RoomPlan = { name: string; opens: string; who: "anyone" | "members" | "crew" | "staff"; minLevel: number };

const OPENS: Record<string, string> = {
  text: "Chat only",
  voice: "Voice",
  video: "Cams on",
  screen: "Screen share",
  youtube: "Watch YouTube together",
  twitch: "Watch a Twitch stream",
  browser: "Browse together",
  article: "Read together",
  poker: "Poker",
  chess: "Chess",
  dnd: "A tabletop session",
  study: "A focus timer",
  fakeout: "The trading game",
};
const WHO: Record<string, string> = {
  anyone: "Anyone who visits",
  members: "Members of this lobby",
  crew: "Trusted members and up",
  staff: "Staff only",
};

export default function RoomDescribe({
  lobbyId,
  accent,
  onMade,
}: {
  lobbyId: string;
  accent: string;
  /** The new room's id: the directory opens it. */
  onMade: (roomId: string) => void;
}) {
  const [plan, setPlan] = useState<RoomPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function make() {
    if (!plan) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`${API}/rooms`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: plan.name,
          lobbyId,
          defaultModule: plan.opens === "text" ? null : plan.opens,
          minLevel: plan.minLevel,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok && j.id) {
        setPlan(null);
        onMade(String(j.id));
      } else setErr(j?.message || "Couldn't make the room.");
    } catch {
      setErr("Couldn't reach Weered.");
    }
    setBusy(false);
  }

  return (
    <>
      <DescribeBox
        kind="room"
        accent={accent}
        className="db-in-tab"
        label="Or describe it"
        placeholder="A movie night room with a watch party"
        onBuild={async (prompt) => {
          const j = await describeJob<RoomPlan>("room", prompt, { lobbyId });
          setPlan(j.result);
          setErr("");
          return { summary: j.summary || "Here it is." };
        }}
      />
      {plan && (
        <Proposal
          accent={accent}
          title={plan.name}
          action="Make the room"
          busy={busy}
          error={err}
          onAction={make}
          onDismiss={() => setPlan(null)}
        >
          <dl>
            <dt>Opens with</dt>
            <dd>{OPENS[plan.opens] || plan.opens}</dd>
            <dt>Who gets in</dt>
            <dd>{WHO[plan.who] || plan.who}</dd>
          </dl>
        </Proposal>
      )}
    </>
  );
}
