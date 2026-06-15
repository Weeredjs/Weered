"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWeered } from "../../../components/WeeredProvider";
import { apiFetch } from "../../../lib/api";
import { weeredToast } from "../../../lib/toast";

export default function ModQueuePageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }} />}>
      <ModQueuePage />
    </Suspense>
  );
}

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const REASON_LABELS: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  HATE_SPEECH: "Hate speech",
  NSFW: "NSFW",
  MISINFORMATION: "Misinformation",
  OFF_TOPIC: "Off-topic",
  OTHER: "Other",
};
const STATUSES = ["PENDING", "REVIEWED", "ACTIONED", "DISMISSED"];

type Report = {
  id: string;
  postId: string | null;
  commentId: string | null;
  reporterId: string;
  reporterName: string;
  reason: string;
  detail: string;
  status: string;
  actionTaken: string | null;
  reviewedAt: string | null;
  createdAt: string;
  post: {
    id: string;
    title: string;
    body: string;
    authorName: string;
    lobbyId: string | null;
    removedAt: string | null;
    locked: boolean;
  } | null;
  comment: {
    id: string;
    postId: string;
    body: string;
    authorName: string;
    removedAt: string | null;
  } | null;
};

function ModQueuePage() {
  const router = useRouter();
  const search = useSearchParams();
  const w: any = useWeered();
  const me = w?.me;

  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [lobbyId, setLobbyId] = useState(search?.get("lobbyId") || "");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    const params = new URLSearchParams();
    params.set("status", status);
    if (lobbyId) params.set("lobbyId", lobbyId);
    params.set("limit", "100");
    const data = await apiFetch(`/forum/reports?${params.toString()}`, { silent: true });
    if (data?.ok) setReports(data.reports || []);
    else if (data?.error === "forbidden") setForbidden(true);
    setLoading(false);
  }, [status, lobbyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function transition(reportId: string, newStatus: string, actionTaken?: string) {
    const data = await apiFetch(`/forum/reports/${reportId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus, actionTaken }),
    });
    if (data?.ok) {
      weeredToast.success(`Report ${newStatus.toLowerCase()}`);
      load();
    }
  }

  async function removeTarget(r: Report) {
    const reason =
      window.prompt("Removal reason:", `Report: ${REASON_LABELS[r.reason] || r.reason}`) || "";
    if (r.postId) {
      const d = await apiFetch(`/forum/posts/${r.postId}/remove`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (d?.ok) await transition(r.id, "ACTIONED", `Post removed: ${reason}`);
    } else if (r.commentId) {
      const d = await apiFetch(`/forum/comments/${r.commentId}/remove`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (d?.ok) await transition(r.id, "ACTIONED", `Comment removed: ${reason}`);
    }
  }

  async function lockThread(r: Report) {
    if (!r.postId) return;
    const d = await apiFetch(`/forum/posts/${r.postId}/lock`, {
      method: "POST",
      body: JSON.stringify({ reason: REASON_LABELS[r.reason] || "" }),
    });
    if (d?.ok) await transition(r.id, "ACTIONED", "Thread locked");
  }

  if (!me) {
    return (
      <div style={{ padding: 40, fontFamily: FONT, color: "rgba(243,244,246,.7)" }}>
        Sign in to access the mod queue.
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "20px 16px 60px",
        fontFamily: FONT,
        color: "rgba(243,244,246,.92)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: "-0.3px" }}>
            Mod Queue
          </h1>
          <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>
            Review reported posts and comments. Take action fast.
          </div>
        </div>
        <button
          onClick={() => router.push("/forum")}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.1)",
            color: "rgba(167,139,250,.8)",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          &larr; Forum
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 2,
            background: "rgba(255,255,255,.04)",
            borderRadius: 8,
            padding: 2,
          }}
        >
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "none",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                background: status === s ? "rgba(255,255,255,.08)" : "transparent",
                color: status === s ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.4)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          value={lobbyId}
          onChange={(e) => setLobbyId(e.target.value)}
          placeholder="Filter by lobbyId (optional)"
          style={{
            flex: 1,
            minWidth: 220,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.1)",
            background: "rgba(0,0,0,.25)",
            color: "rgba(243,244,246,.9)",
            fontSize: 12,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          onClick={load}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: "1px solid rgba(124,58,237,.4)",
            background: "rgba(124,58,237,.18)",
            color: "#c4b5fd",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Refresh
        </button>
      </div>

      {forbidden && (
        <div
          style={{
            padding: 24,
            borderRadius: 10,
            background: "rgba(239,68,68,.06)",
            border: "1px solid rgba(239,68,68,.2)",
            color: "rgba(252,165,165,.85)",
            fontSize: 13,
          }}
        >
          You don't have mod permissions for this view.{" "}
          {lobbyId
            ? "Verify the lobby id and your role."
            : "Set a lobby id you moderate, or sign in as staff."}
        </div>
      )}

      {!forbidden && loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{ height: 96, borderRadius: 10, background: "rgba(255,255,255,.03)" }}
            />
          ))}
        </div>
      )}

      {!forbidden && !loading && reports.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(148,163,184,.55)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(243,244,246,.65)" }}>
            Queue is clear.
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>No {status.toLowerCase()} reports.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {reports.map((r) => {
          const target =
            r.post ||
            ((r.comment
              ? {
                  title: "(comment)",
                  body: r.comment.body,
                  authorName: r.comment.authorName,
                  removedAt: r.comment.removedAt,
                }
              : null) as any);
          const targetType = r.postId ? "post" : "comment";
          const linkPostId = r.postId || r.comment?.postId || "";
          return (
            <div
              key={r.id}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(255,255,255,.025)",
                border: `1px solid ${target?.removedAt ? "rgba(239,68,68,.25)" : "rgba(255,255,255,.06)"}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: "rgba(239,68,68,.14)",
                    color: "#fca5a5",
                    letterSpacing: ".5px",
                  }}
                >
                  {REASON_LABELS[r.reason] || r.reason}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: "rgba(255,255,255,.06)",
                    color: "rgba(255,255,255,.6)",
                    textTransform: "uppercase",
                  }}
                >
                  {targetType}
                </span>
                {target?.removedAt && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: "rgba(239,68,68,.18)",
                      color: "#fca5a5",
                    }}
                  >
                    removed
                  </span>
                )}
                {r.post?.locked && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: "rgba(245,158,11,.16)",
                      color: "#fde68a",
                    }}
                  >
                    locked
                  </span>
                )}
                <span style={{ fontSize: 10, opacity: 0.4, marginLeft: "auto" }}>
                  by {r.reporterName} &middot; {timeAgo(r.createdAt)}
                </span>
              </div>
              {r.post?.title && (
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{r.post.title}</div>
              )}
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(229,231,235,.65)",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 90,
                  overflow: "hidden",
                }}
              >
                {target?.body || "(target deleted)"}
              </div>
              {r.detail && (
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(167,139,250,.7)",
                    marginTop: 8,
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: "rgba(124,58,237,.06)",
                    borderLeft: "2px solid rgba(124,58,237,.4)",
                  }}
                >
                  Reporter note: {r.detail}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {linkPostId && (
                  <button onClick={() => router.push(`/forum/${linkPostId}`)} style={btnStyle()}>
                    View thread
                  </button>
                )}
                {r.status === "PENDING" && (
                  <>
                    <button onClick={() => removeTarget(r)} style={btnStyle("danger")}>
                      Remove {targetType}
                    </button>
                    {r.postId && (
                      <button onClick={() => lockThread(r)} style={btnStyle()}>
                        Lock thread
                      </button>
                    )}
                    <button
                      onClick={() => transition(r.id, "DISMISSED", "No action needed")}
                      style={btnStyle()}
                    >
                      Dismiss
                    </button>
                    <button onClick={() => transition(r.id, "REVIEWED")} style={btnStyle()}>
                      Mark reviewed
                    </button>
                  </>
                )}
                {r.status !== "PENDING" && (
                  <span style={{ fontSize: 10, opacity: 0.5 }}>
                    {r.status} &middot; {r.actionTaken || "no note"}{" "}
                    {r.reviewedAt ? `(${timeAgo(r.reviewedAt)})` : ""}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function btnStyle(variant?: "danger"): React.CSSProperties {
  if (variant === "danger")
    return {
      padding: "5px 12px",
      borderRadius: 7,
      border: "1px solid rgba(239,68,68,.3)",
      background: "rgba(239,68,68,.1)",
      color: "rgba(252,165,165,.95)",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
    };
  return {
    padding: "5px 12px",
    borderRadius: 7,
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(243,244,246,.85)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "just now";
    const m = Math.floor(diff / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch {
    return "";
  }
}
