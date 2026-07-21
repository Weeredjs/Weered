"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  return r.json();
}

type EventItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  promotionStatus: string;
};

export default function LobbyEvents({
  lobbyId,
  accent,
  canPost = false,
}: {
  lobbyId: string;
  accent?: string;
  canPost?: boolean;
}) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fWhen, setFWhen] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/events`);
    if (j.ok) setEvents(j.events.filter((e: EventItem) => e.status === "PUBLISHED"));
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!fTitle.trim() || !fWhen) return;
    setBusy(true);
    setErr("");
    try {
      const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/events`, {
        method: "POST",
        body: JSON.stringify({
          title: fTitle.trim(),
          description: fDesc.trim(),
          startsAt: new Date(fWhen).toISOString(),
          status: "PUBLISHED",
        }),
      });
      if (j?.ok) {
        setFormOpen(false);
        setFTitle("");
        setFWhen("");
        setFDesc("");
        await load();
      } else {
        setErr(j?.error === "forbidden" ? "Lobby admins only." : "Couldn't post the event.");
      }
    } catch {
      setErr("Couldn't post the event.");
    }
    setBusy(false);
  };

  if (loading) return <LoadingState label="Loading events" />;

  const color = accent || "#7C3AED";
  const inputStyle: CSSProperties = {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(0,0,0,.25)",
    color: "rgba(236,242,250,.95)",
    fontSize: 13,
  };

  const postBar = canPost && (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 10,
        padding: formOpen ? "12px 14px" : "8px 14px",
        background: "rgba(255,255,255,.02)",
      }}
    >
      {formOpen ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            style={inputStyle}
            placeholder="Event title: Seed night on The Outpost"
            value={fTitle}
            maxLength={120}
            onChange={(e) => setFTitle(e.target.value)}
          />
          <input
            style={inputStyle}
            type="datetime-local"
            value={fWhen}
            onChange={(e) => setFWhen(e.target.value)}
          />
          <input
            style={inputStyle}
            placeholder="Details (optional)"
            value={fDesc}
            maxLength={300}
            onChange={(e) => setFDesc(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={create}
              disabled={busy || !fTitle.trim() || !fWhen}
              style={{
                padding: "7px 16px",
                borderRadius: 6,
                border: `1px solid ${color}66`,
                background: `${color}22`,
                color: color,
                fontWeight: 700,
                fontSize: 12.5,
                cursor: "pointer",
                opacity: busy || !fTitle.trim() || !fWhen ? 0.55 : 1,
              }}
            >
              {busy ? "Posting…" : "Post event"}
            </button>
            <button
              onClick={() => setFormOpen(false)}
              style={{
                padding: "7px 12px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,.14)",
                background: "transparent",
                color: "rgba(226,232,240,.8)",
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
          {err && <div style={{ fontSize: 12, color: "#E08A83" }}>{err}</div>}
        </div>
      ) : (
        <button
          onClick={() => setFormOpen(true)}
          style={{
            background: "transparent",
            border: "none",
            color: color,
            fontWeight: 700,
            fontSize: 12.5,
            cursor: "pointer",
            padding: 0,
          }}
        >
          + Post an event
        </button>
      )}
    </div>
  );

  if (events.length === 0)
    return (
      <div
        style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}
      >
        {postBar}
        <EmptyState
          title="Nothing on the calendar."
          hint={
            canPost
              ? "Post the first one: a seed night, a fight night, an org op."
              : "When events drop they'll show up here."
          }
        />
      </div>
    );

  return (
    <div
      style={{
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflowY: "auto",
        flex: 1,
      }}
    >
      {postBar}
      {events.map((ev) => {
        const start = new Date(ev.startsAt);
        const month = start.toLocaleString("en-US", { month: "short" }).toUpperCase();
        const day = start.getDate();
        const time = start.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
        const isFeatured = ev.promotionStatus === "APPROVED";
        return (
          <div
            key={ev.id}
            style={{
              display: "flex",
              gap: 14,
              padding: "14px 16px",
              borderRadius: 10,
              border: `1px solid ${isFeatured ? color + "44" : "rgba(255,255,255,.08)"}`,
              background: isFeatured ? color + "0A" : "rgba(255,255,255,.03)",
            }}
          >
            <div style={{ width: 48, flexShrink: 0, textAlign: "center", paddingTop: 2 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".6px",
                  color: color,
                  opacity: 0.8,
                }}
              >
                {month}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{day}</div>
              <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>{time}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{ev.title}</div>
                {isFeatured && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: `${color}22`,
                      border: `1px solid ${color}44`,
                      color: color,
                      fontWeight: 700,
                      letterSpacing: ".3px",
                    }}
                  >
                    FEATURED
                  </span>
                )}
                {ev.category && <span style={{ fontSize: 10, opacity: 0.4 }}>{ev.category}</span>}
              </div>
              {ev.description && (
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4, lineHeight: 1.4 }}>
                  {ev.description}
                </div>
              )}
              {ev.endsAt && (
                <div style={{ fontSize: 10, opacity: 0.4, marginTop: 4 }}>
                  Ends{" "}
                  {new Date(ev.endsAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
