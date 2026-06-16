"use client";
import { useState, useEffect } from "react";
import { S, apiFetch } from "./shared";

export const REASON_LABELS: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  HATE_SPEECH: "Hate speech",
  THREATS: "Threats",
  NSFW: "NSFW",
  MINOR_SAFETY: "Minor safety",
  IMPERSONATION: "Impersonation",
  SELF_HARM: "Self-harm",
  OTHER: "Other",
};

export type AppealRow = {
  id: string;
  userId: string;
  reason: string;
  status: string;
  createdAt: string;
  reviewerNote: string | null;
  reviewedAt: string | null;
  user: {
    id: string;
    name: string;
    banReason: string | null;
    bannedAt: string | null;
    bannedBy: string | null;
  };
};

export function AppealsTab() {
  const [rows, setRows] = useState<AppealRow[]>([]);
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [noteFor, setNoteFor] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const j = await apiFetch(`/staff/ban-appeals?status=${filter}`);
    setLoading(false);
    if (j.ok) setRows(j.rows || []);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function review(id: string, decision: "APPROVED" | "DENIED") {
    const note = (noteFor[id] || "").trim();
    const j = await apiFetch(`/staff/ban-appeals/${encodeURIComponent(id)}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    });
    if (j.ok) {
      setMsg(decision === "APPROVED" ? "Approved — user unbanned." : "Denied.");
      setNoteFor((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      load();
    } else {
      setMsg(j.message || j.error || "Failed.");
    }
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
          {(["PENDING", "ALL"] as const).map((f) => (
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
          {filter === "PENDING" ? "No pending appeals. Calm waters." : "Nothing here."}
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
              <div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{r.user.name}</span>
                <span
                  style={{ marginLeft: 10, fontSize: 11, opacity: 0.5, fontFamily: "monospace" }}
                >
                  {r.user.id.slice(-8)}
                </span>
              </div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                {new Date(r.createdAt).toLocaleString()}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ ...S.label, marginBottom: 4 }}>original ban reason</div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(252,165,165,0.85)",
                  padding: "8px 12px",
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.15)",
                  borderRadius: 6,
                }}
              >
                {r.user.banReason || (
                  <span style={{ opacity: 0.5, fontStyle: "italic" }}>none recorded</span>
                )}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...S.label, marginBottom: 4 }}>their appeal</div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "rgba(243,244,246,0.9)",
                  whiteSpace: "pre-wrap",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 6,
                }}
              >
                {r.reason}
              </div>
            </div>
            {r.status === "PENDING" ? (
              <>
                <input
                  value={noteFor[r.id] || ""}
                  onChange={(e) => setNoteFor((p) => ({ ...p, [r.id]: e.target.value }))}
                  placeholder="Optional note (shown to user with the decision)"
                  style={{ ...S.input, marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => review(r.id, "APPROVED")}
                    style={{
                      ...S.btnPri,
                      padding: "8px 18px",
                      background: "rgba(34,197,94,0.20)",
                      border: "1px solid rgba(34,197,94,0.40)",
                    }}
                  >
                    Approve · Unban
                  </button>
                  <button
                    onClick={() => review(r.id, "DENIED")}
                    style={{ ...S.danger, padding: "8px 18px" }}
                  >
                    Deny
                  </button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.6, padding: "8px 0" }}>
                <span
                  style={{
                    fontWeight: 700,
                    color: r.status === "APPROVED" ? "rgb(110,231,183)" : "rgb(252,165,165)",
                  }}
                >
                  {r.status}
                </span>
                {r.reviewedAt && (
                  <span style={{ marginLeft: 8 }}>{new Date(r.reviewedAt).toLocaleString()}</span>
                )}
                {r.reviewerNote && (
                  <div style={{ marginTop: 6, fontStyle: "italic" }}>note: {r.reviewerNote}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export type BugRow = {
  id: string;
  userId: string | null;
  category: string;
  page: string;
  userAgent: string;
  body: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
  staffNote: string | null;
  user: { id: string; name: string } | null;
};
