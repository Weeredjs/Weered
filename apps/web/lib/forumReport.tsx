"use client";

import React from "react";
import { createRoot, Root } from "react-dom/client";
import { apiFetch } from "./api";
import { weeredToast } from "./toast";

const FORUM_REASONS: { id: string; label: string; hint: string }[] = [
  { id: "SPAM", label: "Spam", hint: "Repeated posts, links, advertising." },
  { id: "HARASSMENT", label: "Harassment", hint: "Targeted abuse, bullying, stalking." },
  { id: "HATE_SPEECH", label: "Hate speech", hint: "Attacks based on identity or group." },
  { id: "NSFW", label: "NSFW / explicit", hint: "Adult content in a non-NSFW context." },
  { id: "MISINFORMATION", label: "Misinformation", hint: "Knowingly false or misleading claims." },
  { id: "OFF_TOPIC", label: "Off-topic", hint: "Doesn't fit this forum or section." },
  { id: "OTHER", label: "Other", hint: "Something else - add context in the note." },
];

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;
function cleanup() {
  try { activeRoot?.unmount(); } catch {}
  try { if (activeContainer && activeContainer.parentNode) activeContainer.parentNode.removeChild(activeContainer); } catch {}
  activeRoot = null;
  activeContainer = null;
}

export function weeredForumReport(opts: { postId?: string; commentId?: string }): Promise<{ ok: boolean; error?: string } | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise(resolve => {
    cleanup();
    const container = document.createElement("div");
    container.setAttribute("data-weered-forum-report", "1");
    document.body.appendChild(container);
    const root = createRoot(container);
    activeRoot = root; activeContainer = container;

    function finish(result: { ok: boolean; error?: string } | null) {
      cleanup();
      resolve(result);
    }

    root.render(<ForumReportDialog {...opts} onDone={finish} />);
  });
}

function ForumReportDialog({ postId, commentId, onDone }: { postId?: string; commentId?: string; onDone: (r: { ok: boolean; error?: string } | null) => void }) {
  const [reason, setReason] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !submitting) onDone(null); }
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); };
  }, [onDone, submitting]);

  async function submit() {
    if (!reason || submitting) return;
    setSubmitting(true);
    const body: any = { reason, detail: detail.trim() || undefined };
    if (postId) body.postId = postId; else if (commentId) body.commentId = commentId;
    const j = await apiFetch("/forum/reports", { method: "POST", body: JSON.stringify(body) });
    if (j?.ok) {
      weeredToast.success("Reported. Mods will review.");
      onDone({ ok: true });
    } else {
      onDone({ ok: false, error: j?.error || "submit_failed" });
    }
  }

  return (
    <div role="dialog" aria-modal="true" onClick={() => !submitting && onDone(null)} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 10002, padding: 20,
      opacity: visible ? 1 : 0, transition: "opacity 0.18s cubic-bezier(0.22,1,0.36,1)",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 440,
        background: "rgba(20,18,16,0.96)",
        border: "1px solid rgba(148,163,184,0.28)",
        borderRadius: 14,
        padding: "22px 22px 18px",
        boxShadow: "0 24px 72px rgba(0,0,0,0.55)",
        transform: visible ? "scale(1) translateY(0)" : "scale(0.96) translateY(8px)",
        transition: "transform 0.22s cubic-bezier(0.22,1,0.36,1)",
        fontFamily: "inherit", color: "rgba(243,244,246,.95)",
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Report this {commentId ? "comment" : "post"}.</div>
        <div style={{ fontSize: 12, color: "rgba(148,163,184,.7)", marginBottom: 14 }}>
          Pick what's wrong. Mods will review.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto", marginBottom: 12 }}>
          {FORUM_REASONS.map(r => (
            <button key={r.id} type="button" onClick={() => setReason(r.id)} style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
              padding: "8px 12px", borderRadius: 8, textAlign: "left",
              border: reason === r.id ? "1px solid rgba(124,58,237,.5)" : "1px solid rgba(255,255,255,.06)",
              background: reason === r.id ? "rgba(124,58,237,.14)" : "transparent",
              color: reason === r.id ? "#c4b5fd" : "rgba(243,244,246,.9)",
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
            }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{r.label}</span>
              <span style={{ fontSize: 11, color: "rgba(148,163,184,.65)" }}>{r.hint}</span>
            </button>
          ))}
        </div>
        <textarea placeholder="Optional: extra context" value={detail} onChange={e => setDetail(e.target.value)} maxLength={1000} rows={3} style={{
          width: "100%", resize: "vertical", padding: "8px 12px",
          borderRadius: 8, border: "1px solid rgba(255,255,255,.1)",
          background: "rgba(0,0,0,.25)", color: "rgba(243,244,246,.95)",
          fontFamily: "inherit", fontSize: 13, outline: "none", marginBottom: 12, boxSizing: "border-box",
        }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => onDone(null)} disabled={submitting} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(148,163,184,.2)", background: "transparent", color: "rgba(148,163,184,.8)", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: submitting ? "default" : "pointer" }}>Cancel</button>
          <button type="button" onClick={submit} disabled={!reason || submitting} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.45)", background: "rgba(239,68,68,0.16)", color: "rgba(252,165,165,.95)", fontSize: 12, fontWeight: 800, fontFamily: "inherit", cursor: (!reason || submitting) ? "not-allowed" : "pointer", opacity: (!reason || submitting) ? 0.5 : 1 }}>
            {submitting ? "Submitting..." : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}
