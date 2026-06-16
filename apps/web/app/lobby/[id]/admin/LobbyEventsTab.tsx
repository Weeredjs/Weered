"use client";
import { useState, useEffect, useCallback } from "react";
import { S, apiFetch, fmtDate } from "./shared";
import { EventStatusBadge } from "./ChallengesTab";
import { LobbyEvent } from "./TiersTab";

export function LobbyEventsTab({
  lobbyId,
  myLevel,
  overrideRole,
  onRefresh,
}: {
  lobbyId: string;
  myLevel: number;
  overrideRole: string | null;
  onRefresh: () => void;
}) {
  const [events, setEvents] = useState<LobbyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    startsAt: "",
    endsAt: "",
    status: "DRAFT",
  });
  const [promoNote, setPromoNote] = useState("");
  const [promoEventId, setPromoEventId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/events`);
    if (j.ok) setEvents(j.events);
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function createEvent() {
    if (!form.title.trim()) {
      setMsg("Title required.");
      return;
    }
    if (!form.startsAt) {
      setMsg("Start date required.");
      return;
    }
    setCreating(true);
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/events`, {
      method: "POST",
      body: JSON.stringify({
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      }),
    });
    setCreating(false);
    if (j.ok) {
      setMsg(`Created "${j.event.title}".`);
      setForm({
        title: "",
        description: "",
        category: "",
        startsAt: "",
        endsAt: "",
        status: "DRAFT",
      });
      load();
      onRefresh();
    } else setMsg(j.error || "Failed.");
  }

  async function updateStatus(id: string, status: string) {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (j.ok) {
      setMsg("Updated.");
      load();
    } else setMsg(j.error || "Failed.");
  }

  async function deleteEvent(id: string) {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/events/${id}`, {
      method: "DELETE",
    });
    if (j.ok) {
      setMsg("Deleted.");
      load();
    } else setMsg(j.error || "Failed.");
  }

  async function requestPromotion(id: string) {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/events/${id}/promote`, {
      method: "POST",
      body: JSON.stringify({ note: promoNote }),
    });
    if (j.ok) {
      setMsg("Promotion requested.");
      setPromoEventId(null);
      setPromoNote("");
      load();
    } else setMsg(j.error || "Failed.");
  }

  const isOwner = overrideRole || myLevel >= 5;
  const fmtDate = (s: string) => {
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  };

  if (loading) return <div style={{ opacity: 0.4, fontSize: 13 }}>Loading events...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {msg && (
        <div
          style={{
            fontSize: 12,
            color: "rgba(167,243,208,.9)",
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(16,185,129,.08)",
            border: "1px solid rgba(16,185,129,.25)",
          }}
        >
          {msg}
        </div>
      )}

      <div>
        <div style={S.sectionTitle}>Create Event</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={S.label}>Title</div>
            <input
              style={S.input}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <div style={S.label}>Category</div>
            <input
              style={S.input}
              placeholder="raid_night, watch_party..."
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={S.label}>Description</div>
            <input
              style={S.input}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <div style={S.label}>Starts At</div>
            <input
              style={S.input}
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            />
          </div>
          <div>
            <div style={S.label}>Ends At</div>
            <input
              style={S.input}
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
            />
          </div>
          <div>
            <div style={S.label}>Status</div>
            <select
              style={{ ...S.input, appearance: "auto" }}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>
        </div>
        <button style={{ ...S.btnPri, marginTop: 12 }} onClick={createEvent} disabled={creating}>
          {creating ? "Creating..." : "Create Event"}
        </button>
      </div>

      <div>
        <div style={S.sectionTitle}>Events</div>
        {events.length === 0 && (
          <div style={{ opacity: 0.4, fontSize: 13, padding: "16px 0", textAlign: "center" }}>
            No events yet.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {events.map((ev) => (
            <div key={ev.id} style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{ev.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                    {fmtDate(ev.startsAt)} {ev.category && `· ${ev.category}`}
                  </div>
                </div>
                <EventStatusBadge status={ev.status} />
                {ev.promotionStatus !== "NONE" && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 7px",
                      borderRadius: 999,
                      background:
                        ev.promotionStatus === "APPROVED"
                          ? "rgba(16,185,129,.10)"
                          : ev.promotionStatus === "DENIED"
                            ? "rgba(239,68,68,.10)"
                            : "rgba(245,158,11,.10)",
                      border: `1px solid ${ev.promotionStatus === "APPROVED" ? "rgba(16,185,129,.30)" : ev.promotionStatus === "DENIED" ? "rgba(239,68,68,.30)" : "rgba(245,158,11,.30)"}`,
                      color:
                        ev.promotionStatus === "APPROVED"
                          ? "rgb(167,243,208)"
                          : ev.promotionStatus === "DENIED"
                            ? "rgb(252,165,165)"
                            : "rgb(253,230,138)",
                      fontWeight: 700,
                      letterSpacing: ".4px",
                    }}
                  >
                    {ev.promotionStatus}
                  </span>
                )}
              </div>
              {ev.description && (
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>{ev.description}</div>
              )}
              {ev.promotionStatus === "DENIED" && ev.promotionDenyReason && (
                <div
                  style={{ fontSize: 11, opacity: 0.6, marginTop: 4, color: "rgb(252,165,165)" }}
                >
                  Denied: {ev.promotionDenyReason}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {ev.status === "DRAFT" && (
                  <button style={S.success} onClick={() => updateStatus(ev.id, "PUBLISHED")}>
                    Publish
                  </button>
                )}
                {ev.status === "PUBLISHED" && (
                  <button style={S.btn} onClick={() => updateStatus(ev.id, "COMPLETED")}>
                    Complete
                  </button>
                )}
                {ev.status !== "CANCELED" && (
                  <button
                    style={{ ...S.btn, color: "rgb(253,230,138)" }}
                    onClick={() => updateStatus(ev.id, "CANCELED")}
                  >
                    Cancel
                  </button>
                )}
                <button style={S.danger} onClick={() => deleteEvent(ev.id)}>
                  Delete
                </button>
                {isOwner &&
                  ev.status === "PUBLISHED" &&
                  ev.promotionStatus === "NONE" &&
                  (promoEventId === ev.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        style={{ ...S.input, width: 180, fontSize: 11 }}
                        placeholder="Pitch to staff (optional)"
                        value={promoNote}
                        onChange={(e) => setPromoNote(e.target.value)}
                      />
                      <button style={S.btnPri} onClick={() => requestPromotion(ev.id)}>
                        Send
                      </button>
                      <button style={S.btn} onClick={() => setPromoEventId(null)}>
                        X
                      </button>
                    </div>
                  ) : (
                    <button style={S.btnPri} onClick={() => setPromoEventId(ev.id)}>
                      Request Promotion
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
