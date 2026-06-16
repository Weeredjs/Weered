"use client";
import { useState, useEffect, useCallback } from "react";
import { S, apiFetch } from "./shared";

export const OUTREACH_STATUSES = [
  "LEAD",
  "CONTACTED",
  "REPLIED",
  "IN_PROGRESS",
  "PARTNERED",
  "DECLINED",
  "STALE",
] as const;
export const OUTREACH_CATEGORIES = [
  "GAME_STUDIO",
  "ESPORTS_ORG",
  "CONTENT_CREATOR",
  "BRAND_SPONSOR",
  "MEDIA",
  "COMMUNITY",
  "PLATFORM",
  "OTHER",
] as const;

export const STATUS_COLORS: Record<string, string> = {
  LEAD: "rgba(148,163,184,.8)",
  CONTACTED: "rgba(96,165,250,.8)",
  REPLIED: "rgba(253,230,138,.8)",
  IN_PROGRESS: "rgba(129,140,248,.8)",
  PARTNERED: "rgba(110,231,183,.8)",
  DECLINED: "rgba(252,165,165,.8)",
  STALE: "rgba(148,163,184,.4)",
};
export const STATUS_BG: Record<string, string> = {
  LEAD: "rgba(148,163,184,.08)",
  CONTACTED: "rgba(96,165,250,.08)",
  REPLIED: "rgba(253,230,138,.08)",
  IN_PROGRESS: "rgba(129,140,248,.08)",
  PARTNERED: "rgba(110,231,183,.08)",
  DECLINED: "rgba(252,165,165,.08)",
  STALE: "rgba(148,163,184,.04)",
};

export function OutreachTab() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

  const [fName, setFName] = useState("");
  const [fCompany, setFCompany] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fRole, setFRole] = useState("");
  const [fCategory, setFCategory] = useState<string>("OTHER");
  const [fStatus, setFStatus] = useState<string>("LEAD");
  const [fNotes, setFNotes] = useState("");
  const [fPostUrl, setFPostUrl] = useState("");
  const [fFollowUp, setFFollowUp] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (catFilter) params.set("category", catFilter);
    apiFetch(`/staff/outreach?${params.toString()}`)
      .then((j) => {
        if (j.ok) setContacts(j.contacts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter, catFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setFName("");
    setFCompany("");
    setFEmail("");
    setFRole("");
    setFCategory("OTHER");
    setFStatus("LEAD");
    setFNotes("");
    setFPostUrl("");
    setFFollowUp("");
    setEditing(null);
  }

  function editContact(c: any) {
    setFName(c.name);
    setFCompany(c.company);
    setFEmail(c.email || "");
    setFRole(c.role || "");
    setFCategory(c.category);
    setFStatus(c.status);
    setFNotes(c.notes || "");
    setFPostUrl(c.postUrl || "");
    setFFollowUp(c.nextFollowUp ? c.nextFollowUp.slice(0, 10) : "");
    setEditing(c);
    setShowForm(true);
  }

  async function save() {
    const body: any = {
      name: fName,
      company: fCompany,
      email: fEmail,
      role: fRole,
      category: fCategory,
      status: fStatus,
      notes: fNotes,
      postUrl: fPostUrl,
      nextFollowUp: fFollowUp || null,
    };

    if (editing) {
      const j = await apiFetch(`/staff/outreach/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (j.ok) {
        setMsg("Updated.");
        setShowForm(false);
        resetForm();
        load();
      } else setMsg(j.error || "Failed.");
    } else {
      const j = await apiFetch("/staff/outreach", { method: "POST", body: JSON.stringify(body) });
      if (j.ok) {
        setMsg("Added.");
        setShowForm(false);
        resetForm();
        load();
      } else setMsg(j.error || "Failed.");
    }
  }

  async function remove(id: string) {
    const j = await apiFetch(`/staff/outreach/${id}`, { method: "DELETE" });
    if (j.ok) load();
  }

  async function quickStatus(id: string, status: string) {
    const j = await apiFetch(`/staff/outreach/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        lastContact: status !== "LEAD" ? new Date().toISOString() : undefined,
      }),
    });
    if (j.ok) load();
  }

  if (loading) return <div style={{ opacity: 0.4 }}>Loading outreach...</div>;

  const total = contacts.length;
  const byStatus: Record<string, number> = {};
  contacts.forEach((c) => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  });

  const displayContacts = contacts.filter((c) => {
    if (!searchQ.trim()) return true;
    const q = searchQ.toLowerCase();
    return (c.name + " " + c.company + " " + (c.notes || "") + " " + (c.category || ""))
      .toLowerCase()
      .includes(q);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {OUTREACH_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? "" : s)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              border:
                filter === s ? `1px solid ${STATUS_COLORS[s]}` : "1px solid rgba(255,255,255,.06)",
              background: filter === s ? STATUS_BG[s] : "rgba(255,255,255,.02)",
              color: STATUS_COLORS[s],
            }}
          >
            {s.replace("_", " ")} ({byStatus[s] || 0})
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          style={{ ...S.input, width: 180, fontSize: 11, cursor: "pointer" }}
        >
          <option value="">All Categories</option>
          {OUTREACH_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <span style={{ fontSize: 12, opacity: 0.4 }}>{total} contacts</span>
          <button
            style={S.btnPri}
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
          >
            {showForm && !editing ? "Cancel" : "+ Add Contact"}
          </button>
        </div>
      </div>

      {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}

      {showForm && (
        <div
          style={{
            ...S.card,
            border: "1px solid rgba(124,58,237,.25)",
            background: "rgba(124,58,237,.04)",
          }}
        >
          <div style={{ ...S.label, marginBottom: 10 }}>
            {editing ? "Edit Contact" : "New Contact"}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <div style={S.label}>Name *</div>
              <input
                style={S.input}
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <div style={S.label}>Company *</div>
              <input
                style={S.input}
                value={fCompany}
                onChange={(e) => setFCompany(e.target.value)}
                placeholder="Riot Games"
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <div style={S.label}>Email</div>
              <input
                style={S.input}
                value={fEmail}
                onChange={(e) => setFEmail(e.target.value)}
                placeholder="jane@riot.com"
              />
            </div>
            <div>
              <div style={S.label}>Role / Title</div>
              <input
                style={S.input}
                value={fRole}
                onChange={(e) => setFRole(e.target.value)}
                placeholder="Community Manager"
              />
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}
          >
            <div>
              <div style={S.label}>Category</div>
              <select
                style={{ ...S.input, cursor: "pointer" }}
                value={fCategory}
                onChange={(e) => setFCategory(e.target.value)}
              >
                {OUTREACH_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={S.label}>Status</div>
              <select
                style={{ ...S.input, cursor: "pointer" }}
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value)}
              >
                {OUTREACH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={S.label}>Follow-up Date</div>
              <input
                type="date"
                style={S.input}
                value={fFollowUp}
                onChange={(e) => setFFollowUp(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={S.label}>Notes</div>
            <textarea
              style={{ ...S.input, minHeight: 60, resize: "vertical" }}
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              placeholder="Context, thread links, what was discussed..."
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={S.label}>Post / Thread URL</div>
            <input
              style={S.input}
              value={fPostUrl}
              onChange={(e) => setFPostUrl(e.target.value)}
              placeholder="https://reddit.com/r/DnD/comments/..."
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save}>
              {editing ? "Update" : "Save"}
            </button>
            {editing && (
              <button
                style={S.btn}
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      <input
        placeholder="Search contacts..."
        value={searchQ}
        onChange={(e) => setSearchQ(e.target.value)}
        style={{ ...S.input, fontSize: 12 }}
      />

      <div
        style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.2fr 90px 90px 40px",
            gap: 0,
            padding: "8px 12px",
            background: "rgba(255,255,255,.03)",
            borderBottom: "1px solid rgba(255,255,255,.06)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".06em",
            textTransform: "uppercase" as const,
            color: "rgba(255,255,255,.3)",
          }}
        >
          <span>Name / Company</span>
          <span>Category</span>
          <span>Status</span>
          <span>Action</span>
          <span></span>
        </div>

        {displayContacts.map((c) => {
          const sColor = STATUS_COLORS[c.status] || "rgba(255,255,255,.5)";
          const overdue = c.nextFollowUp && new Date(c.nextFollowUp) < new Date();
          const isExpanded = expandedContact === c.id;
          return (
            <div key={c.id}>
              <div
                onClick={() => setExpandedContact(isExpanded ? null : c.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.2fr 90px 90px 40px",
                  gap: 0,
                  padding: "7px 12px",
                  cursor: "pointer",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,.03)",
                  background: overdue
                    ? "rgba(245,158,11,.03)"
                    : isExpanded
                      ? "rgba(88,0,229,.04)"
                      : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!isExpanded)
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.02)";
                }}
                onMouseLeave={(e) => {
                  if (!isExpanded)
                    (e.currentTarget as HTMLElement).style.background = overdue
                      ? "rgba(245,158,11,.03)"
                      : "transparent";
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name}
                    {overdue && (
                      <span style={{ marginLeft: 6, fontSize: 9, color: "rgba(253,230,138,.8)" }}>
                        overdue
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      opacity: 0.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.company}
                  </div>
                </div>
                <span style={{ fontSize: 10, opacity: 0.45, fontFamily: "monospace" }}>
                  {c.category.replace(/_/g, " ")}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    padding: "2px 7px",
                    borderRadius: 999,
                    fontWeight: 700,
                    background: STATUS_BG[c.status],
                    color: sColor,
                    border: `1px solid ${sColor}33`,
                    justifySelf: "start",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.status.replace("_", " ")}
                </span>
                <div onClick={(e) => e.stopPropagation()}>
                  {c.status === "LEAD" && (
                    <button
                      style={{ ...S.btnPri, fontSize: 9, padding: "2px 7px" }}
                      onClick={() => quickStatus(c.id, "CONTACTED")}
                    >
                      Contacted
                    </button>
                  )}
                  {c.status === "CONTACTED" && (
                    <button
                      style={{ ...S.success, fontSize: 9, padding: "2px 7px" }}
                      onClick={() => quickStatus(c.id, "REPLIED")}
                    >
                      Replied
                    </button>
                  )}
                  {c.status === "REPLIED" && (
                    <button
                      style={{ ...S.btnPri, fontSize: 9, padding: "2px 7px" }}
                      onClick={() => quickStatus(c.id, "IN_PROGRESS")}
                    >
                      In Progress
                    </button>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    opacity: 0.2,
                    textAlign: "center",
                    transform: isExpanded ? "rotate(90deg)" : "none",
                    transition: "transform .15s",
                  }}
                >
                  &#9654;
                </span>
              </div>

              {isExpanded && (
                <div
                  style={{
                    padding: "10px 12px 12px",
                    background: "rgba(88,0,229,.03)",
                    borderBottom: "1px solid rgba(88,0,229,.12)",
                    display: "flex",
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {c.email && (
                      <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 3 }}>
                        Email: {c.email}
                      </div>
                    )}
                    {c.role && (
                      <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 3 }}>
                        Role: {c.role}
                      </div>
                    )}
                    {c.contactInfo && (
                      <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 3 }}>
                        Contact: {c.contactInfo}
                      </div>
                    )}
                    {c.lastContact && (
                      <div style={{ fontSize: 11, opacity: 0.4, marginBottom: 3 }}>
                        Last contact: {new Date(c.lastContact).toLocaleDateString()}
                      </div>
                    )}
                    {c.nextFollowUp && (
                      <div
                        style={{
                          fontSize: 11,
                          color: overdue ? "rgba(253,230,138,.8)" : "rgba(255,255,255,.4)",
                          marginBottom: 3,
                        }}
                      >
                        Follow-up: {new Date(c.nextFollowUp).toLocaleDateString()}
                        {overdue ? " (overdue)" : ""}
                      </div>
                    )}
                    {c.postUrl && (
                      <div style={{ fontSize: 11, marginBottom: 3 }}>
                        <span style={{ opacity: 0.4 }}>Post: </span>
                        <a
                          href={c.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "rgba(96,165,250,.8)", textDecoration: "none" }}
                        >
                          {c.postUrl.length > 60 ? c.postUrl.slice(0, 60) + "..." : c.postUrl}
                        </a>
                      </div>
                    )}
                    {c.notes && (
                      <div
                        style={{
                          fontSize: 11,
                          opacity: 0.4,
                          marginTop: 6,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.5,
                        }}
                      >
                        {c.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    <button
                      style={{ ...S.btn, fontSize: 10, padding: "4px 10px" }}
                      onClick={() => editContact(c)}
                    >
                      Edit
                    </button>
                    <button
                      style={{ ...S.danger, fontSize: 10, padding: "4px 10px" }}
                      onClick={() => {
                        remove(c.id);
                        setExpandedContact(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {contacts.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, opacity: 0.35, fontSize: 13 }}>
            No outreach contacts yet. Add your first one above.
          </div>
        )}
        {contacts.length > 0 && displayContacts.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, opacity: 0.35, fontSize: 13 }}>
            No contacts match your search.
          </div>
        )}
      </div>
    </div>
  );
}
