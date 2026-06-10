"use client";

import React, { useCallback, useEffect, useState } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

type EventItem = {
  id: string; title: string; description: string; category: string;
  startsAt: string; endsAt: string | null; status: string;
  promotionStatus: string;
};

export default function LobbyEvents({ lobbyId, accent }: { lobbyId: string; accent?: string }) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/events`);
    if (j.ok) setEvents(j.events.filter((e: EventItem) => e.status === "PUBLISHED"));
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState label="Loading events" />;
  if (events.length === 0) return <EmptyState title="Nothing on the calendar." hint="When events drop they'll show up here." />;

  const color = accent || "#7C3AED";

  return (
    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flex: 1 }}>
      {events.map(ev => {
        const start = new Date(ev.startsAt);
        const month = start.toLocaleString("en-US", { month: "short" }).toUpperCase();
        const day = start.getDate();
        const time = start.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
        const isFeatured = ev.promotionStatus === "APPROVED";
        return (
          <div key={ev.id} style={{ display: "flex", gap: 14, padding: "14px 16px", borderRadius: 10, border: `1px solid ${isFeatured ? color + "44" : "rgba(255,255,255,.08)"}`, background: isFeatured ? color + "0A" : "rgba(255,255,255,.03)" }}>
            <div style={{ width: 48, flexShrink: 0, textAlign: "center", paddingTop: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".6px", color: color, opacity: 0.8 }}>{month}</div>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{day}</div>
              <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>{time}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{ev.title}</div>
                {isFeatured && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 999, background: `${color}22`, border: `1px solid ${color}44`, color: color, fontWeight: 700, letterSpacing: ".3px" }}>FEATURED</span>}
                {ev.category && <span style={{ fontSize: 10, opacity: 0.4 }}>{ev.category}</span>}
              </div>
              {ev.description && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4, lineHeight: 1.4 }}>{ev.description}</div>}
              {ev.endsAt && (
                <div style={{ fontSize: 10, opacity: 0.4, marginTop: 4 }}>
                  Ends {new Date(ev.endsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
