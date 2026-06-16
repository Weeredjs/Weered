"use client";
import { BugRow } from "./AppealsTab";
import { useState, useEffect } from "react";
import { S, apiFetch } from "./shared";

export const CATEGORY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  BUG: { label: "BUG", color: "rgb(252,165,165)", bg: "rgba(239,68,68,0.10)" },
  LOBBY_MODULE_REQUEST: { label: "MODULE", color: "rgb(216,180,254)", bg: "rgba(124,58,237,0.10)" },
  FEEDBACK: { label: "FEEDBACK", color: "rgb(252,211,77)", bg: "rgba(245,158,11,0.10)" },
};

export function BugsTab() {
  const [rows, setRows] = useState<BugRow[]>([]);
  const [filter, setFilter] = useState<"OPEN" | "ALL">("OPEN");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [noteFor, setNoteFor] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const j = await apiFetch(`/staff/bugs?status=${filter}`);
    setLoading(false);
    if (j.ok) setRows(j.rows || []);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function close(id: string) {
    const note = (noteFor[id] || "").trim();
    const j = await apiFetch(`/staff/bugs/${encodeURIComponent(id)}/close`, {
      method: "POST",
      body: JSON.stringify({ note }),
    });
    if (j.ok) {
      setMsg("Closed.");
      setNoteFor((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      load();
    } else setMsg(j.message || j.error || "Failed.");
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {(["OPEN", "ALL"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.10)",
                background: filter === f ? "rgba(124,58,237,.20)" : "transparent",
                color: filter === f ? "rgba(216,180,254,.95)" : "rgba(148,163,184,.7)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}
      </div>

      {loading && (
        <div style={{ opacity: 0.5, fontSize: 13, padding: 30, textAlign: "center" }}>Loading…</div>
      )}
      {!loading && rows.length === 0 && (
        <div style={{ opacity: 0.4, fontSize: 13, padding: 40, textAlign: "center" }}>
          {filter === "OPEN" ? "No open bug reports." : "Nothing here."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ ...S.card, padding: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                {(() => {
                  const c = CATEGORY_BADGE[r.category] || CATEGORY_BADGE.BUG;
                  return (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: 1.2,
                        padding: "2px 8px",
                        borderRadius: 4,
                        color: c.color,
                        background: c.bg,
                        border: `1px solid ${c.color.replace("rgb", "rgba").replace(")", ",0.25)")}`,
                      }}
                    >
                      {c.label}
                    </span>
                  );
                })()}
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: r.user ? "rgba(216,180,254,.85)" : "rgba(148,163,184,.5)",
                    fontWeight: 700,
                  }}
                >
                  {r.user?.name || "anonymous"}
                </span>
                {r.page && (
                  <span style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.55 }}>
                    {r.page}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                {new Date(r.createdAt).toLocaleString()}
              </div>
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: "rgba(243,244,246,0.92)",
                whiteSpace: "pre-wrap",
                padding: "10px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
                marginBottom: 10,
              }}
            >
              {r.body}
            </div>
            {r.userAgent && (
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: "rgba(148,163,184,0.45)",
                  marginBottom: 10,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.userAgent}
              </div>
            )}
            {r.status === "OPEN" ? (
              <>
                <input
                  value={noteFor[r.id] || ""}
                  onChange={(e) => setNoteFor((p) => ({ ...p, [r.id]: e.target.value }))}
                  placeholder="Optional internal note"
                  style={{ ...S.input, marginBottom: 8 }}
                />
                <button onClick={() => close(r.id)} style={{ ...S.btnPri, padding: "8px 18px" }}>
                  Mark Closed
                </button>
              </>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                <span style={{ fontWeight: 700, color: "rgb(148,163,184)" }}>CLOSED</span>
                {r.closedAt && (
                  <span style={{ marginLeft: 8 }}>{new Date(r.closedAt).toLocaleString()}</span>
                )}
                {r.staffNote && (
                  <div style={{ marginTop: 6, fontStyle: "italic" }}>note: {r.staffNote}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
