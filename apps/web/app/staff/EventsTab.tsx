"use client";
import { StaffEvent } from "./BroadcastTab";
import { useState, useEffect, useCallback } from "react";
import { GlobalRole, S, apiFetch } from "./shared";

export const EVENT_STATUS_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  DRAFT: {
    bg: "rgba(255,255,255,.05)",
    border: "rgba(255,255,255,.15)",
    color: "rgba(255,255,255,.6)",
  },
  PUBLISHED: {
    bg: "rgba(16,185,129,.10)",
    border: "rgba(16,185,129,.30)",
    color: "rgb(167,243,208)",
  },
  CANCELED: { bg: "rgba(239,68,68,.10)", border: "rgba(239,68,68,.30)", color: "rgb(252,165,165)" },
  COMPLETED: {
    bg: "rgba(14,165,233,.10)",
    border: "rgba(14,165,233,.28)",
    color: "rgb(186,230,253)",
  },
};

export const PROMO_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  NONE: { bg: "transparent", border: "transparent", color: "transparent" },
  PENDING: {
    bg: "rgba(245,158,11,.10)",
    border: "rgba(245,158,11,.30)",
    color: "rgb(253,230,138)",
  },
  APPROVED: {
    bg: "rgba(16,185,129,.10)",
    border: "rgba(16,185,129,.30)",
    color: "rgb(167,243,208)",
  },
  DENIED: { bg: "rgba(239,68,68,.10)", border: "rgba(239,68,68,.30)", color: "rgb(252,165,165)" },
};

export function StatusBadge({ status }: { status: string }) {
  const c = EVENT_STATUS_COLORS[status] || EVENT_STATUS_COLORS.DRAFT;
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        fontWeight: 700,
        letterSpacing: ".4px",
      }}
    >
      {status}
    </span>
  );
}

export function PromoBadge({ status }: { status: string }) {
  if (status === "NONE") return null;
  const c = PROMO_COLORS[status] || PROMO_COLORS.NONE;
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        fontWeight: 700,
        letterSpacing: ".4px",
      }}
    >
      {status}
    </span>
  );
}

export function EventsTab({ myRole }: { myRole: GlobalRole }) {
  const [view, setView] = useState<"all" | "promotions" | "create">("all");
  const [events, setEvents] = useState<StaffEvent[]>([]);
  const [promos, setPromos] = useState<StaffEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    coverImageUrl: "",
    startsAt: "",
    endsAt: "",
    timezone: "UTC",
    status: "DRAFT",
    broadcastOnPublish: false,
  });
  const [creating, setCreating] = useState(false);

  const loadEvents = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (scopeFilter) params.set("scope", scopeFilter);
    if (search) params.set("q", search);
    const j = await apiFetch(`/staff/events?${params}`);
    if (j.ok) setEvents(j.events);
    setLoading(false);
  }, [statusFilter, scopeFilter, search]);

  const loadPromos = useCallback(async () => {
    const j = await apiFetch("/staff/events/promotions");
    if (j.ok) setPromos(j.events);
  }, []);

  useEffect(() => {
    loadEvents();
    loadPromos();
  }, [loadEvents, loadPromos]);

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
    const j = await apiFetch("/staff/events", {
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
        coverImageUrl: "",
        startsAt: "",
        endsAt: "",
        timezone: "UTC",
        status: "DRAFT",
        broadcastOnPublish: false,
      });
      setView("all");
      loadEvents();
    } else setMsg(j.error || "Failed.");
  }

  async function updateEvent(id: string, data: any) {
    const j = await apiFetch(`/staff/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (j.ok) {
      setMsg("Updated.");
      loadEvents();
    } else setMsg(j.error || "Failed.");
  }

  async function deleteEvent(id: string) {
    const j = await apiFetch(`/staff/events/${id}`, { method: "DELETE" });
    if (j.ok) {
      setMsg("Deleted.");
      setSelected(null);
      loadEvents();
    } else setMsg(j.error || "Failed.");
  }

  async function reviewPromo(id: string, decision: string, reason?: string) {
    const j = await apiFetch(`/staff/events/${id}/promotion-review`, {
      method: "POST",
      body: JSON.stringify({ decision, reason }),
    });
    if (j.ok) {
      setMsg(`${decision}.`);
      loadPromos();
      loadEvents();
    } else setMsg(j.error || "Failed.");
  }

  const fmtDate = (s: string) => {
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  };

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

      <div style={{ display: "flex", gap: 8 }}>
        <button style={view === "all" ? S.btnPri : S.btn} onClick={() => setView("all")}>
          All Events
        </button>
        <button
          style={view === "promotions" ? S.btnPri : S.btn}
          onClick={() => setView("promotions")}
        >
          Promotions{" "}
          {promos.length > 0 && (
            <span
              style={{
                marginLeft: 4,
                fontSize: 10,
                padding: "1px 5px",
                borderRadius: 999,
                background: "rgba(245,158,11,.20)",
                color: "rgb(253,230,138)",
              }}
            >
              {promos.length}
            </span>
          )}
        </button>
        <button style={{ ...S.success, marginLeft: "auto" }} onClick={() => setView("create")}>
          + Create Global Event
        </button>
      </div>

      {view === "create" && (
        <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={S.sectionTitle}>Create Global Event</div>
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
                placeholder="ban_court, raid_night, watch_party..."
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 18 }}>
              <input
                type="checkbox"
                checked={form.broadcastOnPublish}
                onChange={(e) => setForm((f) => ({ ...f, broadcastOnPublish: e.target.checked }))}
              />
              <span style={{ fontSize: 12, opacity: 0.7 }}>Broadcast on publish</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btnPri} onClick={createEvent} disabled={creating}>
              {creating ? "Creating..." : "Create Event"}
            </button>
            <button style={S.btn} onClick={() => setView("all")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {view === "all" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              style={{ ...S.input, flex: 1 }}
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              style={{ ...S.input, width: 120, appearance: "auto" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="CANCELED">Canceled</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <select
              style={{ ...S.input, width: 100, appearance: "auto" }}
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
            >
              <option value="">All Scope</option>
              <option value="global">Global</option>
              <option value="lobby">Lobby</option>
            </select>
          </div>
          {loading && <div style={{ opacity: 0.4, fontSize: 13 }}>Loading...</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {events.map((ev) => (
              <div
                key={ev.id}
                style={{
                  ...S.card,
                  cursor: "pointer",
                  transition: "border-color .1s",
                  borderColor: selected === ev.id ? "rgba(124,58,237,.35)" : undefined,
                }}
                onClick={() => setSelected(selected === ev.id ? null : ev.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{ev.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                      {fmtDate(ev.startsAt)} {ev.lobby ? `· ${ev.lobby.name}` : "· GLOBAL"}{" "}
                      {ev.category && `· ${ev.category}`}
                    </div>
                  </div>
                  <StatusBadge status={ev.status} />
                  <PromoBadge status={ev.promotionStatus} />
                </div>
                {selected === ev.id && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: "1px solid rgba(255,255,255,.07)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {ev.description && (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{ev.description}</div>
                    )}
                    <div style={{ fontSize: 11, opacity: 0.5 }}>
                      Created by {ev.createdByName} · {fmtDate(ev.createdAt)}
                    </div>
                    {ev.promotionNote && (
                      <div style={{ fontSize: 11, opacity: 0.6 }}>
                        Promo note: {ev.promotionNote}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {ev.status === "DRAFT" && (
                        <button
                          style={S.success}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateEvent(ev.id, { status: "PUBLISHED" });
                          }}
                        >
                          Publish
                        </button>
                      )}
                      {ev.status === "PUBLISHED" && (
                        <button
                          style={S.btn}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateEvent(ev.id, { status: "COMPLETED" });
                          }}
                        >
                          Complete
                        </button>
                      )}
                      {ev.status !== "CANCELED" && (
                        <button
                          style={S.warn}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateEvent(ev.id, { status: "CANCELED" });
                          }}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        style={S.danger}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEvent(ev.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!loading && events.length === 0 && (
              <div style={{ opacity: 0.4, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                No events found.
              </div>
            )}
          </div>
        </div>
      )}

      {view === "promotions" && (
        <div>
          <div style={S.sectionTitle}>Pending Promotion Requests</div>
          {promos.length === 0 && (
            <div style={{ opacity: 0.4, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
              No pending requests.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {promos.map((ev) => (
              <div key={ev.id} style={S.card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{ev.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.5 }}>
                      {ev.lobby?.name || "Unknown lobby"} · {fmtDate(ev.startsAt)}
                    </div>
                  </div>
                  <StatusBadge status={ev.status} />
                </div>
                {ev.description && (
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                    {ev.description}
                  </div>
                )}
                {ev.promotionNote && (
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.6,
                      marginBottom: 8,
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: "rgba(245,158,11,.06)",
                      border: "1px solid rgba(245,158,11,.15)",
                    }}
                  >
                    "{ev.promotionNote}"
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={S.success} onClick={() => reviewPromo(ev.id, "APPROVED")}>
                    Approve
                  </button>
                  <button
                    style={S.danger}
                    onClick={() => {
                      const r = prompt("Deny reason (optional):");
                      reviewPromo(ev.id, "DENIED", r || undefined);
                    }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
