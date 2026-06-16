"use client";
import { useState, useEffect } from "react";
import { S, apiFetch, fmtDate } from "./shared";

export function JoinRequestsTab({ lobbyId }: { lobbyId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/join-requests`);
    if (j.ok) setRequests(j.requests || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [lobbyId]);

  async function act(reqId: string, action: "approve" | "deny", reason?: string) {
    setActing(reqId);
    const body: any = {};
    if (reason) body.reason = reason;
    await apiFetch(
      `/lobbies/${encodeURIComponent(lobbyId)}/admin/join-requests/${reqId}/${action}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    setActing(null);
    load();
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const reviewed = requests.filter((r) => r.status !== "PENDING");

  if (loading) return <div style={{ padding: 20, opacity: 0.4, fontSize: 12 }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ ...S.label, marginBottom: 12 }}>PENDING REQUESTS ({pending.length})</div>
      {pending.length === 0 && (
        <div style={{ padding: "16px 0", fontSize: 12, opacity: 0.4 }}>No pending requests.</div>
      )}
      {pending.map((r) => (
        <div
          key={r.id}
          style={{
            ...S.card,
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.9)" }}>
              {r.userName}
            </div>
            {r.message && (
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(148,163,184,.55)",
                  marginTop: 3,
                  fontStyle: "italic",
                }}
              >
                "{r.message}"
              </div>
            )}
            <div style={{ fontSize: 10, opacity: 0.35, marginTop: 3 }}>{fmtDate(r.createdAt)}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              style={{ ...S.btnPri, padding: "5px 14px", fontSize: 11 }}
              onClick={() => act(r.id, "approve")}
              disabled={acting === r.id}
            >
              Approve
            </button>
            <button
              style={{
                ...S.btn,
                padding: "5px 14px",
                fontSize: 11,
                borderColor: "rgba(239,68,68,.2)",
                color: "rgba(239,68,68,.7)",
              }}
              onClick={() => {
                const reason = prompt("Deny reason (optional):");
                act(r.id, "deny", reason || undefined);
              }}
              disabled={acting === r.id}
            >
              Deny
            </button>
          </div>
        </div>
      ))}

      {reviewed.length > 0 && (
        <>
          <div style={{ ...S.label, marginTop: 24, marginBottom: 12 }}>
            REVIEWED ({reviewed.length})
          </div>
          {reviewed.map((r) => (
            <div
              key={r.id}
              style={{
                ...S.card,
                marginBottom: 6,
                opacity: 0.6,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{r.userName}</div>
                <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>
                  {r.status === "APPROVED" ? "Approved" : "Denied"}
                  {r.reviewedByName ? ` by ${r.reviewedByName}` : ""} ·{" "}
                  {fmtDate(r.reviewedAt || r.createdAt)}
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 4,
                  color: r.status === "APPROVED" ? "#22C55E" : "#EF4444",
                  background: r.status === "APPROVED" ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)",
                }}
              >
                {r.status}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
